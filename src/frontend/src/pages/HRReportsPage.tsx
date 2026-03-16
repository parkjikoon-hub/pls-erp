/**
 * M3 인사/급여 — 급여명세서 + 인사 보고서 페이지
 */
import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { searchEmployees, type EmployeeSearchResult } from '../api/hr/employees';
import { fetchPayslip, fetchHRSummary, type Payslip, type HRSummary } from '../api/hr/reports';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';

const TYPE_LABELS: Record<string, string> = {
  regular: '정규직', contract: '계약직', part: '파트타임',
};
const ATT_LABELS: Record<string, string> = {
  leave: '연차', sick: '병가', absent: '결근', half: '반차', early: '조퇴',
};

export default function HRReportsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const now = new Date();

  const [tab, setTab] = useState<'payslip' | 'summary'>('payslip');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // 급여명세서
  const [empSearch, setEmpSearch] = useState('');
  const [empResults, setEmpResults] = useState<EmployeeSearchResult[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSearchResult | null>(null);
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [payslipLoading, setPayslipLoading] = useState(false);

  // 인사 통계
  const [summary, setSummary] = useState<HRSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const formatMoney = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n));

  // 직원 검색 디바운스
  useEffect(() => {
    if (empSearch.length < 1) { setEmpResults([]); return; }
    const timer = setTimeout(async () => {
      try { setEmpResults(await searchEmployees(empSearch, 10)); } catch { setEmpResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [empSearch]);

  // 급여명세서 로드
  useEffect(() => {
    if (!selectedEmp) { setPayslip(null); return; }
    setPayslipLoading(true);
    fetchPayslip(selectedEmp.id, year, month)
      .then(setPayslip)
      .catch(() => setPayslip(null))
      .finally(() => setPayslipLoading(false));
  }, [selectedEmp, year, month]);

  // 인사 통계 로드
  useEffect(() => {
    if (tab !== 'summary') return;
    setSummaryLoading(true);
    fetchHRSummary(year)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [tab, year]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <BackButton to="/hr" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">급여명세서 / 보고서</h1>
          <p className="text-sm text-slate-500">개인 급여명세서 조회 및 인사 통계 보고서</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4">
        {[
          { key: 'payslip' as const, label: '급여명세서' },
          ...(isManager ? [{ key: 'summary' as const, label: '인사 통계' }] : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-violet-500 text-white' : 'bg-(--bg-card) text-slate-600 hover:bg-(--bg-main)'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 급여명세서 탭 */}
      {tab === 'payslip' && (
        <div>
          <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* 직원 선택 */}
              {selectedEmp ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                  <span className="text-sm font-medium text-violet-700">
                    {selectedEmp.employee_no} {selectedEmp.name}
                  </span>
                  <button onClick={() => { setSelectedEmp(null); setEmpSearch(''); }} className="text-slate-400 hover:text-red-500">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="직원 이름 또는 사번 검색..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                  />
                  {empResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-(--border-main) rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {empResults.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => { setSelectedEmp(e); setEmpResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 border-b border-(--border-main) last:border-0"
                        >
                          <span className="font-mono text-xs text-slate-500 mr-2">{e.employee_no}</span>
                          <span className="font-medium">{e.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
              </select>
            </div>
          </div>

          {payslipLoading ? (
            <div className="text-center py-12 text-slate-400">불러오는 중...</div>
          ) : payslip ? (
            <div className="bg-(--bg-card) rounded-xl border border-(--border-main) p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">
                {payslip.year}년 {payslip.month}월 급여명세서
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {/* 지급 항목 */}
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 pb-1 border-b border-(--border-main)">지급 항목</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span>기본급</span><span className="font-mono">{formatMoney(payslip.earnings.base_salary)}</span></div>
                    {payslip.earnings.overtime_pay > 0 && <div className="flex justify-between"><span>초과근무수당</span><span className="font-mono">{formatMoney(payslip.earnings.overtime_pay)}</span></div>}
                    {payslip.earnings.bonus > 0 && <div className="flex justify-between"><span>상여금</span><span className="font-mono">{formatMoney(payslip.earnings.bonus)}</span></div>}
                    <div className="flex justify-between text-blue-600"><span>식대 (비과세)</span><span className="font-mono">{formatMoney(payslip.earnings.meal_allowance)}</span></div>
                    {payslip.earnings.car_allowance > 0 && <div className="flex justify-between text-blue-600"><span>자가운전보조금</span><span className="font-mono">{formatMoney(payslip.earnings.car_allowance)}</span></div>}
                    {payslip.earnings.research_allowance > 0 && <div className="flex justify-between text-blue-600"><span>연구활동비</span><span className="font-mono">{formatMoney(payslip.earnings.research_allowance)}</span></div>}
                    {payslip.earnings.childcare_allowance > 0 && <div className="flex justify-between text-blue-600"><span>육아수당</span><span className="font-mono">{formatMoney(payslip.earnings.childcare_allowance)}</span></div>}
                    <div className="flex justify-between font-bold pt-2 border-t border-(--border-main)">
                      <span>총 지급액</span><span className="font-mono">{formatMoney(payslip.earnings.gross_salary)}</span>
                    </div>
                  </div>
                </div>
                {/* 공제 항목 */}
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 pb-1 border-b border-(--border-main)">공제 항목</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span>소득세</span><span className="font-mono text-red-500">{formatMoney(payslip.deductions.income_tax)}</span></div>
                    <div className="flex justify-between"><span>지방소득세</span><span className="font-mono text-red-500">{formatMoney(payslip.deductions.local_tax)}</span></div>
                    <div className="flex justify-between"><span>국민연금</span><span className="font-mono text-red-500">{formatMoney(payslip.deductions.national_pension)}</span></div>
                    <div className="flex justify-between"><span>건강보험</span><span className="font-mono text-red-500">{formatMoney(payslip.deductions.health_insurance)}</span></div>
                    <div className="flex justify-between"><span>장기요양보험</span><span className="font-mono text-red-500">{formatMoney(payslip.deductions.long_term_care)}</span></div>
                    <div className="flex justify-between"><span>고용보험</span><span className="font-mono text-red-500">{formatMoney(payslip.deductions.employment_insurance)}</span></div>
                    <div className="flex justify-between font-bold pt-2 border-t border-(--border-main) text-red-600">
                      <span>총 공제액</span><span className="font-mono">{formatMoney(payslip.deductions.total_deduction)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* 실수령액 */}
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-emerald-800">실수령액</span>
                  <span className="text-2xl font-bold text-emerald-700 font-mono">{formatMoney(payslip.net_salary)}원</span>
                </div>
              </div>
            </div>
          ) : selectedEmp ? (
            <div className="text-center py-12 text-slate-400">해당 월의 급여 데이터가 없습니다</div>
          ) : (
            <div className="text-center py-12 text-slate-400">직원을 선택하면 급여명세서가 표시됩니다</div>
          )}
        </div>
      )}

      {/* 인사 통계 탭 */}
      {tab === 'summary' && (
        <div>
          <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white">
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>

          {summaryLoading ? (
            <div className="text-center py-12 text-slate-400">불러오는 중...</div>
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 인원 현황 */}
              <div className="bg-(--bg-card) rounded-xl p-5 border border-(--border-main)">
                <h3 className="font-bold text-slate-700 mb-3">인원 현황</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>활성 인원</span><span className="font-bold text-emerald-600">{summary.headcount.active}명</span></div>
                  <div className="flex justify-between"><span>비활성 인원</span><span className="text-slate-400">{summary.headcount.inactive}명</span></div>
                  <div className="border-t border-(--border-main) pt-2 mt-2">
                    {Object.entries(summary.headcount.by_type).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{TYPE_LABELS[k] || k}</span><span>{v}명</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 급여 연간 합계 */}
              <div className="bg-(--bg-card) rounded-xl p-5 border border-(--border-main)">
                <h3 className="font-bold text-slate-700 mb-3">{year}년 급여 합계</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>계산 완료 월수</span><span>{summary.payroll_annual.months_calculated}개월</span></div>
                  <div className="flex justify-between"><span>총 지급액</span><span className="font-mono font-bold text-blue-600">{formatMoney(summary.payroll_annual.total_gross)}</span></div>
                  <div className="flex justify-between"><span>총 공제액</span><span className="font-mono text-red-500">{formatMoney(summary.payroll_annual.total_deduction)}</span></div>
                  <div className="flex justify-between font-bold"><span>총 실수령</span><span className="font-mono text-emerald-600">{formatMoney(summary.payroll_annual.total_net)}</span></div>
                </div>
              </div>

              {/* 근태 통계 */}
              <div className="bg-(--bg-card) rounded-xl p-5 border border-(--border-main) md:col-span-2">
                <h3 className="font-bold text-slate-700 mb-3">{year}년 근태 통계</h3>
                {Object.keys(summary.attendance_annual).length === 0 ? (
                  <p className="text-sm text-slate-400">근태 기록이 없습니다</p>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(summary.attendance_annual).map(([k, v]) => (
                      <div key={k} className="bg-white px-4 py-3 rounded-lg border border-(--border-main) text-center min-w-[100px]">
                        <p className="text-xs text-slate-500">{ATT_LABELS[k] || k}</p>
                        <p className="text-xl font-bold text-slate-700">{v}건</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">데이터를 불러올 수 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
