# ERP 개발 진행 현황 (Progress Tracker)
> 이 파일은 새 세션 시작 시 반드시 먼저 읽으세요.

## 현재 상태
- **최종 업데이트**: 2026-03-15
- **현재 Phase**: Phase 1 진행 중 (Step 1-6 완료, Step 1-7 대기)
- **전체 진행률**: 1 / 29 기능 (거래처 마스터 CRUD 완료)
- **UI 디자인**: 시안 C (하이브리드) 확정
- **DB**: Neon PostgreSQL (싱가포르 리전, 프로젝트명: pls-erp)

---

## 완료된 작업

### ✅ Phase 0: 환경 설정 (2026-03-14 완료)
- [x] Git 저장소 초기화 (.gitignore + 초기 커밋 22개 파일)
- [x] 백엔드 프로젝트 구조 생성 (src/backend/ 전체 디렉토리)
- [x] Python 가상환경 생성 (venv/) + 패키지 설치
- [x] 프론트엔드 환경 생성 (Vite + React + TypeScript + Tailwind)
- [x] **클라우드 PostgreSQL 연결 완료** (Neon, 싱가포르 리전)
- [x] .env 파일 생성 (DATABASE_URL, JWT 설정 등)
- [ ] Gemini API 키 설정 미완료 (Phase에서 필요할 때 설정)

### ✅ Phase 0.5: UI 디자인 시안 (2026-03-14 완료)
- [x] 시안 A/B/C HTML 제작
- [x] **시안 C 확정** — 다크 사이드바 + 슬레이트 블루그레이 콘텐츠

### ✅ Phase 1 진행 현황 (2026-03-15 시작)
- [x] Step 1-1: 백엔드 뼈대 코드 (main.py CORS, auth/m1/audit 라우터 등록)
- [x] Step 1-2: M1 DB 스키마 + Alembic 마이그레이션 (11개 테이블 생성)
  - departments, positions, users, permissions, role_permissions
  - audit_logs, customers, product_categories, products, form_configs
- [x] Step 1-3: 인증 시스템 (JWT 로그인, bcrypt 해싱, RBAC 의존성)
  - POST /api/v1/auth/login, GET /api/v1/auth/me
  - get_current_user, get_current_admin, require_role 의존성
- [x] Step 1-4: Audit Log 시스템 (서비스 + 관리자 조회 API)
  - GET /api/v1/audit/logs (관리자 전용, 페이지네이션)
  - log_action(), get_changed_fields() 유틸리티
- [x] Step 1-5: 프론트엔드 뼈대 (시안 C 기반 레이아웃)
  - 로그인 페이지, 대시보드, M1 시스템 페이지
  - Sidebar, Header, AppLayout 컴포넌트
  - Zustand 인증/사이드바 스토어, Axios API 클라이언트
  - TypeScript 에러 없음, 빌드 성공
- [x] 초기 데이터 시드 완료 (admin@pls-erp.com / admin1234)
- [x] Step 1-6: 거래처 마스터 CRUD (첫 수직 슬라이스 — DB→API→UI) ✅
  - 백엔드: schemas.py, service.py, router.py (5개 API 엔드포인트)
  - 프론트엔드: CustomersPage (목록/검색/정렬/페이지네이션/등록/수정/삭제 모달)
  - API: POST/GET/PUT/DELETE /api/v1/system/customers
  - 감사 로그 연동, RBAC 권한 체크, 사업자번호 자동 포맷팅

---

## 다음 단계

### Phase 1 남은 작업
- [ ] Step 1-7: 품목 마스터 CRUD
- [ ] Step 1-8: 부서/직급/사용자 관리
- [ ] Step 1-9: 동적 폼 빌더 (M1-F01)
- [ ] Step 1-10: AI 챗봇 내비게이션 (M1-F03)

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

---

## 핵심 참조 파일
| 파일 | 용도 |
|------|------|
| `agents/dante-db-architect.md` | M1~M7 전체 DB 스키마 SQL |
| `agents/aria-api-engineer.md` | 백엔드 구조, API 패턴, 인증 |
| `agents/nova-frontend-builder.md` | 프론트엔드 컴포넌트, UX 원칙 |
| `docs/ui-mockups/design-C-hybrid.html` | 확정된 UI 디자인 시안 |
| `src/backend/modules/m1_system/models.py` | M1 ORM 모델 |
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
