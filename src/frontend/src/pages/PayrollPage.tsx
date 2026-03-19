/**
 * M3 인사/급여 — 급여 관리 페이지
 * 급여 계산, 추가근무 입력, 급여대장 조회, 개별/전체 승인
 */
import { useState, useEffect, useCallback } from 'react';
import {
  CalculatorIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  fetchPayroll,
  calculatePayroll,
  approvePayroll,
  approvePayrollItems,
  updateOvertime,
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

const DETAIL_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인',
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

  // 추가근무 편집 상태
  const [overtimeEdits, setOvertimeEdits] = useState<Record<string, number>>({});
  const [savingOvertime, setSavingOvertime] = useState(false);
  const [showOvertimeCol, setShowOvertimeCol] = useState(false);

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const formatMoney = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPayroll(year, month);
      setData(result);
      setOvertimeEdits({});
      setSelectedIds(new Set());
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

  // 전체 승인 (기존)
  const handleApproveAll = async () => {
    if (!confirm(`${year}년 ${month}월 급여를 전체 승인하시겠습니까?`)) return;
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

  // 선택 승인 (개별)
  const handleApproveSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert('승인할 직원을 선택하세요.');
      return;
    }
    if (!confirm(`선택한 ${ids.length}명의 급여를 승인하시겠습니까?`)) return;
    setApproving(true);
    try {
      await approvePayrollItems(year, month, ids);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '승인 중 오류가 발생했습니다.');
    } finally {
      setApproving(false);
    }
  };

  // 개별 행 승인
  const handleApproveOne = async (detailId: string) => {
    if (!confirm('이 직원의 급여를 승인하시겠습니까?')) return;
    setApproving(true);
    try {
      await approvePayrollItems(year, month, [detailId]);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '승인 중 오류가 발생했습니다.');
    } finally {
      setApproving(false);
    }
  };

  // 추가근무 시간 저장
  const handleSaveOvertime = async () => {
    const items = Object.entries(overtimeEdits).map(([detail_id, overtime_hours]) => ({
      detail_id,
      overtime_hours,
    }));
    if (items.length === 0) {
      alert('변경된 추가근무 시간이 없습니다.');
      return;
    }
    setSavingOvertime(true);
    try {
      await updateOvertime(year, month, items);
      await loadData();
      alert('추가근무 시간이 반영되었습니다.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
    } finally {
      setSavingOvertime(false);
    }
  };

  // 체크박스 핸들러
  const pendingDetails = data?.details?.filter(d => (d.detail_status || 'pending') !== 'approved') || [];
  const allPendingSelected = pendingDetails.length > 0 && pendingDetails.every(d => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingDetails.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canEdit = data?.status === 'calculated' || data?.status === 'draft';
  const canApprove = isAdmin && data?.status === 'calculated';
  const hasOvertimeEdits = Object.keys(overtimeEdits).length > 0;

  // 칼럼 수 계산
  const extraCols = (showOvertimeCol ? 1 : 0) + (canApprove ? 2 : 0);
  const totalCols = 11 + extraCols;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">급여 관리</h1>
          <p className="text-sm text-slate-500">
            월급여 계산 (4대보험, 소득세, 비과세, 추가근무 자동 산출)
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

          {/* 추가근무 입력 토글 */}
          {isManager && data?.details && data.details.length > 0 && canEdit && (
            <button
              onClick={() => setShowOvertimeCol(!showOvertimeCol)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border shadow-sm transition-colors ${
                showOvertimeCol
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-(--border-main) text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ClockIcon className="w-4 h-4" />
              추가근무 입력
            </button>
          )}

          {/* 추가근무 저장 */}
          {showOvertimeCol && hasOvertimeEdits && (
            <button
              onClick={handleSaveOvertime}
              disabled={savingOvertime}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 shadow-sm"
            >
              {savingOvertime ? '저장 중...' : '추가근무 저장'}
            </button>
          )}

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
                {/* 체크박스 (승인 가능할 때만) */}
                {canApprove && (
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      title="전체 선택"
                    />
                  </th>
                )}
                <th className="text-left px-3 py-3 font-semibold w-16">사번</th>
                <th className="text-left px-3 py-3 font-semibold">이름</th>
                <th className="text-left px-3 py-3 font-semibold">부서</th>
                <th className="text-right px-3 py-3 font-semibold">기본급</th>
                {showOvertimeCol && (
                  <th className="text-center px-3 py-3 font-semibold text-amber-700 bg-amber-50">추가근무(h)</th>
                )}
                <th className="text-right px-3 py-3 font-semibold">추가근무수당</th>
                <th className="text-right px-3 py-3 font-semibold">비과세</th>
                <th className="text-right px-3 py-3 font-semibold">총지급</th>
                <th className="text-right px-3 py-3 font-semibold">4대보험</th>
                <th className="text-right px-3 py-3 font-semibold">소득세</th>
                <th className="text-right px-3 py-3 font-semibold">총공제</th>
                <th className="text-right px-3 py-3 font-semibold text-emerald-700">실수령</th>
                {/* 승인 상태/버튼 칼럼 */}
                {canApprove && (
                  <th className="text-center px-3 py-3 font-semibold w-20">승인</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={totalCols} className="text-center py-12 text-slate-400">불러오는 중...</td>
                </tr>
              ) : !data || !data.details || data.details.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="text-center py-12 text-slate-400">
                    급여 데이터가 없습니다. '급여 계산' 버튼을 눌러 계산하세요.
                  </td>
                </tr>
              ) : (
                data.details.map((d) => {
                  const taxFree = d.meal_allowance + d.car_allowance + d.research_allowance + d.childcare_allowance;
                  const insurance = d.national_pension + d.health_insurance + d.long_term_care + d.employment_insurance;
                  const incomeTax = d.income_tax + d.local_tax;
                  const currentOT = overtimeEdits[d.id] ?? d.overtime_hours;
                  const isApproved = (d.detail_status || 'pending') === 'approved';
                  return (
                    <tr
                      key={d.id}
                      className={`border-t border-(--border-main) hover:bg-(--bg-main)/50 transition-colors ${
                        isApproved ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* 체크박스 */}
                      {canApprove && (
                        <td className="px-3 py-2.5 text-center">
                          {isApproved ? (
                            <CheckCircleIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(d.id)}
                              onChange={() => toggleSelect(d.id)}
                              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-sm">{d.employee_no}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{d.employee_name}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-500">{d.department_name || '-'}</td>
                      <td className="px-3 py-2.5 text-right text-sm">{formatMoney(d.base_salary)}</td>
                      {showOvertimeCol && (
                        <td className="px-2 py-1.5 text-center bg-amber-50/50">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={currentOT}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              setOvertimeEdits((prev) => ({ ...prev, [d.id]: v }));
                            }}
                            disabled={!canEdit}
                            className="w-16 px-2 py-1 text-sm text-center border border-amber-300 rounded-md bg-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right text-sm text-amber-600">
                        {d.overtime_pay > 0 ? formatMoney(d.overtime_pay) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-blue-600">{formatMoney(taxFree)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium">{formatMoney(d.gross_salary)}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-red-500">{formatMoney(insurance)}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-red-500">{formatMoney(incomeTax)}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-red-600 font-medium">{formatMoney(d.total_deduction)}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-emerald-600 font-bold">{formatMoney(d.net_salary)}</td>
                      {/* 개별 승인 버튼 */}
                      {canApprove && (
                        <td className="px-2 py-2 text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              {DETAIL_STATUS_LABELS['approved']}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApproveOne(d.id)}
                              disabled={approving}
                              className="px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100 disabled:opacity-50 transition-colors"
                            >
                              승인
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {data?.details && data.details.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-(--border-light) bg-(--bg-main) font-bold">
                  <td colSpan={(canApprove ? 1 : 0) + (showOvertimeCol ? 7 : 6)} className="px-3 py-3 text-slate-700">
                    합계 ({data.total_employees}명)
                  </td>
                  <td className="px-3 py-3 text-right text-sm">{formatMoney(data.total_gross)}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right text-sm text-red-600">{formatMoney(data.total_deduction)}</td>
                  <td className="px-3 py-3 text-right text-sm text-emerald-600">{formatMoney(data.total_net)}</td>
                  {canApprove && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 하단 승인 바 */}
        {canApprove && data?.details && data.details.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-(--border-main)">
            <div className="text-sm text-slate-600">
              {selectedIds.size > 0 ? (
                <span className="font-medium text-violet-700">{selectedIds.size}명 선택됨</span>
              ) : (
                <span>직원을 선택하여 개별 승인하거나, 전체 승인할 수 있습니다.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 선택 승인 */}
              <button
                onClick={handleApproveSelected}
                disabled={approving || selectedIds.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {approving ? '승인 중...' : `선택 승인 (${selectedIds.size}명)`}
              </button>
              {/* 전체 승인 */}
              <button
                onClick={handleApproveAll}
                disabled={approving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 shadow-sm"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {approving ? '승인 중...' : '전체 승인'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
