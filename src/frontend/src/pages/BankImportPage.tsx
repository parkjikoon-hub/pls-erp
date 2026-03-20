/**
 * M4 재무/회계 — 은행 입금 내역 가져오기
 * CSV 업로드 → 파싱 미리보기 → 전표 자동 생성
 */
import { useState, useEffect, useRef } from 'react';
import {
  parseBankCSV,
  confirmImport,
  getImportHistory,
  getMappings,
  createMapping,
  deleteMapping,
  getBankAccounts,
  createBankAccount,
  deleteBankAccount,
  type ParsedTransaction,
  type ConfirmTransaction,
  type ImportHistory,
  type AccountMapping,
  type CompanyBankAccount,
} from '../api/finance/bankImport';
import { searchAccounts, type AccountSearchResult } from '../api/finance/accounts';

const BANKS = [
  { code: 'shinhan', name: '신한은행' },
  { code: 'ibk', name: '기업은행(IBK)' },
  { code: 'kb', name: '국민은행(KB)' },
  { code: 'woori', name: '우리은행' },
  { code: 'hana', name: '하나은행' },
  { code: 'other', name: '기타 은행' },
];

export default function BankImportPage() {
  /* ── 상태 ── */
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);

  /* 회사 계좌 */
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [showAccountMgmt, setShowAccountMgmt] = useState(false);
  const [newAccBankCode, setNewAccBankCode] = useState('shinhan');
  const [newAccNo, setNewAccNo] = useState('');
  const [newAccHolder, setNewAccHolder] = useState('');
  const [newAccType, setNewAccType] = useState('보통예금');
  const [newAccChartId, setNewAccChartId] = useState('');
  const [newAccChartSearch, setNewAccChartSearch] = useState('');
  const [newAccChartResults, setNewAccChartResults] = useState<AccountSearchResult[]>([]);
  const [newAccPrimary, setNewAccPrimary] = useState(false);

  /* 이력 */
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  /* 매핑 규칙 */
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [showMappings, setShowMappings] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<AccountSearchResult[]>([]);

  /* 계정과목 선택 (거래 행에서) */
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [rowAccountSearch, setRowAccountSearch] = useState('');
  const [rowAccountResults, setRowAccountResults] = useState<AccountSearchResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    loadBankAccounts();
    loadHistory();
    loadMappings();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const data = await getBankAccounts();
      setBankAccounts(data || []);
      // 기본 계좌 자동 선택
      const primary = (data || []).find((a: CompanyBankAccount) => a.is_primary);
      if (primary && !selectedAccountId) setSelectedAccountId(primary.id);
      else if ((data || []).length > 0 && !selectedAccountId) setSelectedAccountId(data[0].id);
    } catch { /* 무시 */ }
  };

  const loadHistory = async () => {
    try {
      const data = await getImportHistory({ size: 10 });
      setHistory(data?.items || []);
    } catch { /* 무시 */ }
  };

  const loadMappings = async () => {
    try {
      const data = await getMappings();
      setMappings(data || []);
    } catch { /* 무시 */ }
  };

  /* ── 선택된 계좌 정보 ── */
  const currentAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const bankCode = currentAccount?.bank_code || 'shinhan';

  /* ── CSV 업로드 & 파싱 ── */
  const handleFileUpload = async (file: File) => {
    if (!currentAccount) {
      alert('먼저 계좌를 선택해주세요. 등록된 계좌가 없으면 아래 "계좌 관리"에서 추가하세요.');
      return;
    }
    setParsing(true);
    try {
      const result = await parseBankCSV(file, currentAccount.bank_code);
      setTransactions(result.transactions || []);
      setFileName(result.file_name || file.name);
      // 중복 아닌 입금 건만 자동 선택
      const autoSelect = new Set<number>();
      (result.transactions || []).forEach((t, i) => {
        if (t.deposit_amount > 0 && !t.is_duplicate) {
          autoSelect.add(i);
        }
      });
      setSelected(autoSelect);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'CSV 파싱 실패');
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  /* ── 전표 생성 확인 ── */
  const handleConfirm = async () => {
    const selectedTx: ConfirmTransaction[] = [];
    transactions.forEach((t, i) => {
      if (selected.has(i) && t.deposit_amount > 0) {
        selectedTx.push({
          transaction_date: t.transaction_date,
          description: t.description,
          amount: t.deposit_amount,
          account_id: t.mapped_account_id || '',
          hash: t.hash,
        });
      }
    });

    // 계정과목 미매핑 건 확인
    const unmapped = selectedTx.filter(t => !t.account_id);
    if (unmapped.length > 0) {
      alert(`계정과목이 지정되지 않은 거래가 ${unmapped.length}건 있습니다. 모든 거래에 계정과목을 지정해주세요.`);
      return;
    }

    if (selectedTx.length === 0) {
      alert('임포트할 거래를 선택해주세요');
      return;
    }

    if (!confirm(`${selectedTx.length}건의 입금 내역을 전표로 생성하시겠습니까?`)) return;

    setConfirming(true);
    try {
      const result = await confirmImport({
        bank_code: bankCode,
        file_name: fileName,
        bank_account_id: currentAccount?.chart_account_id,
        transactions: selectedTx,
      });
      alert(result.message || '전표 생성 완료');
      setTransactions([]);
      setSelected(new Set());
      loadHistory();
    } catch (e: any) {
      alert(e.response?.data?.detail || '전표 생성 실패');
    } finally {
      setConfirming(false);
    }
  };

  /* ── 체크박스 ── */
  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === transactions.filter(t => t.deposit_amount > 0 && !t.is_duplicate).length) {
      setSelected(new Set());
    } else {
      const all = new Set<number>();
      transactions.forEach((t, i) => {
        if (t.deposit_amount > 0 && !t.is_duplicate) all.add(i);
      });
      setSelected(all);
    }
  };

  /* ── 계정과목 검색 (행 편집용) ── */
  const searchRowAccounts = async (q: string) => {
    setRowAccountSearch(q);
    if (q.length < 1) { setRowAccountResults([]); return; }
    try {
      const results = await searchAccounts(q);
      setRowAccountResults(results || []);
    } catch { setRowAccountResults([]); }
  };

  const assignAccount = (rowIdx: number, acc: AccountSearchResult) => {
    setTransactions(prev => prev.map((t, i) =>
      i === rowIdx ? { ...t, mapped_account_id: acc.id, mapped_account_name: `${acc.code} ${acc.name}` } : t
    ));
    setEditingRow(null);
    setRowAccountSearch('');
    setRowAccountResults([]);
  };

  /* ── 매핑 규칙 추가 ── */
  const handleAddMapping = async () => {
    if (!newKeyword.trim() || !newAccountId) return;
    try {
      await createMapping({ keyword: newKeyword.trim(), account_id: newAccountId });
      setNewKeyword('');
      setNewAccountId('');
      setAccountSearch('');
      loadMappings();
    } catch (e: any) {
      alert(e.response?.data?.detail || '매핑 추가 실패');
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('이 매핑 규칙을 삭제하시겠습니까?')) return;
    try {
      await deleteMapping(id);
      loadMappings();
    } catch { /* 무시 */ }
  };

  /* ── 회사 계좌 추가 ── */
  const handleAddAccount = async () => {
    if (!newAccNo.trim() || !newAccHolder.trim() || !newAccChartId) {
      alert('계좌번호, 예금주, 계정과목을 모두 입력해주세요');
      return;
    }
    const bankName = BANKS.find(b => b.code === newAccBankCode)?.name || newAccBankCode;
    try {
      await createBankAccount({
        bank_code: newAccBankCode,
        bank_name: bankName,
        account_no: newAccNo.trim(),
        account_holder: newAccHolder.trim(),
        account_type: newAccType,
        chart_account_id: newAccChartId,
        is_primary: newAccPrimary,
      });
      setNewAccNo(''); setNewAccHolder(''); setNewAccChartId('');
      setNewAccChartSearch(''); setNewAccPrimary(false);
      loadBankAccounts();
    } catch (e: any) {
      alert(e.response?.data?.detail || '계좌 등록 실패');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('이 계좌를 삭제하시겠습니까?')) return;
    try {
      await deleteBankAccount(id);
      if (selectedAccountId === id) setSelectedAccountId('');
      loadBankAccounts();
    } catch { /* 무시 */ }
  };

  /* ── 요약 계산 ── */
  const selectedCount = selected.size;
  const selectedAmount = Array.from(selected).reduce(
    (sum, i) => sum + (transactions[i]?.deposit_amount || 0), 0
  );

  /* ── 렌더링 ── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">입금 내역 가져오기</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAccountMgmt(!showAccountMgmt)}
            className="px-3 py-1.5 text-sm border border-(--border-main) rounded-lg text-slate-600 hover:bg-slate-50">
            계좌 관리 {showAccountMgmt ? '닫기' : '열기'}
          </button>
          <button onClick={() => setShowMappings(!showMappings)}
            className="px-3 py-1.5 text-sm border border-(--border-main) rounded-lg text-slate-600 hover:bg-slate-50">
            매핑 규칙 {showMappings ? '닫기' : '관리'}
          </button>
          <button onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 text-sm border border-(--border-main) rounded-lg text-slate-600 hover:bg-slate-50">
            {showHistory ? '이력 닫기' : '임포트 이력'}
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">사용 방법</p>
        <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
          <li>"계좌 관리"에서 회사 은행 계좌를 등록하세요 (최초 1회)</li>
          <li>아래에서 계좌를 선택하고 인터넷뱅킹 CSV 파일을 업로드하세요</li>
          <li>파싱 결과를 확인하고 계정과목을 지정한 뒤 "전표 생성"을 클릭하세요</li>
          <li>전표 목록에서 생성된 전표를 검토/승인하세요</li>
        </ol>
      </div>

      {/* 계좌 선택 + 파일 업로드 */}
      <div className="bg-white rounded-xl border border-(--border-main) p-5 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-slate-600 mb-1">입금 계좌 선택</label>
            {bankAccounts.length === 0 ? (
              <div className="border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-700">
                등록된 계좌가 없습니다. 위 "계좌 관리"에서 계좌를 먼저 등록해주세요.
              </div>
            ) : (
              <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm">
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} {a.account_no} ({a.account_type}){a.is_primary ? ' ★' : ''} — {a.account_holder}
                  </option>
                ))}
              </select>
            )}
          </div>
          {currentAccount && (
            <div className="text-xs text-slate-500 pb-2">
              연결 계정과목: <span className="font-medium text-slate-700">{currentAccount.chart_account_name}</span>
            </div>
          )}
        </div>

        {/* 드래그앤드롭 업로드 영역 */}
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition"
        >
          <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,.txt" onChange={onFileChange} className="hidden" />
          <div className="text-slate-400 text-4xl mb-2">📄</div>
          <p className="text-slate-600 font-medium">{parsing ? '파싱 중...' : '클릭 또는 파일을 여기에 드래그하세요'}</p>
          <p className="text-xs text-slate-400 mt-1">CSV, TXT 파일 지원 (최대 10MB)</p>
        </div>
      </div>

      {/* 파싱 결과 테이블 */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
          <div className="p-4 border-b border-(--border-main) flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-800">파싱 결과</h2>
              <span className="text-sm text-slate-500">{fileName}</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                전체 {transactions.length}건 · 입금 {transactions.filter(t => t.deposit_amount > 0).length}건
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-amber-700">
                선택: {selectedCount}건 · ₩{selectedAmount.toLocaleString()}
              </span>
              <button onClick={handleConfirm} disabled={confirming || selectedCount === 0}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 text-sm font-medium transition">
                {confirming ? '생성 중...' : `전표 생성 (${selectedCount}건)`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-(--bg-card) text-slate-600 text-xs uppercase">
                  <th className="py-2.5 px-3 w-10">
                    <input type="checkbox" checked={selectedCount > 0 && selectedCount === transactions.filter(t => t.deposit_amount > 0 && !t.is_duplicate).length}
                      onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="text-left py-2.5 px-3 font-semibold">거래일</th>
                  <th className="text-left py-2.5 px-3 font-semibold">적요</th>
                  <th className="text-right py-2.5 px-3 font-semibold">입금액</th>
                  <th className="text-right py-2.5 px-3 font-semibold">출금액</th>
                  <th className="text-right py-2.5 px-3 font-semibold">잔액</th>
                  <th className="text-left py-2.5 px-3 font-semibold">계정과목 (대변)</th>
                  <th className="text-center py-2.5 px-3 font-semibold w-16">상태</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i}
                    className={`border-t border-(--border-main) transition ${
                      t.is_duplicate ? 'bg-slate-50 opacity-50' :
                      t.deposit_amount > 0 ? 'hover:bg-amber-50/30' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      {t.deposit_amount > 0 && !t.is_duplicate && (
                        <input type="checkbox" checked={selected.has(i)}
                          onChange={() => toggleSelect(i)} className="rounded" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{t.transaction_date}</td>
                    <td className="py-2.5 px-3 text-slate-800 max-w-[200px] truncate">{t.description || '-'}</td>
                    <td className={`py-2.5 px-3 text-right font-medium whitespace-nowrap ${t.deposit_amount > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                      {t.deposit_amount > 0 ? `₩${t.deposit_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className={`py-2.5 px-3 text-right whitespace-nowrap ${t.withdrawal_amount > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                      {t.withdrawal_amount > 0 ? `₩${t.withdrawal_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">
                      {t.balance ? `₩${t.balance.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 relative">
                      {t.deposit_amount > 0 && !t.is_duplicate ? (
                        editingRow === i ? (
                          <div className="relative">
                            <input
                              value={rowAccountSearch}
                              onChange={e => searchRowAccounts(e.target.value)}
                              placeholder="계정과목 검색..."
                              className="w-full border border-amber-400 rounded px-2 py-1 text-xs"
                              autoFocus
                              onBlur={() => setTimeout(() => setEditingRow(null), 200)}
                            />
                            {rowAccountResults.length > 0 && (
                              <div className="absolute z-50 top-full left-0 w-64 bg-white border border-(--border-main) rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                                {rowAccountResults.map(acc => (
                                  <button key={acc.id}
                                    onMouseDown={() => assignAccount(i, acc)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 border-b border-(--border-main) last:border-0">
                                    <span className="font-mono text-slate-500">{acc.code}</span> {acc.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => { setEditingRow(i); setRowAccountSearch(''); setRowAccountResults([]); }}
                            className={`text-xs px-2 py-1 rounded ${
                              t.mapped_account_name
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}>
                            {t.mapped_account_name || '계정 지정'}
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {t.is_duplicate ? (
                        <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">중복</span>
                      ) : t.deposit_amount > 0 ? (
                        <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">입금</span>
                      ) : (
                        <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">출금</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 계좌 관리 */}
      {showAccountMgmt && (
        <div className="bg-white rounded-xl border border-(--border-main) p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">회사 은행 계좌 관리</h3>
          <p className="text-xs text-slate-500">CSV 임포트 시 사용할 회사 은행 계좌를 등록합니다. 계좌별로 연결 계정과목(보통예금 등)을 지정합니다.</p>

          {/* 등록된 계좌 목록 */}
          {bankAccounts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-(--bg-card) text-slate-600 text-xs">
                    <th className="text-left py-2 px-3 font-semibold">은행</th>
                    <th className="text-left py-2 px-3 font-semibold">계좌번호</th>
                    <th className="text-left py-2 px-3 font-semibold">예금주</th>
                    <th className="text-left py-2 px-3 font-semibold">유형</th>
                    <th className="text-left py-2 px-3 font-semibold">계정과목</th>
                    <th className="text-center py-2 px-3 font-semibold">기본</th>
                    <th className="text-center py-2 px-3 font-semibold w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map(a => (
                    <tr key={a.id} className="border-t border-(--border-main)">
                      <td className="py-2 px-3">{a.bank_name}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{a.account_no}</td>
                      <td className="py-2 px-3">{a.account_holder}</td>
                      <td className="py-2 px-3 text-slate-500">{a.account_type}</td>
                      <td className="py-2 px-3 text-slate-600">{a.chart_account_name || '-'}</td>
                      <td className="py-2 px-3 text-center">{a.is_primary ? '★' : ''}</td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => handleDeleteAccount(a.id)}
                          className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 계좌 추가 폼 */}
          <div className="border-t border-(--border-main) pt-3 space-y-3">
            <p className="text-sm font-medium text-slate-700">계좌 추가</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-500">은행</label>
                <select value={newAccBankCode} onChange={e => setNewAccBankCode(e.target.value)}
                  className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm">
                  {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">계좌번호</label>
                <input value={newAccNo} onChange={e => setNewAccNo(e.target.value)}
                  placeholder="110-123-456789" className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">예금주</label>
                <input value={newAccHolder} onChange={e => setNewAccHolder(e.target.value)}
                  placeholder="(주)피엘에스" className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">계좌 유형</label>
                <select value={newAccType} onChange={e => setNewAccType(e.target.value)}
                  className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm">
                  <option>보통예금</option>
                  <option>정기예금</option>
                  <option>당좌예금</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <label className="text-xs text-slate-500">연결 계정과목</label>
                <input value={newAccChartSearch}
                  onChange={async e => {
                    setNewAccChartSearch(e.target.value);
                    if (e.target.value.length >= 1) {
                      try {
                        const res = await searchAccounts(e.target.value);
                        setNewAccChartResults(res || []);
                      } catch { setNewAccChartResults([]); }
                    } else {
                      setNewAccChartResults([]);
                    }
                  }}
                  placeholder="예: 보통예금"
                  className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm" />
                {newAccChartResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 w-full bg-white border border-(--border-main) rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {newAccChartResults.map(acc => (
                      <button key={acc.id}
                        onClick={() => { setNewAccChartId(acc.id); setNewAccChartSearch(`${acc.code} ${acc.name}`); setNewAccChartResults([]); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 border-b border-(--border-main) last:border-0">
                        <span className="font-mono text-slate-500">{acc.code}</span> {acc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-sm text-slate-600 pb-1.5">
                <input type="checkbox" checked={newAccPrimary} onChange={e => setNewAccPrimary(e.target.checked)} className="rounded" />
                기본 계좌
              </label>
              <button onClick={handleAddAccount}
                className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 whitespace-nowrap">
                계좌 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 매핑 규칙 관리 */}
      {showMappings && (
        <div className="bg-white rounded-xl border border-(--border-main) p-5 space-y-3">
          <h3 className="font-semibold text-slate-800">적요 → 계정과목 매핑 규칙</h3>
          <p className="text-xs text-slate-500">적요에 키워드가 포함되면 자동으로 계정과목이 매핑됩니다</p>

          {/* 기존 규칙 */}
          {mappings.length > 0 && (
            <div className="space-y-1">
              {mappings.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="text-sm">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">{m.keyword}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="text-slate-700">{m.account_name || m.account_id}</span>
                  </div>
                  <button onClick={() => handleDeleteMapping(m.id)}
                    className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </div>
              ))}
            </div>
          )}

          {/* 새 규칙 추가 */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500">키워드</label>
              <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                placeholder="예: 급여, 이자, 매출" className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1 relative">
              <label className="text-xs text-slate-500">계정과목</label>
              <input value={accountSearch}
                onChange={async e => {
                  setAccountSearch(e.target.value);
                  if (e.target.value.length >= 1) {
                    try {
                      const res = await searchAccounts(e.target.value);
                      setAccountResults(res || []);
                    } catch { setAccountResults([]); }
                  } else {
                    setAccountResults([]);
                  }
                }}
                placeholder="계정과목 검색..."
                className="w-full border border-(--border-main) rounded px-2 py-1.5 text-sm" />
              {accountResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 w-full bg-white border border-(--border-main) rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {accountResults.map(acc => (
                    <button key={acc.id}
                      onClick={() => { setNewAccountId(acc.id); setAccountSearch(`${acc.code} ${acc.name}`); setAccountResults([]); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 border-b border-(--border-main) last:border-0">
                      <span className="font-mono text-slate-500">{acc.code}</span> {acc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleAddMapping}
              className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 whitespace-nowrap">
              추가
            </button>
          </div>
        </div>
      )}

      {/* 임포트 이력 */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
          <div className="p-4 border-b border-(--border-main)">
            <h3 className="font-semibold text-slate-800">임포트 이력</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-(--bg-card) text-slate-600 text-xs uppercase">
                <th className="text-left py-2.5 px-4 font-semibold">일시</th>
                <th className="text-left py-2.5 px-4 font-semibold">은행</th>
                <th className="text-left py-2.5 px-4 font-semibold">파일명</th>
                <th className="text-right py-2.5 px-4 font-semibold">임포트</th>
                <th className="text-right py-2.5 px-4 font-semibold">건너뜀</th>
                <th className="text-right py-2.5 px-4 font-semibold">총 입금액</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">임포트 이력이 없습니다</td></tr>
              ) : (
                history.map(h => (
                  <tr key={h.id} className="border-t border-(--border-main)">
                    <td className="py-2.5 px-4 text-slate-500 text-xs">
                      {h.import_date ? new Date(h.import_date).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-2.5 px-4">
                      {BANKS.find(b => b.code === h.bank_code)?.name || h.bank_code}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[180px] truncate">{h.file_name}</td>
                    <td className="py-2.5 px-4 text-right text-blue-600 font-medium">{h.imported_count}건</td>
                    <td className="py-2.5 px-4 text-right text-slate-400">{h.skipped_count}건</td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-800">
                      ₩{h.total_deposit?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
