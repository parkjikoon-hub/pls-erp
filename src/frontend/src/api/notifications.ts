/**
 * M7 알림센터 — API 호출 함수
 */
import api from './client';

export interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message?: string;
  reference_type?: string;
  reference_id?: string;
  link?: string;
  is_read: boolean;
  created_at?: string;
}

export interface NotificationSetting {
  notification_type: string;
  label: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export async function listNotifications(params?: {
  notification_type?: string;
  is_read?: boolean;
  page?: number;
  size?: number;
}) {
  const res = await api.get('/notifications', { params });
  return res.data?.data ?? res.data;
}

export async function getUnreadCount() {
  const res = await api.get('/notifications/unread-count');
  return res.data?.data ?? res.data;
}

export async function markRead(id: string) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data?.data ?? res.data;
}

export async function markAllRead() {
  const res = await api.patch('/notifications/read-all');
  return res.data?.data ?? res.data;
}

export async function getNotificationSettings() {
  const res = await api.get('/notifications/settings');
  return res.data?.data ?? res.data;
}

export async function updateNotificationSetting(data: {
  notification_type: string;
  in_app_enabled?: boolean;
  email_enabled?: boolean;
}) {
  const res = await api.put('/notifications/settings', data);
  return res.data?.data ?? res.data;
}
