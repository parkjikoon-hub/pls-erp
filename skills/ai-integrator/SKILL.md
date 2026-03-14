---
name: ai-integrator
description: |
  Gemini API 기반 AI 기능 구현 Skill.
  OCR 파싱, 자연어 처리, 요약, 수요 예측 프롬프트와 파싱 로직을 생성합니다.
  사용 시점: OCR 처리, AI 자동 분류, 텍스트 요약, 예측 모델이 필요할 때
---

## 기능 설명
Gemini API를 활용한 AI 기능을 ERP에 통합하는 코드를 생성합니다.

## 핵심 원칙

- **Human-in-the-Loop 필수**: 모든 AI 결과는 `status: "review"` 반환
- **신뢰도 임계값**: confidence < 90% 시 `requires_review: true` 강제
- **JSON 출력 강제**: 프롬프트에 항상 JSON 형식 명시
- **/ai-services 레이어 분리**: AI 호출 코드는 반드시 별도 레이어로 분리

## AI 서비스 목록

| 서비스 | 파일 | 사용 모델 |
|-------|------|---------|
| 주문서 OCR | ocr/order_ocr.py | gemini-1.5-pro (Vision) |
| 영수증 OCR | ocr/receipt_ocr.py | gemini-1.5-pro (Vision) |
| 계정과목 추천 | nlp/account_recommender.py | gemini-1.5-flash |
| 챗봇 내비게이션 | nlp/chatbot.py | gemini-1.5-flash |
| 회의록 요약 | nlp/summarizer.py | gemini-1.5-flash |
| 수요 예측 | forecasting/demand_forecast.py | gemini-1.5-pro |
| 영업 인사이트 | analytics/insights.py | gemini-1.5-flash |

## 사용 예제

예제 1: 신규 OCR 기능 추가
- 입력: "계약서 OCR 파싱 기능 만들어줘"
- 출력: contract_ocr.py + 추출 필드 정의 + JSON 프롬프트

예제 2: AI 분류 추가
- 입력: "문의 이메일 자동 분류 기능 만들어줘"
- 출력: 이메일 카테고리 분류 서비스 + 신뢰도 체크

예제 3: 예측 기능
- 입력: "다음달 수주량 예측 기능 만들어줘"
- 출력: 과거 데이터 기반 Gemini 수요 예측 서비스
