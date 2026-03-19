/**
 * M5 생산/SCM — 재고 관리 API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  zone_type: string;
  description?: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  warehouse_id: string;
  warehouse_name?: string;
  zone_type?: string;
  quantity: number;
  unit_cost: number;
  status: string;
  safety_stock: number;
}

export interface ShortageItem {
  product_id: string;
  product_name?: string;
  product_code?: string;
  current_qty: number;
  safety_stock: number;
  shortage_qty: number;
}

export interface OrderMaterialCheck {
  order_id: string;
  order_no: string;
  has_shortage: boolean;
  materials: {
    product_id: string;
    product_name: string;
    product_code: string;
    required_qty: number;
    current_qty: number;
    safety_stock: number;
    shortage_qty: number;
    is_shortage: boolean;
  }[];
}

/* ── API 호출 ── */

export async function listWarehouses() {
  const res = await api.get('/production/warehouses');
  return res.data.data as Warehouse[];
}

export async function listInventory(params?: {
  warehouse_id?: string;
  zone_type?: string;
  search?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/production/inventory', { params });
  return res.data.data;
}

export async function receiveInventory(data: {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  unit_cost?: number;
  notes?: string;
}) {
  const res = await api.post('/production/inventory/receive', data);
  return res.data;
}

export async function issueInventory(data: {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  notes?: string;
}) {
  const res = await api.post('/production/inventory/issue', data);
  return res.data;
}

export async function transferInventory(data: {
  product_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: number;
  notes?: string;
}) {
  const res = await api.post('/production/inventory/transfer', data);
  return res.data;
}

export async function adjustInventory(data: {
  product_id: string;
  warehouse_id: string;
  new_quantity: number;
  notes: string;
}) {
  const res = await api.post('/production/inventory/adjust', data);
  return res.data;
}

export async function listTransactions(params?: {
  product_id?: string;
  warehouse_id?: string;
  tx_type?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/production/inventory/transactions', { params });
  return res.data.data;
}

export async function getShortageList() {
  const res = await api.get('/production/inventory/shortage');
  return res.data.data as ShortageItem[];
}

export async function checkOrderMaterials(orderId: string) {
  const res = await api.post(`/production/inventory/check-order/${orderId}`);
  return res.data.data as OrderMaterialCheck;
}

/* ── 견적서 단계 재고/원자재 사전 체크 ── */

export interface QuotationMaterialItem {
  material_id: string;
  material_name: string;
  material_code: string;
  required_qty: number;
  current_stock: number;
  shortage_qty: number;
  is_shortage: boolean;
}

export interface QuotationCheckItem {
  product_id: string;
  product_name: string;
  product_code: string;
  requested_qty: number;
  finished_stock: number;
  finished_shortage: number;
  need_production: boolean;
  materials: QuotationMaterialItem[];
}

export interface QuotationCheckResult {
  items: QuotationCheckItem[];
  summary: {
    ready_to_ship: boolean;
    can_produce: boolean;
    need_purchase: boolean;
    shortage_materials: string[];
  };
}

export async function checkQuotationMaterials(
  lines: { product_id: string; quantity: number }[],
) {
  const res = await api.post('/production/inventory/quotation-check', { lines });
  return res.data.data as QuotationCheckResult;
}
