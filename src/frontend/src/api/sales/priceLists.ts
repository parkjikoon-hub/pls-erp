/**
 * M2 영업 — 판매가 관리 API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface PriceListItem {
  id: string;
  customer_id: string;
  customer_name?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  unit_price: number;
  standard_price?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface PriceListResponse {
  items: PriceListItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface CustomerPrice {
  product_id: string;
  product_name: string;
  product_code: string;
  unit: string;
  unit_price: number;
  standard_price: number;
  source: 'customer_special' | 'standard' | 'none';
}

export interface PriceLookup {
  unit_price: number;
  source: 'customer_special' | 'standard' | 'none';
}

/* ── API 함수 ── */

/** 판매가 목록 조회 */
export const fetchPriceLists = (params?: {
  customer_id?: string;
  product_id?: string;
  search?: string;
  page?: number;
  size?: number;
}) => api.get<PriceListResponse>('/sales/price-lists', { params }).then((r) => r.data);

/** 판매가 단건 등록 */
export const createPriceList = (data: {
  customer_id: string;
  product_id: string;
  unit_price: number;
  valid_from?: string;
  valid_until?: string;
  notes?: string;
}) => api.post('/sales/price-lists', data).then((r) => r.data);

/** 판매가 수정 */
export const updatePriceList = (id: string, data: {
  unit_price?: number;
  valid_from?: string;
  valid_until?: string;
  notes?: string;
}) => api.put(`/sales/price-lists/${id}`, data).then((r) => r.data);

/** 판매가 삭제 */
export const deletePriceList = (id: string) =>
  api.delete(`/sales/price-lists/${id}`).then((r) => r.data);

/** 품목 가격 조회 (견적서 작성 시 사용) */
export const lookupPrice = (customerId: string, productId: string) =>
  api.get<PriceLookup>('/sales/price-lists/lookup', {
    params: { customer_id: customerId, product_id: productId },
  }).then((r) => r.data);

/** 거래처 기준 전체 품목 가격 목록 */
export const fetchCustomerPrices = (customerId: string) =>
  api.get<CustomerPrice[]>(`/sales/price-lists/customer/${customerId}`).then((r) => r.data);

/** 기본 판매가 엑셀 업로드 */
export const uploadStandardPrices = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/sales/price-lists/upload-standard', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

/** 거래처별 판매가 엑셀 업로드 */
export const uploadCustomerPrices = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/sales/price-lists/upload-customer', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

/** 엑셀 템플릿 다운로드 */
export const downloadTemplate = (includeData = false) =>
  api.get('/sales/price-lists/download-template', {
    params: { include_data: includeData },
    responseType: 'blob',
  }).then((r) => {
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = includeData ? '판매가_현재데이터.xlsx' : '판매가_템플릿.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
