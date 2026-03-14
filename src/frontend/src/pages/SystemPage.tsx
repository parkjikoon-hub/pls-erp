/**
 * M1 시스템 관리 페이지 — 거래처/품목/사용자 관리의 진입점
 * Step 1-6~1-8에서 탭별 CRUD를 구현합니다.
 */
export default function SystemPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">M1 시스템 관리</h1>
      <p className="text-sm text-slate-500 mb-6">마스터 데이터 관리 (MDM) — 거래처, 품목, 사용자</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '거래처 관리', desc: '매출처/매입처 등록 및 관리', step: 'Step 1-6', color: 'border-blue-400' },
          { title: '품목 관리', desc: '제품/자재/반제품 등록 및 관리', step: 'Step 1-7', color: 'border-emerald-400' },
          { title: '사용자 관리', desc: '부서/직급/계정 관리', step: 'Step 1-8', color: 'border-purple-400' },
        ].map((item) => (
          <div
            key={item.title}
            className={`bg-[#e8ecf2] rounded-xl p-6 border-l-4 ${item.color} border border-[#c8ced8]`}
          >
            <h3 className="font-bold text-slate-700 mb-1">{item.title}</h3>
            <p className="text-sm text-slate-500 mb-3">{item.desc}</p>
            <span className="text-xs text-slate-400">{item.step}에서 구현 예정</span>
          </div>
        ))}
      </div>
    </div>
  );
}
