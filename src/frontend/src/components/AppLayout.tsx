/**
 * 앱 메인 레이아웃 — 사이드바 + 헤더 + 콘텐츠 영역
 * 로그인 후 표시되는 전체 화면 구조입니다.
 */
import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../stores/authStore';

export default function AppLayout() {
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 좌측: 다크 사이드바 */}
      <Sidebar />

      {/* 우측: 헤더 + 콘텐츠 */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        {/* 콘텐츠 영역 — 슬레이트 블루그레이 배경 */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#dce1e9]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
