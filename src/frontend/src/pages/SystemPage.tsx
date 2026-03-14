/**
 * M1 시스템 관리 페이지 — 거래처/품목/사용자 관리의 진입점
 * 카드를 클릭하면 각 관리 페이지로 이동합니다.
 */
import { useNavigate } from 'react-router-dom';
import {
  BuildingOffice2Icon,
  CubeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const menuItems = [
  {
    title: '거래처 관리',
    desc: '매출처/매입처 등록 및 관리',
    icon: BuildingOffice2Icon,
    path: '/system/customers',
    color: 'border-blue-400',
    iconColor: 'text-blue-500',
    enabled: true,
  },
  {
    title: '품목 관리',
    desc: '제품/자재/반제품 등록 및 관리',
    icon: CubeIcon,
    path: '/system/products',
    color: 'border-emerald-400',
    iconColor: 'text-emerald-500',
    enabled: true,
  },
  {
    title: '사용자 관리',
    desc: '부서/직급/계정 관리',
    icon: UserGroupIcon,
    path: '/system/users',
    color: 'border-purple-400',
    iconColor: 'text-purple-500',
    enabled: true,
  },
];

export default function SystemPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">M1 시스템 관리</h1>
      <p className="text-sm text-slate-500 mb-6">마스터 데이터 관리 (MDM) — 거래처, 품목, 사용자</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="flex items-start gap-3">
                <Icon className={`w-8 h-8 ${item.iconColor} flex-shrink-0`} />
                <div>
                  <h3 className="font-bold text-slate-700 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500 mb-2">{item.desc}</p>
                  {!item.enabled && (
                    <span className="text-xs text-slate-400">{item.step}에서 구현 예정</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
