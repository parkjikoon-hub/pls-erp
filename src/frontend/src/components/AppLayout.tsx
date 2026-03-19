/**
 * 앱 메인 레이아웃 — 사이드바(138px) + 헤더(56px) + 탭바(50px) + 콘텐츠
 * 목업 redesign-A2-v2 기준 4영역 레이아웃
 */
import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TabBar from './TabBar';
import ChatWidget from './ChatWidget';
import { useAuthStore } from '../stores/authStore';

export default function AppLayout() {
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 좌측: 사이드바 (138px 고정) */}
      <Sidebar />

      {/* 우측: 헤더 + 탭바 + 콘텐츠 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header />
        <TabBar />

        {/* 콘텐츠 영역 */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--bg-base)' }}>
          <Outlet />
        </main>
      </div>

      {/* AI 챗봇 위젯 (플로팅) */}
      <ChatWidget />
    </div>
  );
}
