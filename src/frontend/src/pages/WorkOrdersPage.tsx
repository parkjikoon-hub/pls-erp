/**
 * M5 생산/SCM — 작업지시서 관리 페이지
 * 칸반 보드 + 리스트 뷰 + 수주 전환
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listWorkOrders, createWorkOrder, createFromOrder,
  updateWorkOrderStatus, updateWorkOrderProgress,
  type WorkOrder, type WorkOrderFormData, type FromOrderResult,
} from '../api/production/workOrders';
import api from '../api/client';


/* 상태 라벨/색상 */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '대기', color: 'text-slate-700', bg: 'bg-slate-100' },
  in_progress: { label: '진행중', color: 'text-blue-700', bg: 'bg-blue-100' },
  qc_wait: { label: 'QC대기', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: '완료', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

const KANBAN_COLUMNS = ['pending', 'in_progress', 'qc_wait', 'completed'] as const;
const NEXT_STATUS: Record<string, string> = {
  pending: 'in_progress', in_progress: 'qc_wait', qc_wait: 'completed',
};

export default function WorkOrdersPage() {
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [statusFilter, setStatusFilter] = useState('');

  /* 생성 모달 */
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<WorkOrderFormData>({
    product_id: '', planned_qty: 1, due_date: new Date().toISOString().slice(0, 10),
  });

  /* 수주 선택 모달 */
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [fromOrderResult, setFromOrderResult] = useState<FromOrderResult | null>(null);

  /* 생산수량 보고 모달 */
  const [showProgress, setShowProgress] = useState(false);
  const [progressWo, setProgressWo] = useState<WorkOrder | null>(null);
  const [progressQty, setProgressQty] = useState(0);

  /* 품목/사용자 목록 */
  const [products, setProducts] = useState<{ id: string; name: string; code: string }[]>([]);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listWorkOrders({
        status: statusFilter || undefined,
        page, size: 100,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/system/products', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setProducts(
        (data?.items || data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code }))
      );
    });
  }, []);

  /* ── 상태 변경 ── */
  const handleStatusChange = async (woId: string, newStatus: string) => {
    try {
      await updateWorkOrderStatus(woId, newStatus);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '상태 변경 실패');
    }
  };

  /* ── 생산 수량 보고 ── */
  const openProgress = (wo: WorkOrder) => {
    setProgressWo(wo);
    setProgressQty(wo.produced_qty);
    setShowProgress(true);
  };

  const handleProgress = async () => {
    if (!progressWo) return;
    try {
      await updateWorkOrderProgress(progressWo.id, progressQty);
      setShowProgress(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '보고 실패');
    }
  };

  /* ── 작업지시서 생성 ── */
  const handleCreate = async () => {
    if (!form.product_id) { alert('품목을 선택해주세요'); return; }
    try {
      await createWorkOrder(form);
      setShowCreate(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '생성 실패');
    }
  };

  /* ── 수주→작업지시서 ── */
  const openOrderModal = async () => {
    try {
      const res = await api.get('/sales/orders', { params: { status: 'confirmed', size: 100 } });
      setOrders(res.data?.data?.items || []);
      setFromOrderResult(null);
      setShowOrderModal(true);
    } catch (e) { console.error(e); }
  };

  const handleFromOrder = async (orderId: string) => {
    try {
      const result = await createFromOrder(orderId);
      setFromOrderResult(result);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '전환 실패');
    }
  };

  /* ── 칸반 카드 ── */
  const KanbanCard = ({ wo }: { wo: WorkOrder }) => {
    const isOverdue = new Date(wo.due_date) < new Date() && wo.status !== 'completed';
    const nextStatus = NEXT_STATUS[wo.status];

    return (
      <div className={`p-3 rounded-lg border ${isOverdue ? 'border-red-300 bg-red-50' : 'border-(--border-main) bg-white'} mb-2`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-slate-500">{wo.wo_no}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            wo.order_type === 'make_to_order' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
          }`}>
            {wo.order_type === 'make_to_order' ? '수주' : '계획'}
          </span>
        </div>
        <div className="font-medium text-sm text-slate-800 mb-1">{wo.product_name}</div>
        {wo.order_no && (
          <div className="text-xs text-slate-400 mb-1">수주: {wo.order_no}</div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${wo.progress_pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{wo.progress_pct}%</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{wo.produced_qty}/{wo.planned_qty}</span>
          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>{wo.due_date}</span>
        </div>
        <div className="flex gap-1 mt-2">
          {nextStatus && (
            <button
              onClick={() => handleStatusChange(wo.id, nextStatus)}
              className="flex-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              → {STATUS_MAP[nextStatus]?.label}
            </button>
          )}
          {(wo.status === 'in_progress' || wo.status === 'qc_wait') && (
            <button
              onClick={() => openProgress(wo)}
              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100"
            >
              수량
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">작업지시서</h1>
          <p className="text-sm text-slate-500 mt-1">
            생산 작업 관리 · 칸반 보드 (총 {total}건)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
            className="px-3 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            {viewMode === 'kanban' ? '리스트 뷰' : '칸반 뷰'}
          </button>
          <button
            onClick={openOrderModal}
            className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            수주 → 작업지시서
          </button>
          <button
            onClick={() => { setForm({ product_id: '', planned_qty: 1, due_date: new Date().toISOString().slice(0, 10) }); setShowCreate(true); }}
            className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            + 계획생산
          </button>
        </div>
      </div>

      {/* 칸반 뷰 */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = items.filter((wo) => wo.status === col);
            const st = STATUS_MAP[col];
            return (
              <div key={col} className="min-h-[300px]">
                <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg ${st.bg}`}>
                  <span className={`font-semibold text-sm ${st.color}`}>{st.label}</span>
                  <span className="text-xs text-slate-400">{colItems.length}</span>
                </div>
                <div className="space-y-0">
                  {colItems.map((wo) => <KanbanCard key={wo.id} wo={wo} />)}
                  {colItems.length === 0 && (
                    <div className="text-center text-sm text-slate-300 py-8">없음</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-(--bg-card) text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">지시번호</th>
                <th className="px-4 py-2 text-center">유형</th>
                <th className="px-4 py-2 text-left">품목</th>
                <th className="px-4 py-2 text-right">계획</th>
                <th className="px-4 py-2 text-right">생산</th>
                <th className="px-4 py-2 text-center">진행률</th>
                <th className="px-4 py-2 text-center">상태</th>
                <th className="px-4 py-2 text-left">납기일</th>
                <th className="px-4 py-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((wo) => {
                const st = STATUS_MAP[wo.status] || STATUS_MAP.pending;
                const isOverdue = new Date(wo.due_date) < new Date() && wo.status !== 'completed';
                return (
                  <tr key={wo.id} className={`border-t border-[#e8ecf2] ${isOverdue ? 'bg-red-50' : 'hover:bg-(--bg-hover)'}`}>
                    <td className="px-4 py-2 font-mono text-slate-700">{wo.wo_no}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-sm px-2.5 py-1 rounded font-medium min-w-[3.5rem] text-center inline-block ${
                        wo.order_type === 'make_to_order' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {wo.order_type === 'make_to_order' ? '수주' : '계획'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{wo.product_name}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{wo.planned_qty}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{wo.produced_qty}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${wo.progress_pct}%` }} />
                        </div>
                        <span className="text-sm text-slate-500 w-8">{wo.progress_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-sm px-2.5 py-1 rounded font-medium min-w-[3.5rem] text-center inline-block ${st.bg} ${st.color}`}>{st.label}</span>
                    </td>
                    <td className={`px-4 py-2 ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{wo.due_date}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {NEXT_STATUS[wo.status] && (
                          <button
                            onClick={() => handleStatusChange(wo.id, NEXT_STATUS[wo.status])}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          >
                            → {STATUS_MAP[NEXT_STATUS[wo.status]]?.label}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 작업지시서 생성 모달 ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">계획생산 작업지시서</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">생산 품목 *</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">선택...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">계획 수량 *</label>
                <input
                  type="number" min={1} value={form.planned_qty}
                  onChange={(e) => setForm({ ...form, planned_qty: Number(e.target.value) })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">납기일 *</label>
                <input
                  type="date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">비고</label>
                <input
                  type="text" value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-(--border-main) rounded-lg text-sm">취소</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">생성</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수주 선택 모달 ── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">수주 → 작업지시서 전환</h2>

            {fromOrderResult ? (
              <div>
                <div className="mb-3">
                  <span className="font-medium text-emerald-700">
                    수주 {fromOrderResult.order_no}에서 {fromOrderResult.work_orders.length}건 생성됨
                  </span>
                </div>
                {fromOrderResult.has_shortage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <div className="font-medium text-red-700 mb-2">원자재 부족 알림</div>
                    <table className="w-full text-sm">
                      <thead className="text-red-600">
                        <tr>
                          <th className="text-left py-1">원자재</th>
                          <th className="text-right py-1">필요</th>
                          <th className="text-right py-1">현재</th>
                          <th className="text-right py-1">부족</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fromOrderResult.material_shortage.map((m) => (
                          <tr key={m.product_id} className="border-t border-red-100">
                            <td className="py-1">{m.product_name}</td>
                            <td className="text-right py-1">{m.required_qty}</td>
                            <td className="text-right py-1">{m.current_qty}</td>
                            <td className="text-right py-1 font-bold text-red-700">{m.shortage_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => setShowOrderModal(false)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">확인</button>
                </div>
              </div>
            ) : (
              <div>
                <table className="w-full text-sm mb-4">
                  <thead className="bg-(--bg-card) text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">수주번호</th>
                      <th className="px-3 py-2 text-left">거래처</th>
                      <th className="px-3 py-2 text-left">수주일</th>
                      <th className="px-3 py-2 text-right">합계</th>
                      <th className="px-3 py-2 text-center">전환</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">전환 가능한 수주가 없습니다</td></tr>
                    ) : (
                      orders.map((o: any) => (
                        <tr key={o.id} className="border-t border-[#e8ecf2] hover:bg-(--bg-hover)">
                          <td className="px-3 py-2 font-medium">{o.order_no}</td>
                          <td className="px-3 py-2 text-slate-600">{o.customer_name}</td>
                          <td className="px-3 py-2 text-slate-500">{o.order_date}</td>
                          <td className="px-3 py-2 text-right">{(o.grand_total || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleFromOrder(o.id)}
                              className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            >
                              전환
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="flex justify-end">
                  <button onClick={() => setShowOrderModal(false)} className="px-4 py-2 border border-(--border-main) rounded-lg text-sm">닫기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 생산 수량 보고 모달 ── */}
      {showProgress && progressWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-2">생산 수량 보고</h2>
            <p className="text-sm text-slate-500 mb-4">{progressWo.wo_no} — {progressWo.product_name}</p>
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-1">
                생산 완료 수량 (계획: {progressWo.planned_qty})
              </label>
              <input
                type="number" min={0} max={progressWo.planned_qty}
                value={progressQty}
                onChange={(e) => setProgressQty(Number(e.target.value))}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowProgress(false)} className="px-4 py-2 border border-(--border-main) rounded-lg text-sm">취소</button>
              <button onClick={handleProgress} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">보고</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
