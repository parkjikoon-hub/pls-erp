/**
 * M3 인사/급여 — 급여 관리 페이지
 * 급여 계산, 급여대장 조회, 승인
 */
import { useState, useEffect, useCallback } from 'react';
import {
  CalculatorIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  fetchPayroll,
  calculatePayroll,
  approvePayroll,
  type PayrollHeader,
} from '../api/hr/payroll';
import { useAuthStore } from '../stores/authStore';

const STATUS_LABELS: Record<string, string> = {
  draft: '작성중',
  calculated: '계산완료',
  approved: '승인',
  paid: '지급완료',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  calculated: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-purple-100 text-purple-700',
};

export default function PayrollPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PayrollHeader | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [approving, setApproving] = useState(false);

  const formatMoney = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPayroll(year, month);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCalculate = async () => {
    if (!confirm(`${year}년 ${month}월 급여를 계산하시겠습니까?\n(기존 계산 결과가 있으면 재계산됩니다)`))
      return;
    setCalculating(true);
    try {
      await calculatePayroll(year, month);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '급여 계산 중 오류가 발생했습니다.');
    } finally {
      setCalculating(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm(`${year}년 ${month}월 급여를 승인하시겠습니까?`)) return;
    setApproving(true);
    try {
      await approvePayroll(year, month);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '승인 중 오류가 발생했습니다.');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">급여 관리</h1>
          <p className="text-sm text-slate-500">
            월급여 계산 (4대보험, 소득세, 비과세 자동 산출)
          </p>
        </div>
      </div>

      {/* 기간 선택 + 액션 */}
      <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}월</option>
            ))}
          </select>

          {data && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[data.status] || ''}`}>
              {STATUS_LABELS[data.status] || data.status}
            </span>
          )}

          <div className="flex-1" />

          {isManager && (
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg hover:from-violet-600 hover:to-violet-700 disabled:opacity-50 shadow-sm"
            >
              <CalculatorIcon className="w-4 h-4" />
              {calculating ? '계산 중...' : '급여 계산'}
            </button>
          )}
          {isAdmin && data?.status === 'calculated' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 shadow-sm"
            >
              <CheckCircleIcon className="w-4 h-4" />
              {approving ? '승인 중...' : '급여 승인'}
            </button>
          )}
        </div>
      </div>

      {/* 급여 요약 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main)">
            <p className="text-sm text-slate-500 mb-1">대상 인원</p>
            <p className="text-xl font-bold text-slate-800">{data.total_employees}명</p>
          </div>
          <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main)">
            <p className="text-sm text-slate-500 mb-1">총 지급액</p>
            <p className="text-xl font-bold text-blue-600">{formatMoney(data.total_gross)}</p>
          </div>
          <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main)">
            <p className="text-sm text-slate-500 mb-1">총 공제액</p>
            <p className="text-xl font-bold text-red-500">{formatMoney(data.total_deduction)}</p>
          </div>
          <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main)">
            <p className="text-sm text-slate-500 mb-1">총 실수령액</p>
            <p className="text-xl font-bold text-emerald-600">{formatMoney(data.total_net)}</p>
          </div>
        </div>
      )}

      {/* 급여 상세 테이블 */}
      <div className="bg-(--bg-card) rounded-xl border border-(--border-main) overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-(--bg-main) text-slate-600">
                <th className="text-left px-3 py-3 font-semibold w-16">사번</th>
                <th className="text-left px-3 py-3 font-semibold">이름</th>
                <th className="text-left px-3 py-3 font-semibold">부서</th>
                <th className="text-right px-3 py-3 font-semibold">기본급</th>
                <th className="text-right px-3 py-3 font-semibold">비과세</th>
                <th className="text-right px-3 py-3 font-semibold">총지급</th>
                <th className="text-right px-3 py-3 font-semibold">4대보험</th>
                <th className="text-right px-3 py-3 font-semibold">소득세</th>
                <th className="text-right px-3 py-3 font-semibold">총공제</th>
                <th className="text-right px-3 py-3 font-semibold text-emerald-700">실수령</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">불러오는 중...</td>
                </tr>
              ) : !data || !data.details || data.details.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    급여 데이터가 없습니다. '급여 계산' 버튼을 눌러 계산하세요.
                  </td>
                </tr>
              ) : (
                data.details.map((d) => {
                  const taxFree = d.meal_allowance + d.car_allowance + d.research_allowance + d.childcare_allowance;
                  const insurance = d.national_pension + d.health_insurance + d.long_term_care + d.employment_insurance;
                  const incomeTax = d.income_tax + d.local_tax;
                  return (
                    <tr key={d.id} className="border-t border-(--border-main) hover:bg-(--bg-main)/50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-sm">{d.employee_no}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{d.employee_name}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-500">{d.department_name || '-'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm">{formatMoney(d.base_salary)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-blue-600">{formatMoney(taxFree)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-medium">{formatMoney(d.gross_salary)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-red-500">{formatMoney(insurance)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-red-500">{formatMoney(incomeTax)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-red-600 font-medium">{formatMoney(d.total_deduction)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-emerald-600 font-bold">{formatMoney(d.net_salary)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {data?.details && data.details.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-(--border-light) bg-(--bg-main) font-bold">
                  <td colSpan={5} className="px-3 py-3 text-slate-700">합계 ({data.total_employees}명)</td>
                  <td className="px-3 py-3 text-right font-mono text-sm">{formatMoney(data.total_gross)}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right font-mono text-sm text-red-600">{formatMoney(data.total_deduction)}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm text-emerald-600">{formatMoney(data.total_net)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
