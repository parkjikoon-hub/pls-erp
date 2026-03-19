/**
 * M4 재무/회계 — 세금계산서 관리 페이지
 * 매출/매입 탭 + CRUD + 확정(자동 전표 생성) + 기간 합계
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  fetchInvoices,
  createInvoice,
  updateInvoice,
  cancelInvoice,
  confirmInvoice,
  fetchInvoiceSummary,
  type InvoiceListItem,
  type InvoiceFormData,
  type InvoiceSummary,
  type PaginatedResult,
} from '../api/finance/invoices';
import {
  fetchCustomers,
  type Customer,
} from '../api/customers';
import { useAuthStore } from '../stores/authStore';

// 상태 배지
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  draft: '임시저장',
  sent: '발송',
  confirmed: '확정',
  cancelled: '취소',
};

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

const EMPTY_FORM: InvoiceFormData = {
  invoice_type: 'issue',
  issue_date: new Date().toISOString().slice(0, 10),
  customer_id: '',
  supply_amount: 0,
  description: '',
};

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  // 탭 (매출/매입)
  const [tab, setTab] = useState<'issue' | 'receive'>('issue');

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<InvoiceListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 합계
  const [summary, setSummary] = useState<InvoiceSummary[]>([]);

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormData>({ ...EMPTY_FORM });

  // 거래처 검색
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDD, setShowCustomerDD] = useState(false);

  // 알림
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 부가세 자동 계산
  const autoTax = useMemo(() => Math.round(form.supply_amount * 0.1), [form.supply_amount]);
  const displayTax = form.tax_amount !== undefined ? form.tax_amount : autoTax;
  const totalAmount = form.supply_amount + (displayTax || 0);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listResult, summaryResult] = await Promise.all([
        fetchInvoices({
          page,
          size: 20,
          invoice_type: tab,
          search: search || undefined,
          status: statusFilter || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
        fetchInvoiceSummary({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
      ]);
      setData(listResult);
      setSummary(summaryResult);
    } catch {
      showToast('error', '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, tab, search, statusFilter, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // 검색 디바운스
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 거래처 검색 디바운스
  useEffect(() => {
    if (!customerQuery) { setCustomerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const result = await fetchCustomers({ search: customerQuery, size: 10, is_active: true });
        setCustomerResults(result.items);
        setShowCustomerDD(true);
      } catch { setCustomerResults([]); }
    }, 400);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // 모달 열기 (등록/수정)
  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, invoice_type: tab });
    setSelectedCustomer(null);
    setCustomerQuery('');
    setShowModal(true);
  };

  const openEdit = (inv: InvoiceListItem) => {
    setEditId(inv.id);
    setForm({
      invoice_type: inv.invoice_type,
      issue_date: inv.issue_date,
      customer_id: '', // ID는 API에서 가져와야 하지만 간소화
      supply_amount: inv.supply_amount,
      tax_amount: inv.tax_amount,
    });
    setSelectedCustomer(null);
    setCustomerQuery(inv.customer_name || '');
    setShowModal(true);
  };

  // 저장
  const handleSave = async () => {
    if (!form.customer_id && !selectedCustomer) {
      showToast('error', '거래처를 선택해주세요');
      return;
    }
    if (form.supply_amount <= 0) {
      showToast('error', '공급가액을 입력해주세요');
      return;
    }

    const payload: InvoiceFormData = {
      ...form,
      customer_id: selectedCustomer?.id || form.customer_id,
      tax_amount: displayTax,
    };

    try {
      if (editId) {
        await updateInvoice(editId, payload);
        showToast('success', '세금계산서가 수정되었습니다');
      } else {
        await createInvoice(payload);
        showToast('success', '세금계산서가 발행되었습니다');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || '저장에 실패했습니다');
    }
  };

  // 확정 (자동 전표 생성)
  const handleConfirm = async (inv: InvoiceListItem) => {
    try {
      await confirmInvoice(inv.id);
      showToast('success', `${inv.invoice_no} 확정 (자동 전표 생성)`);
      loadData();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || '확정에 실패했습니다');
    }
  };

  // 취소
  const handleCancel = async (inv: InvoiceListItem) => {
    try {
      await cancelInvoice(inv.id);
      showToast('success', `${inv.invoice_no} 취소됨`);
      loadData();
    } catch {
      showToast('error', '취소에 실패했습니다');
    }
  };

  // 현재 탭 합계
  const currentSummary = summary.find((s) => s.invoice_type === tab);

  // 페이지네이션
  const totalPages = data?.total_pages || 1;
  const pageNumbers = [];
  const startP = Math.max(1, page - 2);
  const endP = Math.min(totalPages, startP + 4);
  for (let i = startP; i <= endP; i++) pageNumbers.push(i);

  return (
    <div className="p-6 space-y-6">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">세금계산서</h1>
            <p className="text-sm text-gray-500 mt-0.5">매출/매입 세금계산서 발행 및 관리</p>
          </div>
        </div>
        {isManager && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            세금계산서 발행
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['issue', 'receive'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'issue' ? '매출 세금계산서' : '매입 세금계산서'}
          </button>
        ))}
      </div>

      {/* 기간 합계 */}
      {currentSummary && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">건수</p>
              <p className="text-lg font-bold text-gray-800">{currentSummary.count}건</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">공급가액 합계</p>
              <p className="text-lg font-bold text-gray-800">{formatAmount(currentSummary.total_supply)}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">부가세 합계</p>
              <p className="text-lg font-bold text-gray-800">{formatAmount(currentSummary.total_tax)}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">총 합계</p>
              <p className="text-lg font-bold text-amber-700">{formatAmount(currentSummary.total_amount)}원</p>
            </div>
          </div>
        </div>
      )}

      {/* 필터 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="계산서번호, 비고 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50"
            />
          </div>
          <input
            type="date" value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date" value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500"
          />
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

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">등록된 세금계산서가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">계산서번호</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">발행일</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">거래처</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">공급가액</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">부가세</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">합계</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">상태</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 hover:bg-amber-50/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoice_no}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.issue_date}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.customer_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800">{formatAmount(inv.supply_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800">{formatAmount(inv.tax_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatAmount(inv.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center ${
                      STATUS_COLORS[inv.status] || 'bg-gray-100'
                    }`}>
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {inv.status === 'draft' && isManager && (
                        <>
                          <button
                            onClick={() => openEdit(inv)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                            title="수정"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleConfirm(inv)}
                            className="p-1.5 rounded hover:bg-emerald-100 text-gray-500 hover:text-emerald-700"
                            title="확정 (자동 전표 생성)"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {inv.status !== 'cancelled' && isAdmin && (
                        <button
                          onClick={() => handleCancel(inv)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="취소"
                        >
                          <XMarkIcon className="w-4 h-4" />
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {pageNumbers.map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded text-sm ${n === page ? 'bg-amber-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-600'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editId ? '세금계산서 수정' : '세금계산서 발행'}
            </h3>

            {/* 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
              <select
                value={form.invoice_type}
                onChange={(e) => setForm({ ...form, invoice_type: e.target.value })}
                disabled={!!editId}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100"
              >
                <option value="issue">매출</option>
                <option value="receive">매입</option>
              </select>
            </div>

            {/* 발행일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">발행일</label>
              <input
                type="date" value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 거래처 검색 */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">거래처</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <span className="text-sm">{selectedCustomer.name}</span>
                  <button onClick={() => { setSelectedCustomer(null); setCustomerQuery(''); }}
                    className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <input
                  type="text" placeholder="거래처명 검색..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
              )}
              {showCustomerDD && customerResults.length > 0 && !selectedCustomer && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setForm({ ...form, customer_id: c.id });
                        setShowCustomerDD(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 border-b border-gray-50">
                      {c.name}
                      {c.business_no && <span className="ml-2 text-xs text-gray-400">{c.business_no}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 공급가액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">공급가액</label>
              <input
                type="number" min={0}
                value={form.supply_amount || ''}
                onChange={(e) => setForm({ ...form, supply_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 부가세 (자동 10%) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                부가세 <span className="text-gray-400 font-normal">(미입력 시 10% 자동)</span>
              </label>
              <input
                type="number" min={0}
                value={displayTax || ''}
                onChange={(e) => setForm({ ...form, tax_amount: parseFloat(e.target.value) || 0 })}
                placeholder={`${autoTax.toLocaleString()} (자동)`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 합계 표시 */}
            <div className="px-3 py-2 bg-amber-50 rounded-lg text-sm">
              합계: <strong className="font-mono">{formatAmount(totalAmount)}원</strong>
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
              <input
                type="text" value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="비고 입력 (선택)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium">
                {editId ? '수정' : '발행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
