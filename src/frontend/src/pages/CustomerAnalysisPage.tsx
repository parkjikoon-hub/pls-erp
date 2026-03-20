/**
 * M4 재무/회계 — 거래처별 수주/세금계산서/입금 분석
 * 거래처 선택 → 수주·세금계산서·입금 내역 조회 + 입금 동향 분석
 */
import { useState, useEffect } from 'react';
import {
  fetchCustomerOptions,
  fetchCustomerAnalysis,
  fetchCustomerRankings,
  type CustomerOption,
  type CustomerAnalysisResponse,
  type CustomerRanking,
} from '../api/finance/customerAnalysis';

/* ── 상태 배지 색상 ── */
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  invoiced: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: '확정',
  in_production: '생산중',
  shipped: '출하',
  completed: '완료',
  invoiced: '정산완료',
  draft: '임시저장',
  sent: '전송',
  cancelled: '취소',
};

const PAYMENT_COLORS: Record<string, string> = {
  '입금완료': 'bg-green-100 text-green-700',
  '부분입금': 'bg-yellow-100 text-yellow-700',
  '미입금': 'bg-red-100 text-red-700',
};

const GRADE_COLORS: Record<string, string> = {
  '즉시입금': 'text-green-600 bg-green-50 border-green-200',
  '정상입금': 'text-blue-600 bg-blue-50 border-blue-200',
  '지연입금': 'text-yellow-600 bg-yellow-50 border-yellow-200',
  '미입금경향': 'text-red-600 bg-red-50 border-red-200',
  '정보없음': 'text-gray-500 bg-gray-50 border-gray-200',
};

const GRADE_ICONS: Record<string, string> = {
  '즉시입금': '⚡',
  '정상입금': '✅',
  '지연입금': '⏳',
  '미입금경향': '⚠️',
  '정보없음': '—',
};

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

type Tab = 'overview' | 'orders' | 'invoices' | 'payments' | 'trend' | 'ranking';

