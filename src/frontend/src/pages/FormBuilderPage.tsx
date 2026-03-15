/**
 * 동적 폼 빌더 페이지 — 모듈별 커스텀 폼 필드 구성 관리
 * 관리자가 폼 필드를 추가/수정/삭제/정렬하여 JSON으로 저장합니다.
 * 시안 C 기반 디자인 (슬레이트 블루그레이 + 에메랄드 액센트)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  fetchFormConfigs,
  createFormConfig,
  updateFormConfig,
  deleteFormConfig,
  type FormConfig,
  type FormFieldConfig,
  type FormConfigCreateData,
} from '../api/formConfigs';
import { useAuthStore } from '../stores/authStore';

/** 모듈 한글 매핑 */
const MODULE_LABELS: Record<string, string> = {
  M1: '시스템 관리',
  M2: '영업/수주',
  M3: '인사/급여',
  M4: '재무/회계',
  M5: '생산/SCM',
  M6: '그룹웨어',
  M7: '알림 센터',
};

/** 필드 유형 한글 매핑 */
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  number: '숫자',
  date: '날짜',
  select: '선택 (드롭다운)',
  checkbox: '체크박스',
  textarea: '긴 텍스트',
  email: '이메일',
  phone: '전화번호',
};

/** 너비 한글 매핑 */
const WIDTH_LABELS: Record<string, string> = {
  full: '전체 너비',
  half: '절반 (1/2)',
  third: '1/3 너비',
};

/** 빈 필드 초기값 */
const EMPTY_FIELD: FormFieldConfig = {
  key: '',
  label: '',
  field_type: 'text',
  required: false,
  placeholder: '',
  default_value: '',
  options: [],
  sort_order: 0,
  width: 'full',
  description: '',
};

