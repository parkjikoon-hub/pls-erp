/**
 * M3 인사/급여 — 직원(인사카드) API 호출 함수
 */
import api from '../client';

// ── 타입 정의 ──

export interface Employee {
  id: string;
  employee_no: string;
  name: string;
  user_id: string | null;
  department_id: string | null;
  department_name: string | null;
  position_id: string | null;
  position_name: string | null;
  employee_type: string;
  hire_date: string;
  resign_date: string | null;
  base_salary: number;
  is_research_staff: boolean;
  annual_leave_days: number;
  remaining_leaves: number;
  bank_name: string | null;
  bank_account: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  has_childcare: boolean;
  has_car_allowance: boolean;
  memo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeFormData {
  employee_no: string;
  name: string;
  user_id?: string;
  department_id?: string;
  position_id?: string;
  employee_type: string;
  hire_date: string;
  resign_date?: string;
  base_salary: number;
  is_research_staff: boolean;
  annual_leave_days: number;
  bank_name?: string;
  bank_account?: string;
  phone?: string;
  email?: string;
  address?: string;
  has_childcare: boolean;
  has_car_allowance: boolean;
  memo?: string;
}

export interface EmployeeSearchResult {
  id: string;
  employee_no: string;
  name: string;
  department_name: string | null;
  position_name: string | null;
}

export interface EmployeeListParams {
  page?: number;
  size?: number;
  search?: string;
  department_id?: string;
  employee_type?: string;
  is_active?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 함수 ──

export async function fetchEmployees(params: EmployeeListParams = {}) {
  const res = await api.get('/hr/employees', { params });
  return res.data.data as PaginatedResult<Employee>;
}

export async function fetchEmployee(id: string) {
  const res = await api.get(`/hr/employees/${id}`);
  return res.data.data as Employee;
}

export async function searchEmployees(q: string, limit = 20) {
  const res = await api.get('/hr/employees/search', { params: { q, limit } });
  return res.data.data as EmployeeSearchResult[];
}

export async function createEmployee(data: Partial<EmployeeFormData>) {
  const res = await api.post('/hr/employees', data);
  return res.data;
}

export async function updateEmployee(id: string, data: Partial<EmployeeFormData>) {
  const res = await api.put(`/hr/employees/${id}`, data);
  return res.data;
}

export async function deleteEmployee(id: string) {
  const res = await api.delete(`/hr/employees/${id}`);
  return res.data;
}
