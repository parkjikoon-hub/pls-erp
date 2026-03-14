/**
 * 거래처 API — 백엔드 /api/v1/system/customers 와 통신하는 함수들
 */
import api from './client';

/** 거래처 데이터 타입 */
export interface Customer {
  id: string;
  code: string;
  name: string;
  business_no: string | null;
  ceo_name: string | null;
  business_type: string | null;
  business_item: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  fax: string | null;
  contact_person: string | null;
  customer_type: 'customer' | 'supplier' | 'both';
  credit_limit: number;
  payment_terms: number;
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
  is_active: boolean;
  mdm_status: string;
  created_at: string;
  updated_at: string;
}

/** 거래처 생성/수정 요청 타입 */
export interface CustomerFormData {
  code: string;
  name: string;
  business_no?: string;
  ceo_name?: string;
  business_type?: string;
  business_item?: string;
  address?: string;
  phone?: string;
  email?: string;
  fax?: string;
  contact_person?: string;
  customer_type: string;
  credit_limit: number;
  payment_terms: number;
  bank_name?: string;
  bank_account?: string;
  bank_account_name?: string;
}

/** 목록 조회 파라미터 */
export interface CustomerListParams {
  page?: number;
  size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  customer_type?: string;
  is_active?: boolean;
}

/** 페이지네이션 응답 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

/** 거래처 목록 조회 */
export async function fetchCustomers(params: CustomerListParams = {}) {
  const res = await api.get('/system/customers', { params });
  return res.data.data as PaginatedResult<Customer>;
}

/** 거래처 상세 조회 */
export async function fetchCustomer(id: string) {
  const res = await api.get(`/system/customers/${id}`);
  return res.data.data as Customer;
}

/** 거래처 생성 */
export async function createCustomer(data: CustomerFormData) {
  const res = await api.post('/system/customers', data);
  return res.data;
}

/** 거래처 수정 */
export async function updateCustomer(id: string, data: Partial<CustomerFormData>) {
  const res = await api.put(`/system/customers/${id}`, data);
  return res.data;
}

/** 거래처 삭제 (비활성화) */
export async function deleteCustomer(id: string) {
  const res = await api.delete(`/system/customers/${id}`);
  return res.data;
}
