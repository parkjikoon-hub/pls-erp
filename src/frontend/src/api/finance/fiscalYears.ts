/**
 * M4 재무/회계 — 회계연도 API 호출 함수
 */
import api from '../client';

export interface FiscalYear {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
}

export async function fetchFiscalYears() {
  const res = await api.get('/finance/fiscal-years');
  return res.data.data as FiscalYear[];
}

export async function createFiscalYear(data: { year: number; start_date: string; end_date: string }) {
  const res = await api.post('/finance/fiscal-years', data);
  return res.data;
}

export async function updateFiscalYear(id: string, data: { start_date?: string; end_date?: string }) {
  const res = await api.put(`/finance/fiscal-years/${id}`, data);
  return res.data;
}
