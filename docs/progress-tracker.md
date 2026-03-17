# ERP 개발 진행 현황 (Progress Tracker)
> 이 파일은 새 세션 시작 시 반드시 먼저 읽으세요.

## 현재 상태
- **최종 업데이트**: 2026-03-17
- **현재 Phase**: Phase 7 완료 — 전 모듈 구현 완료!
- **전체 진행률**: Phase 0~7 전체 완료 (M1~M7 7개 모듈)
- **배포**: Render 통합 배포 (프론트+백엔드) — https://pls-erp-api.onrender.com
- **시뮬레이션**: 전체 모듈 API 정상 동작 확인 (2026-03-17)
- **UI 디자인**: 시안 C (하이브리드) 확정
- **DB**: Neon PostgreSQL (싱가포르 리전, 프로젝트명: pls-erp)

---

## 완료된 작업

### Phase 0: 환경 설정 (2026-03-14 완료)
- [x] Git 저장소 초기화 (.gitignore + 초기 커밋 22개 파일)
- [x] 백엔드 프로젝트 구조 생성 (src/backend/ 전체 디렉토리)
- [x] Python 가상환경 생성 (venv/) + 패키지 설치
- [x] 프론트엔드 환경 생성 (Vite + React + TypeScript + Tailwind)
- [x] **클라우드 PostgreSQL 연결 완료** (Neon, 싱가포르 리전)
- [x] .env 파일 생성 (DATABASE_URL, JWT 설정 등)
- [ ] Gemini API 키 설정 미완료 (Phase에서 필요할 때 설정)

### Phase 0.5: UI 디자인 시안 (2026-03-14 완료)
- [x] 시안 A/B/C HTML 제작
- [x] **시안 C 확정** — 다크 사이드바 + 슬레이트 블루그레이 콘텐츠

### Phase 1: M1 시스템 아키텍처 & MDM (2026-03-15 완료)
- [x] Step 1-1: 백엔드 뼈대 코드 (main.py CORS, auth/m1/audit 라우터 등록)
- [x] Step 1-2: M1 DB 스키마 + Alembic 마이그레이션 (11개 테이블 생성)
- [x] Step 1-3: 인증 시스템 (JWT 로그인, bcrypt 해싱, RBAC)
- [x] Step 1-4: Audit Log 시스템 (서비스 + 관리자 조회 API)
- [x] Step 1-5: 프론트엔드 뼈대 (시안 C 기반 레이아웃)
- [x] 초기 데이터 시드 완료 (admin@pls-erp.com / admin1234)
- [x] Step 1-6: 거래처 마스터 CRUD + Excel 일괄 업로드
- [x] Step 1-7: 품목 마스터 CRUD + Excel 업로드
- [x] Step 1-8: 부서/직급/사용자 관리 (탭 기반 통합 UI)
- [x] Step 1-9: 동적 폼 빌더 (M1-F01)
- [x] Step 1-10: AI 챗봇 내비게이션 (M1-F03)

### Phase 2: M4 재무/회계 (2026-03-15 완료)
- [x] Step 2-1: DB 스키마 + Alembic 마이그레이션 (7개 테이블)
  - ChartOfAccounts, FiscalYear, JournalEntry, JournalEntryLine
  - TaxInvoice, BankTransfer, BankTransferLine
  - 시드 데이터: 한국 표준 계정과목 69개 + 2026 회계연도
- [x] Step 2-2: 계정과목 마스터 CRUD + 회계연도 관리
  - 백엔드: schemas/accounts.py, services/account_service.py, routers/account_router.py
  - 백엔드: schemas/fiscal_years.py, services/fiscal_year_service.py, routers/fiscal_year_router.py
  - 프론트엔드: AccountsPage (유형필터/검색/CRUD), FinancePage (카드 그리드)
  - API: /finance/accounts (6개), /finance/fiscal-years (3개)
