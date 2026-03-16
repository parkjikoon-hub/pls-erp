/**
 * 뒤로가기 버튼 — 입체적 사각 박스 디자인, 시인성 강조
 * 3D 그림자 + 그라데이션 + 호버 애니메이션
 * 다크모드 대응
 */
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to: string;
  label?: string;
}

export default function BackButton({ to, label = '돌아가기' }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="
        group flex items-center gap-2 px-4 py-2.5 rounded-xl
        bg-gradient-to-b from-white to-slate-100
        dark:from-slate-700 dark:to-slate-800
        border border-slate-200/80 dark:border-slate-600/80
        shadow-[0_2px_8px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]
        dark:shadow-[0_2px_8px_rgba(0,0,0,0.30),0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]
        hover:shadow-[0_4px_16px_rgba(0,0,0,0.13),0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)]
        hover:from-white hover:to-slate-50
        dark:hover:from-slate-600 dark:hover:to-slate-700
        active:shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_3px_rgba(0,0,0,0.06)]
        active:from-slate-50 active:to-slate-100
        dark:active:from-slate-800 dark:active:to-slate-900
        active:translate-y-[1px]
        transition-all duration-150 cursor-pointer
      "
    >
      {/* 입체적 화살표 아이콘 박스 */}
      <span className="
        flex items-center justify-center w-8 h-8 rounded-lg
        bg-gradient-to-b from-slate-600 to-slate-700
        shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.15)]
        group-hover:from-emerald-500 group-hover:to-emerald-600
        group-hover:shadow-[0_2px_8px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]
        transition-all duration-200
      ">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-white group-hover:-translate-x-0.5 transition-transform duration-200"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors pr-1">
        {label}
      </span>
    </button>
  );
}
