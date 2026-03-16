/**
 * M4 재무/회계 — 결산 / 재무제표 페이지
 * 탭 4개: 시산표, 손익계산서, 재무상태표, 기간 마감
 */
import { useState, useEffect, useCallback } from 'react';
import BackButton from '../components/BackButton';
import {
  fetchTrialBalance,
  fetchIncomeStatement,
  fetchBalanceSheet,
  closePeriod,
  reopenPeriod,
  type TrialBalanceResponse,
  type IncomeStatementResponse,
  type BalanceSheetResponse,
} from '../api/finance/closing';
import { fetchFiscalYears, type FiscalYear } from '../api/finance/fiscalYears';
import { useAuthStore } from '../stores/authStore';

// 계정유형 한국어
const TYPE_LABELS: Record<string, string> = {
  asset: '자산', liability: '부채', equity: '자본', revenue: '수익', expense: '비용',
};

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

type Tab = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'close-period';

export default function ClosingPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('trial-balance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // 데이터
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementResponse | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResponse | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);

  // 알림
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        as_of_date: endDate || undefined,
      };

      if (tab === 'trial-balance') {
        setTrialBalance(await fetchTrialBalance(params));
      } else if (tab === 'income-statement') {
        setIncomeStatement(await fetchIncomeStatement(params));
      } else if (tab === 'balance-sheet') {
        setBalanceSheet(await fetchBalanceSheet(params));
      } else if (tab === 'close-period') {
        const years = await fetchFiscalYears();
        setFiscalYears(years);
      }
    } catch {
      showToast('error', '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // 마감/취소 처리
  const handleClose = async (fyId: string) => {
    try {
      await closePeriod(fyId);
      showToast('success', '기간이 마감되었습니다');
      loadData();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || '마감에 실패했습니다');
    }
  };

  const handleReopen = async (fyId: string) => {
    try {
      await reopenPeriod(fyId);
      showToast('success', '마감이 취소되었습니다');
      loadData();
    } catch (err: any) {
      showToast('error', err?.response?.data?.detail || '마감 취소에 실패했습니다');
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'trial-balance', label: '시산표' },
    { key: 'income-statement', label: '손익계산서' },
    { key: 'balance-sheet', label: '재무상태표' },
    { key: 'close-period', label: '기간 마감' },
  ];

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
      <div className="flex items-center gap-3">
        <BackButton to="/finance" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">결산 / 재무제표</h1>
          <p className="text-sm text-gray-500 mt-0.5">시산표, 손익계산서, 재무상태표, 기간 마감</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 기간 필터 (마감 탭 제외) */}
      {tab !== 'close-period' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 font-medium">기간:</label>
            <input type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500" />
            <span className="text-gray-400 text-sm">~</span>
            <input type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <>
            {/* 시산표 */}
            {tab === 'trial-balance' && trialBalance && (
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">코드</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">계정과목</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">유형</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">차변 합계</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">대변 합계</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">전기된 전표가 없습니다</td></tr>
                    ) : (
                      trialBalance.rows.map((row) => (
                        <tr key={row.account_id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{row.account_code}</td>
                          <td className="px-4 py-2.5 text-gray-800">{row.account_name}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              {TYPE_LABELS[row.account_type] || row.account_type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-700">{formatAmount(row.total_debit)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-700">{formatAmount(row.total_credit)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-medium ${row.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            {formatAmount(row.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {trialBalance.rows.length > 0 && (
                    <tfoot>
                      <tr className="bg-amber-50 border-t-2 border-amber-200">
                        <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">합계</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatAmount(trialBalance.total_debit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatAmount(trialBalance.total_credit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                          {formatAmount(trialBalance.total_debit - trialBalance.total_credit)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* 손익계산서 */}
            {tab === 'income-statement' && incomeStatement && (
              <div className="p-5 space-y-6">
                {/* 수익 */}
                <div>
                  <h3 className="text-sm font-bold text-emerald-700 mb-2 border-b border-emerald-200 pb-1">수익 (Revenue)</h3>
                  {incomeStatement.revenue_items.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">수익 항목 없음</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {incomeStatement.revenue_items.map((item) => (
                          <tr key={item.account_id} className="border-b border-gray-50">
                            <td className="py-2 font-mono text-xs text-gray-500 w-16">{item.account_code}</td>
                            <td className="py-2 text-gray-700">{item.account_name}</td>
                            <td className="py-2 text-right font-mono text-emerald-700">{formatAmount(item.amount)}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50 font-bold">
                          <td colSpan={2} className="py-2 text-emerald-800">수익 합계</td>
                          <td className="py-2 text-right font-mono text-emerald-800">{formatAmount(incomeStatement.total_revenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 비용 */}
                <div>
                  <h3 className="text-sm font-bold text-red-700 mb-2 border-b border-red-200 pb-1">비용 (Expense)</h3>
                  {incomeStatement.expense_items.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">비용 항목 없음</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {incomeStatement.expense_items.map((item) => (
                          <tr key={item.account_id} className="border-b border-gray-50">
                            <td className="py-2 font-mono text-xs text-gray-500 w-16">{item.account_code}</td>
                            <td className="py-2 text-gray-700">{item.account_name}</td>
                            <td className="py-2 text-right font-mono text-red-600">{formatAmount(item.amount)}</td>
                          </tr>
                        ))}
                        <tr className="bg-red-50 font-bold">
                          <td colSpan={2} className="py-2 text-red-800">비용 합계</td>
                          <td className="py-2 text-right font-mono text-red-800">{formatAmount(incomeStatement.total_expense)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 당기순이익 */}
                <div className={`p-4 rounded-xl ${incomeStatement.net_income >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800">당기순이익</span>
                    <span className={`text-2xl font-bold font-mono ${incomeStatement.net_income >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatAmount(incomeStatement.net_income)}원
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 재무상태표 */}
            {tab === 'balance-sheet' && balanceSheet && (
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 왼쪽: 자산 */}
                  <div>
                    <h3 className="text-sm font-bold text-blue-700 mb-2 border-b border-blue-200 pb-1">자산 (Assets)</h3>
                    {balanceSheet.asset_items.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">자산 항목 없음</p>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody>
                          {balanceSheet.asset_items.map((item) => (
                            <tr key={item.account_id} className="border-b border-gray-50">
                              <td className="py-2 font-mono text-xs text-gray-500 w-12">{item.account_code}</td>
                              <td className="py-2 text-gray-700">{item.account_name}</td>
                              <td className="py-2 text-right font-mono text-gray-800">{formatAmount(item.amount)}</td>
                            </tr>
                          ))}
                          <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                            <td colSpan={2} className="py-2 text-blue-800">자산 합계</td>
                            <td className="py-2 text-right font-mono text-blue-800">{formatAmount(balanceSheet.total_assets)}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* 오른쪽: 부채 + 자본 */}
                  <div className="space-y-4">
                    {/* 부채 */}
                    <div>
                      <h3 className="text-sm font-bold text-red-700 mb-2 border-b border-red-200 pb-1">부채 (Liabilities)</h3>
                      {balanceSheet.liability_items.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">부채 항목 없음</p>
                      ) : (
                        <table className="w-full text-sm">
                          <tbody>
                            {balanceSheet.liability_items.map((item) => (
                              <tr key={item.account_id} className="border-b border-gray-50">
                                <td className="py-2 font-mono text-xs text-gray-500 w-12">{item.account_code}</td>
                                <td className="py-2 text-gray-700">{item.account_name}</td>
                                <td className="py-2 text-right font-mono text-gray-800">{formatAmount(item.amount)}</td>
                              </tr>
                            ))}
                            <tr className="bg-red-50 font-bold">
                              <td colSpan={2} className="py-2 text-red-800">부채 합계</td>
                              <td className="py-2 text-right font-mono text-red-800">{formatAmount(balanceSheet.total_liabilities)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* 자본 */}
                    <div>
                      <h3 className="text-sm font-bold text-purple-700 mb-2 border-b border-purple-200 pb-1">자본 (Equity)</h3>
                      {balanceSheet.equity_items.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">자본 항목 없음</p>
                      ) : (
                        <table className="w-full text-sm">
                          <tbody>
                            {balanceSheet.equity_items.map((item) => (
                              <tr key={item.account_id} className="border-b border-gray-50">
                                <td className="py-2 font-mono text-xs text-gray-500 w-12">{item.account_code}</td>
                                <td className="py-2 text-gray-700">{item.account_name}</td>
                                <td className="py-2 text-right font-mono text-gray-800">{formatAmount(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {/* 당기순이익 */}
                      <div className="py-2 flex justify-between text-sm border-b border-gray-100">
                        <span className="text-gray-600 italic">당기순이익</span>
                        <span className="font-mono text-gray-800">{formatAmount(balanceSheet.net_income)}</span>
                      </div>
                      <div className="bg-purple-50 py-2 flex justify-between font-bold mt-1 rounded px-1">
                        <span className="text-purple-800">자본 + 당기순이익</span>
                        <span className="font-mono text-purple-800">
                          {formatAmount(balanceSheet.total_equity + balanceSheet.net_income)}
                        </span>
                      </div>
                    </div>

                    {/* 부채 + 자본 합계 */}
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <div className="flex justify-between font-bold text-amber-800">
                        <span>부채 + 자본 합계</span>
                        <span className="font-mono">
                          {formatAmount(balanceSheet.total_liabilities + balanceSheet.total_equity + balanceSheet.net_income)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 균형 체크 */}
                <div className={`mt-4 p-3 rounded-xl text-center text-sm font-medium ${
                  Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity + balanceSheet.net_income)) < 1
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {Math.abs(balanceSheet.total_assets - (balanceSheet.total_liabilities + balanceSheet.total_equity + balanceSheet.net_income)) < 1
                    ? '자산 = 부채 + 자본 (균형 일치)'
                    : '주의: 자산과 부채+자본이 일치하지 않습니다'}
                </div>
              </div>
            )}

            {/* 기간 마감 */}
            {tab === 'close-period' && (
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  회계연도를 마감하면 해당 기간의 posted 전표가 closed로 변경되고, 새 전표를 생성할 수 없습니다.
                  <br />미결 전표(임시저장/검토중/승인)가 있으면 마감할 수 없습니다.
                </p>
                {fiscalYears.length === 0 ? (
                  <p className="text-gray-400">등록된 회계연도가 없습니다</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">연도</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">기간</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600">상태</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-600">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiscalYears.map((fy) => (
                        <tr key={fy.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 font-bold text-gray-800">{fy.year}년</td>
                          <td className="px-4 py-3 text-gray-600">{fy.start_date} ~ {fy.end_date}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              fy.is_closed
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {fy.is_closed ? '마감' : '진행중'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isAdmin && (
                              fy.is_closed ? (
                                <button onClick={() => handleReopen(fy.id)}
                                  className="px-3 py-1.5 text-xs rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium">
                                  마감 취소
                                </button>
                              ) : (
                                <button onClick={() => handleClose(fy.id)}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium">
                                  기간 마감
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
