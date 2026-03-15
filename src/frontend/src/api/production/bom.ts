/**
 * M5 생산/SCM — BOM API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface BomLine {
  id?: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  quantity: number;
  unit?: string;
  scrap_rate?: number;
  sort_order?: number;
}

export interface Bom {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  version: number;
  is_active: boolean;
  line_count?: number;
  lines?: BomLine[];
  created_at?: string;
}

export interface BomFormData {
  product_id: string;
  version: number;
  lines: BomLine[];
}

export interface BomTreeNode {
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_type?: string;
  quantity: number;
  unit?: string;
  scrap_rate?: number;
  children: BomTreeNode[];
}

export interface MaterialRequirement {
  product_id: string;
  product_name?: string;
  product_code?: string;
  unit?: string;
  total_quantity: number;
}

/* ── API 호출 ── */

export async function listBoms(params?: {
  product_id?: string;
  search?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/production/bom', { params });
  return res.data.data;
}

export async function getBom(id: string) {
  const res = await api.get(`/production/bom/${id}`);
  return res.data.data;
}

export async function createBom(data: BomFormData) {
  const res = await api.post('/production/bom', data);
  return res.data;
}

export async function updateBom(id: string, data: Partial<BomFormData> & { is_active?: boolean }) {
  const res = await api.put(`/production/bom/${id}`, data);
  return res.data;
}

export async function deleteBom(id: string) {
  const res = await api.delete(`/production/bom/${id}`);
  return res.data;
}

export async function getBomTree(id: string) {
  const res = await api.get(`/production/bom/${id}/tree`);
  return res.data.data as BomTreeNode;
}

export async function getMaterialRequirements(id: string, quantity: number = 1) {
  const res = await api.get(`/production/bom/${id}/materials`, {
    params: { quantity },
  });
  return res.data.data;
}
