# 세션 인수인계 노트
> 작성 시각: 2026-03-15 (Phase 2 완료 세션)

## 이번 세션에서 완료한 작업

### Phase 2: M4 재무/회계 전체 완료
- **Step 2-1**: DB 스키마 7개 테이블 + Alembic 마이그레이션 + 시드 데이터 (69개 계정과목 + 2026 회계연도)
- **Step 2-2**: 계정과목 마스터 CRUD + 회계연도 관리 (백엔드 6+3 엔드포인트, 프론트엔드 AccountsPage + FinancePage)
- **Step 2-3**: 전표 입력/조회/승인 (백엔드 10 엔드포인트, 프론트엔드 JournalListPage + JournalFormPage)
  - 복식부기 검증 (차변=대변), 전표번호 자동 생성, 상태 워크플로우 (draft→review→approved→posted)
  - 동적 분개 라인 UI, 계정과목 검색 드롭다운, 차대변 실시간 합계
- **Step 2-4**: 세금계산서 발행/관리 (백엔드 7 엔드포인트, 프론트엔드 InvoicesPage)
  - 확정(confirm) 시 자동 전표 생성 (매출: 매출채권/매출/부가세예수금, 매입: 매출원가/부가세대급금/매입채무)
  - 매출/매입 탭, 부가세 자동 계산 (10%), 기간별 합계
- **Step 2-5**: 결산 마감 + 재무제표 (백엔드 5 엔드포인트, 프론트엔드 ClosingPage)
  - 시산표, 손익계산서, 재무상태표, 기간 마감/취소 4탭

## 진행 중이던 작업
- 없음 (Phase 2 전체 완료)

## 다음 세션에서 이어할 작업
1. Phase 2 코드 git commit (아직 커밋 안 됨)
2. **Phase 3: M3 인사/급여** 또는 **Phase 4: M2 영업/수주** 시작
   - CLAUDE.md 개발 순서: Phase 3 (M3) → Phase 4 (M2) → Phase 5 (M5)
3. 선택: M4 AI 기능 추가 (OCR, 계정추천, R&D 대체분개)

## 주의사항 / 이슈
- M4 모듈은 도메인별 파일 분리 구조 (schemas/, services/, routers/)
  - M1은 단일 파일 구조 — M3/M2도 M4 패턴(도메인 분리)을 따르는 것을 권장
- BankTransfer/BankTransferLine 테이블은 생성만 (CRUD 의도적 제외)
- 세금계산서 자동 전표 생성이 계정코드(108,501,307,601,114,301)에 의존 → 시드 데이터 필수
- Gemini API 키 미설정 — 챗봇은 키워드 매칭으로 동작 중
- `skills-lock.json`이 untracked 상태 — 무시해도 됨

## 새 세션 시작 프롬프트
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
