/**
 * 인증 상태 관리 (Zustand)
 * 로그인/로그아웃, 현재 사용자 정보를 전역으로 관리합니다.
 */
import { create } from 'zustand';
import api from '../api/client';

interface User {
  id: string;
  employee_no: string;
  name: string;
  email: string;
  role: string;
  department_name: string | null;
  position_name: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', res.data.access_token);
      set({ isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('로그인에 실패했습니다');
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data });
    } catch (err: any) {
      // 401(인증 만료)일 때만 로그아웃, 그 외 에러는 무시
      if (err?.response?.status === 401) {
        localStorage.removeItem('access_token');
        set({ user: null, isAuthenticated: false });
      }
    }
  },
}));
