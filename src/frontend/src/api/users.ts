/**
 * 사용자/부서/직급 API — 백엔드 /api/v1/system 와 통신하는 함수들
 */
import api from './client';
import type { PaginatedResult } from './customers';

// ── 부서 ──

export interface Department {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface DepartmentFormData {
  code: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number;
}

export async function fetchDepartments() {
  const res = await api.get('/system/departments');
  return res.data.data as Department[];
}

export async function createDepartment(data: DepartmentFormData) {
  const res = await api.post('/system/departments', data);
  return res.data;
}

export async function updateDepartment(id: string, data: Partial<DepartmentFormData> & { is_active?: boolean }) {
  const res = await api.put(`/system/departments/${id}`, data);
  return res.data;
}

// ── 직급 ──

export interface Position {
  id: string;
  code: string;
  name: string;
  level: number;
  is_active: boolean;
  created_at: string;
}

export interface PositionFormData {
  code: string;
  name: string;
  level: number;
}

export async function fetchPositions() {
  const res = await api.get('/system/positions');
  return res.data.data as Position[];
}

export async function createPosition(data: PositionFormData) {
  const res = await api.post('/system/positions', data);
  return res.data;
}

export async function updatePosition(id: string, data: Partial<PositionFormData> & { is_active?: boolean }) {
  const res = await api.put(`/system/positions/${id}`, data);
  return res.data;
}

// ── 사용자 ──

export interface UserInfo {
  id: string;
  employee_no: string;
  name: string;
  email: string;
  department_id: string | null;
  position_id: string | null;
  role: 'admin' | 'manager' | 'user';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserFormData {
  employee_no: string;
  name: string;
  email: string;
  password: string;
  department_id?: string | null;
  position_id?: string | null;
  role: string;
}

export interface UserListParams {
  page?: number;
  size?: number;
  search?: string;
  role?: string;
  department_id?: string;
  is_active?: boolean;
}

export async function fetchUsers(params: UserListParams = {}) {
  const res = await api.get('/system/users', { params });
  return res.data.data as PaginatedResult<UserInfo>;
}

export async function createUser(data: UserFormData) {
  const res = await api.post('/system/users', data);
  return res.data;
}

export async function updateUser(id: string, data: { name?: string; department_id?: string | null; position_id?: string | null; role?: string; is_active?: boolean }) {
  const res = await api.put(`/system/users/${id}`, data);
  return res.data;
}

export async function resetUserPassword(id: string, newPassword: string) {
  const res = await api.post(`/system/users/${id}/reset-password`, { new_password: newPassword });
  return res.data;
}
