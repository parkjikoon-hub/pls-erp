/**
 * M5 생산/SCM — 재고 관리 페이지
 * 창고별 재고 현황 + 입고/출고/이관/조정 + 부족 알림 + 이동 이력
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listWarehouses, listInventory, receiveInventory, issueInventory,
  transferInventory, adjustInventory, listTransactions, getShortageList,
  type Warehouse, type InventoryItem, type ShortageItem,
} from '../api/production/inventory';
import api from '../api/client';
import BackButton from '../components/BackButton';

/* 구역 라벨 */
const ZONE_LABELS: Record<string, string> = {
  raw: '원자재', wip: 'WIP(생산중)', finished: '완제품', defective: '불량품',
};
const ZONE_COLORS: Record<string, string> = {
  raw: 'bg-amber-50 text-amber-700 border-amber-200',
  wip: 'bg-blue-50 text-blue-700 border-blue-200',
  finished: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  defective: 'bg-red-50 text-red-700 border-red-200',
};
const TX_LABELS: Record<string, string> = {
  receive: '입고', issue: '출고', transfer: '이관', adjust: '조정',
};

type ModalType = 'receive' | 'issue' | 'transfer' | 'adjust' | null;

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [zoneFilter, setZoneFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  /* 탭: inventory / transactions / shortage */
  const [tab, setTab] = useState<'inventory' | 'transactions' | 'shortage'>('inventory');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [shortageItems, setShortageItems] = useState<ShortageItem[]>([]);

  /* 모달 */
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalForm, setModalForm] = useState<any>({});
  const [products, setProducts] = useState<{ id: string; name: string; code: string }[]>([]);

  /* ── 데이터 로드 ── */
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listInventory({
        zone_type: zoneFilter || undefined,
        search: search || undefined,
        page,
        size: 50,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [zoneFilter, search, page]);

  const fetchTransactions = useCallback(async () => {
    try {
      const result = await listTransactions({ page: txPage, size: 30 });
      setTransactions(result.items);
      setTxTotal(result.total);
    } catch (e) { console.error(e); }
  }, [txPage]);

  const fetchShortage = useCallback(async () => {
    try {
      const data = await getShortageList();
      setShortageItems(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    listWarehouses().then(setWarehouses);
    api.get('/system/products', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setProducts(
        (data?.items || data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code }))
      );
    });
  }, []);

  useEffect(() => {
    if (tab === 'inventory') fetchInventory();
    else if (tab === 'transactions') fetchTransactions();
    else if (tab === 'shortage') fetchShortage();
  }, [tab, fetchInventory, fetchTransactions, fetchShortage]);

  /* ── 모달 열기 ── */
  const openModal = (type: ModalType) => {
    setModalForm({
      product_id: '', warehouse_id: '',
      from_warehouse_id: '', to_warehouse_id: '',
      quantity: 0, unit_cost: 0, new_quantity: 0, notes: '',
    });
    setModalType(type);
  };

  /* ── 모달 저장 ── */
  const handleModalSave = async () => {
    try {
      if (modalType === 'receive') {
        await receiveInventory(modalForm);
      } else if (modalType === 'issue') {
        await issueInventory(modalForm);
      } else if (modalType === 'transfer') {
        await transferInventory(modalForm);
      } else if (modalType === 'adjust') {
        await adjustInventory(modalForm);
      }
      setModalType(null);
      fetchInventory();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '처리 실패');
    }
  };

  return (
    <div>
      {/* 뒤로가기 */}
      <div className="mb-4">
        <BackButton to="/production" label="생산/SCM" />
      </div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">재고 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            창고별 재고 현황 · 입출고 · 이관 · 부족 알림
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal('receive')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">입고</button>
          <button onClick={() => openModal('issue')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">출고</button>
          <button onClick={() => openModal('transfer')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">이관</button>
          <button onClick={() => openModal('adjust')} className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">조정</button>
        </div>
      </div>

      {/* 창고 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {warehouses.map((wh) => (
          <div
            key={wh.id}
            onClick={() => { setZoneFilter(wh.zone_type === zoneFilter ? '' : wh.zone_type); setPage(1); }}
            className={`p-3 rounded-lg border cursor-pointer transition ${
              zoneFilter === wh.zone_type
                ? ZONE_COLORS[wh.zone_type] + ' border-2'
                : 'bg-white border-(--border-main) hover:bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500">{ZONE_LABELS[wh.zone_type]}</div>
            <div className="font-semibold text-slate-800">{wh.name}</div>
            <div className="text-xs text-slate-400">{wh.code}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-(--border-main)">
        {(['inventory', 'transactions', 'shortage'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'inventory' ? '재고 현황' : t === 'transactions' ? '이동 이력' : '부족 알림'}
            {t === 'shortage' && shortageItems.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {shortageItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 재고 현황 탭 */}
      {tab === 'inventory' && (
        <>
          <div className="flex gap-3 mb-3">
            <input
              placeholder="품목명/코드 검색..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border border-(--border-main) rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
            />
          </div>
          <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-(--bg-card) text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">품목코드</th>
                  <th className="px-4 py-2 text-left">품목명</th>
                  <th className="px-4 py-2 text-left">창고</th>
                  <th className="px-4 py-2 text-right">수량</th>
                  <th className="px-4 py-2 text-right">단가</th>
                  <th className="px-4 py-2 text-center">안전재고</th>
                  <th className="px-4 py-2 text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">로딩 중...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">재고 데이터 없음</td></tr>
                ) : (
                  items.map((inv) => {
                    const isShortage = inv.safety_stock > 0 && inv.quantity < inv.safety_stock;
                    return (
                      <tr key={inv.id} className={`border-t border-[#e8ecf2] ${isShortage ? 'bg-red-50' : 'hover:bg-(--bg-hover)'}`}>
                        <td className="px-4 py-2 text-slate-500">{inv.product_code}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{inv.product_name}</td>
                        <td className="px-4 py-2 text-slate-600">{inv.warehouse_name}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${isShortage ? 'text-red-600' : 'text-slate-800'}`}>
                          {inv.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{inv.unit_cost.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center text-slate-500">
                          {inv.safety_stock > 0 ? inv.safety_stock : '-'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {isShortage && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">부족</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 이동 이력 탭 */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-(--bg-card) text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">일시</th>
                <th className="px-4 py-2 text-center">유형</th>
                <th className="px-4 py-2 text-left">품목</th>
                <th className="px-4 py-2 text-left">출발</th>
                <th className="px-4 py-2 text-left">도착</th>
                <th className="px-4 py-2 text-right">수량</th>
                <th className="px-4 py-2 text-left">메모</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">이력 없음</td></tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-t border-[#e8ecf2] hover:bg-(--bg-hover)">
                    <td className="px-4 py-2 text-slate-500 text-xs">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('ko') : '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {TX_LABELS[tx.transaction_type] || tx.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{tx.product_name || '-'}</td>
                    <td className="px-4 py-2 text-slate-500">{tx.from_warehouse || '-'}</td>
                    <td className="px-4 py-2 text-slate-500">{tx.to_warehouse || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{tx.quantity}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{tx.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 부족 알림 탭 */}
      {tab === 'shortage' && (
        <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-(--bg-card) text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">품목코드</th>
                <th className="px-4 py-2 text-left">품목명</th>
                <th className="px-4 py-2 text-right">현재 재고</th>
                <th className="px-4 py-2 text-right">안전재고</th>
                <th className="px-4 py-2 text-right">부족 수량</th>
              </tr>
            </thead>
            <tbody>
              {shortageItems.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-emerald-600">모든 품목의 재고가 충분합니다</td></tr>
              ) : (
                shortageItems.map((s) => (
                  <tr key={s.product_id} className="border-t border-[#e8ecf2] bg-red-50">
                    <td className="px-4 py-2 text-slate-500">{s.product_code}</td>
                    <td className="px-4 py-2 font-medium text-slate-700">{s.product_name}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-semibold">{s.current_qty}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{s.safety_stock}</td>
                    <td className="px-4 py-2 text-right text-red-700 font-bold">{s.shortage_qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 입고/출고/이관/조정 모달 ── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modalType === 'receive' ? '입고' : modalType === 'issue' ? '출고' : modalType === 'transfer' ? '이관' : '재고 조정'}
            </h2>

            {/* 품목 선택 */}
            <div className="mb-3">
              <label className="block text-sm text-slate-600 mb-1">품목 *</label>
              <select
                value={modalForm.product_id}
                onChange={(e) => setModalForm({ ...modalForm, product_id: e.target.value })}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
              >
                <option value="">선택...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                ))}
              </select>
            </div>

            {/* 창고 선택 */}
            {modalType === 'transfer' ? (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">출발 창고 *</label>
                  <select
                    value={modalForm.from_warehouse_id}
                    onChange={(e) => setModalForm({ ...modalForm, from_warehouse_id: e.target.value })}
                    className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">선택...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">도착 창고 *</label>
                  <select
                    value={modalForm.to_warehouse_id}
                    onChange={(e) => setModalForm({ ...modalForm, to_warehouse_id: e.target.value })}
                    className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">선택...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <label className="block text-sm text-slate-600 mb-1">창고 *</label>
                <select
                  value={modalForm.warehouse_id}
                  onChange={(e) => setModalForm({ ...modalForm, warehouse_id: e.target.value })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">선택...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 수량 */}
            <div className="mb-3">
              <label className="block text-sm text-slate-600 mb-1">
                {modalType === 'adjust' ? '조정 후 수량 *' : '수량 *'}
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={modalType === 'adjust' ? modalForm.new_quantity : modalForm.quantity}
                onChange={(e) => setModalForm({
                  ...modalForm,
                  [modalType === 'adjust' ? 'new_quantity' : 'quantity']: Number(e.target.value),
                })}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* 단가 (입고만) */}
            {modalType === 'receive' && (
              <div className="mb-3">
                <label className="block text-sm text-slate-600 mb-1">단가</label>
                <input
                  type="number"
                  min={0}
                  value={modalForm.unit_cost}
                  onChange={(e) => setModalForm({ ...modalForm, unit_cost: Number(e.target.value) })}
                  className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* 메모 */}
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-1">
                메모 {modalType === 'adjust' ? '(필수 - 사유)' : ''}
              </label>
              <input
                type="text"
                value={modalForm.notes}
                onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                className="w-full border border-(--border-main) rounded-lg px-3 py-2 text-sm"
                placeholder={modalType === 'adjust' ? '조정 사유를 입력하세요' : '메모'}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 border border-(--border-main) rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleModalSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
