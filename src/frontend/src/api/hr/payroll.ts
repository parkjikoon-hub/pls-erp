/**
 * M3 인사/급여 — 급여 API 호출 함수
 */
import api from '../client';

export interface PayrollDetail {
  id: string;
  employee_id: string;
  employee_no: string | null;
  employee_name: string | null;
  department_name: string | null;
  base_salary: number;
  overtime_pay: number;
  bonus: number;
  meal_allowance: number;
  car_allowance: number;
  research_allowance: number;
  childcare_allowance: number;
  other_allowance: number;
  gross_salary: number;
  taxable_salary: number;
  income_tax: number;
  local_tax: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  total_deduction: number;
  net_salary: number;
  work_days: number;
  leave_days: number;
  absent_days: number;
  leave_deduction: number;
  ai_optimized: boolean;
}

export interface PayrollHeader {
  id: string;
  payroll_year: number;
  payroll_month: number;
  status: string;
  total_employees: number;
  total_gross: number;
  total_deduction: number;
  total_net: number;
  payment_date: string | null;
  journal_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  details?: PayrollDetail[];
}

export async function fetchPayrolls(year?: number) {
  const res = await api.get('/hr/payroll', { params: year ? { year } : {} });
  return res.data.data as PayrollHeader[];
}

export async function fetchPayroll(year: number, month: number) {
  const res = await api.get(`/hr/payroll/${year}/${month}`);
  return res.data.data as PayrollHeader | null;
}

export async function calculatePayroll(year: number, month: number) {
  const res = await api.post('/hr/payroll/calculate', {
    payroll_year: year,
    payroll_month: month,
  });
  return res.data;
}

export async function approvePayroll(year: number, month: number, paymentDate?: string) {
  const res = await api.post(`/hr/payroll/${year}/${month}/approve`, {
    payment_date: paymentDate || null,
  });
  return res.data;
}