- [x] Step 2-3: 전표 입력/조회/승인 (복식부기 검증)
  - 백엔드: schemas/journals.py, services/journal_service.py, routers/journal_router.py
  - 프론트엔드: JournalListPage (목록+워크플로우), JournalFormPage (동적 분개 라인+계정검색)
  - 복식부기 검증 (차변=대변), 전표번호 자동 생성 (JE-YYYYMM-NNNN)
  - 상태 워크플로우: draft→review→approved→posted
  - API: /finance/journals (10개 엔드포인트)
- [x] Step 2-4: 세금계산서 발행/관리
  - 백엔드: schemas/invoices.py, services/invoice_service.py, routers/invoice_router.py
  - 프론트엔드: InvoicesPage (매출/매입 탭, 확정, 기간합계)
  - 확정(confirm) 시 자동 전표 생성 (매출: 매출채권/매출/부가세예수금, 매입: 매출원가/부가세대급금/매입채무)
  - API: /finance/invoices (7개 엔드포인트)
- [x] Step 2-5: 결산 마감 + 재무제표
  - 백엔드: schemas/closing.py, services/closing_service.py, routers/closing_router.py
  - 프론트엔드: ClosingPage (시산표/손익계산서/재무상태표/기간마감 4탭)
  - 시산표: posted 전표 계정별 차대변 합계
  - 손익계산서: 수익-비용=당기순이익
  - 재무상태표: 자산=부채+자본+당기순이익
  - 기간 마감: 미결전표 확인 → posted→closed → 회계연도 마감
  - API: /finance/closing (5개 엔드포인트)

---

## 다음 단계

### Phase 3: M3 인사/급여 (2026-03-15 완료)
- [x] Step 3-1: DB 스키마 + Alembic 마이그레이션 (4개 테이블)
  - Employee (인사카드, M1 User 1:1 연결)
  - AttendanceRecord (예외 기반 근태: 연차/병가/결근)
  - PayrollHeader (월별 급여대장)
  - PayrollDetail (개인별 급여명세: 지급 8항목 + 공제 6항목)
- [x] Step 3-2: 사원 관리 CRUD (인사카드)
  - 백엔드: schemas/employees.py, services/employee_service.py, routers/employee_router.py
  - 프론트엔드: EmployeesPage (검색/필터/CRUD + 3 필드셋 모달)
  - API: /hr/employees (6개 엔드포인트)
- [x] Step 3-3: 근태/휴가 관리 (예외 기반)
  - 백엔드: schemas/attendance.py, services/attendance_service.py, routers/attendance_router.py
  - 프론트엔드: AttendancePage (연/월/유형 필터, 등록/삭제 + 연차 자동 차감/복원)
  - API: /hr/attendance (4개 엔드포인트)
- [x] Step 3-4: 급여 계산 엔진
  - 4대보험 (국민연금 4.5%, 건강보험 3.545%, 장기요양 12.81%, 고용보험 0.9%)
  - 소득세 (간이세액표 기반 구간별 계산), 지방소득세 (소득세의 10%)
  - 비과세 자동 분류 (식대/자가운전/연구활동비/육아수당 각 20만원 한도)
  - 프론트엔드: PayrollPage (계산/승인/요약카드/상세테이블)
  - API: /hr/payroll (4개 엔드포인트)
- [x] Step 3-5: 급여명세서 + 인사 통계 보고서
  - 백엔드: services/report_service.py, routers/report_router.py
  - 프론트엔드: HRReportsPage (급여명세서 탭 + 인사통계 탭)
  - API: /hr/reports (3개 엔드포인트)
- [x] Step 3-6: 국세청 신고 파일 생성 (수동 다운로드)
  - CSV 생성 (utf-8-sig BOM, 홈택스 업로드용)
  - 프론트엔드: TaxFilingPage (연/월 선택 → CSV 다운로드 + 사용 가이드)
  - API: GET /hr/reports/tax-filing (StreamingResponse)

