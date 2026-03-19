/**
 * 사이드바 — 138px 고정 너비, 아이콘(56px 원형) + 라벨(13px) 세로 배치
 * 목업 redesign-A2-v2 기준으로 구현
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { MODULES, getActiveModule } from '../config/moduleConfig';

/** 모듈별 SVG 아이콘 — 목업과 동일한 stroke 기반 아이콘 */
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  factory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3a2 2 0 0 1 2 2v14"/>
      <path d="M8 16h.01"/><path d="M12 16h.01"/><path d="M16 16h.01"/>
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
};

/** 색상을 밝게 만드는 헬퍼 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasModuleAccess } = useAuthStore();
  const activeModule = getActiveModule(location.pathname);

  /* 접근 가능한 모듈만 필터링 (대시보드는 항상 표시) */
  const visibleModules = MODULES.filter(
    (m) => m.moduleKey === null || hasModuleAccess(m.moduleKey)
  );

  const handleClick = (mod: typeof MODULES[0]) => {
    if (mod.id === 'dashboard') {
      navigate('/');
    } else if (mod.tabs.length > 0) {
      /* 탭이 있는 모듈: 첫 번째 세부 페이지로 이동 */
      navigate(mod.tabs[0].path);
    } else {
      /* 탭이 없는 모듈 (알림센터 등): 모듈 경로로 이동 */
      navigate('/' + mod.id);
    }
  };

  return (
    <aside
      style={{
        width: 138,
        minWidth: 138,
        background: `linear-gradient(180deg, var(--sidebar-bg-start), var(--sidebar-bg-end))`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0 14px',
        gap: 2,
        zIndex: 100,
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '100vh',
      }}
      className="sidebar-scrollbar"
    >
      {/* 로고 */}
      <div style={{ fontSize: 26, fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px', marginBottom: 6 }}>
        PLS-ERP
      </div>
      {/* 로고 아래 구분선 */}
      <div style={{
        width: 48,
        height: 2,
        borderRadius: 1,
        background: activeModule?.color || '#10b981',
        marginBottom: 20,
        transition: 'background 0.3s',
      }} />

      {/* 네비게이션 항목 */}
      {visibleModules.map((mod) => {
        const isActive = activeModule?.id === mod.id;
        const icon = ICONS[mod.iconName];

        return (
          <div
            key={mod.id}
            onClick={() => handleClick(mod)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '10px 0',
              width: 118,
              cursor: 'pointer',
              borderRadius: 14,
              transition: 'all 0.2s',
              position: 'relative',
            }}
            className={`sidebar-item-hover ${isActive ? 'sidebar-item-active' : ''}`}
          >
            {/* 아이콘 원형 배경 */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                background: isActive
                  ? `linear-gradient(135deg, ${mod.color}, ${lightenColor(mod.color, 30)})`
                  : 'rgba(255,255,255,0.12)',
                boxShadow: isActive ? `0 4px 12px ${mod.color}44` : 'none',
              }}
            >
              <div style={{
                width: 30,
                height: 30,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {icon}
              </div>
            </div>

            {/* 라벨 */}
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? '#ffffff' : 'var(--sidebar-text)',
              textAlign: 'center',
              transition: 'color 0.2s',
              lineHeight: 1.3,
            }}>
              {mod.name}
            </span>

            {/* 활성 표시 점 */}
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: mod.color,
              }} />
            )}
          </div>
        );
      })}

      {/* 사이드바 호버 및 스크롤바 숨김 CSS */}
      <style>{`
        .sidebar-scrollbar::-webkit-scrollbar { width: 0; }
        .sidebar-item-hover:hover { background: rgba(255,255,255,0.06); }
        .sidebar-item-hover:hover span { color: var(--sidebar-text-hover) !important; }
      `}</style>
    </aside>
  );
}
