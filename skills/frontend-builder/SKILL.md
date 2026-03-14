---
name: frontend-builder
description: |
  React + Tailwind CSS 컴포넌트 생성 Skill.
  ERP 화면 컴포넌트, 폼, 테이블, 대시보드를 Mobile First로 구현합니다.
  사용 시점: 새 모듈 UI 개발, 공통 컴포넌트 생성, 대시보드 구현이 필요할 때
---

## 기능 설명
React + Tailwind CSS 기반 ERP UI 컴포넌트를 Mobile First 원칙으로 생성합니다.

## 설계 원칙

1. **Mobile First**: 모든 컴포넌트는 모바일(320px~) 우선 설계
2. **3클릭 원칙**: 핵심 업무 프로세스는 3번 클릭 이내 완결
3. **Human-in-the-Loop**: AI 처리 결과는 '검토 대기' 배지와 함께 표시
4. **상태 관리**: Zustand(전역) + React Query(서버 상태) 조합
5. **에러 UX**: 폼 검증 에러는 즉시 인라인 표시 + toast 알림

## 공통 컴포넌트 목록

```
components/common/
├── DataTable.jsx          # 검색/정렬/페이지네이션 통합 테이블
├── Modal.jsx              # 확인/취소 모달
├── StatusBadge.jsx        # 상태 배지 (draft/review/approved 등)
├── CurrencyInput.jsx      # 금액 입력 (천 단위 자동 콤마)
├── DatePicker.jsx         # 날짜 선택기 (한국어)
├── FileUpload.jsx         # 드래그앤드롭 + 카메라 촬영 지원
├── AIReviewBanner.jsx     # AI 처리 결과 검토 요청 배너
└── LoadingSkeleton.jsx    # 로딩 스켈레톤 UI
```

## 사용 예제

예제 1: 목록 화면 생성
- 입력: "M2 수주 목록 화면 만들어줘"
- 출력: DataTable + 검색 필터 + 상태 배지 + 상세보기 링크

예제 2: 입력 폼 생성
- 입력: "지출결의서 입력 폼 만들어줘"
- 출력: react-hook-form + 영수증 업로드 + 계정과목 추천 드롭다운

예제 3: 대시보드 위젯
- 입력: "매출 현황 차트 위젯 만들어줘"
- 출력: Recharts BarChart + 기간 선택 + 반응형 레이아웃
