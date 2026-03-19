/**
 * M2 영업/수주 — 수주 관리 페이지
 * 수주 목록 + 생성/수정 모달 + 상태 워크플로우 + 진행률
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  downloadStatementExcel,
  type SalesOrder,
  type SalesOrderFormData,
  type SalesOrderLine,
} from '../api/sales/orders';
import api from '../api/client';

import PdfOcrModal from '../components/PdfOcrModal';

/* ── 상태 라벨/색상 ── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '수주확정', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: '생산중', color: 'bg-amber-100 text-amber-700' },
  shipped: { label: '출하완료', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  invoiced: { label: '청구완료', color: 'bg-slate-200 text-slate-700' },
};

/* 작업지시서 상태 */
const WO_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-slate-200 text-slate-700' },
  in_progress: { label: '진행중', color: 'bg-amber-100 text-amber-700' },
  qc_wait: { label: 'QC대기', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
};

/* 출하 상태 */
const SH_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-slate-200 text-slate-700' },
  picked: { label: '피킹완료', color: 'bg-blue-100 text-blue-700' },
  shipped: { label: '출하완료', color: 'bg-purple-100 text-purple-700' },
  delivered: { label: '배송완료', color: 'bg-emerald-100 text-emerald-700' },
};

const emptyLine = (): SalesOrderLine => ({
  product_name: '', quantity: 1, unit_price: 0,
});

