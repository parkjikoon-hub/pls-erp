/**
 * 상단 탭 바 — 모듈별 세부항목을 테두리 박스형 탭으로 표시
 * 현재 URL에서 활성 모듈을 자동 감지하고, 해당 모듈의 탭을 렌더링합니다.
 * 탭이 없는 모듈(대시보드, 알림센터)에서는 렌더링하지 않습니다.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { getActiveModule, getActiveTabIndex } from '../config/moduleConfig';

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeModule = getActiveModule(location.pathname);

  /* 탭이 없으면 렌더링하지 않음 */
  if (!activeModule || activeModule.tabs.length === 0) return null;

  const activeTabIdx = getActiveTabIndex(activeModule, location.pathname);
  const moduleColor = activeModule.color;

  return (
    <div
      style={{
        height: 50,
        minHeight: 50,
        background: 'var(--bg-card-alt)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 10,
        overflowX: 'auto',
      }}
      className="tabbar-scrollbar"
    >
      {activeModule.tabs.map((tab, idx) => {
        const isActive = idx === activeTabIdx;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              border: `1.5px solid ${isActive ? moduleColor : 'var(--tab-inactive-border)'}`,
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? moduleColor : 'var(--tab-inactive-text)',
              background: isActive ? `${moduleColor}0F` : 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              flexShrink: 0,
              fontFamily: 'inherit',
              userSelect: 'none',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'var(--tab-hover-border)';
                e.currentTarget.style.background = 'var(--tab-hover-bg)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'var(--tab-inactive-border)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}

      <style>{`
        .tabbar-scrollbar::-webkit-scrollbar { height: 0; }
      `}</style>
    </div>
  );
}
