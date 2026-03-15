/**
 * 동적 폼 빌더 API — 백엔드 /api/v1/system/form-configs 와 통신하는 함수들
 */
import api from './client';

/** 폼 필드 구성 타입 */
export interface FormFieldConfig {
  key: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'email' | 'phone';
  required: boolean;
  placeholder?: string;
  default_value?: string;
  options?: string[];
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  sort_order: number;
  width: 'full' | 'half' | 'third';
  description?: string;
}

/** 폼 구성 응답 타입 */
export interface FormConfig {
  id: string;
  module: string;
  form_name: string;
  config_json: { fields: FormFieldConfig[] };
  version: number;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

/** 폼 구성 생성 요청 */
export interface FormConfigCreateData {
  module: string;
  form_name: string;
  fields: FormFieldConfig[];
}

/** 폼 구성 수정 요청 */
export interface FormConfigUpdateData {
  fields: FormFieldConfig[];
  is_active?: boolean;
}

/** 폼 구성 목록 조회 */
export async function fetchFormConfigs(module?: string, is_active?: boolean) {
  const params: Record<string, string | boolean> = {};
  if (module) params.module = module;
  if (is_active !== undefined) params.is_active = is_active;
  const res = await api.get('/system/form-configs', { params });
  return res.data.data as FormConfig[];
}

/** 모듈+폼이름으로 폼 구성 조회 (렌더링용) */
export async function fetchFormConfigByName(module: string, form_name: string) {
  const res = await api.get('/system/form-configs/by-name', { params: { module, form_name } });
  return res.data.data as FormConfig | null;
}

/** 폼 구성 상세 조회 */
export async function fetchFormConfig(id: string) {
  const res = await api.get(`/system/form-configs/${id}`);
  return res.data.data as FormConfig;
}

/** 폼 구성 생성 */
export async function createFormConfig(data: FormConfigCreateData) {
  const res = await api.post('/system/form-configs', data);
  return res.data;
}

/** 폼 구성 수정 */
export async function updateFormConfig(id: string, data: FormConfigUpdateData) {
  const res = await api.put(`/system/form-configs/${id}`, data);
  return res.data;
}

/** 폼 구성 삭제 (비활성화) */
export async function deleteFormConfig(id: string) {
  const res = await api.delete(`/system/form-configs/${id}`);
  return res.data;
}
