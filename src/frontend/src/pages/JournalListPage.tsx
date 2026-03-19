/**
 * M4 재무/회계 — 전표 목록 페이지
 * 목록/검색/필터 + 상태 워크플로우 (검토요청/승인/전기/반려)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import {
  fetchJournals,
  deleteJournal,
  submitJournal,
  approveJournal,
  postJournal,
  rejectJournal,
  type JournalListItem,
  type PaginatedResult,
} from '../api/finance/journals';
import { useAuthStore } from '../stores/authStore';

// 전표 유형 한국어 매핑
const TYPE_LABELS: Record<string, string> = {
  sales: '매출',
  purchase: '매입',
  expense: '경비',
  payroll: '급여',
  general: '일반',
  adjustment: '수정',
};

// 상태 배지 색상
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  posted: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-purple-100 text-purple-700',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '임시저장',
  review: '검토중',
  approved: '승인',
  posted: '전기완료',
  closed: '마감',
};

// 금액 포맷 (원화)
function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

export default function JournalListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<JournalListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 반려 모달
  const [rejectTarget, setRejectTarget] = useState<JournalListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<JournalListItem | null>(null);

  // 알림
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchJournals({
        page,
        size: 20,
        search: search || undefined,
        entry_type: typeFilter || undefined,
        status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: 'entry_date',
        sort_order: 'desc',
      });
      setData(result);
    } catch {
      showToast('error', '전표 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // 검색 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 워크플로우 액션
  const handleSubmit = async (journal: JournalListItem) => {
    try {
      await submitJournal(journal.id);
      showToast('success', `${journal.entry_no} 검토 요청됨`);
      loadData();
    } catch {
      showToast('error', '검토 요청에 실패했습니다');
    }
  };

  const handleApprove = async (journal: JournalListItem) => {
    try {
      await approveJournal(journal.id);
      showToast('success', `${journal.entry_no} 승인됨`);
      loadData();
    } catch {
      showToast('error', '승인에 실패했습니다');
    }
  };

  const handlePost = async (journal: JournalListItem) => {
    try {
      await postJournal(journal.id);
      showToast('success', `${journal.entry_no} 전기 완료`);
      loadData();
    } catch {
      showToast('error', '전기에 실패했습니다');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await rejectJournal(rejectTarget.id, rejectReason || undefined);
      showToast('success', `${rejectTarget.entry_no} 반려됨`);
      setRejectTarget(null);
      setRejectReason('');
      loadData();
    } catch {
      showToast('error', '반려에 실패했습니다');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJournal(deleteTarget.id);
      showToast('success', '전표가 삭제되었습니다');
      setDeleteTarget(null);
      loadData();
    } catch {
      showToast('error', '삭제에 실패했습니다');
    }
  };

  // 페이지네이션
  const totalPages = data?.total_pages || 1;
  const pageNumbers = [];
  const startP = Math.max(1, page - 2);
  const endP = Math.min(totalPages, startP + 4);
  for (let i = startP; i <= endP; i++) pageNumbers.push(i);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">전표 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              전표 입력/조회/승인 — 복식부기 기반
            </p>
          </div>
        </div>
        {isManager && (
          <button
            onClick={() => navigate('/finance/journals/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            전표 등록
          </button>
        )}
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="전표번호, 적요 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50"
            />
          </div>

          {/* 기간 */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500"
          />

          {/* 유형 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500"
          >
            <option value="">전체 유형</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            등록된 전표가 없습니다
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">전표번호</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">전표일자</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">유형</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">적요</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">차변</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">대변</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">상태</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((journal) => (
                <tr
                  key={journal.id}
                  className="border-b border-gray-100 hover:bg-amber-50/30 transition"
                >
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {journal.entry_no}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {journal.entry_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-sm font-medium bg-gray-100 text-gray-700">
                      {TYPE_LABELS[journal.entry_type] || journal.entry_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                    {journal.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {formatAmount(journal.total_debit)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {formatAmount(journal.total_credit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${
                      STATUS_COLORS[journal.status] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {STATUS_LABELS[journal.status] || journal.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* 상세 보기 */}
                      <button
                        onClick={() => navigate(`/finance/journals/${journal.id}`)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        title="상세 보기"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>

                      {/* draft 전용: 수정/삭제/검토요청 */}
                      {journal.status === 'draft' && isManager && (
                        <>
                          <button
                            onClick={() => navigate(`/finance/journals/${journal.id}/edit`)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                            title="수정"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSubmit(journal)}
                            className="p-1.5 rounded hover:bg-yellow-100 text-gray-500 hover:text-yellow-700"
                            title="검토 요청"
                          >
                            <ArrowUpTrayIcon className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteTarget(journal)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                              title="삭제"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}

                      {/* review 전용: 승인/반려 */}
                      {journal.status === 'review' && isAdmin && (
                        <>
                          <button
                            onClick={() => handleApprove(journal)}
                            className="p-1.5 rounded hover:bg-emerald-100 text-gray-500 hover:text-emerald-700"
                            title="승인"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRejectTarget(journal)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
                            title="반려"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* approved 전용: 전기 */}
                      {journal.status === 'approved' && isAdmin && (
                        <button
                          onClick={() => handlePost(journal)}
                          className="p-1.5 rounded hover:bg-blue-100 text-gray-500 hover:text-blue-700"
                          title="전기 (회계 반영)"
                        >
                          <DocumentCheckIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              총 {data.total.toLocaleString()}건 (페이지 {data.page}/{data.total_pages})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {pageNumbers.map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded text-sm ${
                    n === page
                      ? 'bg-amber-600 text-white font-bold'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">전표 삭제</h3>
            <p className="text-sm text-gray-600 mb-4">
              전표 <strong>{deleteTarget.entry_no}</strong>을(를) 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">전표 반려</h3>
            <p className="text-sm text-gray-600 mb-4">
              전표 <strong>{rejectTarget.entry_no}</strong>을(를) 반려합니다.
            </p>
            <textarea
              placeholder="반려 사유를 입력해주세요 (선택)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                반려
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
