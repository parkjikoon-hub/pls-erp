/**
 * M5 생산/SCM — 메인 페이지 (하위 메뉴 카드 + 핵심 현황)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

/* 하위 메뉴 카드 */
const SUB_MENUS = [
  {
    path: '/production/bom', title: 'BOM 관리',
    desc: '자재명세서(BOM) 등록 및 다단계 트리 관리',
    icon: '🔩', color: 'from-blue-500 to-blue-600',
  },
  {
    path: '/production/inventory', title: '재고 관리',
    desc: '창고별 재고 현황, 입출고, 이관, 부족 알림',
    icon: '📦', color: 'from-amber-500 to-amber-600',
  },
  {
    path: '/production/work-orders', title: '작업지시서',
    desc: '생산 지시, 칸반 보드, 수주→작업 전환',
    icon: '📋', color: 'from-emerald-500 to-emerald-600',
  },
  {
    path: '/production/qc', title: 'QC 검사',
    desc: '품질 검사 등록 및 합격/불합격/재작업 처리',
    icon: '✅', color: 'from-purple-500 to-purple-600',
  },
  {
    path: '/production/shipments', title: '출하 관리',
    desc: '출하지시서, 배송 추적, 거래명세서 발행',
    icon: '🚚', color: 'from-red-500 to-red-600',
  },
];

interface DashboardStats {
  wo_pending: number;
  wo_in_progress: number;
  wo_qc_wait: number;
  wo_completed: number;
  shortage_count: number;
  shipment_pending: number;
}

export default function ProductionPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    wo_pending: 0, wo_in_progress: 0, wo_qc_wait: 0, wo_completed: 0,
    shortage_count: 0, shipment_pending: 0,
  });

  useEffect(() => {
    /* 각 모듈에서 핵심 수치 가져오기 */
    const fetchStats = async () => {
      try {
        const [woRes, shortRes, shRes] = await Promise.allSettled([
          api.get('/production/work-orders', { params: { size: 1 } }),
          api.get('/production/inventory/shortage'),
          api.get('/production/shipments', { params: { status: 'pending', size: 1 } }),
        ]);

        /* 작업지시서 상태별 카운트 (전체 조회) */
        const woCounts = { pending: 0, in_progress: 0, qc_wait: 0, completed: 0 };
        for (const st of Object.keys(woCounts) as (keyof typeof woCounts)[]) {
          try {
            const r = await api.get('/production/work-orders', { params: { status: st, size: 1 } });
            woCounts[st] = r.data?.data?.total || 0;
          } catch { /* 무시 */ }
        }

        const shortageCount =
          shortRes.status === 'fulfilled'
            ? (shortRes.value.data?.data || []).length
            : 0;
        const shipPending =
          shRes.status === 'fulfilled'
            ? shRes.value.data?.data?.total || 0
            : 0;

        setStats({
          wo_pending: woCounts.pending,
          wo_in_progress: woCounts.in_progress,
          wo_qc_wait: woCounts.qc_wait,
          wo_completed: woCounts.completed,
          shortage_count: shortageCount,
          shipment_pending: shipPending,
        });
      } catch (e) { console.error(e); }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">생산/SCM</h1>
        <p className="text-sm text-slate-500 mt-1">생산 관리, 재고, 품질검사, 출하를 통합 관리합니다</p>
      </div>

      {/* ── 핵심 현황 카드 ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '대기 WO', value: stats.wo_pending, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: '진행중 WO', value: stats.wo_in_progress, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'QC대기', value: stats.wo_qc_wait, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: '완료 WO', value: stats.wo_completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '부족 재고', value: stats.shortage_count, color: stats.shortage_count > 0 ? 'text-red-600' : 'text-slate-600', bg: stats.shortage_count > 0 ? 'bg-red-50' : 'bg-slate-50' },
          { label: '출하 대기', value: stats.shipment_pending, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 border border-(--border-main)`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── 하위 메뉴 카드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUB_MENUS.map(menu => (
          <div
            key={menu.path}
            onClick={() => navigate(menu.path)}
            className="bg-white rounded-xl border border-(--border-main) p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${menu.color} flex items-center justify-center text-2xl flex-shrink-0`}>
                {menu.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition">
                  {menu.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{menu.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
