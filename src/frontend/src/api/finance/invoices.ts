/**
 * M4 재무/회계 — 세금계산서(Tax Invoice) API 호출 함수
 */
import api from '../client';

// ── 타입 정의 ──

export interface Invoice {
  id: string;
  invoice_no: string;
  invoice_type: string;
  issue_date: string;
  customer_id: string;
  customer_name: string | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  journal_id: string | null;
  description: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface InvoiceListItem {
  id: string;
  invoice_no: string;
  invoice_type: string;
  issue_date: string;
  customer_name: string | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at: string | null;
  has_file?: boolean;
  file_original_name?: string | null;
}

export interface InvoiceFormData {
  invoice_type: string;
  issue_date: string;
  customer_id: string;
  supply_amount: number;
  tax_amount?: number;
  description?: string;
}

export interface InvoiceListParams {
  page?: number;
  size?: number;
  invoice_type?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  search?: string;
}

export interface InvoiceSummary {
  invoice_type: string;
  count: number;
  total_supply: number;
  total_tax: number;
  total_amount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

// ── API 함수 ──

export async function fetchInvoices(params: InvoiceListParams = {}) {
  const res = await api.get('/finance/invoices', { params });
  return res.data.data as PaginatedResult<InvoiceListItem>;
}

export async function fetchInvoice(id: string) {
  const res = await api.get(`/finance/invoices/${id}`);
  return res.data.data as Invoice;
}

export async function createInvoice(data: InvoiceFormData) {
  const res = await api.post('/finance/invoices', data);
  return res.data;
}

export async function updateInvoice(id: string, data: Partial<InvoiceFormData>) {
  const res = await api.put(`/finance/invoices/${id}`, data);
  return res.data;
}

export async function cancelInvoice(id: string) {
  const res = await api.delete(`/finance/invoices/${id}`);
  return res.data;
}

export async function confirmInvoice(id: string) {
  const res = await api.post(`/finance/invoices/${id}/confirm`);
  return res.data;
}

export async function fetchInvoiceSummary(params: { start_date?: string; end_date?: string } = {}) {
  const res = await api.get('/finance/invoices/summary', { params });
  return res.data.data as InvoiceSummary[];
}

export async function uploadInvoiceFile(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/finance/invoices/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadInvoiceFile(id: string) {
  const res = await api.get(`/finance/invoices/${id}/file`, {
    responseType: 'blob',
  });
  return res;
}

export async function deleteInvoiceFile(id: string) {
  const res = await api.delete(`/finance/invoices/${id}/file`);
  return res.data;
}
