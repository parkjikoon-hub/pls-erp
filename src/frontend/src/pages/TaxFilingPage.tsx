/**
 * M3 인사/급여 — 국세청 신고파일 다운로드 페이지
 * 담당자가 CSV 파일을 다운로드하여 홈택스에 수동 업로드합니다.
 */
import { useState } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
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

          {/* CSV 파일 구성 안내 */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">CSV 파일 포함 항목</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>· 사번 / 성명</span>
              <span>· 기본급 / 초과근무수당</span>
              <span>· 상여금 / 식대 / 수당</span>
              <span>· 총 지급액 / 과세급여</span>
              <span>· 소득세 / 지방소득세</span>
              <span>· 국민연금 / 건강보험</span>
              <span>· 장기요양 / 고용보험</span>
              <span>· 총 공제액 / 실수령액</span>
            </div>
          </div>

          {/* 홈택스 신고 절차 */}
          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">홈택스 원천세 신고 절차</h3>
            <ol className="text-xs text-amber-700 space-y-2 list-decimal list-inside">
              <li><strong>CSV 다운로드</strong> — 위에서 귀속 연월을 선택하고 파일을 다운로드합니다.</li>
              <li><strong>홈택스 접속</strong> — hometax.go.kr에 사업자 공동인증서로 로그인합니다.</li>
              <li>
                <strong>신고서 작성 경로</strong>
                <div className="ml-4 mt-1 text-amber-600">
                  세금신고 → 원천세 → 정기신고 → 근로소득 간이지급명세서
                </div>
              </li>
              <li><strong>신고서 작성</strong> — CSV 파일의 데이터(인원수, 총 지급액, 소득세 등)를 신고서 각 항목에 입력합니다.</li>
              <li><strong>세액 확인</strong> — 소득세 + 지방소득세 합계가 CSV 파일의 합계와 일치하는지 확인합니다.</li>
              <li><strong>제출 및 납부</strong> — 신고서 제출 → 접수번호 확인 → 납부서 출력 → 은행 납부합니다.</li>
            </ol>
          </div>

          {/* 신고 일정 안내 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">신고 및 납부 기한</h3>
            <div className="text-xs text-blue-700 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-medium w-28 shrink-0">매월 신고/납부</span>
                <span>급여 지급 다음달 <strong>10일</strong>까지 (예: 3월분 → 4월 10일)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium w-28 shrink-0">반기별 신고</span>
                <span>상반기(1~6월): <strong>7월 10일</strong>, 하반기(7~12월): <strong>1월 10일</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium w-28 shrink-0">연말정산</span>
                <span>매년 <strong>2월</strong> 급여 시 정산, 3월 10일까지 신고</span>
              </div>
            </div>
          </div>

          {/* 주의사항 */}
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="text-sm font-semibold text-red-800 mb-2">주의사항</h3>
            <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
              <li>CSV 파일은 <strong>급여 계산 완료</strong> 후에만 생성 가능합니다.</li>
              <li>급여가 수정된 경우 반드시 <strong>CSV를 다시 다운로드</strong>하세요.</li>
              <li>신고 기한(매월 10일) 초과 시 <strong>가산세</strong>가 부과될 수 있습니다.</li>
              <li>비과세 항목(식대·자가운전·연구활동비·육아수당)은 과세급여에서 제외됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
