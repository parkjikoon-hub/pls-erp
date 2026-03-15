/**
 * M3 인사/급여 — 근태/휴가 API 호출 함수
 */
import api from '../client';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_no: string | null;
  employee_name: string | null;
  work_date: string;
  attendance_type: string;
  leave_type: string | null;
  leave_days: number;
  memo: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface AttendanceFormData {
  employee_id: string;
  work_date: string;
  attendance_type: string;
  leave_type?: string;
  leave_days: number;
  memo?: string;
}

export interface LeaveSummary {
  employee_id: string;
  employee_name: string;
  year: number;
  annual_leave_days: number;
  remaining_leaves: number;
  leave_used: number;
  sick_days: number;
  absent_days: number;
  total_exceptions: number;
}

export interface AttendanceListParams {
  employee_id?: string;
  year?: number;
  month?: number;
  attendance_type?: string;
  page?: number;
  size?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export async function fetchAttendance(params: AttendanceListParams = {}) {
  const res = await api.get('/hr/attendance', { params });
  return res.data.data as PaginatedResult<AttendanceRecord>;
}

export async function fetchLeaveSummary(employeeId: string, year: number) {
  const res = await api.get(`/hr/attendance/summary/${employeeId}`, { params: { year } });
  return res.data.data as LeaveSummary;
}

export async function createAttendance(data: AttendanceFormData) {
  const res = await api.post('/hr/attendance', data);
  return res.data;
}

export async function deleteAttendance(id: string) {
  const res = await api.delete(`/hr/attendance/${id}`);
  return res.data;
}
