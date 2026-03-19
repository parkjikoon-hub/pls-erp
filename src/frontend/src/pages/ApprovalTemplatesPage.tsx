/**
 * M6 그룹웨어 — 결재선 템플릿 관리
 */
import { useState, useEffect } from 'react';
import { listTemplates, createTemplate, deleteTemplate, type Template } from '../api/groupware/approvals';
import api from '../api/client';


interface UserOption { id: string; name: string; }

export default function ApprovalTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [docType, setDocType] = useState('');
  const [desc, setDesc] = useState('');
  const [lines, setLines] = useState<{ step_order: number; approver_id: string; role_label: string; line_type: string }[]>([]);

  const load = async () => {
    try {
      const data = await listTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* 무시 */ }
  };

  useEffect(() => {
    load();
    api.get('/system/users').then(r => {
      const list = r.data?.data?.items || r.data?.data || [];
      setUsers(list.map((u: any) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
  }, []);

  const addLine = (type: 'approval' | 'reference') => {
    const sameType = lines.filter(l => l.line_type === type);
    setLines([...lines, { step_order: sameType.length + 1, approver_id: '', role_label: '', line_type: type }]);
  };

  const removeLine = (idx: number) => {
    const updated = lines.filter((_, i) => i !== idx);
    let ao = 0, ro = 0;
    setLines(updated.map(l => ({
      ...l,
      step_order: l.line_type === 'approval' ? ++ao : ++ro,
    })));
  };

  const handleCreate = async () => {
    if (!name.trim()) return alert('템플릿 이름을 입력하세요');
    if (lines.length === 0 || lines.some(l => !l.approver_id)) return alert('결재자를 선택하세요');
    try {
      await createTemplate({
        name,
        document_type: docType || undefined,
        description: desc || undefined,
        lines: lines.map(l => ({
          step_order: l.step_order,
          approver_id: l.approver_id,
          role_label: l.role_label || undefined,
          line_type: l.line_type,
        })),
      });
      setShowForm(false);
      setName(''); setDocType(''); setDesc(''); setLines([]);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.detail || '생성 실패');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    await deleteTemplate(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">결재선 템플릿</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium"
        >
          {showForm ? '취소' : '+ 새 템플릿'}
        </button>
      </div>

      {/* 생성 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-(--border-main) p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">템플릿 이름</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm" placeholder="예: 일반품의 결재선" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">문서 유형 (선택)</label>
              <input value={docType} onChange={e => setDocType(e.target.value)}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm" placeholder="general" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">설명</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm" placeholder="템플릿 설명" />
          </div>

          {/* 라인 */}
          {lines.length > 0 && (
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ln.line_type === 'approval' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {ln.line_type === 'approval' ? `결재 ${ln.step_order}` : `참조 ${ln.step_order}`}
                  </span>
                  <select value={ln.approver_id} onChange={e => {
                    const updated = [...lines]; updated[idx] = { ...updated[idx], approver_id: e.target.value }; setLines(updated);
                  }} className="flex-1 border border-(--border-main) rounded px-2 py-1 text-sm">
                    <option value="">선택</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input value={ln.role_label} onChange={e => {
                    const updated = [...lines]; updated[idx] = { ...updated[idx], role_label: e.target.value }; setLines(updated);
                  }} className="w-24 border border-(--border-main) rounded px-2 py-1 text-sm" placeholder="역할명" />
                  <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 text-sm">삭제</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => addLine('approval')} className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-sm hover:bg-violet-100">+ 결재자</button>
            <button onClick={() => addLine('reference')} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200">+ 참조자</button>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium">저장</button>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.length === 0 ? (
          <p className="text-slate-400 col-span-2 text-center py-10">등록된 템플릿이 없습니다</p>
        ) : (
          templates.map(tpl => (
            <div key={tpl.id} className="bg-white rounded-xl border border-(--border-main) p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{tpl.name}</h3>
                  {tpl.description && <p className="text-xs text-slate-400 mt-0.5">{tpl.description}</p>}
                </div>
                <button onClick={() => handleDelete(tpl.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tpl.lines.map((ln, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
                    ln.line_type === 'approval' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {ln.line_type === 'approval' ? '결재' : '참조'} {ln.step_order}: {ln.approver_name || '미지정'}
                    {ln.role_label && ` (${ln.role_label})`}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
