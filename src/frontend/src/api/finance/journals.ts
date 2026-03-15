/**
 * M4 재무/회계 — 전표(Journal Entry) API 호출 함수
 */
import api from '../client';

// ── 타입 정의 ──

export interface JournalLine {
  id: string;
  line_no: number;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit_amount: number;
  credit_amount: number;
  customer_id: string | null;
  customer_name: string | null;
  description: string | null;
  tax_code: string | null;
  tax_amount: number;
}

export interface JournalLineInput {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  customer_id?: string;
  description?: string;
  tax_code?: string;
  tax_amount?: number;
}

export interface Journal {
  id: string;
  entry_no: string;
  entry_date: string;
  entry_type: string;
  description: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
  source_module: string | null;
  source_id: string | null;
  fiscal_year_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  created_by: string | null;
  lines: JournalLine[];
}

export interface JournalListItem {
  id: string;
  entry_no: string;
  entry_date: string;
  entry_type: string;
  description: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
  created_at: string | null;
  created_by_name: string | null;
}

export interface JournalFormData {
  entry_date: string;
  entry_type: string;
  description?: string;
  lines: JournalLineInput[];
}

export interface JournalListParams {
  page?: number;
  size?: number;
  start_date?: string;
  end_date?: string;
  entry_type?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 함수 ──

export async function fetchJournals(params: JournalListParams = {}) {
  const res = await api.get('/finance/journals', { params });
  return res.data.data as PaginatedResult<JournalListItem>;
}

export async function fetchJournal(id: string) {
  const res = await api.get(`/finance/journals/${id}`);
  return res.data.data as Journal;
}

export async function createJournal(data: JournalFormData) {
  const res = await api.post('/finance/journals', data);
  return res.data;
}

export async function updateJournal(id: string, data: Partial<JournalFormData>) {
  const res = await api.put(`/finance/journals/${id}`, data);
  return res.data;
}

export async function deleteJournal(id: string) {
  const res = await api.delete(`/finance/journals/${id}`);
  return res.data;
}

// ── 상태 워크플로우 ──

export async function submitJournal(id: string) {
  const res = await api.post(`/finance/journals/${id}/submit`);
  return res.data;
}

export async function approveJournal(id: string) {
  const res = await api.post(`/finance/journals/${id}/approve`);
  return res.data;
}

export async function postJournal(id: string) {
  const res = await api.post(`/finance/journals/${id}/post`);
  return res.data;
}

export async function rejectJournal(id: string, reason?: string) {
  const res = await api.post(`/finance/journals/${id}/reject`, { reason });
  return res.data;
}

// ── 유틸 ──

export async function fetchNextEntryNo(entryDate: string) {
  const res = await api.get('/finance/journals/next-entry-no', {
    params: { entry_date: entryDate },
  });
  return res.data.data.entry_no as string;
}
