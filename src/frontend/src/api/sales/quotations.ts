/**
 * M2 영업/수주 — 견적서 API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface QuotationLine {
  id?: string;
  line_no?: number;
  product_id?: string;
  product_name: string;
  specification?: string;
  quantity: number;
  unit_price: number;
  discount_rate?: number;
  amount?: number;
  tax_amount?: number;
  delivery_date?: string;
  remark?: string;
}

export interface Quotation {
  id: string;
  quote_no: string;
  quote_date: string;
  valid_until?: string;
  customer_id: string;
  customer_name?: string;
  sales_rep_id?: string;
  sales_rep_name?: string;
  total_amount: number;
  tax_amount: number;
  grand_total: number;
  status: string;
  notes?: string;
  lines: QuotationLine[];
  created_at?: string;
}

export interface QuotationFormData {
  quote_date: string;
  valid_until?: string;
  customer_id: string;
  sales_rep_id?: string;
  notes?: string;
  lines: QuotationLine[];
}

export interface QuotationListParams {
  customer_id?: string;
  status?: string;
  search?: string;
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

/* ── API 함수 ── */

/** 견적서 목록 조회 */
export async function listQuotations(params: QuotationListParams = {}) {
  const { data } = await api.get('/sales/quotations', { params });
  return data.data as PaginatedResult<Quotation>;
}

/** 견적서 상세 조회 */
export async function getQuotation(id: string) {
  const { data } = await api.get(`/sales/quotations/${id}`);
  return data.data as Quotation;
}

/** 견적서 생성 */
export async function createQuotation(formData: QuotationFormData) {
  const { data } = await api.post('/sales/quotations', formData);
  return data;
}

/** 견적서 수정 */
export async function updateQuotation(id: string, formData: Partial<QuotationFormData>) {
  const { data } = await api.put(`/sales/quotations/${id}`, formData);
  return data;
}

/** 견적서 삭제 */
export async function deleteQuotation(id: string) {
  const { data } = await api.delete(`/sales/quotations/${id}`);
  return data;
}

/** 견적서 상태 변경 */
export async function updateQuotationStatus(id: string, newStatus: string) {
  const { data } = await api.patch(`/sales/quotations/${id}/status`, null, {
    params: { new_status: newStatus },
  });
  return data;
}
