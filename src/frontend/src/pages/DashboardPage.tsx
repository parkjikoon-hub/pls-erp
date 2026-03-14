/**
 * 대시보드 페이지 — 로그인 후 첫 화면
 * 주요 지표 카드 + 간단한 안내를 표시합니다.
 */
import { useAuthStore } from '../stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const cards = [
    { label: '거래처', value: '-', color: 'from-blue-500 to-blue-600', desc: '거래처 관리 활성화' },
    { label: '품목', value: '-', color: 'from-emerald-500 to-emerald-600', desc: 'Step 1-7에서 구현' },
    { label: '사용자', value: '2', color: 'from-purple-500 to-purple-600', desc: '관리자 + 테스트' },
    { label: '부서', value: '4', color: 'from-amber-500 to-amber-600', desc: '경영/개발/영업/생산' },
  ];

  return (
    <div>
      {/* 환영 메시지 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">
          안녕하세요, {user?.name || '사용자'}님
        </h1>
        <p className="text-sm text-slate-500 mt-1">PLS ERP 대시보드에 오신 것을 환영합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#e8ecf2] rounded-xl p-5 border border-[#c8ced8]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-xs font-bold`}>
                {card.label[0]}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800">{card.value}</div>
            <div className="text-xs text-slate-400 mt-1">{card.desc}</div>
          </div>
        ))}
      </div>

      {/* 개발 진행 현황 */}
      <div className="bg-[#e8ecf2] rounded-xl p-6 border border-[#c8ced8]">
        <h2 className="text-base font-bold text-slate-700 mb-4">Phase 1 개발 진행 현황</h2>
        <div className="space-y-3">
          {[
            { step: '1-1', name: '백엔드 뼈대', done: true },
            { step: '1-2', name: 'DB 스키마 마이그레이션', done: true },
            { step: '1-3', name: 'JWT 인증 시스템', done: true },
            { step: '1-4', name: 'Audit Log 시스템', done: true },
            { step: '1-5', name: '프론트엔드 뼈대', done: true },
            { step: '1-6', name: '거래처 마스터 CRUD', done: true },
            { step: '1-7', name: '품목 마스터 CRUD', done: false },
            { step: '1-8', name: '부서/직급/사용자 관리', done: false },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                item.done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500'
              }`}>
                {item.done ? '✓' : item.step.split('-')[1]}
              </div>
              <span className={`text-sm ${item.done ? 'text-slate-500 line-through' : 'text-slate-700 font-medium'}`}>
                Step {item.step}: {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
