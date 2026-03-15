/**
 * M3 인사/급여 — 보고서 + 국세청 신고파일 API
 */
import api from '../client';

export interface Payslip {
  year: number;
  month: number;
  status: string;
  payment_date: string | null;
  employee: {
    employee_no: string;
    name: string;
    department: string | null;
    position: string | null;
  };
  earnings: {
    base_salary: number;
    overtime_pay: number;
    bonus: number;
    meal_allowance: number;
    car_allowance: number;
    research_allowance: number;
    childcare_allowance: number;
    other_allowance: number;
    total_tax_free: number;
    gross_salary: number;
    taxable_salary: number;
  };
  deductions: {
    income_tax: number;
    local_tax: number;
    national_pension: number;
    health_insurance: number;
    long_term_care: number;
    employment_insurance: number;
    total_deduction: number;
  };
  net_salary: number;
  attendance: {
    work_days: number;
    leave_days: number;
    absent_days: number;
    leave_deduction: number;
  };
  ai_optimized: boolean;
}

export interface HRSummary {
  year: number;
  headcount: {
    active: number;
    inactive: number;
    by_type: Record<string, number>;
  };
  payroll_annual: {
    months_calculated: number;
    total_gross: number;
    total_deduction: number;
    total_net: number;
  };
  attendance_annual: Record<string, number>;
}

export async function fetchPayslip(employeeId: string, year: number, month: number) {
  const res = await api.get(`/hr/reports/payslip/${employeeId}`, { params: { year, month } });
  return res.data.data as Payslip;
}

export async function fetchHRSummary(year: number) {
  const res = await api.get('/hr/reports/summary', { params: { year } });
  return res.data.data as HRSummary;
}

export function getTaxFilingUrl(year: number, month: number) {
  // 직접 다운로드 URL 반환 (CSV 파일)
  return `${api.defaults.baseURL}/hr/reports/tax-filing?year=${year}&month=${month}`;
}
