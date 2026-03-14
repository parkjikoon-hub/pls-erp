/**
 * 상단 헤더 — 페이지 제목, 사용자 정보, 로그아웃
 */
import { ArrowRightStartOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';

export default function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="flex items-center justify-between h-12 px-6 bg-[#e8ecf2] border-b border-[#c8ced8]">
      {/* 좌측: 현재 위치 */}
      <div className="text-sm text-slate-600 font-medium">
        PLS ERP
      </div>

      {/* 우측: 사용자 정보 + 로그아웃 */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <UserCircleIcon className="w-5 h-5" />
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-slate-400">({user.role})</span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </header>
  );
}
