/**
 * 대시보드 — 매출 그래프 + 요약 카드 + 월별 제품 상세
 * recharts 라이브러리를 사용한 인터랙티브 차트
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  UserGroupIcon,
  CubeIcon,
  BuildingOfficeIcon,
  UsersIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  ArrowTrendingUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { useAuthStore } from '../stores/authStore';
import api from '../api/client';

/* ───── 타입 ───── */
interface SummaryCards {
  customer_count: number;
  product_count: number;
  user_count: number;
  dept_count: number;
  month_sales: number;
  total_sales: number;
  active_orders: number;
  inventory_items: number;
}

interface MonthData {
  month: number;
  label: string;
  amount: number;
  order_count: number;
}

interface ProductSales {
  product_name: string;
  total_amount: number;
  total_qty: number;
  line_count: number;
}

/* ───── 금액 포맷 ───── */
const formatAmount = (value: number): string => {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
  return value.toLocaleString('ko-KR');
};

const formatFullAmount = (value: number): string =>
  value.toLocaleString('ko-KR') + '원';

/* ───── 차트 색상 ───── */
const BAR_COLOR = '#10b981';
const BAR_ACTIVE = '#059669';

/* ───── 커스텀 툴팁 ───── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e293b] text-white px-3 py-2 rounded-lg shadow-lg text-sm">
      <p className="font-semibold">{label}</p>
      <p className="text-emerald-300">{formatFullAmount(payload[0].value)}</p>
      <p className="text-slate-400 text-xs mt-0.5">
        클릭하면 제품별 상세를 볼 수 있습니다
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();

  /* 상태 */
  const [summary, setSummary] = useState<SummaryCards | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  /* 요약 카드 데이터 로드 */
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data.cards);
    } catch {
      /* 에러 시 빈 상태 유지 */
    }
  }, []);

  /* 월별 매출 데이터 로드 */
  const loadMonthly = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/monthly-sales', { params: { year: selectedYear } });
      setMonthlyData(res.data.data);
    } catch {
      setMonthlyData([]);
    }
  }, [selectedYear]);

  /* 제품별 상세 로드 */
  const loadProductDetail = useCallback(async (month: number) => {
    setLoadingProducts(true);
    try {
      const res = await api.get(`/dashboard/monthly-sales/${month}/products`, {
        params: { year: selectedYear },
      });
      setProductSales(res.data.products);
    } catch {
      setProductSales([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedYear]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadMonthly(); }, [loadMonthly]);

  /* 차트 바 클릭 시 제품 상세 패널 열기 */
  const handleBarClick = (data: any) => {
    if (data?.month) {
      setSelectedMonth(data.month);
      loadProductDetail(data.month);
    }
  };

  /* 요약 카드 정의 */
  const cards = summary
    ? [
        { label: '이번달 매출', value: formatAmount(summary.month_sales), icon: BanknotesIcon, gradient: 'from-emerald-500 to-emerald-600', desc: `${new Date().getMonth() + 1}월 수주 합계` },
        { label: '전체 매출', value: formatAmount(summary.total_sales), icon: ArrowTrendingUpIcon, gradient: 'from-blue-500 to-blue-600', desc: '누적 수주 합계' },
        { label: '진행 수주', value: String(summary.active_orders), icon: ShoppingCartIcon, gradient: 'from-amber-500 to-amber-600', desc: '확정/생산중' },
        { label: '거래처', value: String(summary.customer_count), icon: BuildingOfficeIcon, gradient: 'from-indigo-500 to-indigo-600', desc: '활성 거래처' },
        { label: '품목', value: String(summary.product_count), icon: CubeIcon, gradient: 'from-purple-500 to-purple-600', desc: '등록 품목' },
        { label: '재고 품목', value: String(summary.inventory_items), icon: ArchiveBoxIcon, gradient: 'from-red-500 to-red-600', desc: '재고 보유' },
        { label: '사용자', value: String(summary.user_count), icon: UsersIcon, gradient: 'from-cyan-500 to-cyan-600', desc: '활성 계정' },
        { label: '부서', value: String(summary.dept_count), icon: UserGroupIcon, gradient: 'from-orange-500 to-orange-600', desc: '운영 부서' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          안녕하세요, {user?.name || '사용자'}님
        </h1>
        <p className="text-sm text-slate-500 mt-1">PLS ERP 대시보드에 오신 것을 환영합니다.</p>
      </div>

      {/* ── 요약 카드 그리드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-[#e8ecf2] rounded-xl p-4 border border-[#c8ced8] hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-800">{card.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{card.desc}</div>
            </div>
          );
        })}
      </div>

      {/* ── 월별 매출 차트 ── */}
      <div className="bg-[#e8ecf2] rounded-xl p-5 border border-[#c8ced8]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-700">월별 매출 현황</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="px-2 py-1 text-xs rounded-lg border border-[#c8ced8] bg-white hover:bg-[#dce1e9] transition-colors"
            >
              ◀
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[50px] text-center">
              {selectedYear}년
            </span>
            <button
              onClick={() => setSelectedYear((y) => Math.min(y + 1, currentYear))}
              disabled={selectedYear >= currentYear}
              className="px-2 py-1 text-xs rounded-lg border border-[#c8ced8] bg-white hover:bg-[#dce1e9] disabled:opacity-30 transition-colors"
            >
              ▶
            </button>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyData}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              onMouseMove={(state: any) => {
                if (state?.activeTooltipIndex !== undefined) {
                  setActiveBarIndex(state.activeTooltipIndex);
                }
              }}
              onMouseLeave={() => setActiveBarIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatAmount(v)}
                width={60}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
              <Bar
                dataKey="amount"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={handleBarClick}
              >
                {monthlyData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={activeBarIndex === index ? BAR_ACTIVE : BAR_COLOR}
                    opacity={activeBarIndex !== null && activeBarIndex !== index ? 0.5 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 데이터 없을 때 안내 */}
        {monthlyData.every((d) => d.amount === 0) && (
          <div className="text-center text-sm text-slate-400 mt-2">
            {selectedYear}년 수주 데이터가 없습니다. 영업/수주 메뉴에서 수주를 등록하면 여기에 매출 그래프가 표시됩니다.
          </div>
        )}

        <div className="text-xs text-slate-400 mt-3 text-center">
          막대를 클릭하면 해당 월의 제품별 매출을 확인할 수 있습니다
        </div>
      </div>

      {/* ── 제품별 매출 상세 패널 (월 클릭 시 표시) ── */}
      {selectedMonth !== null && (
        <div className="bg-[#e8ecf2] rounded-xl border border-[#c8ced8] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#c8ced8] bg-[#dce1e9]">
            <h3 className="text-sm font-bold text-slate-700">
              {selectedYear}년 {selectedMonth}월 — 제품별 매출 TOP 10
            </h3>
            <button
              onClick={() => { setSelectedMonth(null); setProductSales([]); }}
              className="p-1 hover:bg-[#c8ced8] rounded-lg transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {loadingProducts ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : productSales.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              해당 월에 수주된 제품이 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs">
                    <th className="text-left px-5 py-2.5 font-medium">순위</th>
                    <th className="text-left px-5 py-2.5 font-medium">제품명</th>
                    <th className="text-right px-5 py-2.5 font-medium">매출액</th>
                    <th className="text-right px-5 py-2.5 font-medium">수량</th>
                    <th className="text-right px-5 py-2.5 font-medium">거래건수</th>
                    <th className="text-left px-5 py-2.5 font-medium">비율</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalAmount = productSales.reduce((s, p) => s + p.total_amount, 0);
                    return productSales.map((p, i) => {
                      const pct = totalAmount > 0 ? (p.total_amount / totalAmount) * 100 : 0;
                      return (
                        <tr key={i} className="border-t border-[#c8ced8] hover:bg-[#dce1e9]/50">
                          <td className="px-5 py-2.5">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700' :
                              i === 1 ? 'bg-slate-200 text-slate-600' :
                              i === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 font-medium text-slate-800">{p.product_name}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-slate-700">
                            {formatFullAmount(p.total_amount)}
                          </td>
                          <td className="px-5 py-2.5 text-right text-slate-600">
                            {p.total_qty.toLocaleString('ko-KR')}
                          </td>
                          <td className="px-5 py-2.5 text-right text-slate-600">{p.line_count}건</td>
                          <td className="px-5 py-2.5 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
