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
  type SalesOrder,
  type SalesOrderFormData,
  type SalesOrderLine,
} from '../api/sales/orders';
import api from '../api/axios';

/* ── 상태 라벨/색상 ── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '수주확정', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: '생산중', color: 'bg-amber-100 text-amber-700' },
  shipped: { label: '출하완료', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  invoiced: { label: '청구완료', color: 'bg-slate-200 text-slate-700' },
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
      } else {
        await createOrder(form);
      }
      setShowModal(false);
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
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 수주 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm bg-white"
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
          className="border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
        />
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-[#c8ced8] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#e8ecf2] text-slate-600">
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
                  <tr key={o.id} className="border-t border-[#e8ecf2] hover:bg-[#f1f4f8]">
                    <td className="px-4 py-2 font-medium text-slate-700">{o.order_no}</td>
                    <td className="px-4 py-2 text-slate-600">{o.order_date}</td>
                    <td className="px-4 py-2 text-slate-600">{o.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      {o.grand_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
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
                        <span className="text-xs text-slate-500 w-8 text-right">{o.progress_pct}%</span>
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
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >수정</button>
                            <button
                              onClick={() => handleDelete(o.id, o.order_no)}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >삭제</button>
                          </>
                        )}
                        {nextStatuses.length > 0 && (
                          <button
                            onClick={() => openStatusModal(o.id, o.status)}
                            className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600 hover:bg-amber-100"
                          >상태변경</button>
                        )}
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
                p === page ? 'bg-blue-600 text-white' : 'bg-white border border-[#c8ced8] text-slate-600 hover:bg-[#e8ecf2]'
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
                <label className="block text-xs font-medium text-slate-600 mb-1">수주일 *</label>
                <input
                  type="date"
                  value={form.order_date}
                  onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">납기일</label>
                <input
                  type="date"
                  value={form.delivery_date || ''}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value || undefined })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">거래처 *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
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
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                  placeholder="특이사항 입력"
                />
              </div>
            </div>

            {/* 라인 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">품목 라인</h3>
                <button onClick={addLine} className="text-xs px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">
                  + 라인 추가
                </button>
              </div>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-[#f1f4f8] rounded-lg p-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-0.5">품목명</label>
                      <input
                        value={line.product_name}
                        onChange={(e) => updateLine(idx, 'product_name', e.target.value)}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-0.5">수량</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-slate-500 mb-0.5">단가</label>
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-right"
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
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-[#c8ced8] rounded-lg text-sm text-slate-600 hover:bg-slate-50">취소</button>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">변경할 상태 *</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">선택</option>
                {getNextStatuses(statusModal.current).map((s) => (
                  <option key={s} value={s}>{STATUS_MAP[s]?.label || s}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">사유 (선택)</label>
              <input
                value={statusMemo}
                onChange={(e) => setStatusMemo(e.target.value)}
                className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                placeholder="상태 변경 사유"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusModal(null)} className="px-4 py-2 border border-[#c8ced8] rounded-lg text-sm text-slate-600 hover:bg-slate-50">취소</button>
              <button
                onClick={handleStatusChange}
                disabled={!newStatus}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >변경</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
