/**
 * M4 재무/회계 — 은행 입금 내역 임포트 API
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface ParsedTransaction {
  row_index: number;
  transaction_date: string;
  description: string;
  deposit_amount: number;
  withdrawal_amount: number;
  balance: number;
  hash: string;
  is_duplicate: boolean;
  mapped_account_id: string | null;
  mapped_account_name: string | null;
}

export interface ParseResult {
  bank_code: string;
  file_name: string;
  total_rows: number;
  deposit_rows: number;
  transactions: ParsedTransaction[];
}

export interface ConfirmTransaction {
  transaction_date: string;
  description: string;
  amount: number;
  account_id: string;
  hash: string;
}

export interface ImportHistory {
  id: string;
  import_date: string;
  bank_code: string;
  file_name: string;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  total_deposit: number;
  source: string;
}

export interface AccountMapping {
  id: string;
  keyword: string;
  account_id: string;
  account_name: string | null;
  priority: number;
  is_active: boolean;
}

export interface CompanyBankAccount {
  id: string;
  bank_code: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  account_type: string;
  chart_account_id: string;
  chart_account_name: string | null;
  is_primary: boolean;
  is_active: boolean;
  memo: string | null;
}

/* ── API 함수 ── */

/** CSV 파일 업로드 + 파싱 (미리보기) */
export async function parseBankCSV(file: File, bankCode: string): Promise<ParseResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/finance/bank-import/parse?bank_code=${bankCode}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data ?? res.data;
}

/** 전표 생성 확인 */
export async function confirmImport(data: {
  bank_code: string;
  file_name: string;
  bank_account_id?: string;
  transactions: ConfirmTransaction[];
}) {
  const res = await api.post('/finance/bank-import/confirm', data);
  return res.data?.data ?? res.data;
}

/** 임포트 이력 조회 */
export async function getImportHistory(params?: { page?: number; size?: number }) {
  const res = await api.get('/finance/bank-import/history', { params });
  return res.data?.data ?? res.data;
}

/** 매핑 규칙 목록 */
export async function getMappings(): Promise<AccountMapping[]> {
  const res = await api.get('/finance/bank-import/mappings');
  return res.data?.data ?? res.data;
}

/** 매핑 규칙 추가 */
export async function createMapping(data: {
  keyword: string;
  account_id: string;
  priority?: number;
}): Promise<AccountMapping> {
  const res = await api.post('/finance/bank-import/mappings', data);
  return res.data?.data ?? res.data;
}

/** 매핑 규칙 삭제 */
export async function deleteMapping(id: string) {
  const res = await api.delete(`/finance/bank-import/mappings/${id}`);
  return res.data?.data ?? res.data;
}

/* ── 회사 은행 계좌 관리 ── */

/** 등록된 회사 계좌 목록 */
export async function getBankAccounts(): Promise<CompanyBankAccount[]> {
  const res = await api.get('/finance/bank-import/accounts');
  return res.data?.data ?? res.data;
}

/** 회사 계좌 등록 */
export async function createBankAccount(data: {
  bank_code: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  account_type?: string;
  chart_account_id: string;
  is_primary?: boolean;
  memo?: string;
}): Promise<CompanyBankAccount> {
  const res = await api.post('/finance/bank-import/accounts', data);
  return res.data?.data ?? res.data;
}

/** 회사 계좌 수정 */
export async function updateBankAccount(id: string, data: Partial<{
  bank_code: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  account_type: string;
  chart_account_id: string;
  is_primary: boolean;
  memo: string;
}>): Promise<CompanyBankAccount> {
  const res = await api.put(`/finance/bank-import/accounts/${id}`, data);
  return res.data?.data ?? res.data;
}

/** 회사 계좌 삭제 */
export async function deleteBankAccount(id: string) {
  const res = await api.delete(`/finance/bank-import/accounts/${id}`);
  return res.data?.data ?? res.data;
}
