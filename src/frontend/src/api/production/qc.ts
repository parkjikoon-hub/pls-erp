/**
 * M5 생산/SCM — QC 검사 API 호출 함수
 */
import api from '../client';

export interface QcInspection {
  id: string;
  work_order_id: string;
  wo_no?: string;
  product_name?: string;
  inspected_qty: number;
  passed_qty: number;
  failed_qty: number;
  result: string;
  defect_types?: Record<string, any>;
  notes?: string;
  inspector_name?: string;
  inspected_at?: string;
}

export interface QcFormData {
  work_order_id: string;
  inspected_qty: number;
  passed_qty: number;
  failed_qty: number;
  result: string;
  defect_types?: Record<string, any>;
  notes?: string;
}

export async function createInspection(data: QcFormData) {
  const res = await api.post('/production/qc', data);
  return res.data;
}

export async function listInspections(params?: {
  work_order_id?: string;
  result?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/production/qc', { params });
  return res.data.data;
}
