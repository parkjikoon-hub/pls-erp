/**
 * M6 그룹웨어 — 공지사항 API 호출 함수
 */
import api from '../client';

export interface NoticeListItem {
  id: string;
  title: string;
  is_pinned: boolean;
  is_important: boolean;
  view_count: number;
  author_id: string;
  author_name?: string;
  created_at?: string;
}

export interface NoticeDetail extends NoticeListItem {
  content: string;
  updated_at?: string;
}

export async function listNotices(params?: { page?: number; size?: number }) {
  const res = await api.get('/groupware/notices', { params });
  return res.data?.data ?? res.data;
}

export async function getNotice(id: string) {
  const res = await api.get(`/groupware/notices/${id}`);
  return res.data?.data ?? res.data;
}

export async function createNotice(data: {
  title: string;
  content: string;
  is_pinned?: boolean;
  is_important?: boolean;
}) {
  const res = await api.post('/groupware/notices', data);
  return res.data?.data ?? res.data;
}

export async function updateNotice(id: string, data: {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  is_important?: boolean;
}) {
  const res = await api.put(`/groupware/notices/${id}`, data);
  return res.data?.data ?? res.data;
}

export async function deleteNotice(id: string) {
  const res = await api.delete(`/groupware/notices/${id}`);
  return res.data?.data ?? res.data;
}
