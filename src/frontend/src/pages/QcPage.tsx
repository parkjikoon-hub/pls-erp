/**
 * M5 생산/SCM — QC 검사 관리 페이지
 * QC대기 작업지시서 선택 → 검사 등록 → 합격/불합격/재작업 처리
 */
import { useState, useEffect, useCallback } from 'react';
import {
  createInspection, listInspections,
  type QcInspection, type QcFormData,
} from '../api/production/qc';
import { listWorkOrders, type WorkOrder } from '../api/production/workOrders';

/* 결과별 색상 */
const RESULT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pass:   { label: '합격',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
  fail:   { label: '불합격', color: 'text-red-700',     bg: 'bg-red-100' },
  rework: { label: '재작업', color: 'text-amber-700',   bg: 'bg-amber-100' },
};

export default function QcPage() {
  const [inspections, setInspections] = useState<QcInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultFilter, setResultFilter] = useState('');

  /* 등록 모달 */
  const [showCreate, setShowCreate] = useState(false);
  const [qcWaitOrders, setQcWaitOrders] = useState<WorkOrder[]>([]);
  const [form, setForm] = useState<QcFormData>({
    work_order_id: '', inspected_qty: 0, passed_qty: 0, failed_qty: 0,
    result: 'pass', notes: '',
  });

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInspections({
        result: resultFilter || undefined,
        size: 100,
      });
      setInspections(data?.items || data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [resultFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 모달 열기 → QC대기 작업지시서 가져오기 ── */
  const openCreate = async () => {
    try {
      const result = await listWorkOrders({ status: 'qc_wait', size: 100 });
      setQcWaitOrders(result?.items || result || []);
    } catch (e) { console.error(e); }
    setForm({
      work_order_id: '', inspected_qty: 0, passed_qty: 0, failed_qty: 0,
      result: 'pass', notes: '',
    });
    setShowCreate(true);
  };

  /* 작업지시서 선택 시 수량 자동 세팅 */
  const handleWoSelect = (woId: string) => {
    const wo = qcWaitOrders.find(w => w.id === woId);
    const qty = wo ? wo.planned_qty - wo.produced_qty : 0;
    setForm(prev => ({
      ...prev,
      work_order_id: woId,
      inspected_qty: qty > 0 ? qty : 0,
      passed_qty: qty > 0 ? qty : 0,
      failed_qty: 0,
    }));
  };

  /* 합격/불합격 수량 동기화 */
  const handlePassedChange = (val: number) => {
    setForm(prev => ({
      ...prev,
      passed_qty: val,
      failed_qty: prev.inspected_qty - val,
    }));
  };

  /* ── 검사 등록 ── */
  const handleCreate = async () => {
    if (!form.work_order_id) { alert('작업지시서를 선택해주세요'); return; }
    if (form.inspected_qty <= 0) { alert('검사 수량을 입력해주세요'); return; }
    if (form.passed_qty + form.failed_qty !== form.inspected_qty) {
      alert('합격 + 불합격 수량이 검사 수량과 일치해야 합니다');
      return;
    }
    try {
      await createInspection(form);
      setShowCreate(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '검사 등록 실패');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">QC 검사</h1>
          <p className="text-sm text-slate-500 mt-1">품질 검사 등록 및 이력 조회</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + QC 검사 등록
        </button>
      </div>

      {/* ── 필터 ── */}
      <div className="flex gap-2">
        {[
          { value: '', label: '전체' },
          { value: 'pass', label: '합격' },
          { value: 'fail', label: '불합격' },
          { value: 'rework', label: '재작업' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setResultFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              resultFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-[#c8ced8] hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── 검사 이력 테이블 ── */}
      <div className="bg-white rounded-xl border border-[#c8ced8] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#e8ecf2] text-slate-700">
              <th className="text-left px-4 py-3 font-semibold">작업지시번호</th>
              <th className="text-left px-4 py-3 font-semibold">품목</th>
              <th className="text-right px-4 py-3 font-semibold">검사수량</th>
              <th className="text-right px-4 py-3 font-semibold">합격</th>
              <th className="text-right px-4 py-3 font-semibold">불합격</th>
              <th className="text-center px-4 py-3 font-semibold">결과</th>
              <th className="text-left px-4 py-3 font-semibold">비고</th>
              <th className="text-left px-4 py-3 font-semibold">검사자</th>
              <th className="text-left px-4 py-3 font-semibold">검사일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8ecf2]">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-400">로딩 중...</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-400">검사 이력이 없습니다</td></tr>
            ) : (
              inspections.map((qc) => {
                const rs = RESULT_STYLE[qc.result] || { label: qc.result, color: 'text-slate-600', bg: 'bg-slate-100' };
                return (
                  <tr key={qc.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-xs">{qc.wo_no || '-'}</td>
                    <td className="px-4 py-3">{qc.product_name || '-'}</td>
                    <td className="px-4 py-3 text-right">{qc.inspected_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{qc.passed_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{qc.failed_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rs.bg} ${rs.color}`}>
                        {rs.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">{qc.notes || '-'}</td>
                    <td className="px-4 py-3">{qc.inspector_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {qc.inspected_at ? new Date(qc.inspected_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 등록 모달 ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">QC 검사 등록</h2>

            {/* 작업지시서 선택 */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">작업지시서 (QC대기)</label>
              <select
                className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm"
                value={form.work_order_id}
                onChange={(e) => handleWoSelect(e.target.value)}
              >
                <option value="">선택하세요</option>
                {qcWaitOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>
                    {wo.wo_no} — {wo.product_name || '품목'} (계획: {wo.planned_qty})
                  </option>
                ))}
              </select>
              {qcWaitOrders.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">QC대기 상태의 작업지시서가 없습니다</p>
              )}
            </div>

            {/* 수량 입력 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">검사수량</label>
                <input
                  type="number" min={0}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm"
                  value={form.inspected_qty}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setForm(prev => ({ ...prev, inspected_qty: v, passed_qty: v, failed_qty: 0 }));
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">합격수량</label>
                <input
                  type="number" min={0} max={form.inspected_qty}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm"
                  value={form.passed_qty}
                  onChange={(e) => handlePassedChange(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">불합격수량</label>
                <input
                  type="number" readOnly
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm bg-slate-50"
                  value={form.failed_qty}
                />
              </div>
            </div>

            {/* 합격률 표시 */}
            {form.inspected_qty > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(form.passed_qty / form.inspected_qty) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-600">
                  {((form.passed_qty / form.inspected_qty) * 100).toFixed(1)}%
                </span>
              </div>
            )}

            {/* 결과 선택 */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">검사 결과</label>
              <div className="flex gap-2">
                {(['pass', 'fail', 'rework'] as const).map(r => {
                  const rs = RESULT_STYLE[r];
                  return (
                    <button
                      key={r}
                      onClick={() => setForm(prev => ({ ...prev, result: r }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        form.result === r
                          ? `${rs.bg} ${rs.color} border-current`
                          : 'bg-white text-slate-500 border-[#c8ced8] hover:bg-slate-50'
                      }`}
                    >
                      {rs.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">비고</label>
              <textarea
                className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="불합격 사유, 특이사항 등"
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-[#c8ced8] rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                검사 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
