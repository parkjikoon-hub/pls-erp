/**
 * M2 영업 — 판매가 관리 페이지
 * - 거래처별 특별 단가 목록 조회/등록/수정/삭제
 * - 엑셀 업로드 (기본가 / 거래처별)
 * - 엑셀 다운로드 (템플릿)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchPriceLists,
  createPriceList,
  updatePriceList,
  deletePriceList,
  uploadStandardPrices,
  uploadCustomerPrices,
  downloadTemplate,
  type PriceListItem,
} from '../api/sales/priceLists';
import api from '../api/client';

/* ── 숫자 포맷 ── */
const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function PriceListPage() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [customerFilter, setCustomerFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  /* 모달 상태 */
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<PriceListItem | null>(null);
  const [form, setForm] = useState({ customer_id: '', product_id: '', unit_price: 0, valid_from: '', valid_until: '', notes: '' });

  /* 엑셀 업로드 모달 */
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'standard' | 'customer'>('standard');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  /* 드롭다운 데이터 */
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; code: string; standard_price: number }[]>([]);

  /* ── 데이터 로드 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPriceLists({
        customer_id: customerFilter || undefined,
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
  }, [customerFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    /* 거래처 목록 */
    api.get('/system/customers', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setCustomers(
        (data?.items || data || []).map((c: any) => ({ id: c.id, name: c.name, code: c.code || '' }))
      );
    }).catch(() => {});
    /* 품목 목록 */
    api.get('/system/products', { params: { size: 500 } }).then((res) => {
      const data = res.data?.data;
      setProducts(
        (data?.items || data || []).map((p: any) => ({
          id: p.id, name: p.name, code: p.code || '',
          standard_price: p.standard_price || 0,
        }))
      );
    }).catch(() => {});
  }, []);

  /* ── 등록/수정 모달 열기 ── */
  const openCreate = () => {
    setEditItem(null);
    setForm({ customer_id: '', product_id: '', unit_price: 0, valid_from: '', valid_until: '', notes: '' });
    setShowModal(true);
  };
  const openEdit = (item: PriceListItem) => {
    setEditItem(item);
    setForm({
      customer_id: item.customer_id,
      product_id: item.product_id,
      unit_price: item.unit_price,
      valid_from: item.valid_from || '',
      valid_until: item.valid_until || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  /* ── 저장 ── */
  const handleSave = async () => {
    try {
      if (editItem) {
        await updatePriceList(editItem.id, {
          unit_price: form.unit_price,
          valid_from: form.valid_from || undefined,
          valid_until: form.valid_until || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await createPriceList({
          customer_id: form.customer_id,
          product_id: form.product_id,
          unit_price: form.unit_price,
          valid_from: form.valid_from || undefined,
          valid_until: form.valid_until || undefined,
          notes: form.notes || undefined,
        });
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.detail || '저장 실패');
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await deletePriceList(id);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.detail || '삭제 실패');
    }
  };

  /* ── 엑셀 업로드 ── */
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = uploadType === 'standard'
        ? await uploadStandardPrices(uploadFile)
        : await uploadCustomerPrices(uploadFile);
      setUploadResult(result);
      fetchData();
    } catch (e: any) {
      setUploadResult({ message: e.response?.data?.detail || '업로드 실패', errors: [] });
    } finally {
      setUploading(false);
    }
  };

  /* 품목 선택 시 기본가 자동 채움 */
  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      product_id: productId,
      unit_price: prev.unit_price || (prod?.standard_price || 0),
    }));
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            판매가 관리
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            거래처별 특별 단가 관리 · 엑셀 업로드 (총 {total}건)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => downloadTemplate(false)}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            템플릿 다운로드
          </button>
          <button
            onClick={() => downloadTemplate(true)}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            현재 데이터 내보내기
          </button>
          <button
            onClick={() => { setShowUploadModal(true); setUploadFile(null); setUploadResult(null); }}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}
          >
            엑셀 업로드
          </button>
          <button
            onClick={openCreate}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}
          >
            + 판매가 등록
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select
          value={customerFilter}
          onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
          style={{ padding: '7px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        >
          <option value="">전체 거래처</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="text"
          placeholder="품목명/코드 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '7px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', width: 220 }}
        />
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--table-header-bg)', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>거래처</th>
              <th style={thStyle}>품목코드</th>
              <th style={thStyle}>품목명</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>기본가</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>특별단가</th>
              <th style={thStyle}>유효기간</th>
              <th style={thStyle}>비고</th>
              <th style={thStyle}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>로딩 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>등록된 판매가가 없습니다</td></tr>
            ) : items.map((item) => {
              const priceDiff = item.unit_price - (item.standard_price || 0);
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={tdStyle}>{item.customer_name}</td>
                  <td style={tdStyle}><code style={{ fontSize: 12, color: '#6366f1' }}>{item.product_code}</code></td>
                  <td style={tdStyle}>{item.product_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(item.standard_price || 0)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {fmt(item.unit_price)}
                    {priceDiff !== 0 && (
                      <span style={{ fontSize: 11, color: priceDiff > 0 ? '#ef4444' : '#10b981', marginLeft: 4 }}>
                        ({priceDiff > 0 ? '+' : ''}{fmt(priceDiff)})
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.valid_from || item.valid_until
                      ? `${item.valid_from || '~'} ~ ${item.valid_until || ''}`
                      : '무제한'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{item.notes || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(item)} style={btnStyle('#3b82f6')}>수정</button>
                      <button onClick={() => handleDelete(item.id)} style={btnStyle('#ef4444')}>삭제</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setPage(i + 1)}
              style={{
                padding: '6px 12px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                border: page === i + 1 ? '2px solid #10b981' : '1px solid var(--border-color)',
                background: page === i + 1 ? '#10b981' : 'var(--bg-base)',
                color: page === i + 1 ? '#fff' : 'var(--text-primary)',
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ── 등록/수정 모달 ── */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {editItem ? '판매가 수정' : '판매가 등록'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {!editItem && (
                <>
                  <label style={labelStyle}>
                    거래처 *
                    <select
                      value={form.customer_id}
                      onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">선택</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    </select>
                  </label>
                  <label style={labelStyle}>
                    품목 *
                    <select
                      value={form.product_id}
                      onChange={(e) => handleProductChange(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">선택</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code}) — 기본가: {fmt(p.standard_price)}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label style={labelStyle}>
                특별 단가 (원) *
                <input
                  type="number"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                비고
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                유효 시작일
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                유효 종료일
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ ...btnStyle('#6b7280'), padding: '8px 20px' }}>취소</button>
              <button
                onClick={handleSave}
                disabled={!editItem && (!form.customer_id || !form.product_id)}
                style={{ ...btnStyle('#10b981'), padding: '8px 20px', opacity: (!editItem && (!form.customer_id || !form.product_id)) ? 0.5 : 1 }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 엑셀 업로드 모달 ── */}
      {showUploadModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>판매가 엑셀 업로드</h3>

            {/* 업로드 유형 선택 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setUploadType('standard')}
                style={{
                  flex: 1, padding: '10px 16px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                  border: uploadType === 'standard' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                  background: uploadType === 'standard' ? '#eff6ff' : 'var(--bg-base)',
                  color: 'var(--text-primary)',
                }}
              >
                <strong>기본 판매가</strong>
                <br /><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>[품목코드, 품목명, 판매가]</span>
              </button>
              <button
                onClick={() => setUploadType('customer')}
                style={{
                  flex: 1, padding: '10px 16px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                  border: uploadType === 'customer' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                  background: uploadType === 'customer' ? '#eff6ff' : 'var(--bg-base)',
                  color: 'var(--text-primary)',
                }}
              >
                <strong>거래처별 판매가</strong>
                <br /><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>[거래처코드, 품목코드, 판매가, 시작일, 종료일]</span>
              </button>
            </div>

            {/* 파일 선택 */}
            <div style={{
              border: '2px dashed var(--border-color)', borderRadius: 12, padding: 24,
              textAlign: 'center', marginBottom: 16, background: 'var(--bg-input)',
            }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                style={{ display: 'block', margin: '0 auto' }}
              />
              {uploadFile && (
                <p style={{ fontSize: 13, color: '#10b981', marginTop: 8 }}>
                  선택됨: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* 업로드 결과 */}
            {uploadResult && (
              <div style={{
                padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13,
                background: uploadResult.errors?.length > 0 ? '#fef3c7' : '#d1fae5',
                border: `1px solid ${uploadResult.errors?.length > 0 ? '#f59e0b' : '#10b981'}`,
              }}>
                <p style={{ fontWeight: 600 }}>{uploadResult.message}</p>
                {uploadResult.errors?.length > 0 && (
                  <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                    {uploadResult.errors.slice(0, 10).map((err: string, i: number) => (
                      <li key={i} style={{ color: '#b45309' }}>{err}</li>
                    ))}
                    {uploadResult.errors.length > 10 && (
                      <li style={{ color: '#b45309' }}>...외 {uploadResult.errors.length - 10}건</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowUploadModal(false)} style={{ ...btnStyle('#6b7280'), padding: '8px 20px' }}>닫기</button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                style={{ ...btnStyle('#10b981'), padding: '8px 20px', opacity: (!uploadFile || uploading) ? 0.5 : 1 }}
              >
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 스타일 ── */
const thStyle: React.CSSProperties = {
  padding: '10px 12px', fontWeight: 600, fontSize: 12,
  textAlign: 'left', borderBottom: '2px solid var(--border-color)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
};
const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '4px 10px', fontSize: 12, borderRadius: 6,
  border: 'none', background: bg, color: '#fff', cursor: 'pointer',
});
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: 'var(--bg-base)', borderRadius: 16, padding: 28,
  width: 560, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600,
  color: 'var(--text-primary)',
};
const inputStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontWeight: 400,
};
