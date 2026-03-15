/**
 * M4 재무/회계 — 결산/재무제표 API 호출 함수
 */
import api from '../client';

// ── 타입 정의 ──

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export interface TrialBalanceResponse {
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  start_date: string | null;
  end_date: string | null;
}

export interface IncomeStatementRow {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
}

export interface IncomeStatementResponse {
  revenue_items: IncomeStatementRow[];
  expense_items: IncomeStatementRow[];
  total_revenue: number;
  total_expense: number;
  net_income: number;
  start_date: string | null;
  end_date: string | null;
}

export interface BalanceSheetRow {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
}

export interface BalanceSheetResponse {
  asset_items: BalanceSheetRow[];
  liability_items: BalanceSheetRow[];
  equity_items: BalanceSheetRow[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  net_income: number;
  as_of_date: string | null;
}

export interface ClosingParams {
  start_date?: string;
  end_date?: string;
  as_of_date?: string;
  fiscal_year_id?: string;
}

// ── API 함수 ──

export async function fetchTrialBalance(params: ClosingParams = {}) {
  const res = await api.get('/finance/closing/trial-balance', { params });
  return res.data.data as TrialBalanceResponse;
}

export async function fetchIncomeStatement(params: ClosingParams = {}) {
  const res = await api.get('/finance/closing/income-statement', { params });
  return res.data.data as IncomeStatementResponse;
}

export async function fetchBalanceSheet(params: ClosingParams = {}) {
  const res = await api.get('/finance/closing/balance-sheet', { params });
  return res.data.data as BalanceSheetResponse;
}

export async function closePeriod(fiscalYearId: string) {
  const res = await api.post('/finance/closing/close-period', {
    fiscal_year_id: fiscalYearId,
  });
  return res.data;
}

export async function reopenPeriod(fiscalYearId: string) {
  const res = await api.post('/finance/closing/reopen-period', {
    fiscal_year_id: fiscalYearId,
  });
  return res.data;
}
