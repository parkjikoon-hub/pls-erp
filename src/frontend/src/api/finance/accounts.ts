/**
 * M4 재무/회계 — 계정과목 API 호출 함수
 */
import api from '../client';

// ── 타입 정의 ──

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  account_group: string | null;
  normal_balance: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountSearchResult {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
}

export interface AccountFormData {
  code: string;
  name: string;
  account_type: string;
  account_group: string;
  normal_balance: string;
  parent_id: string;
  sort_order: number;
}

export interface AccountListParams {
  page?: number;
  size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  account_type?: string;
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

export async function fetchAccounts(params: AccountListParams = {}) {
  const res = await api.get('/finance/accounts', { params });
  return res.data.data as PaginatedResult<Account>;
}

export async function fetchAccount(id: string) {
  const res = await api.get(`/finance/accounts/${id}`);
  return res.data.data as Account;
}

export async function searchAccounts(q: string, limit = 20) {
  const res = await api.get('/finance/accounts/search', { params: { q, limit } });
  return res.data.data as AccountSearchResult[];
}

export async function createAccount(data: Partial<AccountFormData>) {
  const res = await api.post('/finance/accounts', data);
  return res.data;
}

export async function updateAccount(id: string, data: Partial<AccountFormData>) {
  const res = await api.put(`/finance/accounts/${id}`, data);
  return res.data;
}

export async function deleteAccount(id: string) {
  const res = await api.delete(`/finance/accounts/${id}`);
  return res.data;
}
