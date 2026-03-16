/**
 * M2 영업/수주 — 견적서 관리 페이지
 * 견적서 목록 + 생성/수정 모달 + 상태 관리
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listQuotations,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  updateQuotationStatus,
  type Quotation,
  type QuotationFormData,
  type QuotationLine,
} from '../api/sales/quotations';
import api from '../api/client';
import BackButton from '../components/BackButton';

/* ── 상태 라벨/색상 매핑 ── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '작성중', color: 'bg-slate-200 text-slate-700' },
  sent: { label: '발송됨', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: '수락됨', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절됨', color: 'bg-red-100 text-red-700' },
};

/* ── 빈 라인 생성 ── */
const emptyLine = (): QuotationLine => ({
  product_name: '', quantity: 1, unit_price: 0, discount_rate: 0,
});

export default function QuotationsPage() {
  const [items, setItems] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  /* 모달 상태 */
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuotationFormData>({
    quote_date: new Date().toISOString().slice(0, 10),
    customer_id: '',
    lines: [emptyLine()],
  });

  /* 거래처 목록 (드롭다운) */
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listQuotations({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        size: 20,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/system/customers', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setCustomers(
        (data?.items || data || []).map((c: any) => ({ id: c.id, name: c.name }))
      );
    });
  }, []);

  /* ── 모달 열기/닫기 ── */
  const openCreate = () => {
    setEditId(null);
    setForm({
      quote_date: new Date().toISOString().slice(0, 10),
      customer_id: customers[0]?.id || '',
      lines: [emptyLine()],
    });
    setShowModal(true);
  };

  const openEdit = async (q: Quotation) => {
    setEditId(q.id);
    setForm({
      quote_date: q.quote_date,
      valid_until: q.valid_until || undefined,
      customer_id: q.customer_id,
      sales_rep_id: q.sales_rep_id || undefined,
      notes: q.notes || undefined,
      lines: q.lines.length > 0 ? q.lines : [emptyLine()],
    });
    setShowModal(true);
  };

  /* ── 라인 관리 ── */
  const updateLine = (idx: number, field: string, value: any) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });
  };
  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  const removeLine = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((_, i) => i !== idx) : prev.lines,
    }));
  };

  /* ── 저장 ── */
  const handleSave = async () => {
    try {
      if (editId) {
        await updateQuotation(editId, form);
      } else {
        await createQuotation(form);
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '저장 실패');
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async (id: string, quoteNo: string) => {
    if (!confirm(`견적서 ${quoteNo}을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteQuotation(id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '삭제 실패');
    }
  };

  /* ── 상태 변경 ── */
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateQuotationStatus(id, newStatus);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '상태 변경 실패');
    }
  };

  /* ── 라인 소계 계산 ── */
  const calcLineAmount = (line: QuotationLine) =>
    Math.round(line.quantity * line.unit_price * (1 - (line.discount_rate || 0) / 100));

  const formTotal = form.lines.reduce((sum, l) => sum + calcLineAmount(l), 0);
  const formTax = Math.round(formTotal * 0.1);

  return (
    <div>
      {/* 뒤로가기 */}
      <div className="mb-4">
        <BackButton to="/sales" label="영업수주" />
      </div>
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">견적서 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            견적서 작성, 발송, 수락/거절 관리 (총 {total}건)
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          + 견적서 작성
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">전체 상태</option>
          <option value="draft">작성중</option>
          <option value="sent">발송됨</option>
          <option value="accepted">수락됨</option>
          <option value="rejected">거절됨</option>
        </select>
        <input
          placeholder="견적번호 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
        />
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-[#c8ced8] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#e8ecf2] text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">견적번호</th>
              <th className="px-4 py-2 text-left">견적일</th>
              <th className="px-4 py-2 text-left">거래처</th>
              <th className="px-4 py-2 text-right">공급가</th>
              <th className="px-4 py-2 text-right">부가세</th>
              <th className="px-4 py-2 text-right">합계</th>
              <th className="px-4 py-2 text-center">상태</th>
              <th className="px-4 py-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">로딩 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">견적서가 없습니다</td></tr>
            ) : (
              items.map((q) => {
                const st = STATUS_MAP[q.status] || STATUS_MAP.draft;
                return (
                  <tr key={q.id} className="border-t border-[#e8ecf2] hover:bg-[#f1f4f8]">
                    <td className="px-4 py-2 font-medium text-slate-700">{q.quote_no}</td>
                    <td className="px-4 py-2 text-slate-600">{q.quote_date}</td>
                    <td className="px-4 py-2 text-slate-600">{q.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {q.total_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {q.tax_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      {q.grand_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {q.status === 'draft' && (
                          <>
                            <button
                              onClick={() => openEdit(q)}
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >수정</button>
                            <button
                              onClick={() => handleStatusChange(q.id, 'sent')}
                              className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            >발송</button>
                            <button
                              onClick={() => handleDelete(q.id, q.quote_no)}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >삭제</button>
                          </>
                        )}
                        {q.status === 'sent' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(q.id, 'accepted')}
                              className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            >수락</button>
                            <button
                              onClick={() => handleStatusChange(q.id, 'rejected')}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >거절</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${
                p === page ? 'bg-emerald-600 text-white' : 'bg-white border border-[#c8ced8] text-slate-600 hover:bg-[#e8ecf2]'
              }`}
            >{p}</button>
          ))}
        </div>
      )}

      {/* ── 생성/수정 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editId ? '견적서 수정' : '견적서 작성'}
            </h2>

            {/* 헤더 정보 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">견적일 *</label>
                <input
                  type="date"
                  value={form.quote_date}
                  onChange={(e) => setForm({ ...form, quote_date: e.target.value })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">유효기한</label>
                <input
                  type="date"
                  value={form.valid_until || ''}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value || undefined })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">거래처 *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">선택</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
                <input
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-1.5 text-sm"
                  placeholder="특이사항 입력"
                />
              </div>
            </div>

            {/* 품목 라인 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">품목 라인</h3>
                <button onClick={addLine} className="text-xs px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">
                  + 라인 추가
                </button>
              </div>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-[#f1f4f8] rounded-lg p-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-0.5">품목명</label>
                      <input
                        value={line.product_name}
                        onChange={(e) => updateLine(idx, 'product_name', e.target.value)}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm"
                        placeholder="품목명 입력"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-0.5">수량</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-slate-500 mb-0.5">단가</label>
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-0.5">할인(%)</label>
                      <input
                        type="number"
                        value={line.discount_rate || 0}
                        onChange={(e) => updateLine(idx, 'discount_rate', Number(e.target.value))}
                        className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28 text-right">
                      <label className="block text-xs text-slate-500 mb-0.5">금액</label>
                      <div className="text-sm font-medium text-slate-700 py-1">
                        {calcLineAmount(line).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-red-400 hover:text-red-600 text-lg pb-1"
                      title="라인 삭제"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 합계 */}
            <div className="flex justify-end gap-6 text-sm mb-6 border-t border-[#e8ecf2] pt-3">
              <div>공급가: <span className="font-semibold">{formTotal.toLocaleString()}</span></div>
              <div>부가세: <span className="font-semibold">{formTax.toLocaleString()}</span></div>
              <div>합계: <span className="font-bold text-emerald-600">{(formTotal + formTax).toLocaleString()}</span></div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-[#c8ced8] rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >취소</button>
              <button
                onClick={handleSave}
                disabled={!form.customer_id || form.lines.every((l) => !l.product_name)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
