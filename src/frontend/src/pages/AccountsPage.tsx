/**
 * M4 재무/회계 — 계정과목 관리 페이지
 * 목록/검색/필터/등록/수정/비활성화
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  type Account,
  type AccountFormData,
  type PaginatedResult,
} from '../api/finance/accounts';
import { useAuthStore } from '../stores/authStore';

// 계정 유형 한국어 매핑
const TYPE_LABELS: Record<string, string> = {
  asset: '자산',
  liability: '부채',
  equity: '자본',
  revenue: '수익',
  expense: '비용',
};

const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-amber-100 text-amber-700',
};

const EMPTY_FORM: AccountFormData = {
  code: '',
  name: '',
  account_type: 'asset',
  account_group: '',
  normal_balance: 'debit',
  parent_id: '',
  sort_order: 0,
};

// 유형별 기본 정상잔액 매핑
const DEFAULT_BALANCE: Record<string, string> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
};

export default function AccountsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<Account> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // 검색 디바운스 (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 데이터 로딩
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAccounts({
        page,
        size: 50,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        account_type: typeFilter || undefined,
        is_active: activeFilter === '' ? undefined : activeFilter === 'true',
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, typeFilter, activeFilter]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 정렬 토글
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const sortIcon = (column: string) => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // 모달 열기
  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingId(account.id);
    setForm({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      account_group: account.account_group || '',
      normal_balance: account.normal_balance,
      parent_id: account.parent_id || '',
      sort_order: account.sort_order,
    });
    setError('');
    setShowModal(true);
  };

  // 유형 변경 시 정상잔액 자동 설정
  const handleTypeChange = (type: string) => {
    setForm((prev) => ({
      ...prev,
      account_type: type,
      normal_balance: DEFAULT_BALANCE[type] || 'debit',
    }));
  };

  // 저장
  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('계정 코드와 계정명은 필수입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.parent_id) delete payload.parent_id;
      if (!payload.account_group) delete payload.account_group;

      if (editingId) {
        const { code: _, ...updateData } = payload;
        await updateAccount(editingId, updateData as Partial<AccountFormData>);
      } else {
        await createAccount(payload as Partial<AccountFormData>);
      }
      setShowModal(false);
      loadAccounts();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제 (비활성화)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAccount(deleteTarget.id);
      setDeleteTarget(null);
      loadAccounts();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '비활성화 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/finance')}
          className="p-1.5 rounded-lg hover:bg-[#c8ced8] transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">계정과목 관리</h1>
          <p className="text-sm text-slate-500">
            자산/부채/자본/수익/비용 계정 체계를 관리합니다.
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-[#e8ecf2] rounded-xl p-4 border border-[#c8ced8] mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="계정 코드 또는 이름 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* 유형 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">전체 유형</option>
            <option value="asset">자산</option>
            <option value="liability">부채</option>
            <option value="equity">자본</option>
            <option value="revenue">수익</option>
            <option value="expense">비용</option>
          </select>

          {/* 상태 필터 */}
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">전체 상태</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>

          {/* 등록 버튼 */}
          {isManager && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              계정 등록
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-[#e8ecf2] rounded-xl border border-[#c8ced8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dce1e9] text-slate-600">
                <th
                  className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800 w-20"
                  onClick={() => handleSort('code')}
                >
                  코드{sortIcon('code')}
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800"
                  onClick={() => handleSort('name')}
                >
                  계정명{sortIcon('name')}
                </th>
                <th className="text-left px-4 py-3 font-semibold w-20">유형</th>
                <th className="text-left px-4 py-3 font-semibold w-28">그룹</th>
                <th className="text-center px-4 py-3 font-semibold w-20">정상잔액</th>
                <th className="text-center px-4 py-3 font-semibold w-16">상태</th>
                {isManager && (
                  <th className="text-center px-4 py-3 font-semibold w-20">관리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="text-center py-12 text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="text-center py-12 text-slate-400">
                    검색 결과가 없습니다
                  </td>
                </tr>
              ) : (
                data.items.map((a) => (
                  <tr
                    key={a.id}
                    className={`border-t border-[#c8ced8] hover:bg-[#dce1e9]/50 transition-colors ${
                      !a.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{a.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          TYPE_COLORS[a.account_type] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {TYPE_LABELS[a.account_type] || a.account_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {a.account_group || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {a.normal_balance === 'debit' ? '차변' : '대변'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          a.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(a)}
                            className="p-1 rounded hover:bg-[#c8ced8] transition-colors"
                            title="수정"
                          >
                            <PencilSquareIcon className="w-4 h-4 text-slate-500" />
                          </button>
                          {a.is_active && (
                            <button
                              onClick={() => setDeleteTarget(a)}
                              className="p-1 rounded hover:bg-red-100 transition-colors"
                              title="비활성화"
                            >
                              <TrashIcon className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#c8ced8]">
            <span className="text-xs text-slate-500">
              전체 {data.total}건 중 {(data.page - 1) * data.size + 1}-
              {Math.min(data.page * data.size, data.total)}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-[#c8ced8] disabled:opacity-30"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from(
                { length: Math.min(5, data.total_pages) },
                (_, i) => {
                  let startPage = Math.max(1, page - 2);
                  if (startPage + 4 > data.total_pages)
                    startPage = Math.max(1, data.total_pages - 4);
                  const pageNum = startPage + i;
                  if (pageNum > data.total_pages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                        pageNum === page
                          ? 'bg-amber-500 text-white font-bold'
                          : 'hover:bg-[#c8ced8]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="p-1 rounded hover:bg-[#c8ced8] disabled:opacity-30"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 등록/수정 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e8ecf2] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#c8ced8]">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#c8ced8]">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? '계정과목 수정' : '계정과목 등록'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-[#c8ced8]"
              >
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 본문 */}
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <fieldset className="border border-[#c8ced8] rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">
                  기본 정보
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {/* 계정 코드 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      계정 코드 *
                    </label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, code: e.target.value }))
                      }
                      disabled={!!editingId}
                      placeholder="예: 101"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* 계정명 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      계정명 *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="예: 현금"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* 계정 유형 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      유형 *
                    </label>
                    <select
                      value={form.account_type}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="asset">자산</option>
                      <option value="liability">부채</option>
                      <option value="equity">자본</option>
                      <option value="revenue">수익</option>
                      <option value="expense">비용</option>
                    </select>
                  </div>

                  {/* 정상잔액 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      정상잔액
                    </label>
                    <select
                      value={form.normal_balance}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, normal_balance: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="debit">차변</option>
                      <option value="credit">대변</option>
                    </select>
                  </div>

                  {/* 계정 그룹 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      계정 그룹
                    </label>
                    <input
                      type="text"
                      value={form.account_group}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, account_group: e.target.value }))
                      }
                      placeholder="예: 유동자산"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* 정렬 순서 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      정렬 순서
                    </label>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          sort_order: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#c8ced8]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-[#c8ced8] rounded-lg hover:bg-[#dce1e9] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50"
              >
                {saving ? '저장 중...' : editingId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 비활성화 확인 모달 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e8ecf2] rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#c8ced8]">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              계정과목 비활성화
            </h3>
            <p className="text-sm text-slate-600 mb-1">
              <strong>
                {deleteTarget.code} {deleteTarget.name}
              </strong>
            </p>
            <p className="text-sm text-slate-500 mb-6">
              이 계정과목을 비활성화하시겠습니까?
              <br />
              <span className="text-xs text-slate-400">
                데이터는 삭제되지 않으며, 목록에서 숨겨집니다.
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-[#c8ced8] rounded-lg hover:bg-[#dce1e9]"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                비활성화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