export default function SalesOrdersPage() {
  const [items, setItems] = useState<SalesOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  /* 모달 */
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SalesOrderFormData>({
    order_date: new Date().toISOString().slice(0, 10),
    customer_id: '',
    lines: [emptyLine()],
  });

  /* 상태 변경 모달 */
  const [statusModal, setStatusModal] = useState<{ id: string; current: string } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusMemo, setStatusMemo] = useState('');

  /* 연동 현황 모달 */
  const [trackingOrder, setTrackingOrder] = useState<SalesOrder | null>(null);
  const [trackingData, setTrackingData] = useState<{
    workOrders: any[];
    shipments: any[];
    loading: boolean;
  }>({ workOrders: [], shipments: [], loading: false });

  /* 자동 WO 생성 결과 */
  const [woResult, setWoResult] = useState<{
    work_orders?: any[];
    material_shortage?: any[];
    has_shortage?: boolean;
  } | null>(null);

  /* OCR 모달 */
  const [showOcrModal, setShowOcrModal] = useState(false);

  /* 거래처 목록 */
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listOrders({
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
    api.get('/system/customers', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setCustomers(
        (data?.items || data || []).map((c: any) => ({ id: c.id, name: c.name }))
      );
    });
  }, []);

  /* ── 모달 ── */
  const openCreate = () => {
    setEditId(null);
    setForm({
      order_date: new Date().toISOString().slice(0, 10),
      customer_id: customers[0]?.id || '',
      lines: [emptyLine()],
    });
    setShowModal(true);
  };

  const openEdit = (o: SalesOrder) => {
    setEditId(o.id);
    setForm({
      order_date: o.order_date,
      delivery_date: o.delivery_date || undefined,
      customer_id: o.customer_id,
      sales_rep_id: o.sales_rep_id || undefined,
      notes: o.notes || undefined,
      lines: o.lines.length > 0 ? o.lines : [emptyLine()],
    });
    setShowModal(true);
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
        await updateOrder(editId, form);
        setShowModal(false);
      } else {
        const result = await createOrder(form);
        setShowModal(false);
        // 자동 WO 생성 결과가 있으면 표시
        const resultData = result?.data || result;
        if (resultData?.work_orders && resultData.work_orders.length > 0) {
          setWoResult(resultData);
        }
      }
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '저장 실패');
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async (id: string, orderNo: string) => {
    if (!confirm(`수주 ${orderNo}을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteOrder(id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '삭제 실패');
    }
  };

  /* ── 상태 변경 ── */
  const openStatusModal = (id: string, current: string) => {
    setStatusModal({ id, current });
    setNewStatus('');
    setStatusMemo('');
  };

  const handleStatusChange = async () => {
    if (!statusModal || !newStatus) return;
    try {
      await updateOrderStatus(statusModal.id, newStatus, statusMemo || undefined);
      setStatusModal(null);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '상태 변경 실패');
    }
  };

  /* ── 연동 현황 조회 ── */
  const openTracking = async (order: SalesOrder) => {
    setTrackingOrder(order);
    setTrackingData({ workOrders: [], shipments: [], loading: true });
    try {
      const [woRes, shRes] = await Promise.all([
        api.get('/production/work-orders', { params: { order_id: order.id, size: 50 } }),
        api.get('/production/shipments', { params: { order_id: order.id, size: 50 } }),
      ]);
      const woData = woRes.data?.data || woRes.data;
      const shData = shRes.data?.data || shRes.data;
      setTrackingData({
        workOrders: woData?.items || woData || [],
        shipments: shData?.items || shData || [],
        loading: false,
      });
    } catch {
      setTrackingData({ workOrders: [], shipments: [], loading: false });
    }
  };

  /* ── 상태 전환 옵션 ── */
  const getNextStatuses = (current: string): string[] => {
    const transitions: Record<string, string[]> = {
      confirmed: ['in_production', 'shipped', 'completed'],
      in_production: ['shipped', 'completed'],
      shipped: ['completed', 'invoiced'],
      completed: ['invoiced'],
    };
    return transitions[current] || [];
  };

  /* 진행률 바 색상 */
  const progressColor = (pct: number) => {
    if (pct >= 100) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  const calcLineAmount = (line: SalesOrderLine) =>
    Math.round(line.quantity * line.unit_price);

  const formTotal = form.lines.reduce((sum, l) => sum + calcLineAmount(l), 0);
  const formTax = Math.round(formTotal * 0.1);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">수주 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            수주 등록, 진행률 추적, 상태 관리 (총 {total}건)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOcrModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            📄 발주서 OCR
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + 수주 등록
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-(--border-main) rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">전체 상태</option>
          <option value="confirmed">수주확정</option>
          <option value="in_production">생산중</option>
          <option value="shipped">출하완료</option>
          <option value="completed">완료</option>
          <option value="invoiced">청구완료</option>
        </select>
        <input
          placeholder="수주번호 검색..."
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
              <th className="px-4 py-2 text-left">수주번호</th>
              <th className="px-4 py-2 text-left">수주일</th>
              <th className="px-4 py-2 text-left">거래처</th>
              <th className="px-4 py-2 text-right">합계</th>
              <th className="px-4 py-2 text-center">상태</th>
              <th className="px-4 py-2 text-center">진행률</th>
              <th className="px-4 py-2 text-center">납기</th>
              <th className="px-4 py-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">로딩 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">수주 내역이 없습니다</td></tr>
            ) : (
              items.map((o) => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.confirmed;
                const nextStatuses = getNextStatuses(o.status);
                return (
                  <tr key={o.id} className="border-t border-[#e8ecf2] hover:bg-(--bg-hover)">
                    <td className="px-4 py-2 font-medium text-slate-700">{o.order_no}</td>
                    <td className="px-4 py-2 text-slate-600">{o.order_date}</td>
                    <td className="px-4 py-2 text-slate-600">{o.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      {o.grand_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center inline-block ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColor(o.progress_pct)}`}
                            style={{ width: `${o.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-500 w-8 text-right">{o.progress_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-slate-600">
                      {o.delivery_date || '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {o.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => openEdit(o)}
                              className="text-sm px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >수정</button>
                            <button
                              onClick={() => handleDelete(o.id, o.order_no)}
                              className="text-sm px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >삭제</button>
                          </>
                        )}
                        <button
                          onClick={() => openTracking(o)}
                          className="text-sm px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium"
                        >연동현황</button>
                        {nextStatuses.length > 0 && (
                          <button
                            onClick={() => openStatusModal(o.id, o.status)}
                            className="text-sm px-2 py-1 rounded bg-amber-50 text-amber-600 hover:bg-amber-100"
                          >상태변경</button>
                        )}
                        <button
                          onClick={() => downloadStatementExcel(o.id).catch(() => alert('다운로드 실패'))}
                          className="text-sm px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100"
                          title="거래명세서 Excel 다운로드"
                        >명세서</button>
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
                p === page ? 'bg-blue-600 text-white' : 'bg-white border border-(--border-main) text-slate-600 hover:bg-(--bg-card)'
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
              {editId ? '수주 수정' : '수주 등록'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">수주일 *</label>
                <input
                  type="date"
                  value={form.order_date}
                  onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">납기일</label>
                <input
                  type="date"
                  value={form.delivery_date || ''}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value || undefined })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">거래처 *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">선택</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">비고</label>
                <input
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                  placeholder="특이사항 입력"
                />
              </div>
            </div>

            {/* 자동 작업지시서 생성 옵션 (신규 등록 시만 표시) */}
            {!editId && (
              <div className="flex items-center gap-2 mb-4 bg-amber-50 rounded-lg px-4 py-3 border border-amber-200">
                <input
                  type="checkbox"
                  id="auto_create_wo"
                  checked={form.auto_create_wo || false}
                  onChange={(e) => setForm({ ...form, auto_create_wo: e.target.checked })}
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="auto_create_wo" className="text-sm text-amber-800 font-medium cursor-pointer">
                  작업지시서 자동 생성
                </label>
                <span className="text-sm text-amber-600 ml-1">
                  (수주 등록과 동시에 작업지시서를 자동으로 생성합니다)
                </span>
              </div>
            )}

            {/* 라인 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">품목 라인</h3>
                <button onClick={addLine} className="text-sm px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">
                  + 라인 추가
                </button>
              </div>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-(--bg-hover) rounded-lg p-3">
                    <div className="flex-1">
                      <label className="block text-sm text-slate-500 mb-0.5">품목명</label>
                      <input
                        value={line.product_name}
                        onChange={(e) => updateLine(idx, 'product_name', e.target.value)}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-sm text-slate-500 mb-0.5">수량</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-sm text-slate-500 mb-0.5">단가</label>
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28 text-right">
                      <label className="block text-sm text-slate-500 mb-0.5">금액</label>
                      <div className="text-sm font-medium text-slate-700 py-1">
                        {calcLineAmount(line).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-red-400 hover:text-red-600 text-lg pb-1"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 합계 */}
            <div className="flex justify-end gap-6 text-sm mb-6 border-t border-[#e8ecf2] pt-3">
              <div>공급가: <span className="font-semibold">{formTotal.toLocaleString()}</span></div>
              <div>부가세: <span className="font-semibold">{formTax.toLocaleString()}</span></div>
              <div>합계: <span className="font-bold text-blue-600">{(formTotal + formTax).toLocaleString()}</span></div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50">취소</button>
              <button
                onClick={handleSave}
                disabled={!form.customer_id || form.lines.every((l) => !l.product_name)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상태 변경 모달 ── */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">수주 상태 변경</h2>
            <p className="text-sm text-slate-500 mb-3">
              현재 상태: <span className="font-medium">{STATUS_MAP[statusModal.current]?.label}</span>
            </p>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-600 mb-1">변경할 상태 *</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">선택</option>
                {getNextStatuses(statusModal.current).map((s) => (
                  <option key={s} value={s}>{STATUS_MAP[s]?.label || s}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">사유 (선택)</label>
              <input
                value={statusMemo}
                onChange={(e) => setStatusMemo(e.target.value)}
                className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                placeholder="상태 변경 사유"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusModal(null)} className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50">취소</button>
              <button
                onClick={handleStatusChange}
                disabled={!newStatus}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >변경</button>
            </div>
          </div>
        </div>
      )}
      {/* ── 자동 WO 생성 결과 모달 ── */}
      {woResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">작업지시서 자동 생성 결과</h2>

            {/* 생성된 WO 목록 */}
            {woResult.work_orders && woResult.work_orders.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-emerald-700 mb-2">생성된 작업지시서 ({woResult.work_orders.length}건)</h3>
                <div className="space-y-1">
                  {woResult.work_orders.map((wo: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm bg-emerald-50 rounded px-3 py-2">
                      <span className="font-medium text-emerald-800">{wo.wo_no}</span>
                      <span className="text-emerald-600">{wo.product_name} — {wo.qty}개</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 부족 원자재 */}
            {woResult.has_shortage && woResult.material_shortage && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-red-700 mb-2">원자재 부족 알림 ({woResult.material_shortage.length}건)</h3>
                <div className="space-y-1">
                  {woResult.material_shortage.map((m: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm bg-red-50 rounded px-3 py-2">
                      <span className="text-red-800">{m.product_name}</span>
                      <span className="text-red-600">
                        필요: {m.required_qty} | 현재: {m.current_qty} | 부족: {m.shortage_qty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setWoResult(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 연동 현황 모달 ── */}
      {trackingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">수주 연동 현황</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {trackingOrder.order_no} · {trackingOrder.customer_name || '거래처'}
                </p>
              </div>
              <button
                onClick={() => setTrackingOrder(null)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >×</button>
            </div>

            {trackingData.loading ? (
              <div className="py-12 text-center text-slate-400">연동 정보를 불러오는 중...</div>
            ) : (
              <div className="space-y-6">
                {/* 수주 요약 카드 */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600 font-medium">상태</div>
                    <div className="text-sm font-bold text-blue-800 mt-1">
                      {STATUS_MAP[trackingOrder.status]?.label || trackingOrder.status}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 font-medium">합계금액</div>
                    <div className="text-sm font-bold text-slate-800 mt-1">
                      {trackingOrder.grand_total?.toLocaleString() || 0}원
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-amber-600 font-medium">작업지시서</div>
                    <div className="text-sm font-bold text-amber-800 mt-1">
                      {trackingData.workOrders.length}건
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-purple-600 font-medium">출하지시서</div>
                    <div className="text-sm font-bold text-purple-800 mt-1">
                      {trackingData.shipments.length}건
                    </div>
                  </div>
                </div>

                {/* 연동 흐름도 */}
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                  <span className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold">수주확정</span>
                  <span>→</span>
                  <span className={`px-3 py-1.5 rounded-lg font-semibold ${trackingData.workOrders.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                    작업지시 {trackingData.workOrders.length > 0 ? `(${trackingData.workOrders.length})` : '(미생성)'}
                  </span>
                  <span>→</span>
                  <span className={`px-3 py-1.5 rounded-lg font-semibold ${trackingData.workOrders.some((w: any) => w.status === 'completed') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    생산완료
                  </span>
                  <span>→</span>
                  <span className={`px-3 py-1.5 rounded-lg font-semibold ${trackingData.shipments.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
                    출하 {trackingData.shipments.length > 0 ? `(${trackingData.shipments.length})` : '(미생성)'}
                  </span>
                </div>

                {/* 작업지시서 섹션 */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    작업지시서 (생산)
                  </h3>
                  {trackingData.workOrders.length === 0 ? (
                    <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400">
                      아직 작업지시서가 생성되지 않았습니다.
                      <br />
                      <span className="text-xs">생산/SCM → 작업지시서에서 "수주→작업지시서 전환"으로 생성할 수 있습니다.</span>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left">지시번호</th>
                            <th className="px-3 py-2 text-left">품목</th>
                            <th className="px-3 py-2 text-center">상태</th>
                            <th className="px-3 py-2 text-right">계획</th>
                            <th className="px-3 py-2 text-right">생산</th>
                            <th className="px-3 py-2 text-center">진행률</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackingData.workOrders.map((wo: any) => {
                            const wst = WO_STATUS[wo.status] || WO_STATUS.pending;
                            return (
                              <tr key={wo.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium text-slate-700">{wo.wo_no}</td>
                                <td className="px-3 py-2 text-slate-600">{wo.product_name || '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center inline-block ${wst.color}`}>{wst.label}</span>
                                </td>
                                <td className="px-3 py-2 text-right">{wo.planned_qty?.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right">{wo.produced_qty?.toLocaleString() || 0}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${wo.progress_pct >= 100 ? 'bg-emerald-500' : wo.progress_pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                        style={{ width: `${wo.progress_pct || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500 w-7 text-right">{wo.progress_pct || 0}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 출하지시서 섹션 */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    출하지시서 (배송)
                  </h3>
                  {trackingData.shipments.length === 0 ? (
                    <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400">
                      아직 출하지시서가 생성되지 않았습니다.
                      <br />
                      <span className="text-xs">생산/SCM → 출하 관리에서 "수주→출하 생성"으로 생성할 수 있습니다.</span>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left">출하번호</th>
                            <th className="px-3 py-2 text-left">출하일</th>
                            <th className="px-3 py-2 text-center">상태</th>
                            <th className="px-3 py-2 text-left">택배사</th>
                            <th className="px-3 py-2 text-left">송장번호</th>
                            <th className="px-3 py-2 text-left">거래명세서</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackingData.shipments.map((sh: any) => {
                            const sst = SH_STATUS[sh.status] || SH_STATUS.pending;
                            return (
                              <tr key={sh.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium text-slate-700">{sh.shipment_no}</td>
                                <td className="px-3 py-2 text-slate-600">{sh.shipment_date || '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center inline-block ${sst.color}`}>{sst.label}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{sh.carrier_name || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{sh.tracking_no || '-'}</td>
                                <td className="px-3 py-2 text-slate-600">{sh.delivery_note_no || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 수주 라인별 생산/출하 현황 */}
                {trackingOrder.lines && trackingOrder.lines.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      품목별 수주/생산/출하 현황
                    </h3>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left">품목</th>
                            <th className="px-3 py-2 text-right">수주수량</th>
                            <th className="px-3 py-2 text-right">생산완료</th>
                            <th className="px-3 py-2 text-right">출하완료</th>
                            <th className="px-3 py-2 text-center">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackingOrder.lines.map((line: any, idx: number) => {
                            const ordQty = line.quantity || 0;
                            const prodQty = line.produced_qty || 0;
                            const shipQty = line.shipped_qty || 0;
                            const done = shipQty >= ordQty;
                            const partial = prodQty > 0 || shipQty > 0;
                            return (
                              <tr key={idx} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-slate-700">{line.product_name}</td>
                                <td className="px-3 py-2 text-right">{ordQty.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right">{prodQty.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right">{shipQty.toLocaleString()}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center inline-block ${
                                    done ? 'bg-emerald-100 text-emerald-700' :
                                    partial ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {done ? '완료' : partial ? '진행중' : '대기'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setTrackingOrder(null)}
                className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF OCR 모달 ── */}
      {showOcrModal && (
        <PdfOcrModal
          customers={customers}
          onClose={() => setShowOcrModal(false)}
          onOrderCreated={fetchData}
        />
      )}
    </div>
  );
}
