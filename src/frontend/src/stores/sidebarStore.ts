/**
 * 사이드바 상태 관리 — 138px 고정 너비 (토글 제거됨)
 * 하위 호환을 위해 isCollapsed를 항상 false로 유지합니다.
 */
import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>(() => ({
  isCollapsed: false,
  toggle: () => { /* 사이드바 고정 — 토글 비활성화 */ },
}));
