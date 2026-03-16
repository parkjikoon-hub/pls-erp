/**
 * 다크모드/라이트모드 상태 관리
 * localStorage에 저장하여 새로고침 후에도 유지
 */
import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

/* localStorage에서 초기값 불러오기 */
const getInitialDark = (): boolean => {
  const stored = localStorage.getItem('pls-theme');
  if (stored !== null) return stored === 'dark';
  return false; // 기본값: 라이트모드
};

/* <html> 태그에 dark 클래스 적용/제거 */
const applyTheme = (isDark: boolean) => {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('pls-theme', isDark ? 'dark' : 'light');
};

/* 초기 테마 적용 */
const initialDark = getInitialDark();
applyTheme(initialDark);

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialDark,
  toggle: () =>
    set((state) => {
      const next = !state.isDark;
      applyTheme(next);
      return { isDark: next };
    }),
}));
