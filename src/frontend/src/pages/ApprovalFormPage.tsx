/**
 * M6 그룹웨어 — 기안 작성 페이지
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApproval, listTemplates, type Template } from '../api/groupware/approvals';
import api from '../api/client';
import BackButton from '../components/BackButton';

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
];

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

  /* 제출 */
  const handleSubmit = async () => {
    if (!title.trim()) return alert('제목을 입력하세요');
    const approvalSteps = steps.filter(s => s.step_type === 'approval');
    if (approvalSteps.length === 0) return alert('결재자를 최소 1명 추가하세요');
    if (steps.some(s => !s.approver_id)) return alert('모든 결재자를 선택하세요');

    setSubmitting(true);
    try {
      await createApproval({
        title,
        document_type: documentType,
        content: { body: contentText },
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
      <div className="flex items-center gap-3">
        <BackButton to="/groupware/approvals" />
        <h1 className="text-2xl font-bold text-slate-800">새 기안 작성</h1>
      </div>

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
