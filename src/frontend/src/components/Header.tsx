/**
 * 상단 헤더 — 페이지 제목, 다크모드 토글, 알림 벨, 사용자 정보, 로그아웃
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { getUnreadCount } from '../api/notifications';

export default function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = async () => {
      try {
        const data = await getUnreadCount();
        setUnread(data?.unread_count || 0);
      } catch { /* 무시 */ }
    };
    fetchCount();
    /* 30초마다 갱신 */
    const timer = setInterval(fetchCount, 30000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  return (
    <header className="flex items-center justify-between h-12 px-6 bg-(--bg-card) border-b border-(--border-main)">
      {/* 좌측: 현재 위치 */}
      <div className="text-sm text-(--text-secondary) font-medium">
        PLS ERP
      </div>

      {/* 우측: 다크모드 + 알림 + 사용자 정보 + 로그아웃 */}
      <div className="flex items-center gap-4">
        {/* 다크모드 토글 */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
          title={isDark ? '라이트모드로 전환' : '다크모드로 전환'}
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        {/* 알림 벨 */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-1.5 text-slate-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
          title="알림센터"
        >
          <BellIcon className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {user && (
          <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
            <UserCircleIcon className="w-5 h-5" />
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-(--text-muted)">({user.role})</span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </header>
  );
}