export default function CustomerAnalysisPage() {
  /* ── 상태 ── */
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerAnalysisResponse | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  // 랭킹
  const [rankings, setRankings] = useState<CustomerRanking[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  /* ── 초기 로드 ── */
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const opts = await fetchCustomerOptions();
      setCustomers(opts);
    } catch { /* 무시 */ }
  };

  const loadAnalysis = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const result = await fetchCustomerAnalysis(selectedId, startDate || undefined, endDate || undefined);
      setData(result);
      setTab('overview');
    } catch (e: any) {
      alert(e?.response?.data?.detail || '분석 데이터를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const loadRankings = async () => {
    setRankLoading(true);
    try {
      const result = await fetchCustomerRankings(startDate || undefined, endDate || undefined);
      setRankings(result);
      setTab('ranking');
    } catch { /* 무시 */ }
    finally { setRankLoading(false); }
  };

  /* ── 거래처 필터링 ── */
  const filtered = customers.filter(c =>
    c.name.includes(searchTerm) || c.code.includes(searchTerm) || c.business_no.includes(searchTerm)
  );

  /* ── 탭 목록 ── */
  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: '요약' },
    { key: 'orders', label: `수주 (${data?.orders?.length || 0})` },
    { key: 'invoices', label: `세금계산서 (${data?.invoices?.length || 0})` },
    { key: 'payments', label: `입금 (${data?.payments?.length || 0})` },
    { key: 'trend', label: '입금동향' },
    { key: 'ranking', label: '거래처 랭킹' },
  ];

  return (
    <div className="space-y-4">
      {/* ── 상단: 거래처 선택 + 기간 필터 ── */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 거래처 검색 */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">거래처 선택</label>
            <input
              type="text"
              placeholder="거래처명/코드/사업자번호 검색"
              className="w-full border rounded px-3 py-2 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <div className="relative">
                <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
                  ) : filtered.map(c => (
                    <button
                      key={c.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${selectedId === c.id ? 'bg-blue-50 font-semibold' : ''}`}
                      onClick={() => { setSelectedId(c.id); setSearchTerm(c.name); }}
                    >
                      <span className="text-gray-500 mr-2">[{c.code}]</span>
                      {c.name}
                      {c.business_no && <span className="text-gray-400 ml-2 text-xs">{c.business_no}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 기간 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input type="date" className="border rounded px-3 py-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input type="date" className="border rounded px-3 py-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          {/* 버튼 */}
          <button
            onClick={loadAnalysis}
            disabled={!selectedId || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
          <button
            onClick={loadRankings}
            disabled={rankLoading}
            className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:bg-gray-300"
          >
            {rankLoading ? '로딩...' : '전체 랭킹'}
          </button>
        </div>
      </div>

      {/* ── 탭 네비게이션 ── */}
      {(data || tab === 'ranking') && (
        <div className="flex gap-1 border-b">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 탭 내용 ── */}
      {tab === 'overview' && data && <OverviewTab data={data} />}
      {tab === 'orders' && data && <OrdersTab orders={data.orders} />}
      {tab === 'invoices' && data && <InvoicesTab invoices={data.invoices} />}
      {tab === 'payments' && data && <PaymentsTab payments={data.payments} />}
      {tab === 'trend' && data && <TrendTab trend={data.trend} />}
      {tab === 'ranking' && <RankingTab rankings={rankings} loading={rankLoading} onSelect={(id, name) => { setSelectedId(id); setSearchTerm(name); }} />}

      {/* 빈 상태 */}
      {!data && tab !== 'ranking' && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-lg">거래처를 선택하고 "분석하기"를 클릭하세요</p>
          <p className="text-sm mt-1">수주·세금계산서·입금 내역을 종합 분석합니다</p>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   탭 1: 요약 (Overview)
   ═══════════════════════════════════════════════════════ */
function OverviewTab({ data }: { data: CustomerAnalysisResponse }) {
  const s = data.summary;
  const t = data.trend;

  return (
    <div className="space-y-4">
      {/* 거래처 정보 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-1">
          {s.customer_name} <span className="text-sm font-normal text-gray-500">[{s.customer_code}]</span>
        </h3>
        {s.business_no && <p className="text-sm text-gray-500">사업자등록번호: {s.business_no}</p>}
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="총 수주액" value={fmt(s.total_order_amount)} sub={`${s.total_orders}건`} color="blue" />
        <SummaryCard label="세금계산서 발행액" value={fmt(s.total_invoice_amount)} sub={`${s.total_invoices}건`} color="indigo" />
        <SummaryCard label="총 입금액" value={fmt(s.total_payment_amount)} sub={`${s.total_payments}건`} color="green" />
        <SummaryCard label="미수금액" value={fmt(s.outstanding_amount)} sub={s.outstanding_amount > 0 ? '회수 필요' : '잔액 없음'} color={s.outstanding_amount > 0 ? 'red' : 'green'} />
      </div>

      {/* 입금 성향 카드 */}
      <div className={`rounded-lg border p-4 ${GRADE_COLORS[t.grade] || GRADE_COLORS['정보없음']}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{GRADE_ICONS[t.grade] || '—'}</span>
          <div>
            <div className="text-lg font-bold">{t.grade}</div>
            <div className="text-sm">{t.grade_description}</div>
          </div>
          {t.avg_days !== null && (
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold">{t.avg_days}일</div>
              <div className="text-xs">평균 입금 소요일</div>
            </div>
          )}
        </div>
        {t.unpaid_invoices > 0 && (
          <div className="mt-3 pt-3 border-t text-sm">
            미입금 세금계산서 <b>{t.unpaid_invoices}건</b> / 미입금 금액 <b>{fmt(t.unpaid_amount)}원</b>
          </div>
        )}
      </div>

      {/* 통계 요약 */}
      {t.avg_days !== null && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">입금 소요일 통계</h4>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">평균</div>
              <div className="text-lg font-bold">{t.avg_days}일</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">중앙값</div>
              <div className="text-lg font-bold">{t.median_days}일</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">최소</div>
              <div className="text-lg font-bold">{t.min_days}일</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">최대</div>
              <div className="text-lg font-bold">{t.max_days}일</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color] || colors.blue}`}>
      <div className="text-xs font-medium mb-1">{label}</div>
      <div className="text-xl font-bold">{value}<span className="text-xs font-normal ml-1">원</span></div>
      <div className="text-xs mt-1 opacity-75">{sub}</div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   탭 2: 수주 내역
   ═══════════════════════════════════════════════════════ */
function OrdersTab({ orders }: { orders: CustomerAnalysisResponse['orders'] }) {
  if (orders.length === 0) return <EmptyState text="수주 내역이 없습니다" />;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-3 py-2">수주번호</th>
            <th className="px-3 py-2">수주일</th>
            <th className="px-3 py-2">납기일</th>
            <th className="px-3 py-2">품목</th>
            <th className="px-3 py-2 text-right">공급가액</th>
            <th className="px-3 py-2 text-right">총액</th>
            <th className="px-3 py-2 text-center">상태</th>
            <th className="px-3 py-2 text-center">진행률</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map(o => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-blue-600">{o.order_no}</td>
              <td className="px-3 py-2">{o.order_date}</td>
              <td className="px-3 py-2">{o.delivery_date || '-'}</td>
              <td className="px-3 py-2 text-gray-600">{o.items_summary || '-'}</td>
              <td className="px-3 py-2 text-right">{fmt(o.total_amount)}</td>
              <td className="px-3 py-2 text-right font-semibold">{fmt(o.grand_total)}</td>
              <td className="px-3 py-2 text-center">
                <span className={`px-2 py-0.5 rounded text-xs min-w-[3.5rem] inline-block text-center ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[o.status] || o.status}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center gap-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${o.progress_pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{o.progress_pct}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-gray-50 text-sm text-right">
        합계: <b>{fmt(orders.reduce((a, o) => a + o.grand_total, 0))}원</b> ({orders.length}건)
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   탭 3: 세금계산서 내역
   ═══════════════════════════════════════════════════════ */
function InvoicesTab({ invoices }: { invoices: CustomerAnalysisResponse['invoices'] }) {
  if (invoices.length === 0) return <EmptyState text="세금계산서 내역이 없습니다" />;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-3 py-2">발행번호</th>
            <th className="px-3 py-2">발행일</th>
            <th className="px-3 py-2 text-right">공급가액</th>
            <th className="px-3 py-2 text-right">부가세</th>
            <th className="px-3 py-2 text-right">합계</th>
            <th className="px-3 py-2 text-center">상태</th>
            <th className="px-3 py-2 text-center">입금상태</th>
            <th className="px-3 py-2 text-center">입금소요</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map(inv => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-blue-600">{inv.invoice_no}</td>
              <td className="px-3 py-2">{inv.issue_date}</td>
              <td className="px-3 py-2 text-right">{fmt(inv.supply_amount)}</td>
              <td className="px-3 py-2 text-right">{fmt(inv.tax_amount)}</td>
              <td className="px-3 py-2 text-right font-semibold">{fmt(inv.total_amount)}</td>
              <td className="px-3 py-2 text-center">
                <span className={`px-2 py-0.5 rounded text-xs min-w-[3.5rem] inline-block text-center ${STATUS_COLORS[inv.status] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[inv.status] || inv.status}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`px-2 py-0.5 rounded text-xs min-w-[3.5rem] inline-block text-center ${PAYMENT_COLORS[inv.payment_status] || 'bg-gray-100'}`}>
                  {inv.payment_status}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                {inv.days_to_payment !== null ? (
                  <span className={`font-semibold ${inv.days_to_payment <= 7 ? 'text-green-600' : inv.days_to_payment <= 30 ? 'text-blue-600' : 'text-red-600'}`}>
                    {inv.days_to_payment}일
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-gray-50 text-sm text-right">
        합계: <b>{fmt(invoices.reduce((a, i) => a + i.total_amount, 0))}원</b> ({invoices.length}건)
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   탭 4: 입금 내역
   ═══════════════════════════════════════════════════════ */
function PaymentsTab({ payments }: { payments: CustomerAnalysisResponse['payments'] }) {
  if (payments.length === 0) return <EmptyState text="입금 내역이 없습니다" />;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-3 py-2">전표번호</th>
            <th className="px-3 py-2">입금일</th>
            <th className="px-3 py-2 text-right">입금액</th>
            <th className="px-3 py-2">적요</th>
            <th className="px-3 py-2 text-center">출처</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-blue-600">{p.entry_no}</td>
              <td className="px-3 py-2">{p.entry_date}</td>
              <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(p.amount)}원</td>
              <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">{p.description || '-'}</td>
              <td className="px-3 py-2 text-center">
                <span className={`px-2 py-0.5 rounded text-xs ${p.source === '은행입금' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {p.source}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-gray-50 text-sm text-right">
        합계: <b className="text-green-700">{fmt(payments.reduce((a, p) => a + p.amount, 0))}원</b> ({payments.length}건)
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   탭 5: 입금 동향 분석
   ═══════════════════════════════════════════════════════ */
function TrendTab({ trend }: { trend: CustomerAnalysisResponse['trend'] }) {
  const monthly = trend.monthly_trend;

  if (monthly.length === 0 && trend.avg_days === null) {
    return <EmptyState text="입금 동향 데이터가 없습니다" />;
  }

  // 월별 바 차트 최대값 계산
  const maxAmount = Math.max(...monthly.map(m => Math.max(m.invoice_amount, m.payment_amount)), 1);

  return (
    <div className="space-y-4">
      {/* 성향 요약 */}
      <div className={`rounded-lg border p-4 ${GRADE_COLORS[trend.grade] || GRADE_COLORS['정보없음']}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{GRADE_ICONS[trend.grade]}</span>
          <div>
            <div className="text-lg font-bold">{trend.grade}</div>
            <div className="text-sm">{trend.grade_description}</div>
          </div>
        </div>
      </div>

      {/* 월별 추이 차트 (간이 바 차트) */}
      {monthly.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">월별 세금계산서 발행 vs 입금</h4>

          {/* 범례 */}
          <div className="flex gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-400 inline-block" /> 세금계산서 발행액</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> 입금액</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> 평균 입금일</span>
          </div>

          <div className="space-y-2">
            {monthly.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">{m.month}</span>
                <div className="flex-1 space-y-1">
                  {/* 세금계산서 바 */}
                  <div className="flex items-center gap-2">
                    <div className="h-3 bg-indigo-400 rounded" style={{ width: `${(m.invoice_amount / maxAmount) * 100}%`, minWidth: m.invoice_amount > 0 ? '4px' : '0' }} />
                    <span className="text-xs text-gray-500 whitespace-nowrap">{fmt(m.invoice_amount)}</span>
                  </div>
                  {/* 입금 바 */}
                  <div className="flex items-center gap-2">
                    <div className="h-3 bg-green-400 rounded" style={{ width: `${(m.payment_amount / maxAmount) * 100}%`, minWidth: m.payment_amount > 0 ? '4px' : '0' }} />
                    <span className="text-xs text-gray-500 whitespace-nowrap">{fmt(m.payment_amount)}</span>
                  </div>
                </div>
                {/* 입금일 */}
                <span className="text-xs font-semibold w-12 text-right shrink-0">
                  {m.avg_days !== null ? `${m.avg_days}일` : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미입금 현황 */}
      {trend.unpaid_invoices > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <h4 className="text-sm font-semibold text-red-700 mb-2">미입금 현황</h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600">{trend.unpaid_invoices}건</div>
              <div className="text-xs text-red-500">미입금 세금계산서</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{fmt(trend.unpaid_amount)}원</div>
              <div className="text-xs text-red-500">미입금 금액</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   탭 6: 거래처 랭킹
   ═══════════════════════════════════════════════════════ */
function RankingTab({ rankings, loading, onSelect }: { rankings: CustomerRanking[]; loading: boolean; onSelect: (id: string, name: string) => void }) {
  if (loading) return <div className="text-center py-8 text-gray-400">로딩 중...</div>;
  if (rankings.length === 0) return <EmptyState text="거래 내역이 있는 거래처가 없습니다" />;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-3 py-2 text-center w-10">#</th>
            <th className="px-3 py-2">거래처</th>
            <th className="px-3 py-2 text-right">수주액</th>
            <th className="px-3 py-2 text-right">세금계산서</th>
            <th className="px-3 py-2 text-right">입금액</th>
            <th className="px-3 py-2 text-right">미수금</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rankings.map((r, idx) => (
            <tr key={r.customer_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(r.customer_id, r.customer_name)}>
              <td className="px-3 py-2 text-center text-gray-400">{idx + 1}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-blue-600 hover:underline">{r.customer_name}</div>
                <div className="text-xs text-gray-400">{r.customer_code}</div>
              </td>
              <td className="px-3 py-2 text-right">{fmt(r.total_order_amount)}</td>
              <td className="px-3 py-2 text-right">{fmt(r.total_invoice_amount)}</td>
              <td className="px-3 py-2 text-right text-green-700">{fmt(r.total_payment_amount)}</td>
              <td className="px-3 py-2 text-right">
                <span className={r.outstanding_amount > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                  {fmt(r.outstanding_amount)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ── 빈 상태 컴포넌트 ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-2">📋</div>
      <p>{text}</p>
    </div>
  );
}
