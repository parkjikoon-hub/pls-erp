/**
 * M6 그룹웨어 — 결재 상세 + 승인/반려
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApproval, approveRequest, rejectRequest, type ApprovalDetail } from '../api/groupware/approvals';
import { useAuthStore } from '../stores/authStore';

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  draft:    { text: '임시저장', cls: 'bg-slate-100 text-slate-600' },
  pending:  { text: '진행중',   cls: 'bg-blue-100 text-blue-700' },
  approved: { text: '승인',     cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: '반려',     cls: 'bg-red-100 text-red-700' },
  viewed:   { text: '열람',     cls: 'bg-purple-100 text-purple-700' },
};

const DOC_TYPE_LABEL: Record<string, string> = {
  general: '일반 품의', journal: '전표 결재', quotation: '견적 결재',
  sales_order: '수주 결재', expense: '경비 결재',
};

export default function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setDetail(await getApproval(id));
    } catch { navigate('/groupware/approvals'); }
  };

  useEffect(() => { load(); }, [id]);

  if (!detail) return <div className="text-center py-20 text-slate-400">불러오는 중...</div>;

  const badge = STATUS_BADGE[detail.status] || STATUS_BADGE.pending;

  /* 현재 사용자가 결재 가능한지 확인 */
  const approvalSteps = detail.steps.filter(s => s.step_type === 'approval');
  const currentPendingStep = approvalSteps.find(s => s.status === 'pending');
  const canAct = detail.status === 'pending' && currentPendingStep?.approver_id === user?.id;

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!id) return;
    setActing(true);
    try {
      if (action === 'approve') await approveRequest(id, comment || undefined);
      else await rejectRequest(id, comment || undefined);
      await load();
      setComment('');
    } catch (e: any) {
      alert(e.response?.data?.detail || '처리 실패');
    }
    setActing(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-mono">{detail.request_no}</p>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">{detail.title}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.cls}`}>
          {badge.text}
        </span>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-[#c8ced8] p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-400">문서 유형</span>
            <p className="font-medium text-slate-700 mt-0.5">{DOC_TYPE_LABEL[detail.document_type] || detail.document_type}</p>
          </div>
          <div>
            <span className="text-slate-400">기안자</span>
            <p className="font-medium text-slate-700 mt-0.5">{detail.requester_name || '-'}</p>
          </div>
          <div>
            <span className="text-slate-400">금액</span>
            <p className="font-medium text-slate-700 mt-0.5">
              {detail.amount ? detail.amount.toLocaleString() + '원' : '-'}
            </p>
          </div>
          <div>
            <span className="text-slate-400">기안일</span>
            <p className="font-medium text-slate-700 mt-0.5">
              {detail.created_at ? new Date(detail.created_at).toLocaleDateString('ko-KR') : '-'}
            </p>
          </div>
        </div>

        {/* 본문 */}
        {detail.content?.body && (
          <div className="mt-4 pt-4 border-t border-[#c8ced8]">
            <h3 className="text-sm font-medium text-slate-600 mb-2">내용</h3>
            <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4">
              {String(detail.content.body)}
            </div>
          </div>
        )}
      </div>

      {/* 결재선 */}
      <div className="bg-white rounded-xl border border-[#c8ced8] p-5">
        <h3 className="font-bold text-slate-700 mb-4">결재선</h3>
        <div className="space-y-3">
          {detail.steps.filter(s => s.step_type === 'approval').map(step => {
            const stepBadge = STATUS_BADGE[step.status] || STATUS_BADGE.pending;
            const isCurrent = currentPendingStep?.id === step.id && detail.status === 'pending';
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isCurrent ? 'border-cyan-300 bg-cyan-50' : 'border-[#c8ced8]'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                  {step.step_order}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {step.approver_name || '알 수 없음'}
                    {step.role_label && <span className="text-slate-400 ml-1">({step.role_label})</span>}
                  </p>
                  {step.comment && <p className="text-xs text-slate-500 mt-0.5">"{step.comment}"</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stepBadge.cls}`}>
                  {stepBadge.text}
                </span>
                {step.acted_at && (
                  <span className="text-xs text-slate-400">
                    {new Date(step.acted_at).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 참조선 */}
        {detail.steps.filter(s => s.step_type === 'reference').length > 0 && (
          <>
            <h3 className="font-bold text-slate-700 mt-6 mb-3">참조선</h3>
            <div className="flex flex-wrap gap-2">
              {detail.steps.filter(s => s.step_type === 'reference').map(step => (
                <span key={step.id} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                  {step.approver_name || '알 수 없음'}
                  {step.role_label && ` (${step.role_label})`}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 승인/반려 액션 */}
      {canAct && (
        <div className="bg-white rounded-xl border border-[#c8ced8] p-5 space-y-3">
          <h3 className="font-bold text-slate-700">결재 의견</h3>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="의견을 입력하세요 (선택사항)"
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => handleAction('reject')}
              disabled={acting}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium disabled:opacity-50"
            >
              반려
            </button>
            <button
              onClick={() => handleAction('approve')}
              disabled={acting}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50"
            >
              승인
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => navigate('/groupware/approvals')}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← 목록으로
      </button>
    </div>
  );
}
