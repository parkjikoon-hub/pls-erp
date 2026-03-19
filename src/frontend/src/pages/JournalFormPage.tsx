/**
 * M4 재무/회계 — 전표 입력/수정 페이지
 * 동적 분개 라인 + 계정과목 검색 드롭다운 + 차대변 실시간 합계
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  fetchJournal,
  createJournal,
  updateJournal,
  fetchNextEntryNo,
  type JournalLineInput,
} from '../api/finance/journals';
import {
  searchAccounts,
  type AccountSearchResult,
} from '../api/finance/accounts';
import { useAuthStore } from '../stores/authStore';

// 전표 유형
const ENTRY_TYPES = [
  { value: 'sales', label: '매출' },
  { value: 'purchase', label: '매입' },
  { value: 'expense', label: '경비' },
  { value: 'payroll', label: '급여' },
  { value: 'general', label: '일반' },
  { value: 'adjustment', label: '수정' },
];

// 분개 라인 기본값
interface LineRow {
  key: string; // React key용
  account_id: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
}

function emptyLine(): LineRow {
  return {
    key: crypto.randomUUID(),
    account_id: '',
    account_code: '',
    account_name: '',
    debit_amount: 0,
    credit_amount: 0,
    description: '',
  };
}

// 금액 포맷
function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

export default function JournalFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id) && id !== 'new';
  const { user } = useAuthStore();

  // 헤더 상태
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryType, setEntryType] = useState('general');
  const [description, setDescription] = useState('');
  const [nextEntryNo, setNextEntryNo] = useState('');

  // 분개 라인 상태
  const [lines, setLines] = useState<LineRow[]>([emptyLine(), emptyLine()]);

  // 계정과목 검색
  const [searchLineIdx, setSearchLineIdx] = useState<number | null>(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [accountResults, setAccountResults] = useState<AccountSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 폼 상태
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 다음 전표번호 미리보기
  useEffect(() => {
    if (!isEdit && entryDate) {
      fetchNextEntryNo(entryDate).then(setNextEntryNo).catch(() => {});
    }
  }, [entryDate, isEdit]);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    fetchJournal(id)
      .then((journal) => {
        setEntryDate(journal.entry_date);
        setEntryType(journal.entry_type);
        setDescription(journal.description || '');
        setLines(
          journal.lines.map((l) => ({
            key: crypto.randomUUID(),
            account_id: l.account_id,
            account_code: l.account_code || '',
            account_name: l.account_name || '',
            debit_amount: l.debit_amount,
            credit_amount: l.credit_amount,
            description: l.description || '',
          }))
        );
      })
      .catch(() => showToast('error', '전표를 불러올 수 없습니다'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // 계정과목 검색 디바운스
  useEffect(() => {
    if (!accountQuery || searchLineIdx === null) {
      setAccountResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchAccounts(accountQuery, 15);
        setAccountResults(results);
        setShowDropdown(true);
      } catch {
        setAccountResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [accountQuery, searchLineIdx]);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearchLineIdx(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 차대변 합계 (실시간)
  const totals = useMemo(() => {
    const totalDebit = lines.reduce((s, l) => s + (l.debit_amount || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit_amount || 0), 0);
    return { totalDebit, totalCredit, diff: totalDebit - totalCredit };
  }, [lines]);

  const isBalanced = Math.abs(totals.diff) < 1;
  const hasAmount = totals.totalDebit > 0;
  const allLinesHaveAccount = lines.every((l) => l.account_id);

  // 라인 수정
  const updateLine = useCallback((idx: number, field: keyof LineRow, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  // 라인 추가
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  // 라인 삭제
  const removeLine = (idx: number) => {
    if (lines.length <= 2) return; // 최소 2줄 유지
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // 계정과목 선택
  const selectAccount = (idx: number, account: AccountSearchResult) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
      };
      return next;
    });
    setShowDropdown(false);
    setSearchLineIdx(null);
    setAccountQuery('');
  };

  // 저장
  const handleSave = async () => {
    if (!isBalanced) {
      showToast('error', '차변과 대변 합계가 일치하지 않습니다');
      return;
    }
    if (!hasAmount) {
      showToast('error', '금액을 입력해주세요');
      return;
    }
    if (!allLinesHaveAccount) {
      showToast('error', '모든 라인에 계정과목을 선택해주세요');
      return;
    }

    const payload = {
      entry_date: entryDate,
      entry_type: entryType,
      description: description || undefined,
      lines: lines.map((l): JournalLineInput => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount || 0,
        credit_amount: l.credit_amount || 0,
        description: l.description || undefined,
      })),
    };

    setSaving(true);
    try {
      if (isEdit && id) {
        await updateJournal(id, payload);
        showToast('success', '전표가 수정되었습니다');
      } else {
        await createJournal(payload);
        showToast('success', '전표가 등록되었습니다');
      }
      setTimeout(() => navigate('/finance/journals'), 800);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '저장에 실패했습니다';
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400">불러오는 중...</div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '전표 수정' : '전표 등록'}
          </h1>
          {!isEdit && nextEntryNo && (
            <p className="text-sm text-gray-500 mt-0.5">
              예상 전표번호: <span className="font-mono">{nextEntryNo}</span>
            </p>
          )}
        </div>
      </div>

      {/* 전표 헤더 입력 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전표일자 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전표유형 <span className="text-red-500">*</span>
            </label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">적요</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="전표 설명 입력"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* 분개 라인 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">분개 라인</h2>
          <button
            onClick={addLine}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            행 추가
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-8">#</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 min-w-[200px]">계정과목</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-600 w-36">차변</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-600 w-36">대변</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">적요</th>
              <th className="px-4 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-400 text-sm">{idx + 1}</td>

                {/* 계정과목 검색 */}
                <td className="px-4 py-2 relative">
                  {line.account_id ? (
                    <button
                      onClick={() => {
                        setSearchLineIdx(idx);
                        setAccountQuery('');
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded border border-gray-200 hover:border-amber-400 text-sm bg-gray-50"
                    >
                      <span className="font-mono text-sm text-gray-500 mr-1">{line.account_code}</span>
                      {line.account_name}
                    </button>
                  ) : (
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="계정과목 검색..."
                        value={searchLineIdx === idx ? accountQuery : ''}
                        onFocus={() => setSearchLineIdx(idx)}
                        onChange={(e) => {
                          setSearchLineIdx(idx);
                          setAccountQuery(e.target.value);
                        }}
                        className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  )}

                  {/* 드롭다운 */}
                  {showDropdown && searchLineIdx === idx && accountResults.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-50 top-full left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      {accountResults.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => selectAccount(idx, acc)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 border-b border-gray-50 last:border-b-0"
                        >
                          <span className="font-mono text-sm text-gray-500 mr-2">{acc.code}</span>
                          <span>{acc.name}</span>
                          <span className="ml-2 text-sm text-gray-400">
                            ({acc.account_type === 'asset' ? '자산' :
                              acc.account_type === 'liability' ? '부채' :
                              acc.account_type === 'equity' ? '자본' :
                              acc.account_type === 'revenue' ? '수익' : '비용'})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </td>

                {/* 차변 */}
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    value={line.debit_amount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateLine(idx, 'debit_amount', val);
                      if (val > 0) updateLine(idx, 'credit_amount', 0);
                    }}
                    placeholder="0"
                    className="w-full text-right px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                </td>

                {/* 대변 */}
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    value={line.credit_amount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateLine(idx, 'credit_amount', val);
                      if (val > 0) updateLine(idx, 'debit_amount', 0);
                    }}
                    placeholder="0"
                    className="w-full text-right px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                </td>

                {/* 적요 */}
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(idx, 'description', e.target.value)}
                    placeholder="라인 적요"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </td>

                {/* 삭제 */}
                <td className="px-4 py-2">
                  {lines.length > 2 && (
                    <button
                      onClick={() => removeLine(idx)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 합계 바 */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm text-gray-600">
              차변 합계: <strong className="font-mono">{formatAmount(totals.totalDebit)}</strong>
            </span>
            <span className="text-sm text-gray-600">
              대변 합계: <strong className="font-mono">{formatAmount(totals.totalCredit)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isBalanced && hasAmount ? (
              <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <CheckCircleIcon className="w-4 h-4" />
                차대변 일치
              </span>
            ) : hasAmount ? (
              <span className="flex items-center gap-1 text-sm text-red-500 font-medium">
                <ExclamationTriangleIcon className="w-4 h-4" />
                차이: {formatAmount(Math.abs(totals.diff))}
              </span>
            ) : (
              <span className="text-sm text-gray-400">금액을 입력해주세요</span>
            )}
          </div>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/finance/journals')}
          className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !isBalanced || !hasAmount || !allLinesHaveAccount}
          className="px-5 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium shadow-sm transition"
        >
          {saving ? '저장 중...' : isEdit ? '수정 저장' : '임시 저장'}
        </button>
      </div>
    </div>
  );
}
