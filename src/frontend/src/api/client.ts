/**
 * Axios API 클라이언트 — 백엔드와의 통신을 담당합니다.
 * JWT 토큰을 자동으로 헤더에 추가하고, 401 에러 시 로그아웃 처리합니다.
 */
import axios from 'axios';

/* 배포 시 VITE_API_URL 환경변수로 백엔드 주소 지정, 없으면 상대경로(개발용 프록시) */
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터: 저장된 토큰을 자동으로 Authorization 헤더에 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401 에러 시 토큰 삭제 + 로그인 페이지로 이동
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
