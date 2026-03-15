/**
 * M5 생산/SCM — BOM(자재명세서) 관리 페이지
 * BOM 목록 + 생성/수정 모달 + 트리 뷰
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listBoms, getBom, createBom, updateBom, deleteBom,
  getBomTree, getMaterialRequirements,
  type Bom, type BomLine, type BomFormData, type BomTreeNode, type MaterialRequirement,
} from '../api/production/bom';
import api from '../api/client';

/* ── 빈 라인 ── */
const emptyLine = (): BomLine => ({
  material_id: '', quantity: 1, unit: 'EA', scrap_rate: 0, sort_order: 0,
});

/* ── 트리 노드 렌더링 (재귀) ── */
function TreeNode({ node, depth = 0 }: { node: BomTreeNode; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const typeLabel: Record<string, string> = {
    product: '완제품', semi: '반제품', material: '원자재',
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          <span className="text-slate-400 w-4 text-center text-xs">{open ? '▼' : '▶'}</span>
        ) : (
          <span className="w-4 text-center text-slate-300">•</span>
        )}
        <span className="font-medium text-slate-700">{node.product_name || node.product_code}</span>
        <span className="text-xs text-slate-400">{node.product_code}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          node.product_type === 'material' ? 'bg-amber-100 text-amber-700' :
          node.product_type === 'semi' ? 'bg-blue-100 text-blue-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {typeLabel[node.product_type || ''] || node.product_type}
        </span>
        <span className="text-sm text-slate-600 ml-auto">
          {node.quantity} {node.unit || 'EA'}
        </span>
        {node.scrap_rate > 0 && (
          <span className="text-xs text-orange-500">(스크랩 {node.scrap_rate}%)</span>
        )}
      </div>
      {open && hasChildren && node.children.map((child, i) => (
        <TreeNode key={`${child.product_id}-${i}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function BomPage() {
  const [items, setItems] = useState<Bom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  /* 모달 상태 */
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BomFormData>({
    product_id: '', version: 1, lines: [emptyLine()],
  });

  /* 트리 모달 */
  const [showTree, setShowTree] = useState(false);
  const [treeData, setTreeData] = useState<BomTreeNode | null>(null);
  const [materials, setMaterials] = useState<MaterialRequirement[]>([]);
  const [treeQty, setTreeQty] = useState(1);
  const [treeBomId, setTreeBomId] = useState('');

  /* 품목 목록 (드롭다운) */
  const [products, setProducts] = useState<{ id: string; name: string; code: string; product_type: string }[]>([]);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBoms({ page, size: 20 });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/system/products', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setProducts(
        (data?.items || data || []).map((p: any) => ({
          id: p.id, name: p.name, code: p.code, product_type: p.product_type || 'product',
        }))
      );
    });
  }, []);

  /* ── 모달 열기/닫기 ── */
  const openCreate = () => {
    setEditId(null);
    setForm({ product_id: '', version: 1, lines: [emptyLine()] });
    setShowModal(true);
  };

  const openEdit = async (bom: Bom) => {
    try {
      const detail = await getBom(bom.id);
      setEditId(bom.id);
      setForm({
        product_id: detail.product_id,
        version: detail.version,
        lines: detail.lines.length > 0 ? detail.lines : [emptyLine()],
      });
      setShowModal(true);
    } catch (e: any) {
      alert(e?.response?.data?.detail || '상세 조회 실패');
    }
  };

  /* ── 트리 보기 ── */
  const openTree = async (bomId: string) => {
    try {
      setTreeBomId(bomId);
      setTreeQty(1);
      const tree = await getBomTree(bomId);
      setTreeData(tree);
      const matResult = await getMaterialRequirements(bomId, 1);
      setMaterials(matResult.materials);
      setShowTree(true);
    } catch (e: any) {
      alert(e?.response?.data?.detail || '트리 조회 실패');
    }
  };

  const refreshMaterials = async () => {
    try {
      const matResult = await getMaterialRequirements(treeBomId, treeQty);
      setMaterials(matResult.materials);
    } catch (e) {
      console.error(e);
    }
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
    if (!form.product_id) { alert('완제품/반제품을 선택해주세요'); return; }
    if (form.lines.some(l => !l.material_id)) { alert('모든 라인의 구성 자재를 선택해주세요'); return; }
    try {
      if (editId) {
        await updateBom(editId, form);
      } else {
        await createBom(form);
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '저장 실패');
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async (id: string) => {
    if (!confirm('이 BOM을 삭제하시겠습니까?')) return;
    try {
      await deleteBom(id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '삭제 실패');
    }
  };

  /* 품목 필터: 완제품/반제품만 BOM 대상 */
  const bomProducts = products.filter(p => p.product_type !== 'material');
  /* 자재 품목 (라인용): 모든 품목 가능 (반제품도 하위 BOM 있을 수 있음) */
  const materialProducts = products;

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BOM 관리 (자재명세서)</h1>
          <p className="text-sm text-slate-500 mt-1">
            제품별 구성 부품 등록 · 다단계 트리 전개 (총 {total}건)
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          + BOM 등록
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-[#c8ced8] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#e8ecf2] text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">품목명</th>
              <th className="px-4 py-2 text-left">품목코드</th>
              <th className="px-4 py-2 text-center">버전</th>
              <th className="px-4 py-2 text-center">구성 부품 수</th>
              <th className="px-4 py-2 text-center">활성</th>
              <th className="px-4 py-2 text-left">등록일</th>
              <th className="px-4 py-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">로딩 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 BOM이 없습니다</td></tr>
            ) : (
              items.map((b) => (
                <tr key={b.id} className="border-t border-[#e8ecf2] hover:bg-[#f1f4f8]">
                  <td className="px-4 py-2 font-medium text-slate-700">{b.product_name || '-'}</td>
                  <td className="px-4 py-2 text-slate-500">{b.product_code || '-'}</td>
                  <td className="px-4 py-2 text-center">v{b.version}</td>
                  <td className="px-4 py-2 text-center">{b.line_count}개</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {b.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {b.created_at ? new Date(b.created_at).toLocaleDateString('ko') : '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => openTree(b.id)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        트리
                      </button>
                      <button
                        onClick={() => openEdit(b)}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
                p === page ? 'bg-emerald-600 text-white' : 'bg-white border border-[#c8ced8] text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── BOM 생성/수정 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editId ? 'BOM 수정' : 'BOM 등록'}
            </h2>

            {/* 제품 선택 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">완제품/반제품 *</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm"
                  disabled={!!editId}
                >
                  <option value="">선택...</option>
                  {bomProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">버전</label>
                <input
                  type="number"
                  min={1}
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: Number(e.target.value) })}
                  className="w-full border border-[#c8ced8] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* 구성 부품 라인 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">구성 부품 목록</label>
                <button onClick={addLine} className="text-xs text-emerald-600 hover:text-emerald-700">
                  + 부품 추가
                </button>
              </div>
              <div className="border border-[#c8ced8] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#e8ecf2] text-slate-600">
                    <tr>
                      <th className="px-3 py-1.5 text-left">구성 자재 *</th>
                      <th className="px-3 py-1.5 text-center w-24">수량 *</th>
                      <th className="px-3 py-1.5 text-center w-20">단위</th>
                      <th className="px-3 py-1.5 text-center w-24">스크랩율(%)</th>
                      <th className="px-3 py-1.5 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line, idx) => (
                      <tr key={idx} className="border-t border-[#e8ecf2]">
                        <td className="px-3 py-1.5">
                          <select
                            value={line.material_id}
                            onChange={(e) => updateLine(idx, 'material_id', e.target.value)}
                            className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm"
                          >
                            <option value="">선택...</option>
                            {materialProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.code}] {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0.0001}
                            step={0.01}
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                            className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-center"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={line.unit || ''}
                            onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                            className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-center"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={line.scrap_rate || 0}
                            onChange={(e) => updateLine(idx, 'scrap_rate', Number(e.target.value))}
                            className="w-full border border-[#c8ced8] rounded px-2 py-1 text-sm text-center"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() => removeLine(idx)}
                            className="text-red-400 hover:text-red-600"
                            disabled={form.lines.length <= 1}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-[#c8ced8] rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
              >
                {editId ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOM 트리 모달 ── */}
      {showTree && treeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                BOM 트리 — {treeData.product_name}
              </h2>
              <button onClick={() => setShowTree(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {/* 트리 뷰 */}
            <div className="border border-[#c8ced8] rounded-lg p-3 mb-4 max-h-[300px] overflow-y-auto bg-slate-50">
              <TreeNode node={treeData} />
            </div>

            {/* 소요 원자재 */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-slate-700">소요 원자재 (생산 수량:</span>
                <input
                  type="number"
                  min={1}
                  value={treeQty}
                  onChange={(e) => setTreeQty(Number(e.target.value))}
                  className="w-20 border border-[#c8ced8] rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-sm text-slate-700">개)</span>
                <button
                  onClick={refreshMaterials}
                  className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  계산
                </button>
              </div>
              <div className="border border-[#c8ced8] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#e8ecf2] text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">원자재명</th>
                      <th className="px-4 py-2 text-left">코드</th>
                      <th className="px-4 py-2 text-right">총 소요량</th>
                      <th className="px-4 py-2 text-center">단위</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-400">원자재 데이터 없음</td></tr>
                    ) : (
                      materials.map((m, i) => (
                        <tr key={i} className="border-t border-[#e8ecf2]">
                          <td className="px-4 py-2 text-slate-700">{m.product_name}</td>
                          <td className="px-4 py-2 text-slate-500">{m.product_code}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">
                            {m.total_quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-500">{m.unit || 'EA'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowTree(false)}
                className="px-4 py-2 border border-[#c8ced8] rounded-lg text-sm text-slate-600 hover:bg-slate-50"
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
