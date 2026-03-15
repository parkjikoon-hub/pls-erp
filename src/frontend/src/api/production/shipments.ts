/**
 * M5 생산/SCM — 출하 관리 API 호출 함수
 */
import api from '../client';

export interface ShipmentLine {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  order_line_id?: string;
  quantity: number;
  unit_price: number;
  amount: number;
  warehouse_id?: string;
  warehouse_name?: string;
  line_no: number;
}

export interface Shipment {
  id: string;
  shipment_no: string;
  order_id?: string;
  order_no?: string;
  customer_id: string;
  customer_name?: string;
  shipment_date?: string;
  status: string;
  carrier_name?: string;
  tracking_no?: string;
  delivery_note_no?: string;
  shipping_address?: string;
  notes?: string;
  lines?: ShipmentLine[];
  line_count: number;
  total_amount: number;
  created_at?: string;
}

export interface ShipmentLineForm {
  product_id: string;
  order_line_id?: string;
  quantity: number;
  unit_price: number;
  warehouse_id?: string;
}

export interface ShipmentFormData {
  order_id?: string;
  customer_id: string;
  shipment_date?: string;
  carrier_name?: string;
  tracking_no?: string;
  shipping_address?: string;
  notes?: string;
  lines: ShipmentLineForm[];
}

export async function listShipments(params?: {
  status?: string;
  customer_id?: string;
  search?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/production/shipments', { params });
  return res.data.data;
}

export async function getShipment(id: string) {
  const res = await api.get(`/production/shipments/${id}`);
  return res.data.data;
}

export async function createShipment(data: ShipmentFormData) {
  const res = await api.post('/production/shipments', data);
  return res.data.data;
}

export async function createShipmentFromOrder(orderId: string) {
  const res = await api.post(`/production/shipments/from-order/${orderId}`);
  return res.data.data;
}

export async function updateShipment(id: string, data: {
  carrier_name?: string;
  tracking_no?: string;
  shipping_address?: string;
  notes?: string;
}) {
  const res = await api.put(`/production/shipments/${id}`, data);
  return res.data.data;
}

export async function updateShipmentStatus(id: string, newStatus: string) {
  const res = await api.patch(`/production/shipments/${id}/status`, null, {
    params: { new_status: newStatus },
  });
  return res.data.data;
}

export async function getDeliveryNote(id: string) {
  const res = await api.get(`/production/shipments/${id}/delivery-note`);
  return res.data.data;
}
