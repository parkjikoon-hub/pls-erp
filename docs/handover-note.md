# 세션 인수인계 노트
> **v3.0** | 최종 업데이트: **2026-03-16 18:00** | 작성자: Claude Code

## 변경 이력
| 버전 | 일시 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-03-15 16:50 | 초기 작성 (배포 + UI 개편) |
| v2.0 | 2026-03-16 15:30 | Render 통합 배포 + 더미 데이터 시뮬레이션 결과 |
| v3.0 | 2026-03-16 18:00 | Render master 브랜치 문제 해결 + 프론트엔드 dist/ 포함 |

---

## 이번 세션에서 완료한 작업

### 1. 프론트엔드 "Not Found" 문제 해결
- **현상**: https://pls-erp-api.onrender.com 접속 시 `{"detail":"Not Found"}` 표시
- **원인 1**: `render.yaml`의 buildCommand는 Blueprint 초기 설정에만 적용됨 → npm build가 실행되지 않아 dist/ 폴더 없음
- **해결**: 로컬에서 `npm run build` 후 dist/ 파일을 git에 직접 포함
  - `.gitignore`에서 `dist/` 주석 처리
  - `git add -f src/frontend/dist/` 로 강제 추가
  - 커밋: `63a4197`

### 2. Render 브랜치 불일치 발견 및 해결
- **현상**: git push origin main 해도 Render가 재배포하지 않음
- **원인**: Render 서비스가 `master` 브랜치를 감시 중, 우리는 `main`에 push
- **해결**: `git push origin main:master` 로 master에도 push
- **⚠️ 중요**: 앞으로 코드 push 시 **반드시 master에도 push** 해야 Render가 재배포함
  ```bash
  git push origin main && git push origin main:master
  ```
  또는 Render 대시보드에서 감시 브랜치를 `main`으로 변경

### 3. M4 재무 모듈 500 에러 디버깅 시도 (미해결)
- 시도 1: `lazy="selectin"` 추가 → Render 빌드 실패 → 되돌림
- 시도 2: 디버그 try/except 추가 → Render 빌드 실패 → 되돌림
- 시도 3: 디버그 엔드포인트 추가 → Render 빌드 실패 → 되돌림
- **모든 M4 변경사항 되돌림** (커밋 `37be49e`)
- 현재 M4 코드는 원본 상태(커밋 `84dddf1` 기준)

### 4. 더미 데이터 시뮬레이션 완료
- 11단계 중 8단계 성공 (M4 재무 500 에러, M5 재고 연동 미완으로 3단계 실패/스킵)
- `scripts/seed_demo_data.py` 안정화 완료

---

## 현재 배포 상태 (v3.0 기준 — 2026-03-16 18:00)

| 항목 | 상태 |
|------|------|
| Render 서비스 | `pls-erp-api` (free tier) |
| 감시 브랜치 | **master** (main 아님!) |
| 최신 배포 커밋 | `8828a4a` (main:master push 완료) |
| 프론트엔드 | dist/ 파일 git 포함, FastAPI StaticFiles로 서빙 |
| 백엔드 | FastAPI + uvicorn |
| DB | Neon PostgreSQL (싱가포르) |
| URL | https://pls-erp-api.onrender.com |

---

## 다음 세션에서 이어할 작업

### 우선순위 1: 프론트엔드 정상 렌더링 확인
1. https://pls-erp-api.onrender.com 접속하여 React 로그인 페이지 확인
2. `/api/health` 에서 `frontend_exists: true` 확인
3. 확인 후 `main.py` health 엔드포인트의 디버그 필드 제거 (frontend_path, frontend_exists, frontend_files)

### 우선순위 2: M4 재무 모듈 500 에러 수정
- **현상**: `/api/v1/finance/accounts` 모든 엔드포인트 500 에러
- **추정 원인**: SQLAlchemy async + relationship lazy loading 이슈
- **디버깅 방법**:
  1. Render 대시보드 → Logs 탭에서 실제 traceback 확인
  2. 또는 로컬에 Python 3.11 설치 후 백엔드 실행하여 디버깅
- **관련 파일**:
  - `src/backend/modules/m4_finance/models.py` (relationship 설정)
  - `src/backend/modules/m4_finance/services/account_service.py`
  - `src/backend/modules/m4_finance/routers/account_router.py`
- **주의**: M4 코드 수정 시 Render 빌드 실패 가능성 있음 (원인 미파악)

### 우선순위 3: Render 브랜치 설정 정리
- Render 대시보드에서 감시 브랜치를 `master` → `main`으로 변경 권장
- 또는 git push 시 항상 `main:master`도 함께 push

### 우선순위 4: 재고(M5) 창고 연동 보완
- 창고 시드 데이터와 품목 연결 확인
- 재고 입고/이관 시뮬레이션 완성

### 우선순위 5: 엑셀 일괄 업로드 기능 확장
- 사원/재고/BOM/급여 등 모듈별 엑셀 업로드 추가

---

## 주의사항 / 이슈

### 배포 관련
- **⚠️ Render 브랜치**: `master` 브랜치 감시 중 → push 시 `git push origin main:master` 필수
- **Render 무료 플랜 제약**: 15분 미사용 시 슬립, 512MB RAM, 첫 접속 ~50초 대기
- **Render 빌드 주의**: M4 models.py 수정 시 빌드 실패 가능성 (원인 미파악)
- **render.yaml**: Blueprint 초기 설정에만 적용됨, 기존 서비스 설정 변경은 대시보드에서
- **프론트엔드 빌드**: dist/ 파일이 git에 포함되어 있으므로, 프론트엔드 변경 시 로컬에서 `npm run build` 후 커밋 필요

### 로컬 개발 환경
- **Python 3.14**: 로컬 PC에 설치됨 → pydantic-core 빌드 불가, 백엔드 실행 불가
- Python 3.11 별도 설치 필요 (로컬 디버깅용)
- 프론트엔드 로컬 실행: `cd src/frontend && npm run dev`

### 인증 정보
- 로그인: `admin@pls-erp.com` / `admin1234`
- GitHub: `parkjikoon-hub/pls-erp` (main 브랜치, Render는 master 감시)
- Neon DB: `frosty-flower-83629581`
- Render 서비스: `pls-erp-api`

### 더미 데이터 현황 (v3.0 기준)
- 거래처 6개, 품목 8개, 견적서 9건, 수주 6건, 직원 5명
- 모두 `DEMO-` 접두사 → 정리: `python scripts/seed_demo_data.py --cleanup --base-url https://pls-erp-api.onrender.com`

---

## 새 세션 시작 프롬프트
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
