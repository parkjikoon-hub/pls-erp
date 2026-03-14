/**
 * 사용자 관리 페이지 — 부서/직급/사용자를 탭으로 관리
 * 시안 C 기반 디자인
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  XMarkIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  KeyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  fetchDepartments, createDepartment, updateDepartment,
  fetchPositions, createPosition, updatePosition,
  fetchUsers, createUser, updateUser, resetUserPassword,
  type Department, type DepartmentFormData,
  type Position, type PositionFormData,
  type UserInfo, type UserFormData,
} from '../api/users';
import type { PaginatedResult } from '../api/customers';
import { useAuthStore } from '../stores/authStore';

/** 역할 한글 매핑 */
const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  manager: '매니저',
  user: '일반',
};

/** 탭 정의 */
const TABS = [
  { key: 'users', label: '사용자' },
  { key: 'departments', label: '부서' },
  { key: 'positions', label: '직급' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function UsersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabKey>('users');

  return (
    <div>
      {/* 상단 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/system')} className="p-1.5 rounded-lg hover:bg-[#dce1e9] transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserGroupIcon className="w-6 h-6 text-purple-500" />
            사용자 관리
          </h1>
          <p className="text-sm text-slate-500">부서 / 직급 / 사용자 계정을 관리합니다</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-[#e8ecf2] rounded-xl p-1 border border-[#c8ced8] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'users' && <UsersTab isAdmin={isAdmin} />}
      {activeTab === 'departments' && <DepartmentsTab isAdmin={isAdmin} />}
      {activeTab === 'positions' && <PositionsTab isAdmin={isAdmin} />}
    </div>
  );
}


// ══════════════════════════════════════════════
// 사용자 탭
// ══════════════════════════════════════════════

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<PaginatedResult<UserInfo> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // 부서/직급 목록 (드롭다운용)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [form, setForm] = useState<UserFormData>({ employee_no: '', name: '', email: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 비밀번호 초기화 모달
  const [resetTarget, setResetTarget] = useState<UserInfo | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [result, depts, poss] = await Promise.all([
        fetchUsers({
          page, size: 20, search: search || undefined,
          role: roleFilter || undefined,
          is_active: activeFilter === '' ? undefined : activeFilter === 'true',
        }),
        fetchDepartments(),
        fetchPositions(),
      ]);
      setData(result);
      setDepartments(depts);
      setPositions(poss);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [page, search, roleFilter, activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const getDeptName = (id: string | null) => id ? departments.find(d => d.id === id)?.name || '-' : '-';
  const getPosName = (id: string | null) => id ? positions.find(p => p.id === id)?.name || '-' : '-';

  const openCreateModal = () => {
    setForm({ employee_no: '', name: '', email: '', password: '', role: 'user' });
    setEditingUser(null);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (u: UserInfo) => {
    setEditingUser(u);
    setForm({ employee_no: u.employee_no, name: u.name, email: u.email, password: '', department_id: u.department_id, position_id: u.position_id, role: u.role });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('이름과 이메일은 필수입니다.'); return; }
    if (!editingUser && !form.password) { setError('초기 비밀번호를 입력해주세요.'); return; }
    setSaving(true); setError('');
    try {
      if (editingUser) {
        await updateUser(editingUser.id, { name: form.name, department_id: form.department_id, position_id: form.position_id, role: form.role });
      } else {
        await createUser(form);
      }
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (u: UserInfo) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword) return;
    try {
      await resetUserPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword('');
      alert('비밀번호가 초기화되었습니다.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '비밀번호 초기화 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      {/* 필터 바 */}
      <div className="bg-[#e8ecf2] rounded-xl p-4 border border-[#c8ced8] mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="이름, 이메일, 사번 검색..." value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500">
            <option value="">전체 역할</option>
            <option value="admin">관리자</option>
            <option value="manager">매니저</option>
            <option value="user">일반</option>
          </select>
          <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500">
            <option value="">전체 상태</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
          {isAdmin && (
            <button onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors">
              <PlusIcon className="w-4 h-4" /> 사용자 등록
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-[#e8ecf2] rounded-xl border border-[#c8ced8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dce1e9] text-slate-600">
                <th className="text-left px-4 py-3 font-semibold">사번</th>
                <th className="text-left px-4 py-3 font-semibold">이름</th>
                <th className="text-left px-4 py-3 font-semibold">이메일</th>
                <th className="text-left px-4 py-3 font-semibold">부서</th>
                <th className="text-left px-4 py-3 font-semibold">직급</th>
                <th className="text-left px-4 py-3 font-semibold">역할</th>
                <th className="text-center px-4 py-3 font-semibold">상태</th>
                {isAdmin && <th className="text-center px-4 py-3 font-semibold">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-slate-400">불러오는 중...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-slate-400">
                  {search ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}
                </td></tr>
              ) : data.items.map((u) => (
                <tr key={u.id} className="border-t border-[#c8ced8] hover:bg-[#dce1e9]/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.employee_no}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{getDeptName(u.department_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{getPosName(u.position_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      u.role === 'admin' ? 'bg-red-100 text-red-700' :
                      u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{ROLE_LABELS[u.role] || u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEditModal(u)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="수정">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setResetTarget(u); setNewPassword(''); }} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors" title="비밀번호 초기화">
                          <KeyIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleActive(u)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${u.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                          {u.is_active ? '비활성화' : '활성화'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#c8ced8]">
            <span className="text-xs text-slate-500">
              전체 {data.total}건 중 {(data.page - 1) * data.size + 1}-{Math.min(data.page * data.size, data.total)}건
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-[#dce1e9] disabled:opacity-30 transition-colors">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                let startPage = Math.max(1, page - 2);
                if (startPage + 4 > data.total_pages) startPage = Math.max(1, data.total_pages - 4);
                const pageNum = startPage + i;
                if (pageNum > data.total_pages) return null;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pageNum === page ? 'bg-emerald-500 text-white' : 'hover:bg-[#dce1e9] text-slate-600'}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page >= data.total_pages}
                className="p-1.5 rounded-lg hover:bg-[#dce1e9] disabled:opacity-30 transition-colors">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 사용자 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e8ecf2] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#c8ced8]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#c8ced8]">
              <h2 className="text-lg font-bold text-slate-800">{editingUser ? '사용자 수정' : '사용자 등록'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-[#dce1e9] rounded-lg transition-colors">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
              <FormField label="사번 *" value={form.employee_no} onChange={v => setForm(f => ({ ...f, employee_no: v }))} placeholder="예: EMP001" disabled={!!editingUser} />
              <FormField label="이름 *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <FormField label="이메일 *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="user@pls-erp.com" disabled={!!editingUser} />
              {!editingUser && (
                <FormField label="초기 비밀번호 *" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="4자 이상" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">부서</label>
                  <select value={form.department_id || ''} onChange={e => setForm(f => ({ ...f, department_id: e.target.value || null }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500">
                    <option value="">미지정</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">직급</label>
                  <select value={form.position_id || ''} onChange={e => setForm(f => ({ ...f, position_id: e.target.value || null }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500">
                    <option value="">미지정</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">역할</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500">
                  <option value="user">일반</option>
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#c8ced8]">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-[#dce1e9] rounded-lg transition-colors">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors">
                {saving ? '저장 중...' : editingUser ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 초기화 모달 */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e8ecf2] rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#c8ced8]">
            <h3 className="text-lg font-bold text-slate-800 mb-2">비밀번호 초기화</h3>
            <p className="text-sm text-slate-600 mb-4"><strong>{resetTarget.name}</strong> ({resetTarget.email})</p>
            <FormField label="새 비밀번호 *" value={newPassword} onChange={setNewPassword} placeholder="4자 이상" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-[#dce1e9] rounded-lg transition-colors">취소</button>
              <button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 4}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">초기화</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ══════════════════════════════════════════════
// 부서 탭
// ══════════════════════════════════════════════

function DepartmentsTab({ isAdmin }: { isAdmin: boolean }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentFormData>({ code: '', name: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try { setDepartments(await fetchDepartments()); } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setForm({ code: '', name: '', sort_order: 0 }); setEditingDept(null); setError(''); setShowModal(true); };
  const openEdit = (d: Department) => { setForm({ code: d.code, name: d.name, sort_order: d.sort_order }); setEditingDept(d); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('코드와 이름은 필수입니다.'); return; }
    setSaving(true); setError('');
    try {
      if (editingDept) { await updateDepartment(editingDept.id, { name: form.name, sort_order: form.sort_order }); }
      else { await createDepartment(form); }
      setShowModal(false); loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
    } finally { setSaving(false); }
  };

  const handleToggle = async (d: Department) => {
    try { await updateDepartment(d.id, { is_active: !d.is_active }); loadData(); }
    catch { alert('상태 변경 실패'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        {isAdmin && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors">
            <PlusIcon className="w-4 h-4" /> 부서 추가
          </button>
        )}
      </div>
      <div className="bg-[#e8ecf2] rounded-xl border border-[#c8ced8] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#dce1e9] text-slate-600">
              <th className="text-left px-4 py-3 font-semibold">코드</th>
              <th className="text-left px-4 py-3 font-semibold">부서명</th>
              <th className="text-center px-4 py-3 font-semibold">정렬순서</th>
              <th className="text-center px-4 py-3 font-semibold">상태</th>
              {isAdmin && <th className="text-center px-4 py-3 font-semibold">관리</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-slate-400">불러오는 중...</td></tr>
            ) : departments.length === 0 ? (
              <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-slate-400">등록된 부서가 없습니다</td></tr>
            ) : departments.map(d => (
              <tr key={d.id} className="border-t border-[#c8ced8] hover:bg-[#dce1e9]/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.code}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                <td className="px-4 py-3 text-center text-slate-600">{d.sort_order}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${d.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => handleToggle(d)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${d.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                        {d.is_active ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e8ecf2] rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#c8ced8]">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingDept ? '부서 수정' : '부서 추가'}</h3>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm mb-3">{error}</div>}
            <div className="space-y-3">
              <FormField label="부서 코드 *" value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="예: D001" disabled={!!editingDept} />
              <FormField label="부서명 *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">정렬 순서</label>
                <input type="number" value={form.sort_order || 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} min={0}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-[#dce1e9] rounded-lg transition-colors">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors">
                {saving ? '저장 중...' : editingDept ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ══════════════════════════════════════════════
// 직급 탭
// ══════════════════════════════════════════════

function PositionsTab({ isAdmin }: { isAdmin: boolean }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [form, setForm] = useState<PositionFormData>({ code: '', name: '', level: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try { setPositions(await fetchPositions()); } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setForm({ code: '', name: '', level: 1 }); setEditingPos(null); setError(''); setShowModal(true); };
  const openEdit = (p: Position) => { setForm({ code: p.code, name: p.name, level: p.level }); setEditingPos(p); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('코드와 이름은 필수입니다.'); return; }
    setSaving(true); setError('');
    try {
      if (editingPos) { await updatePosition(editingPos.id, { name: form.name, level: form.level }); }
      else { await createPosition(form); }
      setShowModal(false); loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
    } finally { setSaving(false); }
  };

  const handleToggle = async (p: Position) => {
    try { await updatePosition(p.id, { is_active: !p.is_active }); loadData(); }
    catch { alert('상태 변경 실패'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        {isAdmin && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors">
            <PlusIcon className="w-4 h-4" /> 직급 추가
          </button>
        )}
      </div>
      <div className="bg-[#e8ecf2] rounded-xl border border-[#c8ced8] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#dce1e9] text-slate-600">
              <th className="text-left px-4 py-3 font-semibold">코드</th>
              <th className="text-left px-4 py-3 font-semibold">직급명</th>
              <th className="text-center px-4 py-3 font-semibold">레벨</th>
              <th className="text-center px-4 py-3 font-semibold">상태</th>
              {isAdmin && <th className="text-center px-4 py-3 font-semibold">관리</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-slate-400">불러오는 중...</td></tr>
            ) : positions.length === 0 ? (
              <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-slate-400">등록된 직급이 없습니다</td></tr>
            ) : positions.map(p => (
              <tr key={p.id} className="border-t border-[#c8ced8] hover:bg-[#dce1e9]/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.code}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-center text-slate-600">{p.level}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => handleToggle(p)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${p.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                        {p.is_active ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e8ecf2] rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#c8ced8]">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingPos ? '직급 수정' : '직급 추가'}</h3>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm mb-3">{error}</div>}
            <div className="space-y-3">
              <FormField label="직급 코드 *" value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="예: POS001" disabled={!!editingPos} />
              <FormField label="직급명 *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="예: 대리" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">레벨 (높을수록 상위)</label>
                <input type="number" value={form.level} onChange={e => setForm(f => ({ ...f, level: Number(e.target.value) }))} min={1} max={20}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-[#dce1e9] rounded-lg transition-colors">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors">
                {saving ? '저장 중...' : editingPos ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/** 재사용 가능한 텍스트 폼 필드 컴포넌트 */
function FormField({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#c8ced8] bg-white focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 transition-colors" />
    </div>
  );
}