### Phase 4: M2 영업/수주 (2026-03-15 완료)
- [x] Step 4-1: DB 스키마 + Alembic 마이그레이션 (4개 테이블)
  - Quotation (견적서 헤더), QuotationLine (견적서 라인)
  - SalesOrder (수주 헤더), SalesOrderLine (수주 라인)
- [x] Step 4-2: 견적서 CRUD
  - 백엔드: schemas/quotations.py, services/quotation_service.py, routers/quotation_router.py
  - 프론트엔드: QuotationsPage (목록/필터/생성/수정 모달 + 동적 라인)
  - 상태 워크플로우: draft→sent→accepted/rejected
  - 견적번호 자동 생성 (QT-YYYYMM-NNNN)
  - API: /sales/quotations (6개 엔드포인트)
- [x] Step 4-3: 수주 관리 CRUD
  - 백엔드: schemas/orders.py, services/order_service.py, routers/order_router.py
  - 프론트엔드: SalesOrdersPage (목록/필터/생성/수정/상태변경 모달 + 진행률 바)
  - 상태 워크플로우: confirmed→in_production→shipped→completed→invoiced
  - 견적서→수주 전환 기능 (from-quotation 엔드포인트)
  - 수주번호 자동 생성 (SO-YYYYMM-NNNN)
  - API: /sales/orders (7개 엔드포인트)
- [x] Step 4-4: 영업 현황 대시보드
  - 프론트엔드: SalesDashboardPage (요약카드 + 최근 견적/수주 목록)
  - SalesPage (M2 메인 카드 그리드)

### Phase 5: M5 생산/SCM (2026-03-15 완료)
- [x] Step 5-1: DB 스키마 + Alembic 마이그레이션 (9개 테이블)
  - Warehouse, BomHeader, BomLine, Inventory, InventoryTransaction
  - WorkOrder, QcInspection, Shipment, ShipmentLine
  - 시드 데이터: 4개 창고 (WH-RAW, WH-WIP, WH-FIN, WH-DEF)
- [x] Step 5-2: BOM 관리 CRUD + 다단계 트리 전개
  - 백엔드: schemas/bom.py, services/bom_service.py, routers/bom_router.py
  - 프론트엔드: BomPage (목록/생성/수정 + 재귀 트리 뷰 + 소요자재 계산)
  - 다단계 BOM 트리 전개 (순환참조 방지), 스크랩율 반영
  - API: /production/bom (7개 엔드포인트)
- [x] Step 5-3: 재고 관리 — 창고/입출고/이관/부족 알림
  - 백엔드: schemas/inventory.py, services/inventory_service.py, routers/inventory_router.py
  - 프론트엔드: InventoryPage (재고현황/이동이력/부족재고 3탭 + 입출고/이관/조정 모달)
  - DB 레벨 CHECK 제약 (qty >= 0), 수주 기준 소요량 계산
  - API: /production/inventory (9개 엔드포인트)
- [x] Step 5-4: 작업지시서 CRUD + 수주 전환 + 칸반 UI
  - 백엔드: schemas/work_orders.py, services/work_order_service.py, routers/work_order_router.py
  - 프론트엔드: WorkOrdersPage (칸반보드 4열 + 리스트뷰 토글 + 수주→WO 전환)
  - 상태 흐름: pending→in_progress→qc_wait→completed
  - in_progress 전환 시 BOM 전개 → 원자재 자동 출고
  - API: /production/work-orders (7개 엔드포인트)
- [x] Step 5-5: QC 검사 + 합격 시 완제품 자동 이관
  - 백엔드: schemas/qc.py, services/qc_service.py, routers/qc_router.py
  - 프론트엔드: QcPage (검사이력 테이블 + 등록 모달 + 합격률 바)
  - 합격: WIP→완제품 이관 + WO 완료, 불합격: WIP→불량품, 재작업: WO→진행중
  - API: /production/qc (2개 엔드포인트)
