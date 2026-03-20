/**
 * M4 재무/회계 — 거래처별 수주/세금계산서/입금 분석 API
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  business_no: string;
  customer_type: string;
}

export interface CustomerAnalysisSummary {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  customer_type: string;
  business_no: string;
  total_orders: number;
  total_order_amount: number;
  total_invoices: number;
  total_invoice_amount: number;
  total_payments: number;
  total_payment_amount: number;
  outstanding_amount: number;
  avg_payment_days: number | null;
  payment_grade: string;
}

export interface OrderItem {
  id: string;
  order_no: string;
  order_date: string;
  delivery_date: string | null;
  total_amount: number;
  tax_amount: number;
  grand_total: number;
  status: string;
  progress_pct: number;
  items_summary: string;
}

export interface InvoiceItem {
  id: string;
  invoice_no: string;
  invoice_type: string;
  issue_date: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  days_to_payment: number | null;
}

export interface PaymentItem {
  id: string;
  entry_no: string;
  entry_date: string;
  amount: number;
  description: string;
  source: string;
}

export interface PaymentTrendItem {
  month: string;
  invoice_amount: number;
  payment_amount: number;
  avg_days: number | null;
}

export interface PaymentTrendAnalysis {
  avg_days: number | null;
  median_days: number | null;
  min_days: number | null;
  max_days: number | null;
  grade: string;
  grade_description: string;
  unpaid_invoices: number;
  unpaid_amount: number;
  monthly_trend: PaymentTrendItem[];
}

export interface CustomerAnalysisResponse {
  summary: CustomerAnalysisSummary;
  orders: OrderItem[];
  invoices: InvoiceItem[];
  payments: PaymentItem[];
  trend: PaymentTrendAnalysis;
}

export interface CustomerRanking {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  total_order_amount: number;
  total_invoice_amount: number;
  total_payment_amount: number;
  outstanding_amount: number;
  avg_payment_days: number | null;
  payment_grade: string;
}

/* ── API 호출 함수 ── */

const BASE = '/finance/customer-analysis';

/** 거래처 선택 드롭다운용 목록 */
export async function fetchCustomerOptions(): Promise<CustomerOption[]> {
  const res = await api.get(`${BASE}/customers`);
  return res.data.data;
}

/** 거래처별 상세 분석 */
export async function fetchCustomerAnalysis(
  customerId: string,
  startDate?: string,
  endDate?: string,
): Promise<CustomerAnalysisResponse> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await api.get(`${BASE}/detail/${customerId}`, { params });
  return res.data.data;
}

/** 거래처별 랭킹 */
export async function fetchCustomerRankings(
  startDate?: string,
  endDate?: string,
  limit = 20,
): Promise<CustomerRanking[]> {
  const params: Record<string, string | number> = { limit };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const res = await api.get(`${BASE}/rankings`, { params });
  return res.data.data;
}
