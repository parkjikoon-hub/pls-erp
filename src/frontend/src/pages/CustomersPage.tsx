/**
 * 거래처 관리 페이지 — 목록 조회, 등록, 수정, 삭제(비활성화)
 * 시안 C 기반 디자인 (슬레이트 블루그레이 + 에메랄드 액센트)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import BackButton from '../components/BackButton';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type Customer,
  type CustomerFormData,
  type PaginatedResult,
} from '../api/customers';
import { useAuthStore } from '../stores/authStore';
import ExcelImportModal from '../components/ExcelImportModal';

/** 거래처 유형 한글 매핑 */
const TYPE_LABELS: Record<string, string> = {
  customer: '매출처',
  supplier: '매입처',
  both: '겸용',
};

/** 폼 초기값 */
const EMPTY_FORM: CustomerFormData = {
  code: '',
  name: '',
  business_no: '',
  ceo_name: '',
  business_type: '',
  business_item: '',
  address: '',
  phone: '',
  email: '',
  fax: '',
  contact_person: '',
  customer_type: 'both',
  credit_limit: 0,
  payment_terms: 30,
  bank_name: '',
  bank_account: '',
  bank_account_name: '',
};

export default function CustomersPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 삭제 확인 상태
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Excel 임포트 모달 상태
  const [showExcelModal, setShowExcelModal] = useState(false);

  // 거래처 목록 불러오기
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCustomers({
        page,
        size: 20,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        customer_type: typeFilter || undefined,
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
    loadCustomers();
  }, [loadCustomers]);

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  // 정렬 표시 아이콘
  const sortIcon = (column: string) => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // 등록 모달 열기
  const openCreateModal = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  // 수정 모달 열기
  const openEditModal = (c: Customer) => {
    setForm({
      code: c.code,
      name: c.name,
      business_no: c.business_no || '',
      ceo_name: c.ceo_name || '',
      business_type: c.business_type || '',
      business_item: c.business_item || '',
      address: c.address || '',
      phone: c.phone || '',
      email: c.email || '',
      fax: c.fax || '',
      contact_person: c.contact_person || '',
      customer_type: c.customer_type,
      credit_limit: c.credit_limit,
      payment_terms: c.payment_terms,
      bank_name: c.bank_name || '',
      bank_account: c.bank_account || '',
      bank_account_name: c.bank_account_name || '',
    });
    setEditingId(c.id);
    setError('');
    setShowModal(true);
  };

  // 폼 필드 변경
  const handleChange = (field: keyof CustomerFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 저장 (생성 또는 수정)
  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('거래처 코드와 거래처명은 필수입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        // 수정 시 code 제외, 변경된 필드만 전송
        const { code: _, ...updateData } = form;
        await updateCustomer(editingId, updateData);
      } else {
        await createCustomer(form);
      }
      setShowModal(false);
      loadCustomers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; code?: string };
      if (axiosErr.code === 'ECONNABORTED') {
        setError('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  // 삭제 (비활성화)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      loadCustomers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      {/* 상단: 뒤로가기 + 제목 */}
      <div className="flex items-center gap-3 mb-6">
        <BackButton to="/system" />
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BuildingOffice2Icon className="w-6 h-6 text-blue-500" />
            거래처 관리
          </h1>
          <p className="text-sm text-slate-500">매출처 / 매입처 / 겸용 거래처를 등록하고 관리합니다</p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="거래처명, 코드, 사업자번호 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* 유형 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">전체 유형</option>
            <option value="customer">매출처</option>
            <option value="supplier">매입처</option>
            <option value="both">겸용</option>
          </select>

          {/* 활성 필터 */}
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">전체 상태</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>

          {/* 등록 버튼 (관리자/매니저만) */}
          {isManager && (
            <>
              <button
                onClick={() => setShowExcelModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-(--border-main) rounded-lg hover:bg-(--bg-main) transition-colors"
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
                Excel 업로드
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                거래처 등록
              </button>
            </>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-(--bg-card) rounded-xl border border-(--border-main) overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-(--bg-main) text-slate-600">
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('code')}>
                  코드{sortIcon('code')}
                </th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('name')}>
                  거래처명{sortIcon('name')}
                </th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('business_no')}>
                  사업자번호{sortIcon('business_no')}
                </th>
                <th className="text-left px-4 py-3 font-semibold">대표자</th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('customer_type')}>
                  유형{sortIcon('customer_type')}
                </th>
                <th className="text-left px-4 py-3 font-semibold">전화번호</th>
                <th className="text-center px-4 py-3 font-semibold">상태</th>
                {isManager && <th className="text-center px-4 py-3 font-semibold">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isManager ? 8 : 7} className="text-center py-12 text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 8 : 7} className="text-center py-12 text-slate-400">
                    {search ? '검색 결과가 없습니다' : '등록된 거래처가 없습니다'}
                  </td>
                </tr>
              ) : (
                data.items.map((c) => (
                  <tr key={c.id} className="border-t border-(--border-main) hover:bg-(--bg-main)/50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">{c.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.business_no || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.ceo_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded text-sm font-medium ${
                        c.customer_type === 'customer' ? 'bg-blue-100 text-blue-700' :
                        c.customer_type === 'supplier' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {TYPE_LABELS[c.customer_type] || c.customer_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                            title="수정"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          {c.is_active && (
                            <button
                              onClick={() => setDeleteTarget(c)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="비활성화"
                            >
                              <TrashIcon className="w-4 h-4" />
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-(--border-main)">
            <span className="text-sm text-slate-500">
              전체 {data.total}건 중 {(data.page - 1) * data.size + 1}-{Math.min(data.page * data.size, data.total)}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-(--bg-main) disabled:opacity-30 transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                // 현재 페이지를 중심으로 5개 표시
                let startPage = Math.max(1, page - 2);
                if (startPage + 4 > data.total_pages) startPage = Math.max(1, data.total_pages - 4);
                const pageNum = startPage + i;
                if (pageNum > data.total_pages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      pageNum === page
                        ? 'bg-emerald-500 text-white'
                        : 'hover:bg-(--bg-main) text-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="p-1.5 rounded-lg hover:bg-(--bg-main) disabled:opacity-30 transition-colors"
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
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-(--border-main)">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-main)">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? '거래처 수정' : '거래처 등록'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-(--bg-main) rounded-lg transition-colors">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 기본 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">기본 정보</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    label="거래처 코드 *"
                    value={form.code}
                    onChange={(v) => handleChange('code', v)}
                    placeholder="예: C001"
                    disabled={!!editingId}
                  />
                  <FormField
                    label="거래처명 *"
                    value={form.name}
                    onChange={(v) => handleChange('name', v)}
                    placeholder="예: (주)삼성전자"
                  />
                  <FormField
                    label="사업자등록번호"
                    value={form.business_no || ''}
                    onChange={(v) => handleChange('business_no', v)}
                    placeholder="000-00-00000"
                  />
                  <FormField
                    label="대표자명"
                    value={form.ceo_name || ''}
                    onChange={(v) => handleChange('ceo_name', v)}
                  />
                  <FormField
                    label="업태"
                    value={form.business_type || ''}
                    onChange={(v) => handleChange('business_type', v)}
                    placeholder="예: 도매업"
                  />
                  <FormField
                    label="종목"
                    value={form.business_item || ''}
                    onChange={(v) => handleChange('business_item', v)}
                    placeholder="예: 전자제품"
                  />
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-1">거래처 유형</label>
                    <select
                      value={form.customer_type}
                      onChange={(e) => handleChange('customer_type', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="both">겸용 (매출+매입)</option>
                      <option value="customer">매출처</option>
                      <option value="supplier">매입처</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* 연락처 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">연락처</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="전화번호" value={form.phone || ''} onChange={(v) => handleChange('phone', v)} placeholder="02-1234-5678" />
                  <FormField label="팩스" value={form.fax || ''} onChange={(v) => handleChange('fax', v)} />
                  <FormField label="이메일" value={form.email || ''} onChange={(v) => handleChange('email', v)} placeholder="contact@company.com" />
                  <FormField label="담당자명" value={form.contact_person || ''} onChange={(v) => handleChange('contact_person', v)} />
                  <div className="md:col-span-2">
                    <FormField label="주소" value={form.address || ''} onChange={(v) => handleChange('address', v)} placeholder="서울특별시 강남구..." />
                  </div>
                </div>
              </fieldset>

              {/* 거래 조건 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">거래 조건</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">신용한도 (원)</label>
                    <input
                      type="number"
                      value={form.credit_limit}
                      onChange={(e) => handleChange('credit_limit', Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">결제조건 (일)</label>
                    <input
                      type="number"
                      value={form.payment_terms}
                      onChange={(e) => handleChange('payment_terms', Number(e.target.value))}
                      min={0}
                      max={365}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </fieldset>

              {/* 은행 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">은행 정보</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="은행명" value={form.bank_name || ''} onChange={(v) => handleChange('bank_name', v)} placeholder="국민은행" />
                  <FormField label="계좌번호" value={form.bank_account || ''} onChange={(v) => handleChange('bank_account', v)} />
                  <FormField label="예금주" value={form.bank_account_name || ''} onChange={(v) => handleChange('bank_account_name', v)} />
                </div>
              </fieldset>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-(--border-main)">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : editingId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 다이얼로그 ── */}
      {/* ── Excel 임포트 모달 ── */}
      {showExcelModal && (
        <ExcelImportModal
          module="customers"
          moduleName="거래처"
          onClose={() => setShowExcelModal(false)}
          onComplete={() => loadCustomers()}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-sm p-6 border border-(--border-main)">
            <h3 className="text-lg font-bold text-slate-800 mb-2">거래처 비활성화</h3>
            <p className="text-sm text-slate-600 mb-1">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.code})
            </p>
            <p className="text-sm text-slate-500 mb-6">
              이 거래처를 비활성화하시겠습니까?<br />
              <span className="text-sm text-slate-400">데이터는 삭제되지 않으며, 목록에서 숨겨집니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
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


/** 재사용 가능한 폼 필드 컴포넌트 */
function FormField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
      />
    </div>
  );
}
