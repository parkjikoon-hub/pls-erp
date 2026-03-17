/**
 * PDF 발주서 OCR 모달
 * 3단계 Human-in-the-Loop 흐름:
 * 1. PDF/이미지 드래그앤드롭 업로드
 * 2. AI 추출 결과 표시 → 사용자가 수정 가능
 * 3. 확인 → 수주 자동 생성
 */
import { useState, useRef, useCallback } from 'react';
import api from '../api/client';

interface OcrLine {
  product_name: string;
  specification: string;
  quantity: number;
  unit_price: number;
  remark: string;
}

interface OcrResult {
  customer_name: string;
  order_date: string;
  delivery_date: string | null;
  lines: OcrLine[];
  notes: string;
}

interface Props {
  customers: { id: string; name: string }[];
  onClose: () => void;
  onOrderCreated: () => void;
}

type Step = 'upload' | 'review' | 'done';

export default function PdfOcrModal({ customers, onClose, onOrderCreated }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState(0);

  /* OCR 추출 데이터 */
  const [ocrData, setOcrData] = useState<OcrResult | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [autoCreateWo, setAutoCreateWo] = useState(false);

  /* 생성 결과 */
  const [createResult, setCreateResult] = useState<any>(null);

  /* 드래그앤드롭 */
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Step 1: 파일 업로드 + OCR ── */
  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    if (!allowed.includes(ext)) {
      setError(`지원하지 않는 파일 형식입니다. (${allowed.join(', ')} 만 가능)`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기가 10MB를 초과했습니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/sales/ocr/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = data?.data || data;
      if (result.success && result.data) {
        setOcrData(result.data);
        setConfidence(result.confidence || 0);
        // 거래처 자동 매칭
        const matched = customers.find(
          (c) => c.name === result.data.customer_name
        );
        setSelectedCustomerId(matched?.id || '');
        setStep('review');
      } else {
        setError(result.message || 'OCR 처리에 실패했습니다.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'OCR 업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [customers]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  /* ── Step 2: 추출 결과 수정 ── */
  const updateLine = (idx: number, field: keyof OcrLine, value: any) => {
    if (!ocrData) return;
    const lines = [...ocrData.lines];
    lines[idx] = { ...lines[idx], [field]: value };
    setOcrData({ ...ocrData, lines });
  };

  const addLine = () => {
    if (!ocrData) return;
    setOcrData({
      ...ocrData,
      lines: [...ocrData.lines, { product_name: '', specification: '', quantity: 1, unit_price: 0, remark: '' }],
    });
  };

  const removeLine = (idx: number) => {
    if (!ocrData || ocrData.lines.length <= 1) return;
    setOcrData({
      ...ocrData,
      lines: ocrData.lines.filter((_, i) => i !== idx),
    });
  };

  /* ── Step 3: 확정 → 수주 생성 ── */
  const handleConfirm = async () => {
    if (!ocrData || !selectedCustomerId) {
      setError('거래처를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        order_date: ocrData.order_date || new Date().toISOString().slice(0, 10),
        delivery_date: ocrData.delivery_date || undefined,
        customer_id: selectedCustomerId,
        notes: ocrData.notes || 'AI OCR 발주서 인식으로 생성',
        auto_create_wo: autoCreateWo,
        lines: ocrData.lines.map((l) => ({
          product_name: l.product_name,
          specification: l.specification || undefined,
          quantity: l.quantity,
          unit_price: l.unit_price,
          remark: l.remark || undefined,
        })),
      };

      const { data } = await api.post('/sales/ocr/confirm', payload);
      const result = data?.data || data;
      setCreateResult(result);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.detail || '수주 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const calcTotal = () => {
    if (!ocrData) return { supply: 0, tax: 0, total: 0 };
    const supply = ocrData.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const tax = Math.round(supply * 0.1);
    return { supply, tax, total: supply + tax };
  };

  const totals = calcTotal();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">발주서 AI OCR</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'upload' && 'PDF 또는 이미지 파일을 업로드하세요'}
              {step === 'review' && 'AI 추출 결과를 확인하고 수정하세요'}
              {step === 'done' && '수주가 생성되었습니다'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-2 mb-5">
          {['업로드', '검토/수정', '완료'].map((label, i) => {
            const stepIdx = i;
            const currentIdx = step === 'upload' ? 0 : step === 'review' ? 1 : 2;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  stepIdx <= currentIdx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
                }`}>{i + 1}</div>
                <span className={`text-sm ${stepIdx <= currentIdx ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  {label}
                </span>
                {i < 2 && <div className={`w-8 h-0.5 ${stepIdx < currentIdx ? 'bg-blue-600' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Step 1: 업로드 ── */}
        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {loading ? (
              <div>
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-slate-600 font-medium">AI가 발주서를 분석하고 있습니다...</p>
                <p className="text-xs text-slate-400 mt-1">잠시만 기다려주세요</p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-medium text-slate-700">발주서 파일을 여기에 드래그하거나 클릭하세요</p>
                <p className="text-xs text-slate-400 mt-2">PDF, PNG, JPG, JPEG, WEBP (최대 10MB)</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={onFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* ── Step 2: 검토/수정 ── */}
        {step === 'review' && ocrData && (
          <div>
            {/* 신뢰도 바 */}
            <div className="mb-4 flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">AI 인식 신뢰도:</span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${confidence >= 0.8 ? 'bg-emerald-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${confidence >= 0.8 ? 'text-emerald-600' : confidence >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>

            {/* 헤더 정보 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">거래처 *</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">선택 (AI 추출: {ocrData.customer_name})</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">수주일</label>
                <input
                  type="date"
                  value={ocrData.order_date || ''}
                  onChange={(e) => setOcrData({ ...ocrData, order_date: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">납기일</label>
                <input
                  type="date"
                  value={ocrData.delivery_date || ''}
                  onChange={(e) => setOcrData({ ...ocrData, delivery_date: e.target.value || null })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">비고</label>
                <input
                  value={ocrData.notes || ''}
                  onChange={(e) => setOcrData({ ...ocrData, notes: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-1.5 text-sm"
                  placeholder="특이사항"
                />
              </div>
            </div>

            {/* 품목 라인 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">추출된 품목 ({ocrData.lines.length}건)</h3>
                <button onClick={addLine} className="text-xs px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">
                  + 라인 추가
                </button>
              </div>
              <div className="space-y-2">
                {ocrData.lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-(--bg-hover) rounded-lg p-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-0.5">품목명</label>
                      <input
                        value={line.product_name}
                        onChange={(e) => updateLine(idx, 'product_name', e.target.value)}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-slate-500 mb-0.5">규격</label>
                      <input
                        value={line.specification}
                        onChange={(e) => updateLine(idx, 'specification', e.target.value)}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-0.5">수량</label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-slate-500 mb-0.5">단가</label>
                      <input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))}
                        className="w-full border border-(--border-main) rounded px-2 py-1 text-sm text-right"
                      />
                    </div>
                    <div className="w-24 text-right">
                      <label className="block text-xs text-slate-500 mb-0.5">금액</label>
                      <div className="text-sm font-medium text-slate-700 py-1">
                        {Math.round(line.quantity * line.unit_price).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-red-400 hover:text-red-600 text-lg pb-1"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 합계 */}
            <div className="flex justify-end gap-6 text-sm mb-4 border-t border-[#e8ecf2] pt-3">
              <div>공급가: <span className="font-semibold">{totals.supply.toLocaleString()}</span></div>
              <div>부가세: <span className="font-semibold">{totals.tax.toLocaleString()}</span></div>
              <div>합계: <span className="font-bold text-blue-600">{totals.total.toLocaleString()}</span></div>
            </div>

            {/* 자동 WO 옵션 */}
            <div className="flex items-center gap-2 mb-4 bg-amber-50 rounded-lg px-4 py-3 border border-amber-200">
              <input
                type="checkbox"
                id="ocr_auto_wo"
                checked={autoCreateWo}
                onChange={(e) => setAutoCreateWo(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="ocr_auto_wo" className="text-sm text-amber-800 font-medium cursor-pointer">
                작업지시서 자동 생성
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex justify-between">
              <button
                onClick={() => { setStep('upload'); setOcrData(null); setError(''); }}
                className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >다시 업로드</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50">취소</button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || !selectedCustomerId || ocrData.lines.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '생성 중...' : '수주 확정'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: 완료 ── */}
        {step === 'done' && createResult && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-emerald-700 mb-2">수주가 생성되었습니다</h3>
            <p className="text-sm text-slate-600 mb-4">
              수주번호: <span className="font-semibold">{createResult.order_no}</span>
            </p>

            {/* 자동 WO 결과 */}
            {createResult.work_orders && createResult.work_orders.length > 0 && (
              <div className="text-left mb-4">
                <h4 className="text-sm font-semibold text-emerald-700 mb-2">생성된 작업지시서 ({createResult.work_orders.length}건)</h4>
                <div className="space-y-1">
                  {createResult.work_orders.map((wo: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm bg-emerald-50 rounded px-3 py-2">
                      <span className="font-medium">{wo.wo_no}</span>
                      <span className="text-emerald-600">{wo.product_name} — {wo.qty}개</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createResult.has_shortage && createResult.material_shortage && (
              <div className="text-left mb-4">
                <h4 className="text-sm font-semibold text-red-700 mb-2">원자재 부족 ({createResult.material_shortage.length}건)</h4>
                <div className="space-y-1">
                  {createResult.material_shortage.map((m: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm bg-red-50 rounded px-3 py-2">
                      <span>{m.product_name}</span>
                      <span className="text-red-600">부족: {m.shortage_qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => { onOrderCreated(); onClose(); }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >확인</button>
          </div>
        )}
      </div>
    </div>
  );
}
