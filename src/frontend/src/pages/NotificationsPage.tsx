/**
 * M7 알림센터 — 메인 페이지 (알림 목록 + 설정)
 */
import { useState, useEffect } from 'react';
import {
  listNotifications, markRead, markAllRead,
  getNotificationSettings, updateNotificationSetting,
  type NotificationItem, type NotificationSetting,
} from '../api/notifications';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  approval:   { label: '결재', cls: 'bg-cyan-100 text-cyan-700' },
  sales:      { label: '영업', cls: 'bg-emerald-100 text-emerald-700' },
  production: { label: '생산', cls: 'bg-red-100 text-red-700' },
  finance:    { label: '재무', cls: 'bg-amber-100 text-amber-700' },
  hr:         { label: '인사', cls: 'bg-purple-100 text-purple-700' },
  system:     { label: '시스템', cls: 'bg-slate-200 text-slate-600' },
};

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '읽지 않음' },
  { key: 'settings', label: '알림 설정' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params: any = { page, size: 30 };
      if (tab === 'unread') params.is_read = false;
      if (typeFilter) params.notification_type = typeFilter;
      const data = await listNotifications(params);
      setItems(data?.items || []);
      setTotal(data?.total || 0);
    } catch { /* 무시 */ }
    setLoading(false);
  };

  const loadSettings = async () => {
    try {
      const data = await getNotificationSettings();
      setSettings(Array.isArray(data) ? data : []);
    } catch { /* 무시 */ }
  };

  useEffect(() => {
    if (tab === 'settings') loadSettings();
    else loadNotifications();
  }, [tab, page, typeFilter]);

  const handleMarkRead = async (id: string) => {
    await markRead(id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleToggleSetting = async (ntype: string, field: 'in_app_enabled' | 'email_enabled', value: boolean) => {
    await updateNotificationSetting({ notification_type: ntype, [field]: value });
    setSettings(prev => prev.map(s =>
      s.notification_type === ntype ? { ...s, [field]: value } : s
    ));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">알림센터</h1>
        {tab !== 'settings' && (
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-[#c8ced8] rounded-lg hover:bg-slate-50 transition"
          >
            전체 읽음
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'settings' && (
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="border border-[#c8ced8] rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">전체 유형</option>
            {Object.entries(TYPE_BADGE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* 알림 목록 */}
      {tab !== 'settings' && (
        <div className="bg-white rounded-xl border border-[#c8ced8] divide-y divide-[#c8ced8]">
          {loading ? (
            <div className="text-center py-12 text-slate-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {tab === 'unread' ? '읽지 않은 알림이 없습니다' : '알림이 없습니다'}
            </div>
          ) : (
            items.map(n => {
              const badge = TYPE_BADGE[n.notification_type] || TYPE_BADGE.system;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`flex items-start gap-3 px-5 py-4 transition cursor-pointer ${
                    n.is_read ? 'bg-white' : 'bg-orange-50/50 hover:bg-orange-50'
                  }`}
                >
                  {/* 읽지 않음 표시 */}
                  <div className="pt-1.5">
                    <div className={`w-2 h-2 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-orange-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="font-medium text-sm text-slate-800 truncate">{n.title}</span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-slate-500 truncate">{n.message}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                    {n.created_at ? timeAgo(n.created_at) : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 페이지네이션 */}
      {tab !== 'settings' && total > 30 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 border border-[#c8ced8] rounded text-sm disabled:opacity-30">이전</button>
          <span className="text-sm text-slate-500 py-1">{page} / {Math.ceil(total / 30)}</span>
          <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 border border-[#c8ced8] rounded text-sm disabled:opacity-30">다음</button>
        </div>
      )}

      {/* 알림 설정 */}
      {tab === 'settings' && (
        <div className="bg-white rounded-xl border border-[#c8ced8] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#e8ecf2] text-slate-600 text-xs uppercase">
                <th className="text-left py-3 px-5 font-semibold">알림 유형</th>
                <th className="text-center py-3 px-5 font-semibold">인앱 알림</th>
                <th className="text-center py-3 px-5 font-semibold">이메일 알림</th>
              </tr>
            </thead>
            <tbody>
              {settings.map(s => (
                <tr key={s.notification_type} className="border-t border-[#c8ced8]">
                  <td className="py-3 px-5 font-medium text-slate-700">{s.label}</td>
                  <td className="py-3 px-5 text-center">
                    <button
                      onClick={() => handleToggleSetting(s.notification_type, 'in_app_enabled', !s.in_app_enabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        s.in_app_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        s.in_app_enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="py-3 px-5 text-center">
                    <button
                      onClick={() => handleToggleSetting(s.notification_type, 'email_enabled', !s.email_enabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        s.email_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        s.email_enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
