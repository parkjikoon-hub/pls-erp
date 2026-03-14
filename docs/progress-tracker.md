# ERP 개발 진행 현황 (Progress Tracker)
> 이 파일은 Orion이 자동 관리합니다. 새 세션 시작 시 반드시 먼저 읽으세요.

## 현재 상태
- **최종 업데이트**: 2026-03-14
- **현재 Phase**: Phase 0 — 환경 설정 대기
- **전체 진행률**: 0 / 34 기능 완료 (0%)

---

## Phase별 진행 현황

### ✅ Phase 0: 환경 설정
- [ ] `.env` 파일 생성
- [ ] PostgreSQL 데이터베이스 `erp_db` 생성
- [ ] Python 가상환경 설정 (`pip install -r requirements.txt`)
- [ ] Node.js 패키지 설치 (`cd src/frontend && npm install`)
- [ ] Gemini API 키 설정

### ⏳ Phase 1: M1 — 시스템 아키텍처 & MDM
- [ ] M1-F01: 동적 폼 빌더 (Dante→DB / Aria→API / Nova→UI)
- [ ] M1-F02: 외부 API 연동 개방형 구조 (Aria)
- [ ] M1-F03: AI 챗봇 내비게이션 (Gemma)
- [ ] M1-F04: MDM 워크플로우 (Dante→DB / Aria→API)
- [ ] M1-F05: 이카운트 Excel 기초 이관 (Mia)
- [ ] M1-F06: OpenAPI 과거 전표 스크래핑 (Mia)
- [ ] M1-F07: 병행 운영 실시간 동기화 (Mia)

### ⏳ Phase 2: M4 — 재무 및 회계 관리
- [ ] M4-F01: 모바일 OCR + 계정과목 AI 추천 (Gemma→OCR / Aria→API / Nova→UI)
- [ ] M4-F02: 판매/물류 데이터 자동 전표 전환 (Aria)
- [ ] M4-F03: R&D 급여 자동 대체 분개 (Aria)
- [ ] M4-F04: 전자세금계산서 발행/자동 전송 (Aria)
- [ ] M4-F05: 뱅킹 연동 실시간 대금 일괄 이체 (Aria)
- [ ] M4-F06: 회계 결산 마감 기능 (Aria / Nova)

### ⏳ Phase 3: M3 — 인사 및 급여/세무
- [ ] M3-F01: 예외 기반 근태 자동화 (Aria / Nova)
- [ ] M3-F02: AI 세무 최적화 급여 자동 산출 (Aria→엔진 / Gemma)
- [ ] M3-F03: 비과세 항목 자동 분류 (Aria)
- [ ] M3-F04: 국세청 전자신고 파일 자동 생성 (Aria)
- [ ] M3-F05: 인사/세무 보고서 자동 생성 (Iris)

### ⏳ Phase 4: M2 — 영업 및 수주 관리
- [ ] M2-F01: AI OCR 주문서 자동 파싱 (Gemma / Aria / Nova)
- [ ] M2-F02: AI 견적서 자동 생성/발송 (Gemma / Aria)
- [ ] M2-F03: 맞춤형 영업 보고서 자동 생성 (Iris)
- [ ] M2-F04: 실시간 수주 진행률 트래킹 (Aria / Nova)
- [ ] M2-F05: 협력사 전용 포털 (Aria / Nova)

### ⏳ Phase 5: M5 — 생산 및 SCM
- [ ] M5-F01: MRP 기반 원자재 자동 발주 알림 (Aria / Gemma)
- [ ] M5-F02: 칸반/캘린더 작업지시서 시각화 (Aria / Nova)
- [ ] M5-F03: QC 합격 판정 후 자동 재고 이관 (Aria)
- [ ] M5-F04: 물류 출하지시서 자동 연동 (Aria)
- [ ] M5-F05: 생산/재고 보고서 자동 생성 (Iris)

### ⏳ Phase 6: M6 — 그룹웨어 및 협업
- [ ] M6-F01: ERP 전표 통합 전자결재 (Aria / Nova)
- [ ] M6-F02: AI 게시판 회의록 3줄 요약 (Gemma)
- [ ] M6-F03: 게시글-전표 하이퍼링크 연결 (Aria / Nova)

### ⏳ Phase 7: M7 — 지능형 알림 센터
- [ ] M7-F01~04: 상황 기반 푸시 알림 전 모듈 (Aria / Gemma)
- [ ] M7-F05: 외부 메신저 연동 (카카오/슬랙) (Gemma)

---

## 완료된 작업 기록
(완료 시 Orion이 자동 기록)

---

## 현재 이슈 / 미결 사항
(문제 발생 시 기록)

---

## 다음 세션 시작 지시
```
Orion, progress-tracker.md를 읽고 현재 상태에서 개발을 재개해줘.
```
