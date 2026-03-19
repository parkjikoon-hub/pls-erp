/**
 * M3 인사/급여 — 사원 관리 페이지
 * 목록/검색/필터/등록/수정/비활성화
 */
import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type Employee,
  type EmployeeFormData,
  type PaginatedResult,
} from '../api/hr/employees';
import { useAuthStore } from '../stores/authStore';

// 고용유형 한국어 매핑
const TYPE_LABELS: Record<string, string> = {
  regular: '정규직',
  contract: '계약직',
  part: '파트타임',
};
const TYPE_COLORS: Record<string, string> = {
  regular: 'bg-blue-100 text-blue-700',
  contract: 'bg-amber-100 text-amber-700',
  part: 'bg-slate-100 text-slate-600',
};

const EMPTY_FORM: EmployeeFormData = {
  employee_no: '',
  name: '',
  employee_type: 'regular',
  hire_date: new Date().toISOString().slice(0, 10),
  base_salary: 0,
  is_research_staff: false,
  annual_leave_days: 15,
  has_childcare: false,
  has_car_allowance: false,
  ins_national_pension: true,
  ins_health: true,
  ins_longterm_care: true,
  ins_employment: true,
};

export default function EmployeesPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<Employee> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  // 검색 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 데이터 로딩
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEmployees({
        page,
        size: 50,
        search: search || undefined,
        employee_type: typeFilter || undefined,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 모달 열기
  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      employee_no: emp.employee_no,
      name: emp.name,
      user_id: emp.user_id || undefined,
      department_id: emp.department_id || undefined,
      position_id: emp.position_id || undefined,
      employee_type: emp.employee_type,
      hire_date: emp.hire_date,
      resign_date: emp.resign_date || undefined,
      base_salary: emp.base_salary,
      is_research_staff: emp.is_research_staff,
      annual_leave_days: emp.annual_leave_days,
      bank_name: emp.bank_name || undefined,
      bank_account: emp.bank_account || undefined,
      phone: emp.phone || undefined,
      email: emp.email || undefined,
      address: emp.address || undefined,
      has_childcare: emp.has_childcare,
      has_car_allowance: emp.has_car_allowance,
      ins_national_pension: emp.ins_national_pension ?? true,
      ins_health: emp.ins_health ?? true,
      ins_longterm_care: emp.ins_longterm_care ?? true,
      ins_employment: emp.ins_employment ?? true,
      memo: emp.memo || undefined,
    });
    setError('');
    setShowModal(true);
  };

  // 저장
  const handleSave = async () => {
    if (!form.employee_no.trim() || !form.name.trim()) {
      setError('사번과 이름은 필수입니다.');
      return;
    }
    if (!form.hire_date) {
      setError('입사일은 필수입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { ...form };
      // 빈 문자열 필드 제거
      for (const key of Object.keys(payload)) {
        if (payload[key] === '' || payload[key] === undefined) {
          delete payload[key];
        }
      }
      if (editingId) {
        delete payload.employee_no; // 사번은 수정 불가
        await updateEmployee(editingId, payload as Partial<EmployeeFormData>);
      } else {
        await createEmployee(payload as Partial<EmployeeFormData>);
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; code?: string };
      if (axiosErr.code === 'ECONNABORTED') {
        setError('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '비활성화 중 오류가 발생했습니다.');
    }
  };

  // 금액 포맷
  const formatMoney = (n: number) =>
    new Intl.NumberFormat('ko-KR').format(n);

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">사원 관리</h1>
          <p className="text-sm text-slate-500">
            직원 인사카드를 등록, 조회, 수정합니다.
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 사번으로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
          >
            <option value="">전체 고용유형</option>
            <option value="regular">정규직</option>
            <option value="contract">계약직</option>
            <option value="part">파트타임</option>
          </select>
          {isManager && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg hover:from-violet-600 hover:to-violet-700 transition-all shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              사원 등록
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
                <th className="text-left px-4 py-3 font-semibold w-20">사번</th>
                <th className="text-left px-4 py-3 font-semibold">이름</th>
                <th className="text-left px-4 py-3 font-semibold">부서</th>
                <th className="text-left px-4 py-3 font-semibold">직급</th>
                <th className="text-center px-4 py-3 font-semibold w-20">고용유형</th>
                <th className="text-left px-4 py-3 font-semibold w-24">입사일</th>
                <th className="text-right px-4 py-3 font-semibold w-28">기본급</th>
                <th className="text-center px-4 py-3 font-semibold w-16">연차</th>
                {isManager && (
                  <th className="text-center px-4 py-3 font-semibold w-20">관리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="text-center py-12 text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="text-center py-12 text-slate-400">
                    {search ? '검색 결과가 없습니다' : '등록된 사원이 없습니다'}
                  </td>
                </tr>
              ) : (
                data.items.map((emp) => (
                  <tr
                    key={emp.id}
                    className={`border-t border-(--border-main) hover:bg-(--bg-main)/50 transition-colors ${
                      !emp.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-600">{emp.employee_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{emp.name}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.department_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.position_name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center ${
                          TYPE_COLORS[emp.employee_type] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {TYPE_LABELS[emp.employee_type] || emp.employee_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{emp.hire_date}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(emp.base_salary)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-emerald-600 font-medium">{emp.remaining_leaves}</span>
                      <span className="text-slate-400">/{emp.annual_leave_days}</span>
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1 rounded hover:bg-(--border-main) transition-colors"
                            title="수정"
                          >
                            <PencilSquareIcon className="w-4 h-4 text-slate-500" />
                          </button>
                          {emp.is_active && (
                            <button
                              onClick={() => setDeleteTarget(emp)}
                              className="p-1 rounded hover:bg-red-100 transition-colors"
                              title="비활성화"
                            >
                              <TrashIcon className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-(--border-main)">
            <span className="text-sm text-slate-500">
              전체 {data.total}건 중 {(data.page - 1) * data.size + 1}-
              {Math.min(data.page * data.size, data.total)}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-(--border-main) disabled:opacity-30"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from(
                { length: Math.min(5, data.total_pages) },
                (_, i) => {
                  let startPage = Math.max(1, page - 2);
                  if (startPage + 4 > data.total_pages)
                    startPage = Math.max(1, data.total_pages - 4);
                  const pageNum = startPage + i;
                  if (pageNum > data.total_pages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                        pageNum === page
                          ? 'bg-violet-500 text-white font-bold'
                          : 'hover:bg-(--border-main)'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="p-1 rounded hover:bg-(--border-main) disabled:opacity-30"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 등록/수정 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-(--border-main)">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-main)">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? '사원 정보 수정' : '사원 등록'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-(--border-main)"
              >
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 본문 */}
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 기본 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">기본 정보</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">사번 *</label>
                    <input
                      type="text"
                      value={form.employee_no}
                      onChange={(e) => setForm((f) => ({ ...f, employee_no: e.target.value }))}
                      disabled={!!editingId}
                      placeholder="예: EMP-001"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">이름 *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="홍길동"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">고용유형</label>
                    <select
                      value={form.employee_type}
                      onChange={(e) => setForm((f) => ({ ...f, employee_type: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="regular">정규직</option>
                      <option value="contract">계약직</option>
                      <option value="part">파트타임</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">입사일 *</label>
                    <input
                      type="date"
                      value={form.hire_date}
                      onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  {editingId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">퇴사일</label>
                      <input
                        type="date"
                        value={form.resign_date || ''}
                        onChange={(e) => setForm((f) => ({ ...f, resign_date: e.target.value || undefined }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  )}
                </div>
              </fieldset>

              {/* 급여 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">급여 / 수당 정보</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">기본급 (월)</label>
                    <input
                      type="number"
                      value={form.base_salary}
                      onChange={(e) => setForm((f) => ({ ...f, base_salary: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">연차 일수</label>
                    <input
                      type="number"
                      value={form.annual_leave_days}
                      onChange={(e) => setForm((f) => ({ ...f, annual_leave_days: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-4 mt-1">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_research_staff}
                        onChange={(e) => setForm((f) => ({ ...f, is_research_staff: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
                      />
                      R&D 인력 (연구활동비 비과세)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.has_childcare}
                        onChange={(e) => setForm((f) => ({ ...f, has_childcare: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
                      />
                      육아수당 대상
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.has_car_allowance}
                        onChange={(e) => setForm((f) => ({ ...f, has_car_allowance: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
                      />
                      자가운전보조금 대상
                    </label>
                  </div>
                  {/* 4대보험 가입 선택 */}
                  <div className="col-span-2 mt-2">
                    <p className="text-sm font-medium text-slate-600 mb-1.5">4대보험 가입 선택</p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { key: 'ins_national_pension', label: '국민연금' },
                        { key: 'ins_health', label: '건강보험' },
                        { key: 'ins_longterm_care', label: '장기요양보험' },
                        { key: 'ins_employment', label: '고용보험' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(form as any)[key] ?? true}
                            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* 연락처 / 계좌 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">연락처 / 계좌</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">연락처</label>
                    <input
                      type="text"
                      value={form.phone || ''}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="010-1234-5678"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">이메일</label>
                    <input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="example@email.com"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">급여계좌 은행</label>
                    <input
                      type="text"
                      value={form.bank_name || ''}
                      onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                      placeholder="국민은행"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">계좌번호</label>
                    <input
                      type="text"
                      value={form.bank_account || ''}
                      onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))}
                      placeholder="000-0000-0000-00"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-1">비고</label>
                    <textarea
                      value={form.memo || ''}
                      onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-(--border-main)">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-(--border-main) rounded-lg hover:bg-(--bg-main) transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg hover:from-violet-600 hover:to-violet-700 transition-all disabled:opacity-50"
              >
                {saving ? '저장 중...' : editingId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 비활성화 확인 모달 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-sm p-6 border border-(--border-main)">
            <h3 className="text-lg font-bold text-slate-800 mb-2">사원 비활성화</h3>
            <p className="text-sm text-slate-600 mb-1">
              <strong>{deleteTarget.employee_no} {deleteTarget.name}</strong>
            </p>
            <p className="text-sm text-slate-500 mb-6">
              이 사원을 비활성화하시겠습니까?
              <br />
              <span className="text-sm text-slate-400">
                데이터는 삭제되지 않으며, 급여 계산 대상에서 제외됩니다.
              </span>
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
                비활성화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
