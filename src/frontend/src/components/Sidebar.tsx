/**
 * 사이드바 — 아이콘 박스 + 텍스트 박스 분리 디자인
 * 각 모듈별 컬러 아이콘이 독립된 사각 박스 안에 표시됩니다.
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

/* 모듈별 네비게이션 항목 — 컬러와 아이콘 */
const navItems = [
  { path: '/', label: '대시보드', icon: HomeIcon, bg: 'from-emerald-400 to-emerald-600', color: '#10b981' },
  { path: '/system', label: 'M1 시스템', icon: Cog6ToothIcon, bg: 'from-blue-400 to-blue-600', color: '#3b82f6' },
  { path: '/finance', label: 'M4 재무회계', icon: CurrencyDollarIcon, bg: 'from-amber-400 to-amber-600', color: '#f59e0b' },
  { path: '/hr', label: 'M3 인사급여', icon: UserGroupIcon, bg: 'from-purple-400 to-purple-600', color: '#8b5cf6' },
  { path: '/sales', label: 'M2 영업수주', icon: ShoppingCartIcon, bg: 'from-emerald-400 to-emerald-600', color: '#10b981' },
  { path: '/production', label: 'M5 생산SCM', icon: WrenchScrewdriverIcon, bg: 'from-red-400 to-red-600', color: '#ef4444' },
  { path: '/groupware', label: 'M6 그룹웨어', icon: ChatBubbleLeftRightIcon, bg: 'from-cyan-400 to-cyan-600', color: '#06b6d4' },
  { path: '/notifications', label: 'M7 알림센터', icon: BellIcon, bg: 'from-orange-400 to-orange-600', color: '#f97316' },
];

export default function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore();

  return (
    <aside
      className={`flex flex-col h-screen bg-[#0f172a] text-slate-400 transition-all duration-300 ${
        isCollapsed ? 'w-[68px]' : 'w-[230px]'
      }`}
    >
      {/* 로고 영역 */}
      <div className="flex items-center gap-2.5 px-3.5 h-14 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg shadow-emerald-500/20">
          P
        </div>
        {!isCollapsed && (
          <span className="text-slate-200 font-bold text-[15px] whitespace-nowrap tracking-tight">
            PLS <span className="text-emerald-400">ERP</span>
          </span>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-slate-700/70 shadow-sm'
                    : 'hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* 아이콘 박스 — 독립된 사각형 */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-br ${item.bg} shadow-md`
                        : 'bg-slate-800/80 group-hover:bg-slate-700/80'
                    }`}
                    style={isActive ? undefined : { boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] transition-colors duration-200 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                      style={isActive ? undefined : { color: item.color }}
                    />
                  </div>

                  {/* 텍스트 박스 — 아이콘과 분리된 영역 */}
                  {!isCollapsed && (
                    <div
                      className={`flex-1 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-600/40 text-slate-100'
                          : 'bg-transparent text-slate-400 group-hover:bg-slate-700/40 group-hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>
                    </div>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* 접기/펼치기 버튼 */}
      <button
        onClick={toggle}
        className="flex items-center justify-center h-11 border-t border-slate-700/50 hover:bg-slate-800 transition-colors"
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
