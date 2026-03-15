# 세션 인수인계 노트
> 작성 시각: 2026-03-15 (Phase 3 완료 세션)

## 이번 세션에서 완료한 작업

### Phase 3: M3 인사/급여 전체 완료
- **Step 3-1**: DB 스키마 4개 테이블 + Alembic 마이그레이션
  - Employee, AttendanceRecord, PayrollHeader, PayrollDetail
- **Step 3-2**: 사원 관리 CRUD (인사카드)
  - 백엔드 6 엔드포인트, 프론트엔드 EmployeesPage (검색/필터/3필드셋 모달)
- **Step 3-3**: 근태/휴가 관리 (예외 기반)
  - 백엔드 4 엔드포인트, 프론트엔드 AttendancePage (연차 자동 차감/복원)
- **Step 3-4**: 급여 계산 엔진
  - 4대보험, 소득세(구간별), 비과세 자동 분류
  - 백엔드 4 엔드포인트, 프론트엔드 PayrollPage (계산/승인/요약/상세)
- **Step 3-5**: 급여명세서 + 인사 통계 보고서
  - 백엔드 3 엔드포인트, 프론트엔드 HRReportsPage (2탭)
- **Step 3-6**: 국세청 신고 파일 생성 (수동 다운로드)
  - CSV (utf-8-sig BOM), 프론트엔드 TaxFilingPage

## 진행 중이던 작업
- 없음 (Phase 3 전체 완료)

## 다음 세션에서 이어할 작업
1. **Phase 4: M2 영업/수주** 시작
   - CLAUDE.md 개발 순서: Phase 4 (M2) → Phase 5 (M5) → Phase 6 (M6)
2. 또는 AI 기능 추가 (OCR, 계정추천, R&D 대체분개)

## 주의사항 / 이슈
- M3/M4 모듈은 도메인별 파일 분리 구조 (schemas/, services/, routers/)
  - M1은 단일 파일 구조 — 향후 모듈도 M4 패턴 따르기 권장
- 급여 계산은 간이세액표 기반 구간별 근사치 (정밀 간이세액표는 수천 행)
- Employee-User 관계: 1:1 (user_id unique constraint)
- Gemini API 키 미설정 — 챗봇은 키워드 매칭으로 동작 중
- `skills-lock.json`이 untracked 상태 — 무시해도 됨

## 새 세션 시작 프롬프트
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
