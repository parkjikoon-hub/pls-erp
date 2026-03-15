/**
 * M5 생산/SCM — 작업지시서 API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface WorkOrder {
  id: string;
  wo_no: string;
  order_type: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  bom_id?: string;
  planned_qty: number;
  produced_qty: number;
  progress_pct: number;
  status: string;
  start_date?: string;
  due_date: string;
  assigned_to?: string;
  assigned_to_name?: string;
  order_id?: string;
  order_no?: string;
  notes?: string;
  created_at?: string;
}

export interface WorkOrderFormData {
  order_type?: string;
  product_id: string;
  bom_id?: string;
  planned_qty: number;
  start_date?: string;
  due_date: string;
  assigned_to?: string;
  notes?: string;
}

export interface FromOrderResult {
  order_no: string;
  work_orders: { wo_no: string; product_name: string; qty: number }[];
  material_shortage: {
    product_id: string;
    product_name: string;
    product_code: string;
    required_qty: number;
    current_qty: number;
    shortage_qty: number;
  }[];
  has_shortage: boolean;
}

/* ── API 호출 ── */

export async function listWorkOrders(params?: {
  status?: string;
  order_type?: string;
  search?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/production/work-orders', { params });
  return res.data.data;
}

export async function getWorkOrder(id: string) {
  const res = await api.get(`/production/work-orders/${id}`);
  return res.data.data;
}

export async function createWorkOrder(data: WorkOrderFormData) {
  const res = await api.post('/production/work-orders', data);
  return res.data;
}

export async function updateWorkOrder(id: string, data: Partial<WorkOrderFormData>) {
  const res = await api.put(`/production/work-orders/${id}`, data);
  return res.data;
}

export async function createFromOrder(orderId: string) {
  const res = await api.post(`/production/work-orders/from-order/${orderId}`);
  return res.data.data as FromOrderResult;
}

export async function updateWorkOrderStatus(id: string, newStatus: string) {
  const res = await api.patch(`/production/work-orders/${id}/status`, null, {
    params: { new_status: newStatus },
  });
  return res.data;
}

export async function updateWorkOrderProgress(id: string, producedQty: number) {
  const res = await api.patch(`/production/work-orders/${id}/progress`, {
    produced_qty: producedQty,
  });
  return res.data;
}
