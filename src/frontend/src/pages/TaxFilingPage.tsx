/**
 * M3 인사/급여 — 국세청 신고파일 다운로드 페이지
 * 담당자가 CSV 파일을 다운로드하여 홈택스에 수동 업로드합니다.
 */
import { useState } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import BackButton from '../components/BackButton';
import { useAuthStore } from '../stores/authStore';
import api from '../api/client';

export default function TaxFilingPage() {
  const { user } = useAuthStore();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const res = await api.get('/hr/reports/tax-filing', {
        params: { year, month },
        responseType: 'blob',
      });

      // Blob → 파일 다운로드
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8-sig' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `원천세신고_${year}년${String(month).padStart(2, '0')}월.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (axiosErr.response?.status === 404) {
        setError(`${year}년 ${month}월 급여대장이 없습니다. 먼저 급여 계산을 실행하세요.`);
      } else {
        setError('파일 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <BackButton to="/hr" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">국세청 신고파일 생성</h1>
          <p className="text-sm text-slate-500">
            원천세 신고용 CSV 파일을 생성하여 홈택스에 수동 업로드합니다.
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto">
        <div className="bg-(--bg-card) rounded-2xl p-8 border border-(--border-main)">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
              <DocumentArrowDownIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-800 text-center mb-2">
            원천세 신고 파일 다운로드
          </h2>
          <p className="text-sm text-slate-500 text-center mb-6">
            급여 계산이 완료된 월의 원천세 신고용 CSV 파일을 생성합니다.
            <br />
            다운로드한 파일을 홈택스에 업로드하여 신고하세요.
          </p>

          {/* 기간 선택 */}
          <div className="flex gap-3 justify-center mb-6">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-4 py-2.5 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-rose-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-4 py-2.5 text-sm rounded-lg border border-(--border-main) bg-white focus:outline-none focus:border-rose-500"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-rose-600 rounded-lg hover:from-rose-600 hover:to-rose-700 transition-all disabled:opacity-50 shadow-sm"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {downloading ? 'CSV 파일 생성 중...' : 'CSV 파일 다운로드'}
          </button>

          {/* 안내 */}
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">사용 안내</h3>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>위에서 귀속 연월을 선택하고 CSV 파일을 다운로드합니다.</li>
              <li>홈택스 (hometax.go.kr)에 로그인합니다.</li>
              <li>원천세 신고 메뉴에서 신고서를 작성합니다.</li>
              <li>다운로드한 CSV 파일의 데이터를 참고하여 신고서를 작성합니다.</li>
              <li>신고서 제출 후 접수번호를 확인합니다.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
