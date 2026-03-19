/**
 * M6 그룹웨어 — 기안 작성 페이지
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApproval, listTemplates, type Template } from '../api/groupware/approvals';
import api from '../api/client';


interface StepRow {
  step_type: string;
  step_order: number;
  approver_id: string;
  approver_name?: string;
  role_label: string;
}

interface UserOption { id: string; name: string; }

const DOC_TYPES = [
  { value: 'general', label: '일반 품의' },
  { value: 'journal', label: '전표 결재' },
  { value: 'quotation', label: '견적 결재' },
  { value: 'sales_order', label: '수주 결재' },
  { value: 'expense', label: '경비 결재' },
  { value: 'leave', label: '연차/휴가' },
  { value: 'half_leave', label: '반차' },
  { value: 'early_leave', label: '조퇴' },
];

const LEAVE_TYPES = ['leave', 'half_leave', 'early_leave'];

export default function ApprovalFormPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('general');
  const [amount, setAmount] = useState('');
  const [contentText, setContentText] = useState('');
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /* 휴가 전용 필드 */
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [halfType, setHalfType] = useState<'am' | 'pm'>('am');
  const isLeaveType = LEAVE_TYPES.includes(documentType);

  useEffect(() => {
    /* 사용자 목록 + 템플릿 목록 로드 */
    const init = async () => {
      try {
        const [uRes, tRes] = await Promise.allSettled([
          api.get('/system/users'),
          listTemplates(),
        ]);
        if (uRes.status === 'fulfilled') {
          const list = uRes.value.data?.data?.items || uRes.value.data?.data || [];
          setUsers(list.map((u: any) => ({ id: u.id, name: u.name })));
        }
        if (tRes.status === 'fulfilled') {
          setTemplates(Array.isArray(tRes.value) ? tRes.value : []);
        }
      } catch { /* 무시 */ }
    };
    init();
  }, []);

  /* 템플릿 적용 */
  const applyTemplate = (tpl: Template) => {
    setSteps(
      tpl.lines.map(ln => ({
        step_type: ln.line_type,
        step_order: ln.step_order,
        approver_id: ln.approver_id,
        approver_name: ln.approver_name,
        role_label: ln.role_label || '',
      })),
    );
  };

  /* 결재선 추가 */
  const addStep = (type: 'approval' | 'reference') => {
    const sameType = steps.filter(s => s.step_type === type);
    setSteps([...steps, {
      step_type: type,
      step_order: sameType.length + 1,
      approver_id: '',
      role_label: '',
    }]);
  };

  /* 결재선 삭제 */
  const removeStep = (idx: number) => {
    const updated = steps.filter((_, i) => i !== idx);
    // step_order 재정렬
    let approvalOrder = 0, refOrder = 0;
    setSteps(updated.map(s => ({
      ...s,
      step_order: s.step_type === 'approval' ? ++approvalOrder : ++refOrder,
    })));
  };

  /* 휴가 일수 계산 */
  const calcLeaveDays = (): number => {
    if (documentType === 'leave' && leaveStart && leaveEnd) {
      return Math.max(1, Math.round((new Date(leaveEnd).getTime() - new Date(leaveStart).getTime()) / 86400000) + 1);
    }
    if (documentType === 'half_leave') return 0.5;
    return 0; // early_leave
  };

  /* 제출 */
  const handleSubmit = async () => {
    if (!title.trim()) return alert('제목을 입력하세요');
    const approvalSteps = steps.filter(s => s.step_type === 'approval');
    if (approvalSteps.length === 0) return alert('결재자를 최소 1명 추가하세요');
    if (steps.some(s => !s.approver_id)) return alert('모든 결재자를 선택하세요');

    /* 휴가 유형 검증 */
    if (isLeaveType && !leaveStart) return alert('날짜를 입력하세요');
    if (documentType === 'leave' && !leaveEnd) return alert('종료일을 입력하세요');

    /* content JSON 구성 — 휴가 정보 포함 */
    const content: Record<string, any> = { body: contentText };
    if (isLeaveType) {
      content.leave_start = leaveStart;
      content.leave_end = documentType === 'leave' ? leaveEnd : leaveStart;
      content.leave_type = documentType === 'half_leave' ? `half_${halfType}` : 'annual';
      content.leave_days = calcLeaveDays();
      if (documentType === 'half_leave') content.half_type = halfType;
    }

    setSubmitting(true);
    try {
      await createApproval({
        title,
        document_type: documentType,
        content,
        amount: amount ? parseFloat(amount) : undefined,
        steps: steps.map(s => ({
          step_type: s.step_type,
          step_order: s.step_order,
          approver_id: s.approver_id,
          role_label: s.role_label || undefined,
        })),
      });
      navigate('/groupware/approvals');
    } catch (e: any) {
      alert(e.response?.data?.detail || '기안 실패');
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">새 기안 작성</h1>

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-(--border-main) p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">제목</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="결재 제목을 입력하세요"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">문서 유형</label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
            >
              {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">금액 (선택)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        {/* 휴가 전용 필드 — 문서 유형이 연차/반차/조퇴일 때만 표시 */}
        {isLeaveType && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-bold text-cyan-700">휴가 정보</h3>
            {documentType === 'leave' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">시작일</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={e => setLeaveStart(e.target.value)}
                    className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">종료일</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={e => setLeaveEnd(e.target.value)}
                    className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                {leaveStart && leaveEnd && (
                  <p className="col-span-2 text-sm text-cyan-700 font-medium">
                    차감 일수: {Math.max(1, Math.round((new Date(leaveEnd).getTime() - new Date(leaveStart).getTime()) / 86400000) + 1)}일
                  </p>
                )}
              </div>
            )}
            {documentType === 'half_leave' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">날짜</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={e => setLeaveStart(e.target.value)}
                    className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">반차 유형</label>
                  <select
                    value={halfType}
                    onChange={e => setHalfType(e.target.value as 'am' | 'pm')}
                    className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="am">오전 반차</option>
                    <option value="pm">오후 반차</option>
                  </select>
                </div>
                <p className="col-span-2 text-sm text-cyan-700 font-medium">차감 일수: 0.5일</p>
              </div>
            )}
            {documentType === 'early_leave' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">날짜</label>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={e => setLeaveStart(e.target.value)}
                  className="w-1/2 border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                />
                <p className="mt-2 text-sm text-cyan-700 font-medium">차감 일수: 없음 (조퇴)</p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">내용</label>
          <textarea
            value={contentText}
            onChange={e => setContentText(e.target.value)}
            rows={10}
            className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="품의 내용을 입력하세요"
          />
        </div>
      </div>

      {/* 결재선 설정 */}
      <div className="bg-white rounded-xl border border-(--border-main) p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-700">결재선 / 참조선</h2>
          {templates.length > 0 && (
            <select
              onChange={e => {
                const tpl = templates.find(t => t.id === e.target.value);
                if (tpl) applyTemplate(tpl);
              }}
              className="border border-(--border-main) rounded-lg px-2 py-1 text-xs"
              defaultValue=""
            >
              <option value="" disabled>템플릿 불러오기</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {/* 결재선 목록 */}
        {steps.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">결재자/참조자를 추가하세요</p>
        ) : (
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  step.step_type === 'approval' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {step.step_type === 'approval' ? `결재 ${step.step_order}` : `참조 ${step.step_order}`}
                </span>
                <select
                  value={step.approver_id}
                  onChange={e => {
                    const updated = [...steps];
                    const user = users.find(u => u.id === e.target.value);
                    updated[idx] = { ...updated[idx], approver_id: e.target.value, approver_name: user?.name };
                    setSteps(updated);
                  }}
                  className="flex-1 border border-(--border-main) rounded px-2 py-1 text-sm"
                >
                  <option value="">결재자 선택</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input
                  value={step.role_label}
                  onChange={e => {
                    const updated = [...steps];
                    updated[idx] = { ...updated[idx], role_label: e.target.value };
                    setSteps(updated);
                  }}
                  className="w-24 border border-(--border-main) rounded px-2 py-1 text-sm"
                  placeholder="역할명"
                />
                <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 text-sm">
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => addStep('approval')}
            className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-sm hover:bg-cyan-100 transition"
          >
            + 결재자
          </button>
          <button
            onClick={() => addStep('reference')}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition"
          >
            + 참조자
          </button>
        </div>
      </div>

      {/* 제출 */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => navigate('/groupware/approvals')}
          className="px-4 py-2 border border-(--border-main) text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-sm font-medium disabled:opacity-50"
        >
          {submitting ? '상신 중...' : '상신'}
        </button>
      </div>
    </div>
  );
}