export default function FormBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // 목록 상태
  const [configs, setConfigs] = useState<FormConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<string>('');

  // 편집 모달 상태
  const [showEditor, setShowEditor] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FormConfig | null>(null);
  const [formModule, setFormModule] = useState('M1');
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<FormFieldConfig[]>([]);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 미리보기 모달
  const [showPreview, setShowPreview] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<FormConfig | null>(null);

  // 목록 조회
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFormConfigs(moduleFilter || undefined);
      setConfigs(data);
    } catch {
      // 에러 무시 (목록 비어있을 수 있음)
    } finally {
      setLoading(false);
    }
  }, [moduleFilter]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  // 새 폼 구성 만들기
  const handleCreate = () => {
    setEditingConfig(null);
    setFormModule('M1');
    setFormName('');
    setFields([]);
    setEditingFieldIndex(null);
    setError('');
    setShowEditor(true);
  };

  // 기존 폼 구성 편집
  const handleEdit = (config: FormConfig) => {
    setEditingConfig(config);
    setFormModule(config.module);
    setFormName(config.form_name);
    setFields(config.config_json.fields || []);
    setEditingFieldIndex(null);
    setError('');
    setShowEditor(true);
  };

  // 삭제 (비활성화)
  const handleDelete = async (config: FormConfig) => {
    if (!confirm(`'${config.module}/${config.form_name}' 폼 구성을 비활성화하시겠습니까?`)) return;
    try {
      await deleteFormConfig(config.id);
      loadConfigs();
    } catch {
      alert('삭제 중 오류가 발생했습니다');
    }
  };

  // 필드 추가
  const handleAddField = () => {
    const newField: FormFieldConfig = {
      ...EMPTY_FIELD,
      sort_order: fields.length,
      key: `field_${fields.length + 1}`,
    };
    setFields([...fields, newField]);
    setEditingFieldIndex(fields.length);
  };

  // 필드 삭제
  const handleRemoveField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    // sort_order 재정렬
    updated.forEach((f, i) => { f.sort_order = i; });
    setFields(updated);
    if (editingFieldIndex === index) setEditingFieldIndex(null);
    else if (editingFieldIndex !== null && editingFieldIndex > index) {
      setEditingFieldIndex(editingFieldIndex - 1);
    }
  };

  // 필드 순서 변경
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    newFields.forEach((f, i) => { f.sort_order = i; });
    setFields(newFields);

    // 편집 중인 필드도 따라 이동
    if (editingFieldIndex === index) setEditingFieldIndex(targetIndex);
    else if (editingFieldIndex === targetIndex) setEditingFieldIndex(index);
  };

  // 필드 속성 변경
  const handleFieldChange = (index: number, key: keyof FormFieldConfig, value: unknown) => {
    const updated = [...fields];
    (updated[index] as unknown as Record<string, unknown>)[key] = value;
    setFields(updated);
  };

  // 저장
  const handleSave = async () => {
    setError('');

    if (!formName.trim()) {
      setError('폼 이름을 입력해주세요');
      return;
    }
    if (fields.length === 0) {
      setError('필드를 1개 이상 추가해주세요');
      return;
    }
    // 필드 키 중복 확인
    const keys = fields.map(f => f.key);
    const duplicateKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicateKeys.length > 0) {
      setError(`필드 키가 중복되었습니다: ${duplicateKeys.join(', ')}`);
      return;
    }
    // 빈 키/라벨 확인
    const emptyField = fields.find(f => !f.key.trim() || !f.label.trim());
    if (emptyField) {
      setError('모든 필드의 키와 표시명은 필수입니다');
      return;
    }

    setSaving(true);
    try {
      if (editingConfig) {
        await updateFormConfig(editingConfig.id, { fields });
      } else {
        const data: FormConfigCreateData = {
          module: formModule,
          form_name: formName.trim(),
          fields,
        };
        await createFormConfig(data);
      }
      setShowEditor(false);
      loadConfigs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // 미리보기 열기
  const handlePreview = (config: FormConfig) => {
    setPreviewConfig(config);
    setShowPreview(true);
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/system')} className="p-1.5 hover:bg-[#d0d6de] rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">동적 폼 빌더</h1>
          <p className="text-sm text-slate-500">모듈별 커스텀 입력 필드를 구성합니다</p>
        </div>
      </div>

      {/* 필터 + 추가 버튼 */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#c8ced8] bg-[#e8ecf2] text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">전체 모듈</option>
          {Object.entries(MODULE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{k} — {v}</option>
          ))}
        </select>

        {isAdmin && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            새 폼 구성
          </button>
        )}
      </div>

      {/* 폼 구성 목록 */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">불러오는 중...</div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Cog6ToothIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>등록된 폼 구성이 없습니다</p>
          {isAdmin && <p className="text-xs mt-1">"새 폼 구성" 버튼으로 추가하세요</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`bg-[#e8ecf2] rounded-xl p-5 border border-[#c8ced8] ${
                config.is_active ? '' : 'opacity-50'
              }`}
            >
              {/* 카드 헤더 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="inline-block px-2 py-0.5 text-xs font-bold rounded bg-blue-100 text-blue-700 mb-1">
                    {config.module}
                  </span>
                  <h3 className="font-bold text-slate-700">{config.form_name}</h3>
                </div>
                <span className="text-xs text-slate-400">v{config.version}</span>
              </div>

              {/* 필드 요약 */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1.5">
                  필드 {config.config_json.fields?.length || 0}개
                  {!config.is_active && ' · 비활성'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(config.config_json.fields || []).slice(0, 5).map((f) => (
                    <span
                      key={f.key}
                      className="inline-block px-2 py-0.5 text-xs rounded bg-slate-200 text-slate-600"
                    >
                      {f.label}
                    </span>
                  ))}
                  {(config.config_json.fields || []).length > 5 && (
                    <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-200 text-slate-400">
                      +{(config.config_json.fields || []).length - 5}
                    </span>
                  )}
                </div>
              </div>

              {/* 카드 액션 */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#c8ced8]">
                <button
                  onClick={() => handlePreview(config)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-[#d0d6de] rounded-lg transition-colors"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                  미리보기
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleEdit(config)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      편집
                    </button>
                    {config.is_active && (
                      <button
                        onClick={() => handleDelete(config)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        비활성화
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 폼 편집기 모달 ─── */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-[#eef1f5] rounded-2xl shadow-2xl w-full max-w-4xl mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#c8ced8]">
              <h2 className="text-lg font-bold text-slate-800">
                {editingConfig ? '폼 구성 편집' : '새 폼 구성 만들기'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-[#d0d6de] rounded-lg">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              {/* 에러 메시지 */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              {/* 모듈/폼이름 설정 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">모듈 *</label>
                  <select
                    value={formModule}
                    onChange={(e) => setFormModule(e.target.value)}
                    disabled={!!editingConfig}
                    className="w-full px-3 py-2 rounded-lg border border-[#c8ced8] bg-white text-sm disabled:opacity-50"
                  >
                    {Object.entries(MODULE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">폼 이름 *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={!!editingConfig}
                    placeholder="예: customer_extra, product_spec"
                    className="w-full px-3 py-2 rounded-lg border border-[#c8ced8] bg-white text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 필드 목록 + 편집 영역 */}
              <div className="grid grid-cols-5 gap-4">
                {/* 왼쪽: 필드 목록 */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-700">필드 목록</h3>
                    <button
                      onClick={handleAddField}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      필드 추가
                    </button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-[#c8ced8] rounded-lg">
                      <DocumentDuplicateIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      필드를 추가하세요
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {fields.map((field, index) => (
                        <div
                          key={index}
                          onClick={() => setEditingFieldIndex(index)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            editingFieldIndex === index
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-[#c8ced8] bg-white hover:bg-slate-50'
                          }`}
                        >
                          {/* 순서 변경 버튼 */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveField(index, 'up'); }}
                              disabled={index === 0}
                              className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                            >
                              <ArrowUpIcon className="w-3 h-3 text-slate-500" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveField(index, 'down'); }}
                              disabled={index === fields.length - 1}
                              className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                            >
                              <ArrowDownIcon className="w-3 h-3 text-slate-500" />
                            </button>
                          </div>

                          {/* 필드 정보 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {field.label || '(이름 없음)'}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {field.key} · {FIELD_TYPE_LABELS[field.field_type] || field.field_type}
                            </p>
                          </div>

                          {/* 삭제 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveField(index); }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 오른쪽: 필드 속성 편집 */}
                <div className="col-span-3">
                  {editingFieldIndex !== null && fields[editingFieldIndex] ? (
                    <FieldPropertyEditor
                      field={fields[editingFieldIndex]}
                      onChange={(key, value) => handleFieldChange(editingFieldIndex, key, value)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm border border-dashed border-[#c8ced8] rounded-lg min-h-[200px]">
                      왼쪽에서 필드를 선택하면 속성을 편집할 수 있습니다
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#c8ced8]">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-[#d0d6de] rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : (editingConfig ? '수정' : '등록')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 미리보기 모달 ─── */}
      {showPreview && previewConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-[#eef1f5] rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#c8ced8]">
              <h2 className="text-lg font-bold text-slate-800">
                폼 미리보기 — {previewConfig.module}/{previewConfig.form_name}
              </h2>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-[#d0d6de] rounded-lg">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              <FormPreview fields={previewConfig.config_json.fields || []} />
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-[#c8ced8]">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-[#d0d6de] rounded-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/** 필드 속성 편집 컴포넌트 */
function FieldPropertyEditor({
  field,
  onChange,
}: {
  field: FormFieldConfig;
  onChange: (key: keyof FormFieldConfig, value: unknown) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#c8ced8] p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-700 mb-3">필드 속성</h3>

      {/* 키 + 표시명 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">필드 키 (영문) *</label>
          <input
            type="text"
            value={field.key}
            onChange={(e) => onChange('key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="예: manager_name"
            className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">표시명 (한국어) *</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onChange('label', e.target.value)}
            placeholder="예: 담당 영업사원"
            className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
          />
        </div>
      </div>

      {/* 필드 유형 + 너비 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">필드 유형 *</label>
          <select
            value={field.field_type}
            onChange={(e) => onChange('field_type', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">너비</label>
          <select
            value={field.width}
            onChange={(e) => onChange('width', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
          >
            {Object.entries(WIDTH_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 필수 여부 + 기본값 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="field-required"
            checked={field.required}
            onChange={(e) => onChange('required', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600"
          />
          <label htmlFor="field-required" className="text-sm text-slate-600">필수 입력</label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">기본값</label>
          <input
            type="text"
            value={field.default_value || ''}
            onChange={(e) => onChange('default_value', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
          />
        </div>
      </div>

      {/* 힌트 텍스트 */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">입력 힌트 (placeholder)</label>
        <input
          type="text"
          value={field.placeholder || ''}
          onChange={(e) => onChange('placeholder', e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
        />
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">필드 설명 (도움말)</label>
        <input
          type="text"
          value={field.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
        />
      </div>

      {/* select 유형일 때: 선택지 목록 */}
      {field.field_type === 'select' && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            선택지 목록 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={(field.options || []).join(', ')}
            onChange={(e) => onChange('options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="예: 옵션1, 옵션2, 옵션3"
            className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
          />
        </div>
      )}

      {/* text/textarea: 길이 제한 */}
      {(field.field_type === 'text' || field.field_type === 'textarea') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">최소 길이</label>
            <input
              type="number"
              value={field.min_length ?? ''}
              onChange={(e) => onChange('min_length', e.target.value ? Number(e.target.value) : undefined)}
              min={0}
              className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">최대 길이</label>
            <input
              type="number"
              value={field.max_length ?? ''}
              onChange={(e) => onChange('max_length', e.target.value ? Number(e.target.value) : undefined)}
              min={1}
              className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
            />
          </div>
        </div>
      )}

      {/* number: 범위 제한 */}
      {field.field_type === 'number' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">최소값</label>
            <input
              type="number"
              value={field.min_value ?? ''}
              onChange={(e) => onChange('min_value', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">최대값</label>
            <input
              type="number"
              value={field.max_value ?? ''}
              onChange={(e) => onChange('max_value', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#c8ced8] text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}


/** 폼 미리보기 컴포넌트 — 설정된 필드를 실제 폼처럼 렌더링 */
function FormPreview({ fields }: { fields: FormFieldConfig[] }) {
  if (fields.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">필드가 없습니다</p>;
  }

  // 너비에 따른 CSS 클래스
  const widthClass = (w: string) => {
    switch (w) {
      case 'half': return 'col-span-1';
      case 'third': return 'col-span-1';
      default: return 'col-span-2';
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map((field) => (
        <div key={field.key} className={widthClass(field.width)}>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {field.field_type === 'textarea' ? (
            <textarea
              placeholder={field.placeholder || ''}
              defaultValue={field.default_value || ''}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#c8ced8] bg-white text-sm"
            />
          ) : field.field_type === 'select' ? (
            <select className="w-full px-3 py-2 rounded-lg border border-[#c8ced8] bg-white text-sm">
              <option value="">선택하세요</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.field_type === 'checkbox' ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                defaultChecked={field.default_value === 'true'}
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-500">{field.placeholder || field.label}</span>
            </div>
          ) : (
            <input
              type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
              placeholder={field.placeholder || ''}
              defaultValue={field.default_value || ''}
              className="w-full px-3 py-2 rounded-lg border border-[#c8ced8] bg-white text-sm"
            />
          )}

          {field.description && (
            <p className="text-xs text-slate-400 mt-1">{field.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
