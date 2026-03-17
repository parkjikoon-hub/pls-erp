# 세션 인수인계 노트
> **v4.0** | 최종 업데이트: **2026-03-17 10:00** | 작성자: Claude Code

## 변경 이력
| 버전 | 일시 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-03-15 16:50 | 초기 작성 (배포 + UI 개편) |
| v2.0 | 2026-03-16 15:30 | Render 통합 배포 + 더미 데이터 시뮬레이션 결과 |
| v3.0 | 2026-03-16 18:00 | Render master 브랜치 문제 해결 + 프론트엔드 dist/ 포함 |
| v4.0 | 2026-03-17 10:00 | **전체 API 500 에러 해결** (DB 마이그레이션 + M4 스키마 수정) |

---

## 이번 세션에서 완료한 작업

### 1. 전체 API 500 에러 원인 발견 및 해결
- **현상**: 로그인 포함 DB 사용 API 전부 500 에러
- **원인 1**: `users.allowed_modules` 컬럼이 코드에만 있고 DB에 없음
  - 해결: lifespan에서 `Base.metadata.create_all()` 호출 → 누락 테이블/컬럼 자동 생성
- **원인 2**: M6(그룹웨어), M7(알림) 테이블도 DB에 없음
  - 해결: 위와 동일 (create_all이 모든 누락 테이블 한번에 생성)
- **원인 3**: M4 Pydantic 스키마에서 UUID 필드가 `str`로 정의 → 직렬화 실패
  - 해결: 5개 스키마 파일의 30+ 필드를 `uuid.UUID`로 수정
- **원인 4**: M4 ChartOfAccounts 자기참조 relationship lazy loading 미설정
  - 해결: `lazy="noload"` 추가

### 2. 인프라 개선
- lifespan 함수에 에러 핸들링 추가 (seed 실패해도 앱 실행)
- health 엔드포인트 디버그 필드 제거

---

## 현재 배포 상태 (v4.0 기준 — 2026-03-17 10:00)

| 항목 | 상태 |
|------|------|
| Render 서비스 | `pls-erp-api` (free tier) |
| 감시 브랜치 | **master** (main 아님!) |
| 전체 API | **M1~M7 + 인증 + 대시보드 전부 정상 동작** |
| 프론트엔드 | dist/ 파일 git 포함, FastAPI StaticFiles로 서빙 |
| DB | Neon PostgreSQL (싱가포르), 자동 테이블 생성 활성화 |
| URL | https://pls-erp-api.onrender.com |

### API 테스트 결과 (2026-03-17)
| 모듈 | 엔드포인트 | 상태 |
|------|-----------|------|
| 인증 | POST /api/v1/auth/login | ✅ 정상 |
| M1 거래처 | GET /api/v1/system/customers | ✅ 정상 (6건) |
| M4 계정과목 | GET /api/v1/finance/accounts | ✅ 정상 (69건) |
| M3 인사 | GET /api/v1/hr/employees | ✅ 정상 |
| M2 영업 | GET /api/v1/sales/quotations | ✅ 정상 |
| M5 재고 | GET /api/v1/production/inventory | ✅ 정상 (0건) |
| M6 결재 | GET /api/v1/groupware/approvals | ✅ 정상 (0건) |
| M7 알림 | GET /api/v1/notifications/ | ✅ 정상 (0건) |
| 대시보드 | GET /api/v1/dashboard/summary | ✅ 정상 |

---

## 다음 세션에서 이어할 작업

### 우선순위 1: 브라우저에서 프론트엔드 확인
1. https://pls-erp-api.onrender.com 접속 → React 로그인 페이지 확인
2. admin@pls-erp.com / admin1234 로그인 → 대시보드 진입 확인

### 우선순위 2: 재고(M5) 창고-품목 연동 보완
- 창고 시드 데이터와 품목 연결 확인
- 재고 입고/이관 시뮬레이션 완성

### 우선순위 3: 시뮬레이션 재실행
- 전체 시뮬레이션 재실행 (`scripts/seed_demo_data.py`)

### 우선순위 4: AI 기능 추가 (Gemini API)
- M4-F01: 영수증 OCR + 자동 분개

---

## 주의사항 / 이슈

### 배포 관련
- **⚠️ Render 브랜치**: `master` 브랜치 감시 중 → push 시 `git push origin main:master` 필수
- **Render 무료 플랜**: 15분 미사용 시 슬립, 첫 접속 ~50초 대기
- **프론트엔드 빌드**: 변경 시 `npm run build` 후 `git add -f src/frontend/dist/`

### 기술적 사항
- **DB 자동 마이그레이션**: `create_all()`은 새 테이블만 생성, 기존 테이블 컬럼 추가는 ALTER TABLE 필요
- **trailing slash 주의**: API 호출 시 trailing slash 없이 (예: `/api/v1/groupware/approvals`)

### 인증 정보
- 로그인: `admin@pls-erp.com` / `admin1234`
- GitHub: `parkjikoon-hub/pls-erp` (main, Render는 master 감시)
- Neon DB: `frosty-flower-83629581`

---

## 새 세션 시작 프롬프트
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
