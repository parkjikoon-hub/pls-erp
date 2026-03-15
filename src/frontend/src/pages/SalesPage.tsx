/**
 * M2 영업/수주 — 메인 페이지 (카드 그리드 네비게이션)
 */
import { useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const menuItems = [
  {
    title: '견적서 관리',
    desc: '견적서 작성/발송/수락/거절 관리',
    icon: DocumentTextIcon,
    path: '/sales/quotations',
    color: 'border-emerald-400',
    iconColor: 'text-emerald-500',
    enabled: true,
  },
  {
    title: '수주 관리',
    desc: '수주 등록, 상태 추적, 진행률 관리',
    icon: ClipboardDocumentListIcon,
    path: '/sales/orders',
    color: 'border-blue-400',
    iconColor: 'text-blue-500',
    enabled: true,
  },
  {
    title: '영업 현황',
    desc: '매출 통계, 거래처별 실적, 수주 현황 리포트',
    icon: ChartBarIcon,
    path: '/sales/dashboard',
    color: 'border-amber-400',
    iconColor: 'text-amber-500',
    enabled: true,
  },
];

export default function SalesPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">M2 영업/수주</h1>
        <p className="text-sm text-slate-500 mt-1">
          견적서 작성, 수주 관리, 매출 현황 등 영업 관련 기능을 관리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => item.enabled && navigate(item.path)}
              disabled={!item.enabled}
              className={`text-left bg-[#e8ecf2] rounded-xl p-6 border-l-4 ${item.color} border border-[#c8ced8] transition-all ${
                item.enabled
                  ? 'hover:shadow-md hover:bg-[#dce1e9] cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <Icon className={`w-8 h-8 mb-3 ${item.iconColor}`} />
              <h3 className="font-bold text-slate-700 mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
              {!item.enabled && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-500">
                  개발 예정
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
