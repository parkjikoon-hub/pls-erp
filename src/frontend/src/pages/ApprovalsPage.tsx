/**
 * M6 그룹웨어 — 결재함 (내 기안 / 내 결재 / 참조 3탭)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { myRequests, myApprovals, myReferences, type ApprovalListItem } from '../api/groupware/approvals';


const TABS = [
  { key: 'requests', label: '내 기안' },
  { key: 'approvals', label: '내 결재' },
  { key: 'references', label: '참조' },
] as const;

type TabKey = typeof TABS[number]['key'];

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  draft:    { text: '임시저장', cls: 'bg-slate-100 text-slate-600' },
  pending:  { text: '진행중',   cls: 'bg-blue-100 text-blue-700' },
  approved: { text: '승인',     cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: '반려',     cls: 'bg-red-100 text-red-700' },
};

const DOC_TYPE_LABEL: Record<string, string> = {
  general: '일반',
  journal: '전표',
  quotation: '견적',
  sales_order: '수주',
  expense: '경비',
};

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('requests');
  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        let data;
        if (tab === 'requests') data = await myRequests();
        else if (tab === 'approvals') data = await myApprovals();
        else data = await myReferences();
        setItems(data?.items || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetch();
  }, [tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">전자결재</h1>
        <button
          onClick={() => navigate('/groupware/approvals/new')}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium"
        >
          + 새 기안
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 결재 목록 테이블 */}
      <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-(--bg-card) text-slate-600 text-xs uppercase">
              <th className="text-left py-3 px-4 font-semibold">결재번호</th>
              <th className="text-left py-3 px-4 font-semibold">제목</th>
              <th className="text-left py-3 px-4 font-semibold">유형</th>
              <th className="text-right py-3 px-4 font-semibold">금액</th>
              <th className="text-center py-3 px-4 font-semibold">진행</th>
              <th className="text-center py-3 px-4 font-semibold">상태</th>
              <th className="text-left py-3 px-4 font-semibold">기안자</th>
              <th className="text-left py-3 px-4 font-semibold">기안일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400">불러오는 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400">결재 건이 없습니다</td></tr>
            ) : (
              items.map(item => {
                const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
                return (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/groupware/approvals/${item.id}`)}
                    className="border-t border-(--border-main) hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">{item.request_no}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{item.title}</td>
                    <td className="py-3 px-4 text-slate-500">{DOC_TYPE_LABEL[item.document_type] || item.document_type}</td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {item.amount ? item.amount.toLocaleString() + '원' : '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-slate-500">
                      {item.current_step ?? '-'}/{item.total_steps ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.requester_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
