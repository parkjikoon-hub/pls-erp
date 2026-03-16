/**
 * M3 인사/급여 — 메인 페이지 (카드 그리드 네비게이션)
 */
import { useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  DocumentChartBarIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

const menuItems = [
  {
    title: '사원 관리',
    desc: '직원 인사카드 등록/조회/수정',
    icon: UserGroupIcon,
    path: '/hr/employees',
    color: 'border-violet-400',
    iconColor: 'text-violet-500',
    enabled: true,
  },
  {
    title: '근태/휴가 관리',
    desc: '휴가, 병가, 결근 등 예외 근태 기록',
    icon: CalendarDaysIcon,
    path: '/hr/attendance',
    color: 'border-blue-400',
    iconColor: 'text-blue-500',
    enabled: true,
  },
  {
    title: '급여 관리',
    desc: '월급여 계산, 4대보험, 소득세 자동 산출',
    icon: BanknotesIcon,
    path: '/hr/payroll',
    color: 'border-emerald-400',
    iconColor: 'text-emerald-500',
    enabled: true,
  },
  {
    title: '급여명세서 / 보고서',
    desc: '급여명세서 조회, 인사 통계 보고서',
    icon: DocumentChartBarIcon,
    path: '/hr/reports',
    color: 'border-amber-400',
    iconColor: 'text-amber-500',
    enabled: true,
  },
  {
    title: '국세청 신고파일',
    desc: '원천세 신고용 파일 생성 (수동 다운로드)',
    icon: DocumentArrowDownIcon,
    path: '/hr/tax-filing',
    color: 'border-rose-400',
    iconColor: 'text-rose-500',
    enabled: true,
  },
];

export default function HRPage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">M3 인사/급여</h1>
        <p className="text-sm text-slate-500 mt-1">
          사원 정보, 근태, 급여 계산, 세무 신고 등 인사/급여 관련 기능을 관리합니다.
        </p>
      </div>

      {/* 기능 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
