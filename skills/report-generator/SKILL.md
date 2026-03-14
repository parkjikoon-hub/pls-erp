---
name: report-generator
description: |
  Excel/PDF 보고서 자동 생성 Skill.
  openpyxl 기반 서식 있는 보고서와 AI 인사이트를 포함한 경영 보고서를 생성합니다.
  사용 시점: 영업/재무/인사/생산 보고서 생성, Excel/PDF 다운로드 기능이 필요할 때
---

## 기능 설명
openpyxl을 활용하여 서식 있는 ERP 보고서를 자동 생성합니다.

## 지원 보고서 목록

| 보고서 | 모듈 | 형식 | AI 인사이트 |
|-------|------|------|-----------|
| 월간 영업 실적 | M2 | Excel | ✅ |
| 수주 진행 현황 | M2 | Excel | - |
| 손익계산서 | M4 | Excel/PDF | - |
| 재무상태표 | M4 | Excel/PDF | - |
| 현금흐름표 | M4 | Excel | - |
| 월간 급여대장 | M3 | Excel | - |
| 비과세 절세 효과 | M3 | Excel | ✅ |
| 생산 실적 보고서 | M5 | Excel | - |
| 재고 현황 | M5 | Excel | - |
| QC 수율 분석 | M5 | Excel | ✅ |

## 공통 서식 스타일

```python
# 헤더 스타일 (파란색 배경 + 흰색 볼드)
HEADER_STYLE = {
    "fill": PatternFill("solid", fgColor="1F4E79"),
    "font": Font(bold=True, color="FFFFFF", name="맑은 고딕"),
    "alignment": Alignment(horizontal="center")
}

# 금액 서식
AMOUNT_FORMAT = '#,##0'

# 합계 행 (굵은 글씨 + 노란 배경)
TOTAL_STYLE = {
    "fill": PatternFill("solid", fgColor="FFF2CC"),
    "font": Font(bold=True)
}
```

## 사용 예제

예제 1: 영업 보고서 생성
- 입력: "이번달 영업 보고서 Excel 만들어줘"
- 출력: 수주/매출 요약 + 거래처별 + 제품별 + AI 인사이트 시트

예제 2: 재무제표 생성
- 입력: "2025년 연간 손익계산서 만들어줘"
- 출력: 계정과목별 금액 + 전년도 비교 + PDF 변환

예제 3: 급여대장 생성
- 입력: "3월 급여대장 Excel 만들어줘"
- 출력: 직원별 급여 내역 + 합계 + 비과세 절세 효과 요약
