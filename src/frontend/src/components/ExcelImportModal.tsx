/**
 * Excel 일괄 업로드 모달 — 공통 컴포넌트
 * 이카운트 등 외부 ERP에서 엑셀로 내보낸 데이터를 PLS ERP로 가져옵니다.
 *
 * 3단계 흐름:
 *   1. 파일 업로드 → 컬럼 자동 인식
 *   2. 컬럼 매핑 확인/수정 → 미리보기
 *   3. 일괄 등록 → 결과 확인
 */
import { useState, useRef } from 'react';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import api from '../api/client';

/** 컬럼 매핑 정보 */
interface ColumnMapping {
  excel_column: string;
  target_field: string | null;
}

/** PLS ERP 필드 정보 */
interface TargetField {
  field_name: string;
  display_name: string;
  required: boolean;
}

/** 분석 결과 */
interface AnalyzeResult {
  sheets: string[];
  selected_sheet: string;
  headers: string[];
  preview_rows: string[][];
  total_rows: number;
  mappings: ColumnMapping[];
  target_fields: TargetField[];
  module: string;
}

/** 미리보기 결과 */
interface PreviewResult {
  valid_count: number;
  error_count: number;
  valid_preview: Record<string, unknown>[];
  errors: { row: number | null; data: Record<string, unknown>; errors: string[] }[];
  total_rows: number;
}

/** 실행 결과 */
interface ExecuteResult {
  success_count: number;
  skip_count: number;
  error_count: number;
  errors: { row: number | null; data: Record<string, unknown>; errors: string[] }[];
  total_rows: number;
}

interface Props {
  module: string;        // "customers", "products" 등
  moduleName: string;    // "거래처", "품목" 등 (화면 표시용)
  onClose: () => void;
  onComplete: () => void; // 완료 후 목록 새로고침용
}

type Step = 'upload' | 'mapping' | 'result';

