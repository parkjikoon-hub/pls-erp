/**
 * 로그인 페이지 — 시안 C 기반 분할 레이아웃
 * 좌측: 브랜드 + 기능 소개 / 우측: 로그인 폼
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다');
    }
  };

  return (
    <div className="flex h-screen">
      {/* 좌측: 브랜드 영역 */}
      <div className="hidden lg:flex w-[45%] bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-slate-300 flex-col justify-center px-16 relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute -top-1/2 -right-[30%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(16,185,129,0.08)_0%,transparent_70%)] rounded-full" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_70%)] rounded-full" />

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-slate-100 mb-1">
            PLS <span className="text-emerald-400">ERP</span>
          </h1>
          <p className="text-sm text-slate-500 mb-10">AI 통합 기업 자원 관리 시스템</p>

          <ul className="space-y-4">
            {[
              { icon: '🤖', bg: 'bg-emerald-500/15', title: 'AI 자동 인식', desc: '발주서 OCR + 자동 전표 생성' },
              { icon: '⚡', bg: 'bg-blue-500/15', title: '업무 자동화', desc: '반복 업무 90% 이상 자동 처리' },
              { icon: '📊', bg: 'bg-amber-500/15', title: '실시간 대시보드', desc: '매출/생산/재고 현황 한눈에' },
              { icon: '🔒', bg: 'bg-purple-500/15', title: '보안 & 감사', desc: '역할 기반 접근 제어 + 변경 이력' },
            ].map((feat) => (
              <li key={feat.title} className="flex items-center gap-4 py-3 border-b border-slate-700/30 last:border-none">
                <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center text-lg flex-shrink-0`}>
                  {feat.icon}
                </div>
                <div>
                  <div className="font-semibold text-slate-200 text-sm">{feat.title}</div>
                  <div className="text-xs text-slate-500">{feat.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 우측: 로그인 폼 */}
      <div className="flex-1 bg-(--bg-main) flex items-center justify-center px-8">
        <form onSubmit={handleSubmit} className="w-full max-w-[380px]">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">로그인</h2>
          <p className="text-sm text-slate-500 mb-8">PLS ERP에 로그인하세요</p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@pls-erp.com"
              required
              className="w-full px-3.5 py-2.5 border-[1.5px] border-(--border-main) rounded-lg text-sm bg-(--bg-card) outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] focus:bg-(--bg-elevated) transition-all"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              className="w-full px-3.5 py-2.5 border-[1.5px] border-(--border-main) rounded-lg text-sm bg-(--bg-card) outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] focus:bg-(--bg-elevated) transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>

          <p className="text-center mt-6 text-xs text-slate-400">
            PLS ERP v1.0 — AI 통합 기업 자원 관리
          </p>
        </form>
      </div>
    </div>
  );
}
