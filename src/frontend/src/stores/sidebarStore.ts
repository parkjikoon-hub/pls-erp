/**
 * 사이드바 상태 관리 — 접기/펼치기 토글
 */
import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
}));
