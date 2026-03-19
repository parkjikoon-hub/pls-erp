/**
 * 품목 관리 페이지 — 원자재/완제품/반제품 카드 UI + 목록 조회/등록/수정/삭제
 */
import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  type Product,
  type ProductFormData,
  type ProductCategory,
} from '../api/products';
import type { PaginatedResult } from '../api/customers';
import { useAuthStore } from '../stores/authStore';
import ExcelImportModal from '../components/ExcelImportModal';

/** 품목 유형 한글 매핑 */
const TYPE_LABELS: Record<string, string> = {
  product: '완제품',
  material: '원자재',
  semi: '반제품',
};

/** 카드 설정 (유형별 아이콘, 색상) */
const TYPE_CARDS = [
  {
    key: 'material',
    label: '원자재',
    icon: WrenchScrewdriverIcon,
    color: 'amber',
    bgClass: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    activeClass: 'bg-amber-100 border-amber-400 ring-2 ring-amber-300',
    iconClass: 'text-amber-600',
    countClass: 'text-amber-700',
  },
  {
    key: 'product',
    label: '완제품',
    icon: CubeIcon,
    color: 'emerald',
    bgClass: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    activeClass: 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300',
    iconClass: 'text-emerald-600',
    countClass: 'text-emerald-700',
  },
  {
    key: 'semi',
    label: '반제품',
    icon: CpuChipIcon,
    color: 'purple',
    bgClass: 'bg-purple-50 border-purple-200 hover:border-purple-400',
    activeClass: 'bg-purple-100 border-purple-400 ring-2 ring-purple-300',
    iconClass: 'text-purple-600',
    countClass: 'text-purple-700',
  },
];

/** 폼 초기값 */
const EMPTY_FORM: ProductFormData = {
  code: '',
  name: '',
  category_id: null,
  product_type: 'product',
  unit: 'EA',
  standard_price: 0,
  cost_price: 0,
  safety_stock: 0,
  inventory_method: 'fifo',
  tax_rate: 10,
};

