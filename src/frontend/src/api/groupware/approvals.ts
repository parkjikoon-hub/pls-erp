/**
 * M6 그룹웨어 — 결재/템플릿 API 호출 함수
 */
import api from '../client';

/* ── 타입 정의 ── */

export interface TemplateLine {
  id?: string;
  step_order: number;
  approver_id: string;
  approver_name?: string;
  role_label?: string;
  line_type: string; // approval / reference
}

export interface Template {
  id: string;
  name: string;
  document_type?: string;
  description?: string;
  is_active: boolean;
  lines: TemplateLine[];
  created_at?: string;
}

export interface ApprovalStep {
  id: string;
  step_type: string;
  step_order: number;
  approver_id: string;
  approver_name?: string;
  role_label?: string;
  status: string;
  comment?: string;
  acted_at?: string;
}

export interface ApprovalListItem {
  id: string;
  request_no: string;
  title: string;
  document_type: string;
  amount?: number;
  status: string;
  requester_id: string;
  requester_name?: string;
  reference_type?: string;
  reference_id?: string;
  current_step?: number;
  total_steps?: number;
  created_at?: string;
}

export interface ApprovalDetail extends ApprovalListItem {
  content?: Record<string, unknown>;
  steps: ApprovalStep[];
}

/* ── 결재선 템플릿 API ── */

export async function listTemplates() {
  const res = await api.get('/groupware/templates');
  return res.data?.data ?? res.data;
}

export async function createTemplate(data: {
  name: string;
  document_type?: string;
  description?: string;
  lines: Omit<TemplateLine, 'id' | 'approver_name'>[];
}) {
  const res = await api.post('/groupware/templates', data);
  return res.data?.data ?? res.data;
}

export async function deleteTemplate(id: string) {
  const res = await api.delete(`/groupware/templates/${id}`);
  return res.data?.data ?? res.data;
}

/* ── 결재 요청 API ── */

export async function listApprovals(params?: {
  status?: string;
  document_type?: string;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/groupware/approvals', { params });
  return res.data?.data ?? res.data;
}

export async function getApproval(id: string) {
  const res = await api.get(`/groupware/approvals/${id}`);
  return res.data?.data ?? res.data;
}

export async function createApproval(data: {
  title: string;
  document_type?: string;
  content?: Record<string, unknown>;
  amount?: number;
  reference_type?: string;
  reference_id?: string;
  steps: { step_type: string; step_order: number; approver_id: string; role_label?: string }[];
}) {
  const res = await api.post('/groupware/approvals', data);
  return res.data?.data ?? res.data;
}

export async function myRequests(params?: { page?: number; size?: number }) {
  const res = await api.get('/groupware/approvals/my-requests', { params });
  return res.data?.data ?? res.data;
}

export async function myApprovals(params?: { status?: string }) {
  const res = await api.get('/groupware/approvals/my-approvals', { params });
  return res.data?.data ?? res.data;
}

export async function myReferences() {
  const res = await api.get('/groupware/approvals/my-references');
  return res.data?.data ?? res.data;
}

export async function approveRequest(id: string, comment?: string) {
  const res = await api.patch(`/groupware/approvals/${id}/approve`, { comment });
  return res.data?.data ?? res.data;
}

export async function rejectRequest(id: string, comment?: string) {
  const res = await api.patch(`/groupware/approvals/${id}/reject`, { comment });
  return res.data?.data ?? res.data;
}
