/**
 * 품목 API — 백엔드 /api/v1/system/products 와 통신하는 함수들
 */
import api from './client';
import type { PaginatedResult } from './customers';

/** 품목 카테고리 데이터 타입 */
export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

/** 품목 데이터 타입 */
export interface Product {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  product_type: 'product' | 'material' | 'semi';
  unit: string;
  standard_price: number;
  cost_price: number;
  safety_stock: number;
  inventory_method: string;
  tax_rate: number;
  is_active: boolean;
  mdm_status: string;
  created_at: string;
  updated_at: string;
}

/** 품목 생성/수정 요청 타입 */
export interface ProductFormData {
  code: string;
  name: string;
  category_id?: string | null;
  product_type: string;
  unit: string;
  standard_price: number;
  cost_price: number;
  safety_stock: number;
  inventory_method: string;
  tax_rate: number;
}

/** 목록 조회 파라미터 */
export interface ProductListParams {
  page?: number;
  size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  product_type?: string;
  category_id?: string;
  is_active?: boolean;
}

/** 품목 카테고리 생성 요청 타입 */
export interface CategoryFormData {
  code: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number;
}

// ── 카테고리 API ──

/** 카테고리 목록 조회 */
export async function fetchCategories() {
  const res = await api.get('/system/product-categories');
  return res.data.data as ProductCategory[];
}

/** 카테고리 생성 */
export async function createCategory(data: CategoryFormData) {
  const res = await api.post('/system/product-categories', data);
  return res.data;
}

// ── 품목 API ──

/** 품목 목록 조회 */
export async function fetchProducts(params: ProductListParams = {}) {
  const res = await api.get('/system/products', { params });
  return res.data.data as PaginatedResult<Product>;
}

/** 품목 상세 조회 */
export async function fetchProduct(id: string) {
  const res = await api.get(`/system/products/${id}`);
  return res.data.data as Product;
}

/** 품목 생성 */
export async function createProduct(data: ProductFormData) {
  const res = await api.post('/system/products', data);
  return res.data;
}

/** 품목 수정 */
export async function updateProduct(id: string, data: Partial<ProductFormData>) {
  const res = await api.put(`/system/products/${id}`, data);
  return res.data;
}

/** 품목 삭제 (비활성화) */
export async function deleteProduct(id: string) {
  const res = await api.delete(`/system/products/${id}`);
  return res.data;
}