export default function ProductsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  // 목록 상태
  const [data, setData] = useState<PaginatedResult<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 유형별 건수
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({ material: 0, product: 0, semi: 0 });

  // 카테고리 목록 (드롭다운용)
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 카테고리 추가 모달
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  // 삭제 확인 상태
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Excel 임포트 모달 상태
  const [showExcelModal, setShowExcelModal] = useState(false);

  // 카테고리 목록 불러오기
  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
    } catch {
      /* 카테고리 로딩 실패 시 빈 배열 유지 */
    }
  }, []);

  // 유형별 건수 불러오기
  const loadTypeCounts = useCallback(async () => {
    try {
      const [mat, prod, semi] = await Promise.all([
        fetchProducts({ product_type: 'material', size: 1 }),
        fetchProducts({ product_type: 'product', size: 1 }),
        fetchProducts({ product_type: 'semi', size: 1 }),
      ]);
      setTypeCounts({
        material: mat.total,
        product: prod.total,
        semi: semi.total,
      });
    } catch {
      /* 건수 로딩 실패 무시 */
    }
  }, []);

  // 품목 목록 불러오기
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProducts({
        page,
        size: 20,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        product_type: typeFilter || undefined,
        category_id: categoryFilter || undefined,
        is_active: activeFilter === '' ? undefined : activeFilter === 'true',
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, typeFilter, categoryFilter, activeFilter]);

  useEffect(() => {
    loadCategories();
    loadTypeCounts();
  }, [loadCategories, loadTypeCounts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 정렬 토글
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const sortIcon = (column: string) => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // 카테고리명 가져오기
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '-';
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? cat.name : '-';
  };

  // 카드 클릭 → 유형 필터 토글
  const handleCardClick = (type: string) => {
    if (typeFilter === type) {
      setTypeFilter('');
    } else {
      setTypeFilter(type);
    }
    setPage(1);
  };

  // 카드 내 "새로 등록" → 해당 유형 선택된 폼 열기
  const openCreateWithType = (type: string) => {
    setForm({ ...EMPTY_FORM, product_type: type });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  // 등록 모달 열기
  const openCreateModal = () => {
    setForm({ ...EMPTY_FORM, product_type: typeFilter || 'product' });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  // 수정 모달 열기
  const openEditModal = (p: Product) => {
    setForm({
      code: p.code,
      name: p.name,
      category_id: p.category_id,
      product_type: p.product_type,
      unit: p.unit,
      standard_price: p.standard_price,
      cost_price: p.cost_price,
      safety_stock: p.safety_stock,
      inventory_method: p.inventory_method,
      tax_rate: p.tax_rate,
    });
    setEditingId(p.id);
    setError('');
    setShowModal(true);
  };

  // 폼 필드 변경
  const handleChange = (field: keyof ProductFormData, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 저장 (생성 또는 수정)
  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('품목 코드와 품목명은 필수입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const { code: _, ...updateData } = form;
        await updateProduct(editingId, updateData);
      } else {
        await createProduct(form);
      }
      setShowModal(false);
      loadProducts();
      loadTypeCounts();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; code?: string };
      if (axiosErr.code === 'ECONNABORTED') {
        setError('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(axiosErr.response?.data?.detail || '저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  // 삭제 (비활성화)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      loadProducts();
      loadTypeCounts();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '삭제 중 오류가 발생했습니다.');
    }
  };

  // 카테고리 저장
  const handleSaveCategory = async () => {
    if (!categoryForm.code.trim() || !categoryForm.name.trim()) return;
    setSavingCategory(true);
    try {
      await createCategory(categoryForm);
      await loadCategories();
      setShowCategoryModal(false);
      setCategoryForm({ code: '', name: '' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || '카테고리 등록 중 오류가 발생했습니다.');
    } finally {
      setSavingCategory(false);
    }
  };

  // 금액 포맷팅
  const formatPrice = (value: number) => {
    return value.toLocaleString('ko-KR');
  };

  // 현재 선택된 유형의 라벨
  const currentTypeLabel = typeFilter ? TYPE_LABELS[typeFilter] : '전체 품목';

  return (
    <div>
      {/* 상단: 뒤로가기 + 제목 */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CubeIcon className="w-6 h-6 text-emerald-500" />
            품목 관리
          </h1>
          <p className="text-sm text-slate-500">제품 / 자재 / 반제품을 등록하고 관리합니다</p>
        </div>
      </div>

      {/* 유형별 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {TYPE_CARDS.map((card) => {
          const Icon = card.icon;
          const isActive = typeFilter === card.key;
          return (
            <div
              key={card.key}
              onClick={() => handleCardClick(card.key)}
              className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all duration-200 ${
                isActive ? card.activeClass : card.bgClass
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center bg-white/70 shadow-sm`}>
                    <Icon className={`w-6 h-6 ${card.iconClass}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{card.label}</h3>
                    <p className={`text-2xl font-bold ${card.countClass}`}>{typeCounts[card.key]}건</p>
                  </div>
                </div>
                {isManager && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openCreateWithType(card.key); }}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
                  >
                    + 등록
                  </button>
                )}
              </div>
              {isActive && (
                <div className="absolute top-2 right-2">
                  <span className="text-xs font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full">선택됨</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 필터 바 */}
      <div className="bg-(--bg-card) rounded-xl p-4 border border-(--border-main) mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="품목명, 코드 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* 카테고리 필터 */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">전체 카테고리</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* 활성 필터 */}
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">전체 상태</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>

          {/* 유형 필터 해제 버튼 */}
          {typeFilter && (
            <button
              onClick={() => { setTypeFilter(''); setPage(1); }}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
              필터 해제
            </button>
          )}

          {/* 버튼 (관리자/매니저만) */}
          {isManager && (
            <>
              <button
                onClick={() => setShowExcelModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-(--border-main) rounded-lg hover:bg-(--bg-main) transition-colors"
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
                Excel 업로드
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                품목 등록
              </button>
            </>
          )}
        </div>
      </div>

      {/* 테이블 제목 */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <h2 className="text-base font-semibold text-slate-700">{currentTypeLabel} 목록</h2>
        {data && <span className="text-sm text-slate-400">({data.total}건)</span>}
      </div>

      {/* 테이블 */}
      <div className="bg-(--bg-card) rounded-xl border border-(--border-main) overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-(--bg-main) text-sm text-slate-600">
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('code')}>
                  코드{sortIcon('code')}
                </th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('name')}>
                  품목명{sortIcon('name')}
                </th>
                <th className="text-left px-4 py-3 font-semibold">카테고리</th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('product_type')}>
                  유형{sortIcon('product_type')}
                </th>
                <th className="text-left px-4 py-3 font-semibold">단위</th>
                <th className="text-right px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('standard_price')}>
                  기준단가{sortIcon('standard_price')}
                </th>
                <th className="text-right px-4 py-3 font-semibold cursor-pointer hover:text-slate-800" onClick={() => handleSort('cost_price')}>
                  원가{sortIcon('cost_price')}
                </th>
                <th className="text-center px-4 py-3 font-semibold">상태</th>
                {isManager && <th className="text-center px-4 py-3 font-semibold">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="text-center py-12 text-sm text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="text-center py-12 text-sm text-slate-400">
                    {search ? '검색 결과가 없습니다' : '등록된 품목이 없습니다'}
                  </td>
                </tr>
              ) : (
                data.items.map((p) => (
                  <tr key={p.id} className="border-t border-(--border-main) hover:bg-(--bg-main)/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">{p.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{getCategoryName(p.category_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center ${
                        p.product_type === 'product' ? 'bg-emerald-100 text-emerald-700' :
                        p.product_type === 'material' ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {TYPE_LABELS[p.product_type] || p.product_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.unit}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatPrice(p.standard_price)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatPrice(p.cost_price)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                            title="수정"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          {p.is_active && (
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="비활성화"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-(--border-main)">
            <span className="text-sm text-slate-500">
              전체 {data.total}건 중 {(data.page - 1) * data.size + 1}-{Math.min(data.page * data.size, data.total)}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-(--bg-main) disabled:opacity-30 transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                let startPage = Math.max(1, page - 2);
                if (startPage + 4 > data.total_pages) startPage = Math.max(1, data.total_pages - 4);
                const pageNum = startPage + i;
                if (pageNum > data.total_pages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      pageNum === page
                        ? 'bg-emerald-500 text-white'
                        : 'hover:bg-(--bg-main) text-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="p-1.5 rounded-lg hover:bg-(--bg-main) disabled:opacity-30 transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 등록/수정 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-(--border-main)">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-main)">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? '품목 수정' : `${TYPE_LABELS[form.product_type] || '품목'} 등록`}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-(--bg-main) rounded-lg transition-colors">
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 기본 정보 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">기본 정보</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    label="품목 코드 *"
                    value={form.code}
                    onChange={(v) => handleChange('code', v)}
                    placeholder="예: P001"
                    disabled={!!editingId}
                  />
                  <FormField
                    label="품목명 *"
                    value={form.name}
                    onChange={(v) => handleChange('name', v)}
                    placeholder="예: 알루미늄 프레임"
                  />

                  {/* 카테고리 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">카테고리</label>
                    <div className="flex gap-2">
                      <select
                        value={form.category_id || ''}
                        onChange={(e) => handleChange('category_id', e.target.value || null)}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">미분류</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      {isManager && (
                        <button
                          type="button"
                          onClick={() => setShowCategoryModal(true)}
                          className="px-2 py-2 text-sm rounded-lg border border-(--border-main) bg-white hover:bg-(--bg-main) transition-colors text-slate-500"
                          title="새 카테고리 추가"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 품목 유형 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">품목 유형</label>
                    <select
                      value={form.product_type}
                      onChange={(e) => handleChange('product_type', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="product">완제품</option>
                      <option value="material">원자재</option>
                      <option value="semi">반제품</option>
                    </select>
                  </div>

                  {/* 단위 */}
                  <FormField
                    label="단위"
                    value={form.unit}
                    onChange={(v) => handleChange('unit', v)}
                    placeholder="EA, KG, M 등"
                  />

                  {/* 재고평가 방법 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">재고평가 방법</label>
                    <select
                      value={form.inventory_method}
                      onChange={(e) => handleChange('inventory_method', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="fifo">선입선출 (FIFO)</option>
                      <option value="avg">이동평균</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* 가격 및 재고 */}
              <fieldset className="border border-(--border-main) rounded-xl p-4">
                <legend className="text-sm font-semibold text-slate-600 px-2">가격 및 재고</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <NumberField
                    label="기준 단가 (원)"
                    value={form.standard_price}
                    onChange={(v) => handleChange('standard_price', v)}
                    min={0}
                  />
                  <NumberField
                    label="원가 (원)"
                    value={form.cost_price}
                    onChange={(v) => handleChange('cost_price', v)}
                    min={0}
                  />
                  <NumberField
                    label="안전재고 수량"
                    value={form.safety_stock}
                    onChange={(v) => handleChange('safety_stock', Math.floor(v))}
                    min={0}
                    step={1}
                  />
                  <NumberField
                    label="부가세율 (%)"
                    value={form.tax_rate}
                    onChange={(v) => handleChange('tax_rate', v)}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                </div>
              </fieldset>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-(--border-main)">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : editingId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 카테고리 추가 모달 ── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-sm p-6 border border-(--border-main)">
            <h3 className="text-lg font-bold text-slate-800 mb-4">새 카테고리 추가</h3>
            <div className="space-y-3">
              <FormField
                label="카테고리 코드 *"
                value={categoryForm.code}
                onChange={(v) => setCategoryForm((prev) => ({ ...prev, code: v }))}
                placeholder="예: CAT001"
              />
              <FormField
                label="카테고리명 *"
                value={categoryForm.name}
                onChange={(v) => setCategoryForm((prev) => ({ ...prev, name: v }))}
                placeholder="예: 알루미늄 소재"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={savingCategory}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-colors"
              >
                {savingCategory ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Excel 임포트 모달 ── */}
      {showExcelModal && (
        <ExcelImportModal
          module="products"
          moduleName="품목"
          onClose={() => setShowExcelModal(false)}
          onComplete={() => { loadProducts(); loadTypeCounts(); }}
        />
      )}

      {/* ── 삭제 확인 다이얼로그 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-sm p-6 border border-(--border-main)">
            <h3 className="text-lg font-bold text-slate-800 mb-2">품목 비활성화</h3>
            <p className="text-sm text-slate-600 mb-1">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.code})
            </p>
            <p className="text-sm text-slate-500 mb-6">
              이 품목을 비활성화하시겠습니까?<br />
              <span className="text-sm text-slate-400">데이터는 삭제되지 않으며, 목록에서 숨겨집니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-(--bg-main) rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                비활성화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/** 재사용 가능한 텍스트 폼 필드 컴포넌트 */
function FormField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
      />
    </div>
  );
}


/** 재사용 가능한 숫자 폼 필드 컴포넌트 */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-emerald-500 transition-colors"
      />
    </div>
  );
}
