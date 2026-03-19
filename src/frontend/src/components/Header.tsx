/**
 * 상단 헤더 — 56px 높이
 * 좌측: 모듈 색상 점 + 모듈명
 * 우측: 다크모드 토글(슬라이드) + 알림벨 + 아바타 + 관리자명 + 로그아웃 버튼
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { getUnreadCount } from '../api/notifications';
import { getActiveModule } from '../config/moduleConfig';

export default function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  const activeModule = getActiveModule(location.pathname);
  const moduleName = activeModule?.name || '대시보드';
  const moduleColor = activeModule?.color || '#10b981';

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = async () => {
      try {
        const data = await getUnreadCount();
        setUnread(data?.unread_count || 0);
      } catch { /* 무시 */ }
    };
    fetchCount();
    const timer = setInterval(fetchCount, 30000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  /* 사용자 이니셜 */
  const initial = user?.name ? user.name.charAt(0) : 'A';

  return (
    <header
      style={{
        height: 56,
        minHeight: 56,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
      }}
    >
      {/* 좌측: 모듈 색상 점 + 모듈명 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: moduleColor,
          flexShrink: 0,
          transition: 'background 0.3s',
        }} />
        <span style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          {moduleName}
        </span>
      </div>

      {/* 우측: 다크모드 + 알림 + 사용자 + 로그아웃 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* 다크모드 토글 스위치 */}
        <div
          onClick={toggleTheme}
          style={{
            width: 52,
            height: 28,
            borderRadius: 14,
            background: isDark ? '#4f6385' : 'var(--input-border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.25s',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: 3,
              left: 3,
              transition: 'transform 0.25s',
              transform: isDark ? 'translateX(24px)' : 'translateX(0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </div>
        </div>

        {/* 알림 벨 아이콘 */}
        <div
          onClick={() => navigate('/notifications')}
          style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread > 0 && (
            <span style={{
              position: 'absolute',
              top: -5,
              right: -7,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ef4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-card)',
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>

        {/* 아바타 + 이름 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {initial}
          </div>
          <span style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}>
            {user?.name || '관리자'} ({user?.role || 'admin'})
          </span>
        </div>

        {/* 로그아웃 버튼 */}
        <button
          onClick={logout}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '7px 16px',
            fontSize: 14,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-base)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
