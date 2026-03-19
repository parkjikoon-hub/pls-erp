/**
 * M5 생산/SCM — 출하 관리 페이지
 * 출하지시서 목록 + 수주 기반 자동 생성 + 상태 진행 + 거래명세서 인쇄
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listShipments, getShipment, createShipmentFromOrder,
  updateShipmentStatus, getDeliveryNote,
  type Shipment,
} from '../api/production/shipments';
import api from '../api/client';


/* 상태 라벨/색상 */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '대기',   color: 'text-slate-700',   bg: 'bg-slate-100' },
  picked:    { label: '피킹완료', color: 'text-blue-700',    bg: 'bg-blue-100' },
  shipped:   { label: '출하완료', color: 'text-purple-700',  bg: 'bg-purple-100' },
  delivered: { label: '배송완료', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

const NEXT_STATUS: Record<string, string> = {
  pending: 'picked', picked: 'shipped', shipped: 'delivered',
};

const NEXT_LABEL: Record<string, string> = {
  pending: '피킹 완료', picked: '출하 처리', shipped: '배송 완료',
};

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  /* 상세 모달 */
  const [detail, setDetail] = useState<Shipment | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  /* 수주 선택 모달 */
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  /* 거래명세서 모달 */
  const [dnData, setDnData] = useState<Shipment | null>(null);
  const [showDn, setShowDn] = useState(false);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listShipments({
        status: statusFilter || undefined,
        page, size: 30,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 상세 보기 ── */
  const openDetail = async (id: string) => {
    try {
      const data = await getShipment(id);
      setDetail(data);
      setShowDetail(true);
    } catch (e: any) {
      alert(e?.response?.data?.detail || '조회 실패');
    }
  };

  /* ── 상태 변경 ── */
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateShipmentStatus(id, newStatus);
      setShowDetail(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '상태 변경 실패');
    }
  };

  /* ── 수주→출하 ── */
  const openOrderModal = async () => {
    try {
      const res = await api.get('/sales/orders', { params: { size: 100 } });
      const all = res.data?.data?.items || [];
      setOrders(all.filter((o: any) => ['confirmed', 'in_production'].includes(o.status)));
      setShowOrderModal(true);
    } catch (e) { console.error(e); }
  };

  const handleFromOrder = async (orderId: string) => {
    try {
      await createShipmentFromOrder(orderId);
      setShowOrderModal(false);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || '출하 생성 실패');
    }
  };

  /* ── 거래명세서 ── */
  const openDeliveryNote = async (id: string) => {
    try {
      const data = await getDeliveryNote(id);
      setDnData(data);
      setShowDn(true);
    } catch (e: any) {
      alert(e?.response?.data?.detail || '거래명세서 조회 실패');
    }
  };

  const printDn = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">출하 관리</h1>
          <p className="text-sm text-slate-500 mt-1">출하지시서 관리 및 배송 추적</p>
        </div>
        <button
          onClick={openOrderModal}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
        >
          + 수주→출하 생성
        </button>
      </div>

      {/* ── 상태 필터 ── */}
      <div className="flex gap-2">
        {[
          { value: '', label: '전체' },
          { value: 'pending', label: '대기' },
          { value: 'picked', label: '피킹완료' },
          { value: 'shipped', label: '출하완료' },
          { value: 'delivered', label: '배송완료' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              statusFilter === f.value
                ? 'bg-red-600 text-white'
                : 'bg-white text-slate-600 border border-(--border-main) hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── 출하 목록 테이블 ── */}
      <div className="bg-white rounded-xl border border-(--border-main) overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-(--bg-card) text-slate-700">
              <th className="text-left px-4 py-3 font-semibold">출하번호</th>
              <th className="text-left px-4 py-3 font-semibold">수주번호</th>
              <th className="text-left px-4 py-3 font-semibold">거래처</th>
              <th className="text-center px-4 py-3 font-semibold">상태</th>
              <th className="text-right px-4 py-3 font-semibold">품목수</th>
              <th className="text-right px-4 py-3 font-semibold">합계금액</th>
              <th className="text-left px-4 py-3 font-semibold">택배사</th>
              <th className="text-left px-4 py-3 font-semibold">송장번호</th>
              <th className="text-left px-4 py-3 font-semibold">거래명세서</th>
              <th className="text-left px-4 py-3 font-semibold">출하일</th>
              <th className="text-center px-4 py-3 font-semibold">진행</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8ecf2]">
            {loading ? (
              <tr><td colSpan={11} className="text-center py-12 text-slate-400">로딩 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-slate-400">출하 내역이 없습니다</td></tr>
            ) : (
              items.map(sh => {
                const st = STATUS_MAP[sh.status] || { label: sh.status, color: 'text-slate-600', bg: 'bg-slate-100' };
                return (
                  <tr
                    key={sh.id}
                    className="hover:bg-slate-50 transition cursor-pointer"
                    onClick={() => openDetail(sh.id)}
                  >
                    <td className="px-4 py-3 text-xs font-medium">{sh.shipment_no}</td>
                    <td className="px-4 py-3 text-xs">{sh.order_no || '-'}</td>
                    <td className="px-4 py-3">{sh.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center inline-block ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{sh.line_count}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {sh.total_amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-xs">{sh.carrier_name || '-'}</td>
                    <td className="px-4 py-3 text-xs">{sh.tracking_no || '-'}</td>
                    <td className="px-4 py-3">
                      {sh.delivery_note_no ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeliveryNote(sh.id); }}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {sh.delivery_note_no}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {sh.shipment_date || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {NEXT_STATUS[sh.status] ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(sh.id, NEXT_STATUS[sh.status]); }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition whitespace-nowrap"
                        >
                          {NEXT_LABEL[sh.status]}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">완료</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 페이징 */}
        {total > 30 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-[#e8ecf2]">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border border-(--border-main) text-sm disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-sm text-slate-600">{page} / {Math.ceil(total / 30)}</span>
            <button
              disabled={page * 30 >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-(--border-main) text-sm disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* ── 상세 모달 ── */}
      {showDetail && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                출하지시서 {detail.shipment_no}
              </h2>
              <span className={`px-2.5 py-1 rounded text-sm font-medium min-w-[3.5rem] text-center inline-block ${
                STATUS_MAP[detail.status]?.bg} ${STATUS_MAP[detail.status]?.color}`}>
                {STATUS_MAP[detail.status]?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">거래처:</span> {detail.customer_name}</div>
              <div><span className="text-slate-500">수주번호:</span> {detail.order_no || '-'}</div>
              <div><span className="text-slate-500">택배사:</span> {detail.carrier_name || '-'}</div>
              <div><span className="text-slate-500">송장번호:</span> {detail.tracking_no || '-'}</div>
              <div className="col-span-2">
                <span className="text-slate-500">배송주소:</span> {detail.shipping_address || '-'}
              </div>
            </div>

            {/* 출하 품목 */}
            <table className="w-full text-sm border border-(--border-main) rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-(--bg-card)">
                  <th className="text-left px-3 py-2 font-semibold">No</th>
                  <th className="text-left px-3 py-2 font-semibold">품목</th>
                  <th className="text-right px-3 py-2 font-semibold">수량</th>
                  <th className="text-right px-3 py-2 font-semibold">단가</th>
                  <th className="text-right px-3 py-2 font-semibold">금액</th>
                  <th className="text-left px-3 py-2 font-semibold">출고창고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8ecf2]">
                {(detail.lines || []).map(ln => (
                  <tr key={ln.id}>
                    <td className="px-3 py-2">{ln.line_no}</td>
                    <td className="px-3 py-2">{ln.product_name} ({ln.product_code})</td>
                    <td className="px-3 py-2 text-right">{ln.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{ln.unit_price.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium">{ln.amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{ln.warehouse_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-(--bg-card) font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">합계</td>
                  <td className="px-3 py-2 text-right">{detail.total_amount?.toLocaleString()}원</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-2">
              {detail.delivery_note_no && (
                <button
                  onClick={() => { setShowDetail(false); openDeliveryNote(detail.id); }}
                  className="px-4 py-2 text-sm text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50"
                >
                  거래명세서
                </button>
              )}
              {NEXT_STATUS[detail.status] && (
                <button
                  onClick={() => handleStatusChange(detail.id, NEXT_STATUS[detail.status])}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  {NEXT_LABEL[detail.status]}
                </button>
              )}
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-(--border-main) rounded-lg hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수주 선택 모달 ── */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">수주서 선택 → 출하 생성</h2>
            {orders.length === 0 ? (
              <p className="text-slate-400 text-center py-8">출하 가능한 수주가 없습니다</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {orders.map(o => (
                  <div
                    key={o.id}
                    onClick={() => handleFromOrder(o.id)}
                    className="flex items-center justify-between p-3 rounded-lg border border-(--border-main) hover:bg-blue-50 cursor-pointer transition"
                  >
                    <div>
                      <div className="font-medium text-sm">{o.order_no}</div>
                      <div className="text-xs text-slate-500">{o.customer_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{o.total_amount?.toLocaleString()}원</div>
                      <div className="text-xs text-slate-500">{o.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-(--border-main) rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 거래명세서 인쇄 모달 ── */}
      {showDn && dnData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 print:bg-white print:items-start">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-8 space-y-4 print:shadow-none print:rounded-none print:max-w-none">
            {/* 거래명세서 헤더 */}
            <div className="text-center border-b-2 border-slate-800 pb-4">
              <h1 className="text-2xl font-bold">거 래 명 세 서</h1>
              <p className="text-sm text-slate-500 mt-1">No. {dnData.delivery_note_no}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p><strong>거래처:</strong> {dnData.customer_name}</p>
                <p><strong>출하번호:</strong> {dnData.shipment_no}</p>
                <p><strong>수주번호:</strong> {dnData.order_no || '-'}</p>
              </div>
              <div className="space-y-1 text-right">
                <p><strong>출하일:</strong> {dnData.shipment_date || '-'}</p>
                <p><strong>택배사:</strong> {dnData.carrier_name || '-'}</p>
                <p><strong>송장번호:</strong> {dnData.tracking_no || '-'}</p>
              </div>
            </div>

            {/* 품목 테이블 */}
            <table className="w-full text-sm border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-3 py-2 text-center">No</th>
                  <th className="border border-slate-400 px-3 py-2 text-left">품목코드</th>
                  <th className="border border-slate-400 px-3 py-2 text-left">품목명</th>
                  <th className="border border-slate-400 px-3 py-2 text-right">수량</th>
                  <th className="border border-slate-400 px-3 py-2 text-right">단가</th>
                  <th className="border border-slate-400 px-3 py-2 text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {(dnData.lines || []).map(ln => (
                  <tr key={ln.id}>
                    <td className="border border-slate-400 px-3 py-2 text-center">{ln.line_no}</td>
                    <td className="border border-slate-400 px-3 py-2">{ln.product_code}</td>
                    <td className="border border-slate-400 px-3 py-2">{ln.product_name}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right">{ln.quantity.toLocaleString()}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right">{ln.unit_price.toLocaleString()}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right">{ln.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-slate-50">
                  <td colSpan={5} className="border border-slate-400 px-3 py-2 text-right">합 계</td>
                  <td className="border border-slate-400 px-3 py-2 text-right">
                    {dnData.total_amount?.toLocaleString()}원
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* 비고 */}
            {dnData.notes && (
              <div className="text-sm">
                <strong>비고:</strong> {dnData.notes}
              </div>
            )}

            {/* 인쇄 버튼 (인쇄 시 숨김) */}
            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <button
                onClick={printDn}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                인쇄
              </button>
              <button
                onClick={() => setShowDn(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-(--border-main) rounded-lg hover:bg-slate-50"
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
