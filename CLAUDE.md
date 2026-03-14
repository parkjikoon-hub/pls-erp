# AI 통합 ERP 개발 오케스트레이션 시스템
# Next-Gen AI Integrated ERP — Claude Code Multi-Agent Orchestration

> **사용법**: 이 파일을 Claude Code 프로젝트 루트에 배치하면 세션 시작 시 자동으로 로드됩니다.
> Antigravity IDX 터미널에서 `claude` 명령어 실행 시 이 지침이 활성화됩니다.

---

## 🏗️ 프로젝트 개요

**시스템명**: Next-Gen AI Integrated ERP  
**목표**: 이카운트 ERP 완전 대체 + AI 기반 업무 자동화 90% 이상  
**개발 방식**: Claude Code 멀티에이전트 기반 모듈별 순차 구현  
**기술 스택**: React + Tailwind / FastAPI / PostgreSQL / Gemini API

---

## 👥 에이전트 팀 구성

이 프로젝트는 8개의 전문 에이전트가 협업합니다:

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| **Orion** (Orchestrator) | `agents/orion-orchestrator.md` | 전체 진행 총괄, 모듈 간 의존성 관리 |
| **Dante** (DB Architect) | `agents/dante-db-architect.md` | ERD 설계, PostgreSQL 스키마, 마이그레이션 |
| **Aria** (API Engineer) | `agents/aria-api-engineer.md` | FastAPI/Node.js REST API, OpenAPI 문서 |
| **Nova** (Frontend Builder) | `agents/nova-frontend-builder.md` | React + Tailwind UI, 모바일 반응형 |
| **Gemma** (AI Integrator) | `agents/gemma-ai-integrator.md` | Gemini API OCR, 요약, 수요 예측 연동 |
| **Rex** (Test Engineer) | `agents/rex-test-engineer.md` | 단위/통합 테스트, 품질 검증 |
| **Mia** (Data Migrator) | `agents/mia-data-migrator.md` | 이카운트 OpenAPI 이관, 데이터 정합성 |
| **Iris** (Report Builder) | `agents/iris-report-builder.md` | 보고서 자동 생성, Excel/PDF 출력 |

---

## 📋 모듈 개발 순서 (의존성 기반)

```
Phase 1: M1 — 시스템 아키텍처 & MDM      (기반, 의존성 없음)
Phase 2: M4 — 재무 및 회계 관리           (M1 필요)
Phase 3: M3 — 인사 및 급여/세무 관리      (M1, M4 필요)
Phase 4: M2 — 영업 및 수주 관리           (M1, M4 필요)
Phase 5: M5 — 생산 및 SCM               (M1, M2, M4 필요)
Phase 6: M6 — 그룹웨어 및 협업            (M1~M5 필요)
Phase 7: M7 — 지능형 알림 센터            (M1~M6 필요)
```

---

## 🚀 세션 시작 방법

### 신규 모듈 개발 시작
```
Orion, [모듈명] 개발을 시작해줘.
예: "Orion, M1 시스템 아키텍처 개발을 시작해줘."
```

### 특정 기능 직접 구현
```
[에이전트명], [기능 ID] 구현해줘.
예: "Dante, M1 전체 ERD 설계해줘."
예: "Aria, M4-F04 전자세금계산서 API 구현해줘."
```

### 진행 상황 확인
```
Orion, 현재 개발 진행 상황 보고해줘.
```

---

## 📁 프로젝트 디렉토리 구조

```
erp-project/
├── CLAUDE.md                    ← 이 파일 (오케스트레이션 지침)
├── agents/                      ← 에이전트 정의 파일
│   ├── orion-orchestrator.md
│   ├── dante-db-architect.md
│   ├── aria-api-engineer.md
│   ├── nova-frontend-builder.md
│   ├── gemma-ai-integrator.md
│   ├── rex-test-engineer.md
│   ├── mia-data-migrator.md
│   └── iris-report-builder.md
├── skills/                      ← 재사용 Skill 정의
│   ├── db-schema-designer/SKILL.md
│   ├── api-architect/SKILL.md
│   ├── frontend-builder/SKILL.md
│   ├── ai-integrator/SKILL.md
│   ├── test-writer/SKILL.md
│   ├── report-generator/SKILL.md
│   └── data-migrator/SKILL.md
├── docs/
│   ├── PRD_v1.0.md              ← PRD 요약 참조본
│   └── progress-tracker.md     ← 개발 진행 현황
└── src/                         ← 실제 구현 코드
    ├── frontend/                ← React + Tailwind
    ├── backend/                 ← FastAPI
    ├── ai-services/             ← Gemini API 연동
    └── db/                      ← PostgreSQL 스키마
```

---

## ⚙️ 코드 품질 원칙 (전 에이전트 공통 적용)

1. **모든 함수에 한국어 주석 필수**
2. **에러 핸들링 필수** — try/except + 의미 있는 에러 메시지
3. **Audit Log 미들웨어 전역 적용** — 모든 데이터 수정에 이력 기록
4. **Human-in-the-Loop** — AI 처리 결과는 '검토 대기' 상태로 반환
5. **RBAC 권한 체크** — 모든 API 엔드포인트 인증 토큰 필수
6. **각 기능 완료 후 단위 테스트 코드 함께 작성**

---

## 🔑 환경 변수 설정 (개발 시작 전 .env 파일 생성)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/erp_db

# AI
GEMINI_API_KEY=your_gemini_api_key

# Auth
JWT_SECRET_KEY=your_jwt_secret
JWT_ALGORITHM=HS256

# External APIs
ECOUNT_API_KEY=your_ecount_api_key
KAKAO_API_KEY=your_kakao_api_key
SLACK_WEBHOOK_URL=your_slack_webhook

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASSWORD=your_app_password
```

---

## ⚠️ 컨텍스트 관리 규칙 (필수 준수)

- 모듈 1개 개발 완료 시 `docs/progress-tracker.md` 업데이트
- 새 세션 시작 시 `docs/progress-tracker.md` 먼저 읽어서 상태 복원

### 🔴 컨텍스트 70% 인수인계 프로토콜 (자동 실행)

컨텍스트 사용량이 약 70%에 도달하면 **반드시** 아래 절차를 실행합니다:

1. **현재 작업 중단** — 진행 중이던 코드가 있으면 안전한 상태로 저장
2. **`docs/progress-tracker.md` 업데이트** — 완료/미완료 항목 최신화
3. **`docs/handover-note.md` 작성** — 아래 양식으로 인수인계 문서 생성
4. **사용자에게 알림** — "컨텍스트 70%에 도달했습니다" + 새 탭 시작 프롬프트 제공

### 인수인계 문서 양식 (`docs/handover-note.md`)

```markdown
# 세션 인수인계 노트
> 작성 시각: {YYYY-MM-DD HH:MM}

## 이번 세션에서 완료한 작업
- (완료 항목 목록)

## 진행 중이던 작업
- 작업명: {작업 이름}
- 진행률: {%}
- 현재 상태: {어디까지 했고 무엇이 남았는지}
- 관련 파일: {수정 중이던 파일 경로}

## 다음 세션에서 이어할 작업
1. (순서대로 나열)

## 주의사항 / 이슈
- (알려진 버그, 미해결 에러, 특별 주의사항)

## 새 세션 시작 프롬프트
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