export default function ExcelImportModal({ module, moduleName, onClose, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 파일 상태
  const [file, setFile] = useState<File | null>(null);

  // 분석 결과
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // 미리보기 결과
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  // 실행 결과
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);

  // ── Step 1: 파일 업로드 + 분석 ──
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('module', module);

      const res = await api.post('/system/import/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.status === 'error') {
        setError(res.data.detail || '파일 분석 실패');
        return;
      }

      const result = res.data.data as AnalyzeResult;
      setAnalyzeResult(result);
      setMappings(result.mappings);
      setStep('mapping');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '파일 업로드 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: 매핑 수정 ──
  const updateMapping = (index: number, targetField: string | null) => {
    setMappings(prev => prev.map((m, i) =>
      i === index ? { ...m, target_field: targetField || null } : m
    ));
  };

  // ── Step 2→3: 미리보기 + 실행 ──
  const handleExecute = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      // 미리보기로 검증
      const previewForm = new FormData();
      previewForm.append('file', file);
      previewForm.append('module', module);
      previewForm.append('mappings_json', JSON.stringify(mappings));

      const previewRes = await api.post('/system/import/preview', previewForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const preview = previewRes.data.data as PreviewResult;
      setPreviewResult(preview);

      if (preview.valid_count === 0) {
        setError('등록 가능한 데이터가 없습니다. 매핑을 확인해주세요.');
        setLoading(false);
        return;
      }

      // 실제 등록
      const execForm = new FormData();
      execForm.append('file', file);
      execForm.append('module', module);
      execForm.append('mappings_json', JSON.stringify(mappings));

      const execRes = await api.post('/system/import/execute', execForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = execRes.data.data as ExecuteResult;
      setExecuteResult(result);
      setStep('result');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || '등록 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // ── 완료 ──
  const handleDone = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-(--border-main)">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-main) flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <DocumentArrowUpIcon className="w-5 h-5 text-emerald-500" />
              {moduleName} Excel 일괄 업로드
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">이카운트 등 외부 엑셀 데이터를 PLS ERP로 가져옵니다</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-(--bg-main) rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-(--border-main) flex-shrink-0">
          {[
            { key: 'upload', label: '1. 파일 선택' },
            { key: 'mapping', label: '2. 컬럼 매핑' },
            { key: 'result', label: '3. 결과 확인' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <ArrowRightIcon className="w-3 h-3 text-slate-400" />}
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                step === s.key
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400'
              }`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: 파일 업로드 ── */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full max-w-sm border-2 border-dashed border-(--border-main) rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
              >
                <ArrowUpTrayIcon className="w-12 h-12 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Excel 파일을 선택해주세요</p>
                  <p className="text-xs text-slate-400 mt-1">.xlsx 형식 · 최대 10MB</p>
                </div>
              </div>
              {loading && (
                <p className="mt-4 text-sm text-emerald-600">파일 분석 중...</p>
              )}
              <div className="mt-6 text-xs text-slate-400 text-center space-y-1">
                <p>이카운트 ERP에서 엑셀로 내보내기 한 파일을 그대로 업로드하세요.</p>
                <p>컬럼명이 달라도 자동으로 매칭합니다.</p>
              </div>
            </div>
          )}

          {/* ── Step 2: 컬럼 매핑 ── */}
          {step === 'mapping' && analyzeResult && (
            <div className="space-y-4">
              {/* 파일 요약 */}
              <div className="bg-white rounded-lg p-3 border border-(--border-main) text-sm">
                <span className="text-slate-500">파일:</span>{' '}
                <span className="font-medium text-slate-700">{file?.name}</span>
                <span className="text-slate-400 ml-3">시트: {analyzeResult.selected_sheet}</span>
                <span className="text-slate-400 ml-3">총 {analyzeResult.total_rows}행</span>
              </div>

              {/* 매핑 테이블 */}
              <div className="bg-white rounded-lg border border-(--border-main) overflow-hidden">
                <div className="grid grid-cols-[1fr,auto,1fr] gap-0 items-center bg-(--bg-main) px-4 py-2 text-xs font-semibold text-slate-600">
                  <span>엑셀 컬럼명</span>
                  <span className="px-4">→</span>
                  <span>PLS ERP 필드</span>
                </div>
                {mappings.map((m, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr,auto,1fr] gap-0 items-center px-4 py-2 border-t border-(--border-main)"
                  >
                    <span className="text-sm text-slate-700">{m.excel_column}</span>
                    <span className="px-4 text-slate-400">→</span>
                    <select
                      value={m.target_field || ''}
                      onChange={(e) => updateMapping(idx, e.target.value || null)}
                      className={`text-sm px-2 py-1.5 rounded border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500 ${
                        m.target_field ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      <option value="">(무시)</option>
                      {analyzeResult.target_fields.map((f) => (
                        <option key={f.field_name} value={f.field_name}>
                          {f.display_name} {f.required ? '*' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* 미리보기 테이블 */}
              {analyzeResult.preview_rows.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">데이터 미리보기 (처음 5행)</h3>
                  <div className="overflow-x-auto bg-white rounded-lg border border-(--border-main)">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-(--bg-main)">
                          {analyzeResult.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analyzeResult.preview_rows.map((row, ri) => (
                          <tr key={ri} className="border-t border-(--border-main)">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-[150px] truncate">
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 검증 미리보기 결과 (있을 경우) */}
              {previewResult && (
                <div className="bg-white rounded-lg p-3 border border-(--border-main) text-sm">
                  <span className="text-emerald-600 font-medium">등록 가능: {previewResult.valid_count}건</span>
                  {previewResult.error_count > 0 && (
                    <span className="text-red-500 font-medium ml-4">오류: {previewResult.error_count}건</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: 결과 ── */}
          {step === 'result' && executeResult && (
            <div className="space-y-4 py-4">
              {/* 결과 요약 */}
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-600">{executeResult.success_count}</div>
                  <div className="text-xs text-slate-500 mt-1">등록 성공</div>
                </div>
                {executeResult.skip_count > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{executeResult.skip_count}</div>
                    <div className="text-xs text-slate-500 mt-1">건너뜀 (중복)</div>
                  </div>
                )}
                {executeResult.error_count > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-500">{executeResult.error_count}</div>
                    <div className="text-xs text-slate-500 mt-1">오류</div>
                  </div>
                )}
              </div>

              {/* 성공 메시지 */}
              {executeResult.success_count > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                  <span>{executeResult.success_count}건의 {moduleName} 데이터가 등록되었습니다.</span>
                </div>
              )}

              {/* 에러 상세 */}
              {executeResult.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">오류/건너뜀 상세</h3>
                  <div className="bg-white rounded-lg border border-(--border-main) max-h-[200px] overflow-y-auto">
                    {executeResult.errors.map((err, i) => (
                      <div key={i} className="px-4 py-2 border-b border-(--border-main) last:border-0 text-xs">
                        <span className="text-slate-500">
                          {err.data && typeof err.data === 'object' && 'code' in err.data
                            ? `[${err.data.code}] `
                            : ''}
                          {err.data && typeof err.data === 'object' && 'name' in err.data
                            ? String(err.data.name)
                            : `행 ${err.row || '?'}`}
                        </span>
                        <span className="text-red-500 ml-2">{err.errors.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-(--border-main) flex-shrink-0">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => { setStep('upload'); setFile(null); setAnalyzeResult(null); setError(''); }}
                className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                다시 선택
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'result' && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                취소
              </button>
            )}
            {step === 'mapping' && (
              <button
                onClick={handleExecute}
                disabled={loading || !mappings.some(m => m.target_field)}
                className="flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '등록 중...' : `${analyzeResult?.total_rows || 0}건 일괄 등록`}
              </button>
            )}
            {step === 'result' && (
              <button
                onClick={handleDone}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors"
              >
                완료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