- [x] Step 5-6: 출하 관리 + 배송 추적 + 거래명세서
  - 백엔드: schemas/shipments.py, services/shipment_service.py, routers/shipment_router.py
  - 프론트엔드: ShipmentsPage (목록/상세/수주→출하 전환 + 거래명세서 인쇄)
  - 상태 흐름: pending→picked→shipped→delivered
  - picked: 완제품 창고 자동 출고, shipped: 거래명세서 번호 자동 발행
  - API: /production/shipments (7개 엔드포인트)
- [x] Step 5-7: 생산 대시보드 + Sidebar 활성화
  - 프론트엔드: ProductionPage (현황카드 + 하위메뉴 카드 그리드)
  - Sidebar M5 활성화 (disabled 제거)

### Phase 6: M6 그룹웨어 (2026-03-15 완료)
- [x] Step 6-1: DB 스키마 + Alembic 마이그레이션 (5개 테이블)
  - ApprovalTemplate (결재선 템플릿), ApprovalTemplateLine (템플릿 단계)
  - ApprovalRequest (결재 요청), ApprovalStep (결재/참조 단계)
  - Notice (공지사항)
- [x] Step 6-2: 결재선 템플릿 CRUD
  - 백엔드: schemas/approvals.py, services/template_service.py, routers/template_router.py
  - 자주 쓰는 결재선 저장/불러오기/삭제
  - API: /groupware/templates (3개 엔드포인트)
- [x] Step 6-3: 결재 요청/승인/반려 엔진
  - 백엔드: services/approval_service.py, routers/approval_router.py
  - 범용 결재 엔진: document_type + reference_type/id로 ERP 문서 연결
  - 결재선 vs 참조선 분리 (step_type: approval/reference)
  - 순차 결재 + 즉시 반려 흐름
  - 결재번호 자동 생성 (AP-YYYYMM-NNNN)
  - API: /groupware/approvals (9개 엔드포인트)
- [x] Step 6-4: 공지사항 CRUD
  - 백엔드: schemas/notices.py, services/notice_service.py, routers/notice_router.py
  - 관리자/매니저만 작성, 고정글 우선 정렬, 조회수 자동 증가
  - API: /groupware/notices (5개 엔드포인트)
- [x] Step 6-5: 프론트엔드 UI + Sidebar 활성화
  - 프론트엔드: GroupwarePage (메인 현황), ApprovalsPage (3탭 결재함)
  - ApprovalFormPage (기안 작성 + 템플릿 불러오기 + 결재선/참조선 설정)
  - ApprovalDetailPage (상세 + 승인/반려 액션)
  - ApprovalTemplatesPage (템플릿 관리)
  - NoticesPage (공지 목록/상세/작성/수정/삭제)
  - API: api/groupware/approvals.ts, api/groupware/notices.ts
  - Sidebar M6 활성화 (disabled 제거)

### Phase 7: M7 알림센터 (2026-03-15 완료)
- [x] Step 7-1: DB 스키마 + Alembic 마이그레이션 (2개 테이블)
  - Notification (인앱 알림: 유형별 분류, ERP 문서 연결, 읽음 처리)
  - NotificationSetting (사용자별 알림 수신 설정)
- [x] Step 7-2: 알림 서비스 + 라우터
  - 백엔드: schemas/notifications.py, services/notification_service.py, routers/notification_router.py
  - 알림 생성 (다른 모듈에서 호출 가능), 목록 조회, 읽음/전체읽음, 설정 관리
  - API: /notifications (6개 엔드포인트)
- [x] Step 7-3: 프론트엔드 UI + Sidebar 활성화
  - 프론트엔드: NotificationsPage (전체/읽지않음/설정 3탭 + 유형 필터)
  - 헤더 벨 아이콘 (읽지 않은 알림 뱃지, 30초 자동 갱신)
  - API: api/notifications.ts
  - Sidebar M7 활성화 (disabled 제거)

