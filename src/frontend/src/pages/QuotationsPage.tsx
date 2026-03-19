/**
 * M2 영업/수주 — 견적서 관리 페이지
 * 견적서 목록 + 생성/수정 모달 + 상태 관리
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listQuotations,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  updateQuotationStatus,
  convertToOrder,
  downloadQuotationExcel,
  type Quotation,
  type QuotationFormData,
  type QuotationLine,
} from '../api/sales/quotations';
import { fetchCustomerPrices, type CustomerPrice } from '../api/sales/priceLists';
import { checkQuotationMaterials, type QuotationCheckResult } from '../api/production/inventory';
import api from '../api/client';
import BackButton from '../components/BackButton';

/* ── 상태 라벨/색상 매핑 ── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '작성중', color: 'bg-slate-200 text-slate-700' },
  sent: { label: '발송됨', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: '수락됨', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절됨', color: 'bg-red-100 text-red-700' },
};

/* ── 빈 라인 생성 ── */
const emptyLine = (): QuotationLine => ({
  product_name: '', quantity: 1, unit_price: 0, discount_rate: 0,
});

export default function QuotationsPage() {
  const [items, setItems] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  /* 모달 상태 */
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuotationFormData>({
    quote_date: new Date().toISOString().slice(0, 10),
    customer_id: '',
    lines: [emptyLine()],
  });

  /* 거래처 목록 (드롭다운) */
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  /* 품목 목록 (드롭다운) */
  const [products, setProducts] = useState<{ id: string; code: string; name: string; standard_price: number }[]>([]);

  /* 거래처별 품목 가격 캐시 — 거래처 선택 시 일괄 조회 */
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([]);

  /* 라인별 가격 출처 표시 */
  const [linePriceSources, setLinePriceSources] = useState<Record<number, string>>({});

  /* 재고 사전 체크 결과 */
  const [stockCheckResult, setStockCheckResult] = useState<QuotationCheckResult | null>(null);
  const [stockCheckLoading, setStockCheckLoading] = useState(false);

  /* 수주 전환 모달 */
  const [convertModal, setConvertModal] = useState<{ show: boolean; quotation: Quotation | null; orderDate: string }>({
    show: false, quotation: null, orderDate: new Date().toISOString().slice(0, 10),
  });
  const [convertLoading, setConvertLoading] = useState(false);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listQuotations({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        size: 20,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    /* 거래처 목록 로드 */
    api.get('/system/customers', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setCustomers(
        (data?.items || data || []).map((c: any) => ({ id: c.id, name: c.name }))
      );
    });
    /* 품목 목록 로드 */
    api.get('/system/products', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setProducts(
        (data?.items || data || []).map((p: any) => ({
          id: p.id, code: p.code || '', name: p.name,
          standard_price: p.standard_price || 0,
        }))
      );
    });
  }, []);

  /* 거래처 변경 시 → 해당 거래처의 품목별 가격 일괄 조회 */
  const loadCustomerPrices = useCallback(async (customerId: string) => {
    if (!customerId) { setCustomerPrices([]); return; }
    try {
      const res = await fetchCustomerPrices(customerId);
      /* API 응답 구조: { data: [...] } 또는 배열 직접 */
      const prices = (res as any)?.data || res;
      setCustomerPrices(Array.isArray(prices) ? prices : []);
    } catch {
      setCustomerPrices([]);
    }
  }, []);

  /* 품목 선택 시 가격 자동 채움 */
  const applyPriceForProduct = useCallback((lineIdx: number, productId: string) => {
    if (!productId) return;
    /* 1순위: 거래처별 특별단가 */
    const cp = customerPrices.find((p) => p.product_id === productId);
    if (cp) {
      updateLine(lineIdx, 'unit_price', cp.unit_price);
      setLinePriceSources((prev) => ({ ...prev, [lineIdx]: cp.source === 'customer_special' ? '특별단가' : '기본가' }));
      return;
    }
    /* 2순위: 품목 기본 판매가 */
    const prod = products.find((p) => p.id === productId);
    if (prod && prod.standard_price > 0) {
      updateLine(lineIdx, 'unit_price', prod.standard_price);
      setLinePriceSources((prev) => ({ ...prev, [lineIdx]: '기본가' }));
      return;
    }
    /* 가격 미등록 */
    setLinePriceSources((prev) => ({ ...prev, [lineIdx]: '미등록' }));
  }, [customerPrices, products]);

  /* ── 모달 열기/닫기 ── */
  const openCreate = () => {
    setEditId(null);
    const cid = customers[0]?.id || '';
    setForm({
      quote_date: new Date().toISOString().slice(0, 10),
      customer_id: cid,
      lines: [emptyLine()],
    });
    setLinePriceSources({});
    if (cid) loadCustomerPrices(cid);
    setShowModal(true);
  };

  const openEdit = async (q: Quotation) => {
    setEditId(q.id);
    setForm({
      quote_date: q.quote_date,
      valid_until: q.valid_until || undefined,
      customer_id: q.customer_id,
      sales_rep_id: q.sales_rep_id || undefined,
      notes: q.notes || undefined,
      lines: q.lines.length > 0 ? q.lines : [emptyLine()],
    });
    setLinePriceSources({});
    if (q.customer_id) loadCustomerPrices(q.customer_id);
    setShowModal(true);
  };

  /* 수주 전환 결과 모달 */
  const [convertResult, setConvertResult] = useState<any>(null);

  /* ── 수주 전환 실행 ── */
  const handleConvert = async () => {
    if (!convertModal.quotation) return;
    setConvertLoading(true);
    try {
      const result = await convertToOrder(convertModal.quotation.id, convertModal.orderDate);
      const data = result?.data || result;
      setConvertModal({ show: false, quotation: null, orderDate: new Date().toISOString().slice(0, 10) });
      setConvertResult(data);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '수주 전환 실패');
    } finally {
      setConvertLoading(false);
    }
  };

  /* ── 라인 관리 ── */
  const updateLine = (idx: number, field: string, value: any) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });
  };
  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  const removeLine = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((_, i) => i !== idx) : prev.lines,
    }));
  };

  /* ── 저장 ── */
  const handleSave = async () => {
    try {
      if (editId) {
        await updateQuotation(editId, form);
      } else {
        await createQuotation(form);
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '저장 실패');
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async (id: string, quoteNo: string) => {
    if (!confirm(`견적서 ${quoteNo}을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteQuotation(id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '삭제 실패');
    }
  };

  /* ── 상태 변경 ── */
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateQuotationStatus(id, newStatus);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '상태 변경 실패');
    }
  };

  /* ── 재고 사전 체크 ── */
  const handleStockCheck = async () => {
    const validLines = form.lines
      .filter((l) => l.product_id && l.quantity > 0)
      .map((l) => ({ product_id: l.product_id!, quantity: l.quantity }));
    if (validLines.length === 0) {
      alert('품목을 하나 이상 선택해주세요');
      return;
    }
    setStockCheckLoading(true);
    try {
      const result = await checkQuotationMaterials(validLines);
      setStockCheckResult(result);
    } catch (e: any) {
      alert(e?.response?.data?.detail || '재고 체크 실패');
    } finally {
      setStockCheckLoading(false);
    }
  };

  /* ── 라인 소계 계산 ── */
  const calcLineAmount = (line: QuotationLine) =>
    Math.round(line.quantity * line.unit_price * (1 - (line.discount_rate || 0) / 100));

  const formTotal = form.lines.reduce((sum, l) => sum + calcLineAmount(l), 0);
  const formTax = Math.round(formTotal * 0.1);

  return (
    <div>
      {/* 뒤로가기 */}
      <div className="mb-4">
        <BackButton to="/sales" label="영업수주" />
      </div>
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">견적서 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            견적서 작성, 발송, 수락/거절 관리 (총 {total}건)
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          + 견적서 작성
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-(--border-main) rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">전체 상태</option>
          <option value="draft">작성중</option>
          <option value="sent">발송됨</option>
          <option value="accepted">수락됨</option>
          <option value="rejected">거절됨</option>
        </select>
        <input
          placeholder="견적번호 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-(--border-main) rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
        />
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-(--bg-card) text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">견적번호</th>
              <th className="px-4 py-2 text-left">견적일</th>
              <th className="px-4 py-2 text-left">거래처</th>
              <th className="px-4 py-2 text-right">공급가</th>
              <th className="px-4 py-2 text-right">부가세</th>
              <th className="px-4 py-2 text-right">합계</th>
              <th className="px-4 py-2 text-center">상태</th>
              <th className="px-4 py-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">로딩 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">견적서가 없습니다</td></tr>
            ) : (
              items.map((q) => {
                const st = STATUS_MAP[q.status] || STATUS_MAP.draft;
                return (
                  <tr key={q.id} className="border-t border-[#e8ecf2] hover:bg-(--bg-hover)">
                    <td className="px-4 py-2 font-medium text-slate-700">{q.quote_no}</td>
                    <td className="px-4 py-2 text-slate-600">{q.quote_date}</td>
                    <td className="px-4 py-2 text-slate-600">{q.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {q.total_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {q.tax_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      {q.grand_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {q.status === 'draft' && (
                          <>
                            <button
                              onClick={() => openEdit(q)}
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >수정</button>
                            <button
                              onClick={() => handleStatusChange(q.id, 'sent')}
                              className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            >발송</button>
                            <button
                              onClick={() => handleDelete(q.id, q.quote_no)}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >삭제</button>
                          </>
                        )}
                        {q.status === 'sent' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(q.id, 'accepted')}
                              className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            >수락</button>
                            <button
                              onClick={() => handleStatusChange(q.id, 'rejected')}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >거절</button>
                          </>
                        )}
                        {q.status === 'accepted' && (
                          <button
                            onClick={() => setConvertModal({ show: true, quotation: q, orderDate: new Date().toISOString().slice(0, 10) })}
                            className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium"
                          >수주전환</button>
                        )}
                        <button
                          onClick={() => downloadQuotationExcel(q.id).catch(() => alert('다운로드 실패'))}
                          className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100"
                          title="견적서 Excel 다운로드"
                        >Excel</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${
                p === page ? 'bg-emerald-600 text-white' : 'bg-white border border-(--border-main) text-slate-600 hover:bg-(--bg-card)'
              }`}
            >{p}</button>
          ))}
        </div>
      )}

      {/* ── 생성/수정 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editId ? '견적서 수정' : '견적서 작성'}
            </h2>

            {/* 헤더 정보 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">견적일 *</label>
                <input
                  type="date"
                  value={form.quote_date}
                  onChange={(e) => setForm({ ...form, quote_date: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">유효기한</label>
                <input
                  type="date"
                  value={form.valid_until || ''}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value || undefined })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">거래처 *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setForm({ ...form, customer_id: cid });
                    loadCustomerPrices(cid);
                  }}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">선택</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
                <input
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                  placeholder="특이사항 입력"
                />
              </div>
            </div>

            {/* 품목 라인 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">품목 라인</h3>
                <button onClick={addLine} className="text-xs px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">
                  + 라인 추가
                </button>
              </div>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-(--bg-hover) rounded-lg p-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs text-slate-500 mb-0.5">품목</label>
                      <select
                        value={line.product_id || ''}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const prod = products.find((p) => p.id === pid);
                          updateLine(idx, 'product_id', pid);
                          updateLine(idx, 'product_name', prod?.name || '');
                          /* 품목 선택 시 자동 단가 적용 */
                          if (pid && form.customer_id) {
                            setTimeout(() => applyPriceForProduct(idx, pid), 0);
                          }
                        }}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm"
                      >
                        <option value="">품목 선택</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-0.5">수량</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-slate-500 mb-0.5">
                        단가
                        {linePriceSources[idx] && (
                          <span className={`ml-1 text-[10px] px-1 rounded ${
                            linePriceSources[idx] === '특별단가' ? 'bg-amber-100 text-amber-700'
                            : linePriceSources[idx] === '기본가' ? 'bg-blue-100 text-blue-600'
                            : 'bg-slate-100 text-slate-500'
                          }`}>{linePriceSources[idx]}</span>
                        )}
                      </label>
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => {
                          updateLine(idx, 'unit_price', Number(e.target.value));
                          setLinePriceSources((prev) => ({ ...prev, [idx]: '수동입력' }));
                        }}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-0.5">할인(%)</label>
                      <input
                        type="number"
                        value={line.discount_rate || 0}
                        onChange={(e) => updateLine(idx, 'discount_rate', Number(e.target.value))}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28 text-right">
                      <label className="block text-xs text-slate-500 mb-0.5">금액</label>
                      <div className="text-sm font-medium text-slate-700 py-1">
                        {calcLineAmount(line).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-red-400 hover:text-red-600 text-lg pb-1"
                      title="라인 삭제"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 합계 */}
            <div className="flex justify-end gap-6 text-sm mb-6 border-t border-[#e8ecf2] pt-3">
              <div>공급가: <span className="font-semibold">{formTotal.toLocaleString()}</span></div>
              <div>부가세: <span className="font-semibold">{formTax.toLocaleString()}</span></div>
              <div>합계: <span className="font-bold text-emerald-600">{(formTotal + formTax).toLocaleString()}</span></div>
            </div>

            {/* 재고 사전 체크 */}
            <div className="mb-4">
              <button
                onClick={handleStockCheck}
                disabled={stockCheckLoading || form.lines.every((l) => !l.product_id)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {stockCheckLoading ? '확인 중...' : '재고/원자재 사전 확인'}
              </button>

              {stockCheckResult && (
                <div className="mt-3 border border-slate-200 rounded-lg p-4 bg-slate-50 text-sm">
                  <h4 className="font-semibold text-slate-700 mb-2">재고/원자재 사전 체크 결과</h4>

                  {/* 종합 판정 */}
                  <div className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    stockCheckResult.summary.ready_to_ship ? 'bg-emerald-50 text-emerald-700'
                    : stockCheckResult.summary.can_produce ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
                  }`}>
                    {stockCheckResult.summary.ready_to_ship
                      ? '즉시 출하 가능 — 완제품 재고 충분'
                      : stockCheckResult.summary.can_produce
                        ? '생산 필요 — 원자재 확보됨'
                        : `원자재 구매 필요 — 부족: ${stockCheckResult.summary.shortage_materials.join(', ')}`
                    }
                  </div>

                  {/* 품목별 상세 */}
                  {stockCheckResult.items.map((item) => (
                    <div key={item.product_id} className="mb-2 bg-white rounded-lg p-3 border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-slate-700">
                          [{item.product_code}] {item.product_name} ({item.requested_qty}개 요청)
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          !item.need_production ? 'bg-emerald-100 text-emerald-700'
                          : item.materials.some((m) => m.is_shortage) ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          {!item.need_production ? '출하 가능' : item.materials.some((m) => m.is_shortage) ? '구매 필요' : '생산 가능'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        완제품 재고: {item.finished_stock}개
                        {item.need_production && <span className="text-amber-600 ml-2">부족: {item.finished_shortage}개 → 생산 필요</span>}
                      </div>

                      {item.materials.length > 0 && (
                        <div className="mt-2 ml-4">
                          <div className="text-xs text-slate-500 mb-1">원자재 현황:</div>
                          {item.materials.map((m) => (
                            <div key={m.material_id} className="flex items-center gap-2 text-xs py-0.5">
                              <span className={`w-2 h-2 rounded-full ${m.is_shortage ? 'bg-red-500' : 'bg-emerald-500'}`} />
                              <span className="text-slate-600">{m.material_name}</span>
                              <span className="text-slate-400">
                                필요 {m.required_qty} / 현재 {m.current_stock}
                              </span>
                              {m.is_shortage && (
                                <span className="text-red-600 font-medium">부족 {m.shortage_qty}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowModal(false); setStockCheckResult(null); }}
                className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >취소</button>
              <button
                onClick={handleSave}
                disabled={!form.customer_id || form.lines.every((l) => !l.product_id && !l.product_name)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수주 전환 확인 모달 ── */}
      {convertModal.show && convertModal.quotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">수주 전환</h2>
            <p className="text-sm text-slate-600 mb-4">
              견적서 <span className="font-semibold">{convertModal.quotation.quote_no}</span>을(를)
              수주로 전환하시겠습니까?
            </p>
            <div className="mb-2 text-sm text-slate-500">
              거래처: {convertModal.quotation.customer_name} | 합계: {convertModal.quotation.grand_total.toLocaleString()}원
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">수주일 *</label>
              <input
                type="date"
                value={convertModal.orderDate}
                onChange={(e) => setConvertModal({ ...convertModal, orderDate: e.target.value })}
                className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConvertModal({ show: false, quotation: null, orderDate: '' })}
                className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >취소</button>
              <button
                onClick={handleConvert}
                disabled={convertLoading || !convertModal.orderDate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >{convertLoading ? '처리 중...' : '수주 전환'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수주 전환 결과 모달 (스마트 분기) ── */}
      {convertResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">수주 전환 완료</h2>

            <div className="mb-3 text-sm text-slate-600">
              수주번호: <span className="font-semibold text-slate-800">{convertResult.order_no}</span>
            </div>

            {/* 스마트 분기 결과 */}
            {convertResult.smart_action && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                convertResult.smart_action === 'ready_to_ship' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : convertResult.has_shortage ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <div className="font-semibold mb-1">
                  {convertResult.smart_action === 'ready_to_ship' ? '즉시 출하 가능'
                  : convertResult.has_shortage ? '원자재 구매 필요'
                  : '생산 시작 가능'}
                </div>
                <div className="text-xs opacity-80">{convertResult.smart_message}</div>
              </div>
            )}

            {/* 생성된 작업지시서 목록 */}
            {convertResult.work_orders?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-600 mb-1">생성된 작업지시서:</div>
                <div className="space-y-1">
                  {convertResult.work_orders.map((wo: any, i: number) => (
                    <div key={i} className="text-xs bg-slate-50 rounded px-3 py-1.5 text-slate-600">
                      {wo.wo_no} — {wo.product_name} ({wo.order_qty}개)
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 부족 원자재 */}
            {convertResult.material_shortage?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-red-600 mb-1">부족 원자재:</div>
                <div className="space-y-1">
                  {convertResult.material_shortage.map((m: any, i: number) => (
                    <div key={i} className="text-xs bg-red-50 rounded px-3 py-1.5 text-red-600">
                      {m.product_name} — 필요 {m.required_qty} / 현재 {m.current_qty} (부족: {m.shortage_qty})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setConvertResult(null)}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
              >확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
