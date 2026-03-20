/**
 * M4 재무/회계 — CODEF 은행 실시간 연동 API
 */
import api from '../client';

const BASE = '/finance/bank-realtime';

export interface BankCode {
  code: string;
  name: string;
}

export interface CodefTestResult {
  success: boolean;
  message: string;
  token_preview: string | null;
}

export interface CodefSyncResult {
  success: boolean;
  message: string;
  total_fetched: number;
  new_count: number;
  duplicate_count: number;
  journals_created: number;
  preview: {
    date: string;
    amount: number;
    description: string;
    balance: string;
    hash: string;
  }[];
  period: {
    start_date: string;
    end_date: string;
  };
}

/** CODEF 연결 테스트 */
export async function testCodefConnection(): Promise<CodefTestResult> {
  const res = await api.get(`${BASE}/test`);
  return res.data.data;
}

/** 은행 코드 목록 */
export async function getBankCodes(): Promise<BankCode[]> {
  const res = await api.get(`${BASE}/bank-codes`);
  return res.data.data;
}

/** Connected ID 생성 */
export async function createConnectedId(data: {
  bank_code: string;
  login_type: string;
  login_id: string;
  login_pw: string;
}): Promise<{ success: boolean; message: string; connected_id: string | null }> {
  const res = await api.post(`${BASE}/connected-id`, data);
  return res.data.data;
}

/** 계좌 목록 조회 */
export async function getAccountList(data: {
  connected_id: string;
  bank_code: string;
}): Promise<{ success: boolean; accounts: any[] }> {
  const res = await api.post(`${BASE}/accounts`, data);
  return res.data.data;
}

/** 거래내역 동기화 */
export async function syncTransactions(data: {
  connected_id: string;
  bank_code: string;
  account_no: string;
  start_date?: string;
  end_date?: string;
  company_account_id?: string;
}): Promise<CodefSyncResult> {
  const res = await api.post(`${BASE}/sync`, data);
  return res.data.data;
}
