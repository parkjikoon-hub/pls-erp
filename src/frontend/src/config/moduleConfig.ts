/**
 * 모듈 설정 — 사이드바, 헤더, 탭바에서 공유하는 모듈 메타데이터
 * 각 모듈의 이름, 색상, 아이콘, 세부 탭(하위 페이지) 정보를 정의합니다.
 */

export interface ModuleTab {
  label: string;
  path: string;
}

export interface ModuleInfo {
  id: string;
  name: string;
  color: string;
  /** 사이드바에 표시할 SVG 아이콘 (Heroicons outline 이름) */
  iconName: string;
  /** 상단 탭에 표시할 세부 항목 목록 */
  tabs: ModuleTab[];
  /** 접근 권한 체크용 모듈 키 (null이면 항상 접근 가능) */
  moduleKey: string | null;
}

/** 모듈 정의 — 사이드바 순서대로 */
export const MODULES: ModuleInfo[] = [
  {
    id: 'dashboard',
    name: '대시보드',
    color: '#10b981',
    iconName: 'dashboard',
    tabs: [],
    moduleKey: null,
  },
  {
    id: 'system',
    name: '시스템관리',
    color: '#3b82f6',
    iconName: 'settings',
    tabs: [
      { label: '거래처관리', path: '/system/customers' },
      { label: '품목관리', path: '/system/products' },
      { label: '사용자관리', path: '/system/users' },
      { label: '동적 폼 빌더', path: '/system/form-builder' },
    ],
    moduleKey: 'system',
  },
  {
    id: 'sales',
    name: '영업관리',
    color: '#10b981',
    iconName: 'trending',
    tabs: [
      { label: '견적서', path: '/sales/quotations' },
      { label: '수주관리', path: '/sales/orders' },
      { label: '판매가관리', path: '/sales/price-lists' },
      { label: '영업현황', path: '/sales/dashboard' },
    ],
    moduleKey: 'sales',
  },
  {
    id: 'production',
    name: '생산관리',
    color: '#ef4444',
    iconName: 'factory',
    tabs: [
      { label: 'BOM관리', path: '/production/bom' },
      { label: '재고관리', path: '/production/inventory' },
      { label: '작업지시', path: '/production/work-orders' },
      { label: '품질검사', path: '/production/qc' },
      { label: '출하관리', path: '/production/shipments' },
    ],
    moduleKey: 'production',
  },
  {
    id: 'finance',
    name: '재무회계',
    color: '#f59e0b',
    iconName: 'wallet',
    tabs: [
      { label: '계정과목', path: '/finance/accounts' },
      { label: '전표관리', path: '/finance/journals' },
      { label: '세금계산서', path: '/finance/invoices' },
      { label: '입금가져오기', path: '/finance/bank-import' },
      { label: '거래처분석', path: '/finance/customer-analysis' },
      { label: '결산마감', path: '/finance/closing' },
    ],
    moduleKey: 'finance',
  },
  {
    id: 'hr',
    name: '인사급여',
    color: '#8b5cf6',
    iconName: 'people',
    tabs: [
      { label: '사원관리', path: '/hr/employees' },
      { label: '근태관리', path: '/hr/attendance' },
      { label: '급여관리', path: '/hr/payroll' },
      { label: 'HR보고서', path: '/hr/reports' },
      { label: '세무신고', path: '/hr/tax-filing' },
    ],
    moduleKey: 'hr',
  },
  {
    id: 'groupware',
    name: '그룹웨어',
    color: '#06b6d4',
    iconName: 'mail',
    tabs: [
      { label: '전자결재', path: '/groupware/approvals' },
      { label: '공지사항', path: '/groupware/notices' },
      { label: '결재템플릿', path: '/groupware/templates' },
    ],
    moduleKey: 'groupware',
  },
  {
    id: 'notifications',
    name: '알림센터',
    color: '#f97316',
    iconName: 'bell',
    tabs: [],
    moduleKey: 'notifications',
  },
];

/**
 * URL 경로에서 현재 활성 모듈을 찾는 헬퍼
 * 예: '/system/customers' → system 모듈
 */
export function getActiveModule(pathname: string): ModuleInfo | undefined {
  if (pathname === '/') return MODULES[0]; // 대시보드
  const basePath = '/' + pathname.split('/')[1];
  return MODULES.find((m) => {
    if (m.id === 'dashboard') return false;
    // 모듈 ID 기반 매칭
    const moduleBasePath = '/' + m.id;
    // notifications 예외 처리
    if (m.id === 'notifications' && basePath === '/notifications') return true;
    return basePath === moduleBasePath;
  });
}

/**
 * URL 경로에서 현재 활성 탭 인덱스를 찾는 헬퍼
 */
export function getActiveTabIndex(module: ModuleInfo, pathname: string): number {
  const idx = module.tabs.findIndex((tab) => pathname.startsWith(tab.path));
  return idx >= 0 ? idx : 0;
}
