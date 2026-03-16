/**
 * M4 재무/회계 — 메인 페이지 (카드 그리드 네비게이션)
 */
import { useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const menuItems = [
  {
    title: '계정과목 관리',
    desc: '계정과목 체계 등록 및 관리',
    icon: BookOpenIcon,
    path: '/finance/accounts',
    color: 'border-amber-400',
    iconColor: 'text-amber-500',
    enabled: true,
  },
  {
    title: '전표 관리',
    desc: '전표 입력, 조회, 승인 처리',
    icon: DocumentTextIcon,
    path: '/finance/journals',
    color: 'border-blue-400',
    iconColor: 'text-blue-500',
    enabled: true,
  },
  {
    title: '세금계산서',
    desc: '매출/매입 세금계산서 발행 및 관리',
    icon: ReceiptPercentIcon,
    path: '/finance/invoices',
    color: 'border-emerald-400',
    iconColor: 'text-emerald-500',
    enabled: true,
  },
  {
    title: '결산 / 재무제표',
    desc: '시산표, 손익계산서, 재무상태표, 기간 마감',
    icon: ChartBarIcon,
    path: '/finance/closing',
    color: 'border-purple-400',
    iconColor: 'text-purple-500',
    enabled: true,
  },
];

export default function FinancePage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">M4 재무/회계</h1>
        <p className="text-sm text-slate-500 mt-1">
          계정과목, 전표, 세금계산서, 결산 등 재무/회계 관련 기능을 관리합니다.
        </p>
      </div>

      {/* 기능 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => item.enabled && navigate(item.path)}
              disabled={!item.enabled}
              className={`text-left bg-(--bg-card) rounded-xl p-6 border-l-4 ${item.color} border border-(--border-main) transition-all ${
                item.enabled
                  ? 'hover:shadow-md hover:bg-(--bg-main) cursor-pointer'
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
