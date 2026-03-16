/**
 * M6 그룹웨어 — 공지사항
 */
import { useState, useEffect } from 'react';
import { listNotices, getNotice, createNotice, updateNotice, deleteNotice, type NoticeListItem, type NoticeDetail } from '../api/groupware/notices';
import { useAuthStore } from '../stores/authStore';
import BackButton from '../components/BackButton';

export default function NoticesPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  /* 상세 모달 */
  const [detail, setDetail] = useState<NoticeDetail | null>(null);

  /* 작성/수정 모달 */
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [formImportant, setFormImportant] = useState(false);

  const load = async () => {
    try {
      const data = await listNotices({ page, size: 20 });
      setNotices(data?.items || []);
      setTotal(data?.total || 0);
    } catch { /* 무시 */ }
  };

  useEffect(() => { load(); }, [page]);

  const openDetail = async (id: string) => {
    try {
      setDetail(await getNotice(id));
      await load(); // 조회수 갱신
    } catch { /* 무시 */ }
  };

  const openEdit = (notice?: NoticeDetail) => {
    if (notice) {
      setEditId(notice.id);
      setFormTitle(notice.title);
      setFormContent(notice.content);
      setFormPinned(notice.is_pinned);
      setFormImportant(notice.is_important);
    } else {
      setEditId(null);
      setFormTitle(''); setFormContent(''); setFormPinned(false); setFormImportant(false);
    }
    setDetail(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return alert('제목과 내용을 입력하세요');
    try {
      if (editId) {
        await updateNotice(editId, { title: formTitle, content: formContent, is_pinned: formPinned, is_important: formImportant });
      } else {
        await createNotice({ title: formTitle, content: formContent, is_pinned: formPinned, is_important: formImportant });
      }
      setShowForm(false);
      await load();
    } catch (e: any) { alert(e.response?.data?.detail || '저장 실패'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지를 삭제하시겠습니까?')) return;
    try {
      await deleteNotice(id);
      setDetail(null);
      await load();
    } catch { /* 무시 */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/groupware" />
          <h1 className="text-2xl font-bold text-slate-800">공지사항</h1>
        </div>
        {isManager && (
          <button onClick={() => openEdit()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium"
          >
            + 공지 작성
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-(--bg-card) text-slate-600 text-xs uppercase">
              <th className="text-left py-3 px-4 font-semibold w-12"></th>
              <th className="text-left py-3 px-4 font-semibold">제목</th>
              <th className="text-left py-3 px-4 font-semibold">작성자</th>
              <th className="text-right py-3 px-4 font-semibold">조회</th>
              <th className="text-left py-3 px-4 font-semibold">등록일</th>
            </tr>
          </thead>
          <tbody>
            {notices.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400">등록된 공지가 없습니다</td></tr>
            ) : (
              notices.map(n => (
                <tr key={n.id} onClick={() => openDetail(n.id)}
                  className="border-t border-(--border-main) hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="py-3 px-4">
                    {n.is_pinned && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">고정</span>}
                    {n.is_important && !n.is_pinned && <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">중요</span>}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{n.title}</td>
                  <td className="py-3 px-4 text-slate-500">{n.author_name || '-'}</td>
                  <td className="py-3 px-4 text-right text-slate-400">{n.view_count}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    {n.created_at ? new Date(n.created_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 border border-(--border-main) rounded text-sm disabled:opacity-30">이전</button>
          <span className="text-sm text-slate-500 py-1">{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 border border-(--border-main) rounded text-sm disabled:opacity-30">다음</button>
        </div>
      )}

      {/* 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {detail.is_pinned && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">고정</span>}
                    {detail.is_important && <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">중요</span>}
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">{detail.title}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {detail.author_name} | {detail.created_at ? new Date(detail.created_at).toLocaleDateString('ko-KR') : ''} | 조회 {detail.view_count}
                  </p>
                </div>
                <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
              </div>
              <div className="border-t border-(--border-main) pt-4 text-sm text-slate-700 whitespace-pre-wrap">
                {detail.content}
              </div>
              {isManager && (
                <div className="flex gap-2 justify-end border-t border-(--border-main) pt-3">
                  <button onClick={() => openEdit(detail)} className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">수정</button>
                  <button onClick={() => handleDelete(detail.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">삭제</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 작성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl"
          >
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-800">{editId ? '공지 수정' : '공지 작성'}</h2>
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm" placeholder="제목" />
              <textarea value={formContent} onChange={e => setFormContent(e.target.value)}
                rows={8} className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm resize-none" placeholder="내용" />
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={formPinned} onChange={e => setFormPinned(e.target.checked)} className="rounded" />
                  상단 고정
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={formImportant} onChange={e => setFormImportant(e.target.checked)} className="rounded" />
                  중요 공지
                </label>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-(--border-main) text-slate-600 rounded-lg text-sm">취소</button>
                <button onClick={handleSave} className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
