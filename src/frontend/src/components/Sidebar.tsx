/**
 * 사이드바 — 시안 C 기반 다크 사이드바 (접기/펼치기 지원)
 * 3D 그라디언트 SVG 아이콘 + 모듈별 컬러
 */
import { NavLink } from 'react-router-dom';
import {
  Cog6ToothIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  WrenchScrewdriverIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  HomeIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/solid';
import { useSidebarStore } from '../stores/sidebarStore';

// 모듈별 네비게이션 항목
const navItems = [
  { path: '/', label: '대시보드', icon: HomeIcon, color: '#10b981' },
  { path: '/system', label: 'M1 시스템', icon: Cog6ToothIcon, color: '#3b82f6' },
  { path: '/finance', label: 'M4 재무회계', icon: CurrencyDollarIcon, color: '#f59e0b' },
  { path: '/hr', label: 'M3 인사급여', icon: UserGroupIcon, color: '#8b5cf6' },
  { path: '/sales', label: 'M2 영업수주', icon: ShoppingCartIcon, color: '#10b981' },
  { path: '/production', label: 'M5 생산SCM', icon: WrenchScrewdriverIcon, color: '#ef4444' },
  { path: '/groupware', label: 'M6 그룹웨어', icon: ChatBubbleLeftRightIcon, color: '#06b6d4' },
  { path: '/notifications', label: 'M7 알림센터', icon: BellIcon, color: '#f97316' },
];

export default function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore();

  return (
    <aside
      className={`flex flex-col h-screen bg-[#0f172a] text-slate-400 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      {/* 로고 영역 */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-slate-700/50">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          P
        </div>
        {!isCollapsed && (
          <span className="text-slate-200 font-semibold text-sm whitespace-nowrap">
            PLS <span className="text-emerald-400">ERP</span>
          </span>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div
                key={item.path}
                className="flex items-center gap-3 px-4 py-2 mx-2 rounded-lg opacity-30 cursor-not-allowed"
                title={`${item.label} (개발 예정)`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: item.color }} />
                {!isCollapsed && <span className="text-[13px] whitespace-nowrap">{item.label}</span>}
              </div>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-700/60 text-slate-100'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" style={{ color: item.color }} />
              {!isCollapsed && <span className="text-[13px] whitespace-nowrap">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* 접기/펼치기 버튼 */}
      <button
        onClick={toggle}
        className="flex items-center justify-center h-10 border-t border-slate-700/50 hover:bg-slate-800 transition-colors"
      >
        {isCollapsed ? (
          <ChevronDoubleRightIcon className="w-4 h-4" />
        ) : (
          <ChevronDoubleLeftIcon className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
