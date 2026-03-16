/**
 * M6 그룹웨어 — 메인 페이지 (하위 메뉴 카드 + 결재 현황)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { myApprovals } from '../api/groupware/approvals';
import { listNotices } from '../api/groupware/notices';

const SUB_MENUS = [
  {
    path: '/groupware/approvals', title: '전자결재',
    desc: '기안 작성, 승인/반려 처리, 결재함 조회',
    icon: '📝', color: 'from-cyan-500 to-cyan-600',
  },
  {
    path: '/groupware/templates', title: '결재선 템플릿',
    desc: '자주 쓰는 결재선을 저장하고 관리',
    icon: '📋', color: 'from-violet-500 to-violet-600',
  },
  {
    path: '/groupware/notices', title: '공지사항',
    desc: '회사 공지사항 조회 및 관리',
    icon: '📢', color: 'from-amber-500 to-amber-600',
  },
];

export default function GroupwarePage() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [noticeCount, setNoticeCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [approvals, notices] = await Promise.allSettled([
          myApprovals({ status: 'pending' }),
          listNotices({ page: 1, size: 1 }),
        ]);
        if (approvals.status === 'fulfilled') setPendingCount(approvals.value?.total || 0);
        if (notices.status === 'fulfilled') setNoticeCount(notices.value?.total || 0);
      } catch { /* 무시 */ }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">그룹웨어</h1>
        <p className="text-sm text-slate-500 mt-1">전자결재, 공지사항을 통합 관리합니다</p>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '결재 대기', value: pendingCount, color: 'text-cyan-600', bg: 'bg-cyan-50' },
          { label: '전체 공지', value: noticeCount, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 border border-(--border-main)`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 하위 메뉴 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUB_MENUS.map(menu => (
          <div
            key={menu.path}
            onClick={() => navigate(menu.path)}
            className="bg-white rounded-xl border border-(--border-main) p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${menu.color} flex items-center justify-center text-2xl flex-shrink-0`}>
                {menu.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition">
                  {menu.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{menu.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
