# ERP 개발 진행 현황 (Progress Tracker)
> 이 파일은 새 세션 시작 시 반드시 먼저 읽으세요.

## 현재 상태
- **최종 업데이트**: 2026-03-15
- **현재 Phase**: Phase 2 완료 (M4 재무/회계 Step 2-1 ~ 2-5 전체 완료)
- **전체 진행률**: Phase 0 + 0.5 + Phase 1 (M1) + Phase 2 (M4) 완료
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

### Phase 3: M3 인사 및 급여/세무 관리 (M1, M4 필요)
- [ ] Step 3-1: M3 DB 스키마 + 마이그레이션
- [ ] Step 3-2: 사원 정보 관리 (인사카드)
- [ ] Step 3-3: 급여 관리
- [ ] Step 3-4: 근태/휴가 관리
- [ ] Step 3-5: 세무 관련

### Phase 4: M2 영업 및 수주 관리 (M1, M4 필요)
- [ ] Step 4-1: M2 DB 스키마 + 마이그레이션
- [ ] Step 4-2: 견적서/수주 관리
- [ ] Step 4-3: 매출 관리
- [ ] Step 4-4: 수금 관리

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
- M3-F04: 국세청 전자신고 파일

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