### 배포 & 시뮬레이션 (2026-03-16 완료)
- [x] Render 프론트+백엔드 통합 배포 (main.py StaticFiles + render.yaml 빌드 수정)
- [x] 더미 데이터 시뮬레이션 스크립트 작성 (scripts/seed_demo_data.py)
- [x] 시뮬레이션 실행: 로그인/거래처/품목/견적/수주/작업지시/직원/대시보드 성공
- [x] **M4 재무 모듈 500 에러 수정 완료** (2026-03-17)
  - 원인 1: users.allowed_modules 컬럼 DB 미존재 → 앱 시작 시 자동 생성
  - 원인 2: M4 Pydantic 스키마 UUID 타입 불일치 (str→uuid.UUID)
  - 원인 3: M6/M7 테이블 DB 미존재 → create_all로 자동 생성
  - 원인 4: M4 relationship lazy loading 미설정 → lazy="noload" 추가
- [ ] 재고(M5) 창고-품목 연동 보완 필요

### AI 기능 (별도 Step, 나중에 추가)
- [ ] M4-F01: 영수증 OCR (Gemini Vision → 자동 분개)
- [ ] M4-F01: 계정과목 AI 추천 (적요→계정 매칭)
- [ ] M4-F03: R&D 대체분개 자동화
- [ ] M4-F04: 국세청 전자세금계산서 전송
- [ ] AI 결산 보고서 생성

---

## 제외 기능 (외부 연동)
- M1-F06: 이카운트 OpenAPI 스크래핑
- M1-F07: 병행 운영 실시간 동기화
- M4-F04: 국세청 API 전송 (수동 발행으로 대체)
- M4-F05: 뱅킹 연동 이체 (수동 입력으로 대체)
- M3-F04: 국세청 전자신고 자동 전송 (수동 CSV 다운로드로 대체 — Step 3-6 구현 완료)

---

## 개발 전략
- **수직 슬라이스**: 한 기능을 DB→API→UI까지 완전히 구현 후 다음으로 이동
- **UI**: 시안 C (하이브리드) 기반 — 다크 사이드바 + 슬레이트 블루그레이 콘텐츠
- **DB**: Neon PostgreSQL (싱가포르 리전, pls-erp 프로젝트)
- **명칭**: "PLS ERP" (Next-Gen ERP 아님)
- **M4 코드 구조**: 도메인별 파일 분리 (schemas/, services/, routers/ 서브디렉토리)

---

## 핵심 참조 파일
| 파일 | 용도 |
|------|------|
| `agents/dante-db-architect.md` | M1~M7 전체 DB 스키마 SQL |
| `agents/aria-api-engineer.md` | 백엔드 구조, API 패턴, 인증 |
| `agents/nova-frontend-builder.md` | 프론트엔드 컴포넌트, UX 원칙 |
| `docs/ui-mockups/design-C-hybrid.html` | 확정된 UI 디자인 시안 |
| `src/backend/modules/m1_system/` | M1 ORM 모델 + 서비스 + 라우터 |
| `src/backend/modules/m4_finance/` | M4 재무/회계 전체 모듈 |
| `src/backend/modules/m3_hr/` | M3 인사/급여 전체 모듈 |
| `src/backend/modules/m2_sales/` | M2 영업/수주 전체 모듈 |
| `src/backend/modules/m5_production/` | M5 생산/SCM 전체 모듈 |
| `src/backend/modules/m6_groupware/` | M6 그룹웨어 전체 모듈 |
| `src/backend/modules/m7_notifications/` | M7 알림센터 전체 모듈 |
| `src/backend/auth/` | JWT 인증 모듈 |
| `src/frontend/src/` | React 프론트엔드 코드 |

---

## 로그인 계정
| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@pls-erp.com | admin1234 |
| 테스트 | user@pls-erp.com | user1234 |

---

## 다음 세션 시작 방법
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
