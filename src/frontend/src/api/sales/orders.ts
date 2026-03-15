/**
 * M2 영업/수주 — 수주 API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface SalesOrderLine {
  id?: string;
  line_no?: number;
  product_id?: string;
  product_name: string;
  specification?: string;
  quantity: number;
  unit_price: number;
  amount?: number;
  tax_amount?: number;
  delivery_date?: string;
  produced_qty?: number;
  shipped_qty?: number;
  remark?: string;
}

export interface SalesOrder {
  id: string;
  order_no: string;
  order_date: string;
  delivery_date?: string;
  customer_id: string;
  customer_name?: string;
  quotation_id?: string;
  quotation_no?: string;
  sales_rep_id?: string;
  sales_rep_name?: string;
  total_amount: number;
  tax_amount: number;
  grand_total: number;
  status: string;
  progress_pct: number;
  notes?: string;
  lines: SalesOrderLine[];
  created_at?: string;
}

export interface SalesOrderFormData {
  order_date: string;
  delivery_date?: string;
  customer_id: string;
  quotation_id?: string;
  sales_rep_id?: string;
  notes?: string;
  lines: SalesOrderLine[];
}

export interface OrderListParams {
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

/** 수주 목록 조회 */
export async function listOrders(params: OrderListParams = {}) {
  const { data } = await api.get('/sales/orders', { params });
  return data.data as PaginatedResult<SalesOrder>;
}

/** 수주 상세 조회 */
export async function getOrder(id: string) {
  const { data } = await api.get(`/sales/orders/${id}`);
  return data.data as SalesOrder;
}

/** 수주 생성 */
export async function createOrder(formData: SalesOrderFormData) {
  const { data } = await api.post('/sales/orders', formData);
  return data;
}

/** 견적서 → 수주 전환 */
export async function createOrderFromQuotation(quotationId: string, orderDate: string) {
  const { data } = await api.post(`/sales/orders/from-quotation/${quotationId}`, null, {
    params: { order_date: orderDate },
  });
  return data;
}

/** 수주 수정 */
export async function updateOrder(id: string, formData: Partial<SalesOrderFormData>) {
  const { data } = await api.put(`/sales/orders/${id}`, formData);
  return data;
}

/** 수주 상태 변경 */
export async function updateOrderStatus(id: string, status: string, memo?: string) {
  const { data } = await api.patch(`/sales/orders/${id}/status`, { status, memo });
  return data;
}

/** 수주 삭제 */
export async function deleteOrder(id: string) {
  const { data } = await api.delete(`/sales/orders/${id}`);
  return data;
}
