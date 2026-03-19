/**
 * M3 인사/급여 — 근태/휴가 관리 페이지
 * 예외 기반: 정상출근은 기록하지 않고, 휴가/병가/결근만 입력
 */
import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  fetchAttendance,
  createAttendance,
  deleteAttendance,
  type AttendanceRecord,
  type AttendanceFormData,
  type PaginatedResult,
} from '../api/hr/attendance';
import { searchEmployees, type EmployeeSearchResult } from '../api/hr/employees';
import { useAuthStore } from '../stores/authStore';

// 근태 유형 한국어 매핑
const TYPE_LABELS: Record<string, string> = {
  leave: '연차',
  sick: '병가',
  absent: '결근',
  half: '반차',
  early: '조퇴',
};
const TYPE_COLORS: Record<string, string> = {
  leave: 'bg-blue-100 text-blue-700',
  sick: 'bg-red-100 text-red-700',
  absent: 'bg-slate-200 text-slate-700',
  half: 'bg-amber-100 text-amber-700',
  early: 'bg-purple-100 text-purple-700',
};
const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '연차',
  sick: '병가',
  special: '특별휴가',
  half_am: '오전반차',
  half_pm: '오후반차',
};

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const now = new Date();

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<AttendanceRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState('');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AttendanceFormData>({
    employee_id: '',
    work_date: now.toISOString().slice(0, 10),
    attendance_type: 'leave',
    leave_type: 'annual',
    leave_days: 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 직원 검색
  const [empSearch, setEmpSearch] = useState('');
  const [empResults, setEmpResults] = useState<EmployeeSearchResult[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSearchResult | null>(null);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);

  // 데이터 로딩
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAttendance({
        year: yearFilter,
        month: monthFilter,
        attendance_type: typeFilter || undefined,
        size: 100,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [yearFilter, monthFilter, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 직원 검색 디바운스
  useEffect(() => {
    if (empSearch.length < 1) {
      setEmpResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchEmployees(empSearch, 10);
        setEmpResults(results);
      } catch {
        setEmpResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [empSearch]);

  // 근태 유형 변경 시 차감일수 자동 설정
  const handleTypeChange = (type: string) => {
    let days = 1;
    let leaveType: string | undefined = undefined;
    if (type === 'half') {
      days = 0.5;
      leaveType = 'half_am';
    } else if (type === 'leave') {
      leaveType = 'annual';
    } else if (type === 'sick') {
      leaveType = 'sick';
    }
    setForm((f) => ({ ...f, attendance_type: type, leave_days: days, leave_type: leaveType }));
  };

  // 모달 열기
  const openModal = () => {
    setForm({
      employee_id: '',
      work_date: now.toISOString().slice(0, 10),
      attendance_type: 'leave',
      leave_type: 'annual',
      leave_days: 1,
    });
    setSelectedEmp(null);
    setEmpSearch('');
    setError('');
    setShowModal(true);
  };

  // 저장
  const handleSave = async () => {
    if (!form.employee_id) {
      setError('직원을 선택해주세요.');
      return;
    }
    if (!form.work_date) {
      setError('날짜를 선택해주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAttendance(form);
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAttendance(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">근태/휴가 관리</h1>
          <p className="text-sm text-slate-500">
            예외 기반 근태 — 정상출근은 자동 처리되며, 휴가/병가/결근만 기록합니다.
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}월</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
          >
            <option value="">전체 유형</option>
            <option value="leave">연차</option>
            <option value="half">반차</option>
            <option value="sick">병가</option>
            <option value="absent">결근</option>
            <option value="early">조퇴</option>
          </select>
          <div className="flex-1" />
          {isManager && (
            <button
              onClick={openModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg hover:from-violet-600 hover:to-violet-700 transition-all shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              근태 등록
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-(--bg-card) rounded-xl border border-(--border-main) overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-(--bg-main) text-slate-600">
                <th className="text-left px-4 py-3 font-semibold w-24">날짜</th>
                <th className="text-left px-4 py-3 font-semibold w-20">사번</th>
                <th className="text-left px-4 py-3 font-semibold">이름</th>
                <th className="text-center px-4 py-3 font-semibold w-20">유형</th>
                <th className="text-center px-4 py-3 font-semibold w-24">휴가종류</th>
                <th className="text-center px-4 py-3 font-semibold w-16">차감일</th>
                <th className="text-left px-4 py-3 font-semibold">사유</th>
                {isManager && (
                  <th className="text-center px-4 py-3 font-semibold w-16">삭제</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isManager ? 8 : 7} className="text-center py-12 text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 8 : 7} className="text-center py-12 text-slate-400">
                    해당 기간에 근태 기록이 없습니다 (모두 정상출근)
                  </td>
                </tr>
              ) : (
                data.items.map((rec) => (
                  <tr key={rec.id} className="border-t border-(--border-main) hover:bg-(--bg-main)/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600">{rec.work_date}</td>
                    <td className="px-4 py-3 text-xs">{rec.employee_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{rec.employee_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center ${TYPE_COLORS[rec.attendance_type] || 'bg-slate-100'}`}>
                        {TYPE_LABELS[rec.attendance_type] || rec.attendance_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {rec.leave_type ? (LEAVE_TYPE_LABELS[rec.leave_type] || rec.leave_type) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">{rec.leave_days}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[200px]">
                      {rec.memo || '-'}
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1 rounded hover:bg-red-100 transition-colors"
                          title="삭제 (연차 복원)"
                        >
                          <TrashIcon className="w-4 h-4 text-red-400" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 등록 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-md border border-(--border-main)">
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-main)">
              <h2 className="text-lg font-bold text-slate-800">근태 등록</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-(--border-main)">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
              )}

              {/* 직원 선택 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">직원 *</label>
                {selectedEmp ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                    <span className="text-sm font-medium text-violet-700">
                      {selectedEmp.employee_no} {selectedEmp.name}
                    </span>
                    <span className="text-xs text-slate-500">{selectedEmp.department_name}</span>
                    <button
                      onClick={() => { setSelectedEmp(null); setForm(f => ({ ...f, employee_id: '' })); setEmpSearch(''); }}
                      className="ml-auto text-slate-400 hover:text-red-500"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      placeholder="이름 또는 사번 검색..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                    {empResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-(--border-main) rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {empResults.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => {
                              setSelectedEmp(e);
                              setForm((f) => ({ ...f, employee_id: e.id }));
                              setEmpResults([]);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 border-b border-(--border-main) last:border-0"
                          >
                            <span className="text-xs text-slate-500 mr-2">{e.employee_no}</span>
                            <span className="font-medium">{e.name}</span>
                            {e.department_name && (
                              <span className="text-xs text-slate-400 ml-2">{e.department_name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 날짜 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={form.work_date}
                  onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* 근태 유형 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">유형</label>
                  <select
                    value={form.attendance_type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="leave">연차</option>
                    <option value="half">반차</option>
                    <option value="sick">병가</option>
                    <option value="absent">결근</option>
                    <option value="early">조퇴</option>
                  </select>
                </div>
                {(form.attendance_type === 'leave' || form.attendance_type === 'half') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">휴가 종류</label>
                    <select
                      value={form.leave_type || ''}
                      onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    >
                      {form.attendance_type === 'half' ? (
                        <>
                          <option value="half_am">오전반차</option>
                          <option value="half_pm">오후반차</option>
                        </>
                      ) : (
                        <>
                          <option value="annual">연차</option>
                          <option value="special">특별휴가</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* 사유 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">사유</label>
                <textarea
                  value={form.memo || ''}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  rows={2}
                  placeholder="사유를 입력하세요 (선택)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-(--border-main)">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-(--border-main) rounded-lg hover:bg-(--bg-main)"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg hover:from-violet-600 hover:to-violet-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-sm p-6 border border-(--border-main)">
            <h3 className="text-lg font-bold text-slate-800 mb-2">근태 기록 삭제</h3>
            <p className="text-sm text-slate-600 mb-1">
              <strong>{deleteTarget.employee_name}</strong> — {deleteTarget.work_date}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              {TYPE_LABELS[deleteTarget.attendance_type]} ({deleteTarget.leave_days}일)
            </p>
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded mb-4">
              삭제 시 차감된 연차가 자동으로 복원됩니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-(--border-main) rounded-lg hover:bg-(--bg-main)"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
