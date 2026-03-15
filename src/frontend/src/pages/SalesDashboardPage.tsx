/**
 * M2 영업/수주 — 영업 현황 대시보드
 * 수주 현황 요약 카드 + 최근 견적/수주 목록
 */
import { useState, useEffect } from 'react';
import { listQuotations, type Quotation } from '../api/sales/quotations';
import { listOrders, type SalesOrder } from '../api/sales/orders';

/* ── 상태 라벨 ── */
const QT_STATUS: Record<string, string> = {
  draft: '작성중', sent: '발송됨', accepted: '수락됨', rejected: '거절됨',
};
const SO_STATUS: Record<string, string> = {
  confirmed: '수주확정', in_production: '생산중', shipped: '출하완료',
  completed: '완료', invoiced: '청구완료',
};

export default function SalesDashboardPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [stats, setStats] = useState({
    totalQuotations: 0,
    totalOrders: 0,
    totalOrderAmount: 0,
    pendingQuotations: 0,
    activeOrders: 0,
  });

  useEffect(() => {
    // 최근 견적서/수주 5건씩 로드
    Promise.all([
      listQuotations({ size: 5 }),
      listOrders({ size: 5 }),
      // 전체 통계용
      listQuotations({ status: 'draft', size: 1 }),
      listQuotations({ size: 1 }),
      listOrders({ size: 1 }),
    ]).then(([qtRecent, soRecent, qtPending, qtAll, soAll]) => {
      setQuotations(qtRecent.items);
      setOrders(soRecent.items);

      // 활성 수주 합계 계산
      const activeAmount = soRecent.items
        .filter((o) => !['invoiced'].includes(o.status))
        .reduce((sum, o) => sum + o.grand_total, 0);

      setStats({
        totalQuotations: qtAll.total,
        totalOrders: soAll.total,
        totalOrderAmount: activeAmount,
        pendingQuotations: qtPending.total,
        activeOrders: soRecent.items.filter((o) => !['completed', 'invoiced'].includes(o.status)).length,
      });
    });
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">영업 현황</h1>
        <p className="text-sm text-slate-500 mt-1">
          견적서, 수주 현황을 한눈에 확인합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#c8ced8] p-4">
          <div className="text-xs text-slate-500 mb-1">전체 견적서</div>
          <div className="text-2xl font-bold text-slate-800">{stats.totalQuotations}</div>
          <div className="text-xs text-amber-500 mt-1">대기 {stats.pendingQuotations}건</div>
        </div>
        <div className="bg-white rounded-xl border border-[#c8ced8] p-4">
          <div className="text-xs text-slate-500 mb-1">전체 수주</div>
          <div className="text-2xl font-bold text-slate-800">{stats.totalOrders}</div>
          <div className="text-xs text-blue-500 mt-1">진행중 {stats.activeOrders}건</div>
        </div>
        <div className="bg-white rounded-xl border border-[#c8ced8] p-4 col-span-2">
          <div className="text-xs text-slate-500 mb-1">진행중 수주 금액</div>
          <div className="text-2xl font-bold text-emerald-600">
            {stats.totalOrderAmount.toLocaleString()}원
          </div>
        </div>
      </div>

      {/* 최근 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 최근 견적서 */}
        <div className="bg-white rounded-xl border border-[#c8ced8] p-4">
          <h3 className="font-semibold text-slate-700 mb-3">최근 견적서</h3>
          {quotations.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">견적서가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {quotations.map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm border-b border-[#e8ecf2] pb-2 last:border-0">
                  <div>
                    <div className="font-medium text-slate-700">{q.quote_no}</div>
                    <div className="text-xs text-slate-500">{q.customer_name} · {q.quote_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">{q.grand_total.toLocaleString()}</div>
                    <div className="text-xs text-slate-500">{QT_STATUS[q.status] || q.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 수주 */}
        <div className="bg-white rounded-xl border border-[#c8ced8] p-4">
          <h3 className="font-semibold text-slate-700 mb-3">최근 수주</h3>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">수주 내역이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b border-[#e8ecf2] pb-2 last:border-0">
                  <div>
                    <div className="font-medium text-slate-700">{o.order_no}</div>
                    <div className="text-xs text-slate-500">{o.customer_name} · {o.order_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">{o.grand_total.toLocaleString()}</div>
                    <div className="flex items-center gap-1 justify-end">
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${o.progress_pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{o.progress_pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
