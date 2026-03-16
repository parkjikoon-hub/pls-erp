# 세션 인수인계 노트
> **v2.0** | 최종 업데이트: **2026-03-16 15:30** | 작성자: Claude Code

## 변경 이력
| 버전 | 일시 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-03-15 16:50 | 초기 작성 (배포 + UI 개편) |
| v2.0 | 2026-03-16 15:30 | Render 통합 배포 + 더미 데이터 시뮬레이션 결과 |

---

## 이번 세션에서 완료한 작업

### 1. 프론트+백엔드 Render 통합 배포
- **기존**: Vercel(프론트) + Render(백엔드) 분리 배포
- **변경**: Render 단일 서버에서 FastAPI가 React 빌드 파일도 서빙
- **통합 URL**: https://pls-erp-api.onrender.com (프론트+백 모두 이 주소)
- 수정 파일:
  - `src/backend/main.py` — StaticFiles + SPA 폴백 라우트 추가
  - `render.yaml` — buildCommand에 `npm install && npm run build` 추가

### 2. 더미 데이터 시뮬레이션 스크립트 작성
- `scripts/seed_demo_data.py` 신규 생성 (약 600줄)
- 11단계 실제 업무 플로우 시뮬레이션
- 모든 더미 데이터에 `DEMO-` 접두사 → 나중에 더미만 삭제 가능
- `--cleanup` 옵션으로 DEMO- 데이터만 삭제

### 3. 시뮬레이션 결과 (배포 서버 검증 완료)

| 단계 | 기능 | 결과 | 비고 |
|------|------|------|------|
| 1 | 관리자 로그인 | **성공** | JWT 토큰 발급 정상 |
| 2 | 거래처 5개 등록 | **성공** | DEMO-CUST001~005, 총 6개 |
| 3 | 품목 8개 등록 | **성공** | DEMO-PROD001~008 |
| 4 | 견적서 3건 생성 | **성공** | QT-202603-NNNN 자동채번 |
| 5 | 견적→수주 전환 2건 | **성공** | SO-202603-NNNN 자동채번 |
| 6 | 작업지시서 생성 | **성공** | 수주 기반 자동 생성 |
| 7 | 재고 입고 | 건너뜀 | 창고-품목 연결 미완성 |
| 8 | 재고 이관 | 건너뜀 | 7번 미완으로 인한 스킵 |
| 9 | 직원 5명 등록 | **성공** | DEMO-EMP101~105 |
| 10 | 계정과목/전표 | **실패** | M4 재무 모듈 500 에러 (기존 버그) |
| 11 | 대시보드 검증 | **성공** | 거래처5/품목8/수주6/매출2,095만원 |

### 4. 시뮬레이션 스크립트 안정화
- GET 요청 시 `json` 파라미터 제거 (httpx 호환)
- 409 에러(이미 존재) 시 기존 DEMO 데이터 목록 조회하여 ID 확보
- 모든 단계에 try/except 안전장치 추가
- API 응답 래핑(`{"status":"success","data":{...}}`) 처리용 `get_data()` 헬퍼

---

## 진행 중이던 작업 → 중단됨

### M4 재무 모듈 500 에러 디버깅 (미해결)
- **진행률**: 30%
- **현상**: `/api/v1/finance/accounts` 모든 엔드포인트에서 500 Internal Server Error
- **확인된 사실**:
  - DB 테이블은 존재함 (전표 검증에서 계정과목 테이블 조회 성공)
  - 계정과목 CREATE, LIST, GET 모두 500
  - `lazy="selectin"` 추가 시도 → Render 빌드 실패 (원인 불명, 되돌림)
  - 디버그 엔드포인트 추가 시도 → Render 빌드 실패 (되돌림)
- **추정 원인**:
  1. SQLAlchemy async lazy loading 이슈 (relationship 기본 lazy="select"가 async 미지원)
  2. ORM 모델 간 관계 설정 문제 (`relationship("Customer")` 참조)
  3. Render 빌드 환경에서 특정 코드 변경이 빌드 실패를 유발
- **현재 상태**: 84dddf1 커밋의 원본 코드로 복원 완료. M4 500 에러는 그대로 남아있음
- **관련 파일**:
  - `src/backend/modules/m4_finance/models.py` (relationship 설정)
  - `src/backend/modules/m4_finance/routers/account_router.py`
  - `src/backend/modules/m4_finance/services/account_service.py`

---

## 다음 세션에서 이어할 작업

### 우선순위 1: M4 재무 모듈 500 에러 수정
1. 로컬에서 Python 3.11 설치 후 백엔드 실행하여 실제 에러 traceback 확인
2. 또는 Render 대시보드에서 서비스 로그 확인 (https://dashboard.render.com)
3. relationship lazy loading 문제일 경우 `lazy="selectin"` 또는 `lazy="noload"` 적용
4. 디버깅 시 Render 빌드가 실패하지 않도록 최소한의 변경만 적용

### 우선순위 2: 재고(M5) 창고 연동 보완
- 창고 시드 데이터와 품목의 연결 확인
- 재고 입고/이관 시뮬레이션 완성

### 우선순위 3: 엑셀 일괄 업로드 기능 확장
- 사원/재고/BOM/급여 등 모듈별 엑셀 업로드 추가 (이전 세션 사용자 요청)

### 우선순위 4: 프론트엔드 통합 URL 확인
- https://pls-erp-api.onrender.com 에서 React 프론트엔드가 정상 렌더링되는지 확인
- (현재 Render 무료 플랜은 15분 미사용 시 슬립, 첫 접속 시 50초 대기)

---

## 주의사항 / 이슈

### 배포 관련
- **Render 무료 플랜 제약**: 15분 미사용 시 슬립, 512MB RAM, 빌드 느림
- **Render 빌드 주의**: M4 models.py 수정 시 빌드 실패 가능성 있음 (원인 미파악)
- **Vercel 프론트엔드**: 더 이상 사용 안 함 (Render 통합으로 전환)
- **Python 버전**: Render에서 `.python-version`에 3.11.11 지정 필수
- **Node 버전**: render.yaml에 NODE_VERSION=20.11.0 설정됨

### 로컬 개발 환경
- **Python 3.14**: 로컬 PC에 Python 3.14 설치됨 → pydantic-core 빌드 불가
- 로컬 백엔드 실행 불가, 시뮬레이션은 배포 서버 대상으로만 가능
- Python 3.11 별도 설치 필요 (로컬 디버깅용)

### 인증 정보
- 로그인: `admin@pls-erp.com` / `admin1234`
- GitHub: `parkjikoon-hub/pls-erp` (main 브랜치)
- Neon DB 프로젝트: `frosty-flower-83629581`
- Render 서비스: `pls-erp-api`

### 더미 데이터 현황 (v2.0 기준 — 2026-03-16)
- 거래처 6개 (DEMO-CUST001~005 + 디버그용 1개)
- 품목 8개 (DEMO-PROD001~008)
- 견적서 9건, 수주 6건 (여러 번 시뮬레이션 실행으로 누적)
- 직원 5명 (DEMO-EMP101~105)
- 삭제 명령: `python scripts/seed_demo_data.py --cleanup --base-url https://pls-erp-api.onrender.com`

---

## 회사 규모 정보 (사용자 제공)
- 직원 약 20명, 실제 ERP 사용자 5명
- 거래처 현재 약 300개, 향후 1000개
- 하루 수주 최대 100건
- 현재 개발/테스트 단계, 향후 회사 직원들에게 테스트 배포 예정
- Render Starter($7/월)로 프로덕션 전환 권장

---

## 새 세션 시작 프롬프트
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
