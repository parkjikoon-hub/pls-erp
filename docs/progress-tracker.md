# ERP 개발 진행 현황 (Progress Tracker)
> 이 파일은 새 세션 시작 시 반드시 먼저 읽으세요.

## 현재 상태
- **최종 업데이트**: 2026-03-14
- **현재 Phase**: Phase 0.5 완료 → Phase 1 시작 대기
- **전체 진행률**: 0 / 29 기능 (외부 연동 5개 제외)
- **UI 디자인**: 시안 C (하이브리드) 확정

---

## 완료된 작업

### ✅ Phase 0: 환경 설정 (2026-03-14 완료)
- [x] Git 저장소 초기화 (.gitignore + 초기 커밋 22개 파일)
- [x] 백엔드 프로젝트 구조 생성 (src/backend/ 전체 디렉토리)
  - main.py, config.py, database.py, shared/response.py, shared/pagination.py
  - modules/m1~m7, auth/, audit/, tests/ 디렉토리
  - 모든 __init__.py 파일 생성
- [x] Python 가상환경 생성 (venv/) + 패키지 설치 (requirements.txt)
  - FastAPI 0.109, SQLAlchemy 2.0.25, asyncpg, Alembic, pytest 등
- [x] 프론트엔드 환경 생성 (Vite + React + TypeScript)
  - src/frontend/ 에 Vite 프로젝트 생성
  - Tailwind CSS, React Router, Axios, Zustand, Heroicons 설치
  - vite.config.ts에 Tailwind 플러그인 + API 프록시 설정
- [ ] **클라우드 PostgreSQL 연결 미완료** (Supabase/Neon 인스턴스 필요, .env 파일 생성 필요)
- [ ] Gemini API 키 설정 미완료

### ✅ Phase 0.5: UI 디자인 시안 (2026-03-14 완료)
- [x] 시안 A (클래식 ERP) HTML 제작 → docs/ui-mockups/design-A-classic.html
- [x] 시안 B (모던 SaaS) HTML 제작 → docs/ui-mockups/design-B-modern.html
- [x] 시안 C (하이브리드) HTML 제작 → docs/ui-mockups/design-C-hybrid.html
- [x] **시안 C 확정** — 수정사항 반영 완료:
  - 이모지 → 3D 그라디언트 SVG 아이콘으로 교체
  - 콘텐츠 배경색: 밝은 흰색 → 슬레이트 블루그레이(#dce1e9)
  - "Next-Gen ERP" → "PLS ERP"로 명칭 변경

---

## 다음 단계 (Phase 1: M1 시스템 아키텍처 & MDM)

### 선행 작업 (미완료)
- [ ] 클라우드 PostgreSQL 인스턴스 생성 (Supabase 또는 Neon)
- [ ] .env 파일 생성 (DATABASE_URL 등)

### Phase 1 구현 순서
- [ ] Step 1-1: 백엔드 뼈대 코드 (main.py CORS, 라우터 등록)
- [ ] Step 1-2: M1 DB 스키마 생성 (Alembic 마이그레이션)
- [ ] Step 1-3: 인증 시스템 (JWT 로그인, RBAC)
- [ ] Step 1-4: Audit Log 시스템
- [ ] Step 1-5: 프론트엔드 뼈대 (시안 C 기반 레이아웃, 공통 컴포넌트)
- [ ] Step 1-6: 거래처 마스터 CRUD (첫 수직 슬라이스)
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
- **DB**: 클라우드 PostgreSQL (Supabase 또는 Neon)
- **명칭**: "PLS ERP" (Next-Gen ERP 아님)

---

## 핵심 참조 파일
| 파일 | 용도 |
|------|------|
| `agents/dante-db-architect.md` | M1~M7 전체 DB 스키마 SQL |
| `agents/aria-api-engineer.md` | 백엔드 구조, API 패턴, 인증 |
| `agents/nova-frontend-builder.md` | 프론트엔드 컴포넌트, UX 원칙 |
| `docs/ui-mockups/design-C-hybrid.html` | 확정된 UI 디자인 시안 |
| `.claude/plans/proud-booping-sifakis.md` | 전체 개발 실행 계획서 |

---

## 다음 세션 시작 방법
```
docs/progress-tracker.md를 읽고 현재 상태에서 개발을 재개해줘.
클라우드 DB 설정부터 시작하고, Phase 1의 Step 1-1부터 순서대로 진행하자.
```
