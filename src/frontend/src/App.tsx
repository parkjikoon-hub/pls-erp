/**
 * PLS ERP — 메인 앱 라우터
 * 인증 여부에 따라 로그인 페이지 또는 메인 레이아웃을 표시합니다.
 * 모듈별 접근 권한 가드를 적용합니다.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import ProductsPage from './pages/ProductsPage';
import UsersPage from './pages/UsersPage';
import FormBuilderPage from './pages/FormBuilderPage';
import AccountsPage from './pages/AccountsPage';
import JournalListPage from './pages/JournalListPage';
import JournalFormPage from './pages/JournalFormPage';
import InvoicesPage from './pages/InvoicesPage';
import ClosingPage from './pages/ClosingPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import PayrollPage from './pages/PayrollPage';
import HRReportsPage from './pages/HRReportsPage';
import TaxFilingPage from './pages/TaxFilingPage';
import QuotationsPage from './pages/QuotationsPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import SalesDashboardPage from './pages/SalesDashboardPage';
import PriceListPage from './pages/PriceListPage';
import BomPage from './pages/BomPage';
import InventoryPage from './pages/InventoryPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import QcPage from './pages/QcPage';
import ShipmentsPage from './pages/ShipmentsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ApprovalFormPage from './pages/ApprovalFormPage';
import ApprovalDetailPage from './pages/ApprovalDetailPage';
import ApprovalTemplatesPage from './pages/ApprovalTemplatesPage';
import NoticesPage from './pages/NoticesPage';
import NotificationsPage from './pages/NotificationsPage';

/** 인증된 사용자만 접근 가능한 라우트 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/** 모듈별 접근 권한 가드 — 권한 없으면 대시보드로 리다이렉트 */
function ModuleGuard({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const { hasModuleAccess } = useAuthStore();
  return hasModuleAccess(moduleKey) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 페이지 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 인증 필요 영역 */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />

          {/* M1 시스템관리 — /system → 첫 번째 탭(거래처관리)으로 리다이렉트 */}
          <Route path="/system" element={<ModuleGuard moduleKey="system"><Navigate to="/system/customers" replace /></ModuleGuard>} />
          <Route path="/system/customers" element={<ModuleGuard moduleKey="system"><CustomersPage /></ModuleGuard>} />
          <Route path="/system/products" element={<ModuleGuard moduleKey="system"><ProductsPage /></ModuleGuard>} />
          <Route path="/system/users" element={<ModuleGuard moduleKey="system"><UsersPage /></ModuleGuard>} />
          <Route path="/system/form-builder" element={<ModuleGuard moduleKey="system"><FormBuilderPage /></ModuleGuard>} />

          {/* M4 재무/회계 — /finance → 계정과목으로 리다이렉트 */}
          <Route path="/finance" element={<ModuleGuard moduleKey="finance"><Navigate to="/finance/accounts" replace /></ModuleGuard>} />
          <Route path="/finance/accounts" element={<ModuleGuard moduleKey="finance"><AccountsPage /></ModuleGuard>} />
          <Route path="/finance/journals" element={<ModuleGuard moduleKey="finance"><JournalListPage /></ModuleGuard>} />
          <Route path="/finance/journals/new" element={<ModuleGuard moduleKey="finance"><JournalFormPage /></ModuleGuard>} />
          <Route path="/finance/journals/:id" element={<ModuleGuard moduleKey="finance"><JournalFormPage /></ModuleGuard>} />
          <Route path="/finance/journals/:id/edit" element={<ModuleGuard moduleKey="finance"><JournalFormPage /></ModuleGuard>} />
          <Route path="/finance/invoices" element={<ModuleGuard moduleKey="finance"><InvoicesPage /></ModuleGuard>} />
          <Route path="/finance/closing" element={<ModuleGuard moduleKey="finance"><ClosingPage /></ModuleGuard>} />

          {/* M3 인사/급여 — /hr → 사원관리로 리다이렉트 */}
          <Route path="/hr" element={<ModuleGuard moduleKey="hr"><Navigate to="/hr/employees" replace /></ModuleGuard>} />
          <Route path="/hr/employees" element={<ModuleGuard moduleKey="hr"><EmployeesPage /></ModuleGuard>} />
          <Route path="/hr/attendance" element={<ModuleGuard moduleKey="hr"><AttendancePage /></ModuleGuard>} />
          <Route path="/hr/payroll" element={<ModuleGuard moduleKey="hr"><PayrollPage /></ModuleGuard>} />
          <Route path="/hr/reports" element={<ModuleGuard moduleKey="hr"><HRReportsPage /></ModuleGuard>} />
          <Route path="/hr/tax-filing" element={<ModuleGuard moduleKey="hr"><TaxFilingPage /></ModuleGuard>} />

          {/* M2 영업/수주 — /sales → 견적서로 리다이렉트 */}
          <Route path="/sales" element={<ModuleGuard moduleKey="sales"><Navigate to="/sales/quotations" replace /></ModuleGuard>} />
          <Route path="/sales/quotations" element={<ModuleGuard moduleKey="sales"><QuotationsPage /></ModuleGuard>} />
          <Route path="/sales/orders" element={<ModuleGuard moduleKey="sales"><SalesOrdersPage /></ModuleGuard>} />
          <Route path="/sales/price-lists" element={<ModuleGuard moduleKey="sales"><PriceListPage /></ModuleGuard>} />
          <Route path="/sales/dashboard" element={<ModuleGuard moduleKey="sales"><SalesDashboardPage /></ModuleGuard>} />

          {/* M5 생산/SCM — /production → BOM관리로 리다이렉트 */}
          <Route path="/production" element={<ModuleGuard moduleKey="production"><Navigate to="/production/bom" replace /></ModuleGuard>} />
          <Route path="/production/bom" element={<ModuleGuard moduleKey="production"><BomPage /></ModuleGuard>} />
          <Route path="/production/inventory" element={<ModuleGuard moduleKey="production"><InventoryPage /></ModuleGuard>} />
          <Route path="/production/work-orders" element={<ModuleGuard moduleKey="production"><WorkOrdersPage /></ModuleGuard>} />
          <Route path="/production/qc" element={<ModuleGuard moduleKey="production"><QcPage /></ModuleGuard>} />
          <Route path="/production/shipments" element={<ModuleGuard moduleKey="production"><ShipmentsPage /></ModuleGuard>} />

          {/* M6 그룹웨어 — /groupware → 전자결재로 리다이렉트 */}
          <Route path="/groupware" element={<ModuleGuard moduleKey="groupware"><Navigate to="/groupware/approvals" replace /></ModuleGuard>} />
          <Route path="/groupware/approvals" element={<ModuleGuard moduleKey="groupware"><ApprovalsPage /></ModuleGuard>} />
          <Route path="/groupware/approvals/new" element={<ModuleGuard moduleKey="groupware"><ApprovalFormPage /></ModuleGuard>} />
          <Route path="/groupware/approvals/:id" element={<ModuleGuard moduleKey="groupware"><ApprovalDetailPage /></ModuleGuard>} />
          <Route path="/groupware/templates" element={<ModuleGuard moduleKey="groupware"><ApprovalTemplatesPage /></ModuleGuard>} />
          <Route path="/groupware/notices" element={<ModuleGuard moduleKey="groupware"><NoticesPage /></ModuleGuard>} />

          {/* M7 알림센터 */}
          <Route path="/notifications" element={<ModuleGuard moduleKey="notifications"><NotificationsPage /></ModuleGuard>} />
        </Route>

        {/* 그 외 경로 → 대시보드로 이동 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
