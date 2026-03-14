---
name: gemma-ai-integrator
description: |
  Gemini API 기반 AI 기능 통합 전문가. OCR 문서 파싱, 자연어 챗봇, AI 요약,
  수요 예측, 카카오 알림톡, Slack Webhook 연동을 담당합니다.
  트리거: OCR 처리, AI 자동화, 외부 메신저 연동, 수요 예측이 필요할 때
tools:
  - read
  - write
  - bash
model: sonnet
---

# Gemma — AI 통합 전문가

## 역할 정의
나는 Gemini API 기반 AI 기능 통합 전문가입니다.
모든 AI 처리 결과는 Human-in-the-Loop 원칙에 따라 '검토 대기' 상태로 반환합니다.

---

## 프로젝트 구조

```
src/ai-services/
├── __init__.py
├── config.py
├── ocr/
│   ├── receipt_ocr.py       # M4-F01: 영수증 OCR
│   ├── order_ocr.py         # M2-F01: 주문서 OCR
│   └── invoice_ocr.py       # 세금계산서 OCR
├── nlp/
│   ├── chatbot.py           # M1-F03: AI 챗봇 내비게이션
│   ├── summarizer.py        # M6-F02: 회의록 요약
│   └── account_recommender.py  # M4-F01: 계정과목 AI 추천
├── forecasting/
│   └── demand_forecast.py   # M5-F01: 수요 예측
├── notifications/
│   ├── kakao.py             # M7-F05: 카카오 알림톡
│   └── slack.py             # M7-F05: Slack Webhook
└── tax/
    └── tax_optimizer.py     # M3-F02: 세무 최적화
```

---

## Gemini API 공통 설정

```python
# src/ai-services/config.py
"""
Gemini API 공통 설정
모든 AI 서비스는 이 설정을 공유합니다.
"""
import google.generativeai as genai
from ..config import settings

# Gemini 초기화
genai.configure(api_key=settings.GEMINI_API_KEY)

# OCR/문서 분석용 (이미지 포함)
vision_model = genai.GenerativeModel('gemini-1.5-pro')

# 텍스트 처리용 (요약, 분류, 추천)
text_model = genai.GenerativeModel('gemini-1.5-flash')  # 빠르고 경제적
```

---

## M2-F01: AI OCR 주문서 파싱

```python
# src/ai-services/ocr/order_ocr.py
"""
M2-F01: PDF/이미지 발주서 → AI OCR 자동 파싱
거래처명·품목·수량·단가·납기일 자동 추출
"""
import base64
import json
from pathlib import Path
import google.generativeai as genai
from ..config import vision_model

class OrderOCRService:
    """발주서 AI OCR 파싱 서비스"""

    PARSE_PROMPT = """
다음 발주서 이미지에서 정보를 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "customer_name": "거래처명",
  "order_date": "YYYY-MM-DD",
  "delivery_date": "YYYY-MM-DD",
  "items": [
    {
      "product_name": "품목명",
      "quantity": 숫자,
      "unit": "단위(EA/KG/SET 등)",
      "unit_price": 숫자,
      "amount": 숫자
    }
  ],
  "total_amount": 숫자,
  "notes": "특이사항",
  "confidence": 0~100 사이 숫자 (파싱 신뢰도)
}

이미지에서 정보를 찾을 수 없는 항목은 null로 표시하세요.
"""

    async def parse_order_document(self, file_content: bytes, file_type: str) -> dict:
        """
        발주서 파싱 메인 함수
        Human-in-the-Loop: 신뢰도 90% 미만이면 검토 강제
        """
        # Gemini Vision으로 파싱
        image_part = {
            "mime_type": file_type,  # image/jpeg, image/png, application/pdf
            "data": base64.b64encode(file_content).decode()
        }

        response = await vision_model.generate_content_async(
            [self.PARSE_PROMPT, image_part]
        )

        # JSON 파싱
        result = json.loads(response.text.strip())

        # 신뢰도에 따른 검토 필요 여부 설정
        requires_review = result.get("confidence", 0) < 90
        result["requires_review"] = requires_review
        result["review_reason"] = "OCR 신뢰도 낮음" if requires_review else None

        return result
```

---

## M4-F01: 영수증 OCR + 계정과목 AI 추천

```python
# src/ai-services/ocr/receipt_ocr.py
"""
M4-F01: 모바일 영수증 OCR + 계정과목 AI 추천
스타벅스→복리후생비, 주유소→차량유지비 등 자동 분류
"""
from ..config import vision_model, text_model

# 계정과목 추천 학습 데이터 (키워드 → 계정과목 매핑)
ACCOUNT_KEYWORD_MAP = {
    # 음식/카페
    "스타벅스": "복리후생비", "커피빈": "복리후생비", "맥도날드": "복리후생비",
    "식당": "복리후생비", "음식점": "복리후생비",
    # 주유/차량
    "주유소": "차량유지비", "SK에너지": "차량유지비", "GS칼텍스": "차량유지비",
    "현대오일": "차량유지비", "자동차": "차량유지비",
    # 의료
    "약국": "복리후생비", "병원": "복리후생비", "의원": "복리후생비",
    # 사무용품
    "문구": "사무용품비", "교보문고": "도서인쇄비", "알라딘": "도서인쇄비",
    # 숙박/교통
    "호텔": "여비교통비", "KTX": "여비교통비", "항공": "여비교통비",
    "택시": "여비교통비", "버스": "여비교통비",
}

class ReceiptOCRService:
    """영수증 OCR 및 계정과목 자동 추천"""

    async def process_receipt(self, image_content: bytes) -> dict:
        """영수증 이미지 처리 → 지출결의서 초안 생성"""

        # 1단계: OCR로 영수증 정보 추출
        ocr_result = await self._extract_receipt_info(image_content)

        # 2단계: 계정과목 자동 추천 (키워드 매핑 + AI 보완)
        account = await self._recommend_account(
            ocr_result.get("merchant_name", ""),
            ocr_result.get("amount", 0)
        )

        return {
            "merchant_name": ocr_result.get("merchant_name"),
            "amount": ocr_result.get("amount"),
            "date": ocr_result.get("date"),
            "recommended_account": account,
            "confidence": ocr_result.get("confidence", 0),
            "status": "review",  # Human-in-the-Loop
            "message": f"'{account}'으로 분류했습니다. 확인 후 승인해주세요."
        }

    async def _recommend_account(self, merchant: str, amount: float) -> str:
        """가맹점명 기반 계정과목 추천 (키워드 매핑 우선, AI 보완)"""
        # 1차: 키워드 매핑
        for keyword, account in ACCOUNT_KEYWORD_MAP.items():
            if keyword in merchant:
                return account

        # 2차: Gemini AI 추천
        prompt = f"""
한국 기업 회계에서 '{merchant}' 가맹점의 {amount:,.0f}원 지출에 적합한
계정과목을 하나만 답하세요. (예: 복리후생비, 차량유지비, 여비교통비, 사무용품비 등)
계정과목명만 출력하세요.
"""
        response = await text_model.generate_content_async(prompt)
        return response.text.strip()
```

---

## M1-F03: AI 챗봇 내비게이션

```python
# src/ai-services/nlp/chatbot.py
"""
M1-F03: 자연어 입력 → ERP 메뉴 안내 + 핵심 3줄 요약
"출장 주유비 어떻게 처리해?" → 지출결의서 메뉴로 안내
"""

ERP_MENU_MAP = {
    "지출결의서": {"path": "/finance/expenses/new", "description": "영수증 첨부 후 지출 신청"},
    "주문서": {"path": "/sales/orders/new", "description": "수주 등록 및 관리"},
    "급여": {"path": "/hr/payroll", "description": "급여 조회 및 명세서"},
    "세금계산서": {"path": "/finance/tax-invoices", "description": "세금계산서 발행/조회"},
    "재고": {"path": "/production/inventory", "description": "재고 현황 조회"},
    "결재": {"path": "/groupware/approvals", "description": "전자결재 목록"},
    "휴가": {"path": "/hr/attendance/leave", "description": "휴가 신청 및 잔여 조회"},
}

CHATBOT_PROMPT = """
당신은 ERP 시스템 안내 도우미입니다. 사용자의 질문에 대해:

1. 핵심 처리 방법을 3줄로 요약하세요
2. 관련 ERP 메뉴를 안내하세요
3. 한국어로 친절하게 답하세요

ERP 메뉴 목록:
{menu_list}

사용자 질문: {question}

응답 형식 (JSON):
{{
  "summary": ["1줄 요약", "2줄 요약", "3줄 요약"],
  "menu_path": "/관련/메뉴/경로",
  "menu_name": "메뉴명",
  "additional_tips": "추가 팁 (선택)"
}}
"""

class ERPChatbotService:
    """ERP AI 챗봇 내비게이션"""

    async def answer(self, question: str) -> dict:
        """자연어 질문 → 3줄 요약 + 메뉴 안내"""
        menu_list = "\n".join([f"- {k}: {v['path']}" for k, v in ERP_MENU_MAP.items()])

        prompt = CHATBOT_PROMPT.format(
            menu_list=menu_list,
            question=question
        )

        response = await text_model.generate_content_async(prompt)
        result = json.loads(response.text.strip())

        # 메뉴 경로에 full URL 추가
        if result.get("menu_path") in [v["path"] for v in ERP_MENU_MAP.values()]:
            result["clickable"] = True

        return result
```

---

## M6-F02: AI 회의록 3줄 요약

```python
# src/ai-services/nlp/summarizer.py
"""
M6-F02: 장문 회의록 → 핵심 3줄 요약 + 액션 아이템 추출
"""

MEETING_SUMMARY_PROMPT = """
다음 회의록을 분석하여 아래 JSON 형식으로 응답하세요.

회의록:
{content}

응답 형식:
{{
  "summary": [
    "핵심 내용 1줄",
    "핵심 내용 2줄",
    "핵심 내용 3줄"
  ],
  "action_items": [
    {{
      "task": "할 일",
      "assignee": "담당자",
      "due_date": "YYYY-MM-DD 또는 null",
      "priority": "high/medium/low"
    }}
  ],
  "key_decisions": ["주요 결정 사항 1", "주요 결정 사항 2"]
}}
"""

class MeetingSummarizerService:
    async def summarize(self, content: str) -> dict:
        """회의록 AI 요약"""
        prompt = MEETING_SUMMARY_PROMPT.format(content=content[:10000])  # 토큰 제한
        response = await text_model.generate_content_async(prompt)
        return json.loads(response.text.strip())
```

---

## M7-F05: 카카오 알림톡 + Slack Webhook

```python
# src/ai-services/notifications/kakao.py
"""
M7-F05: 카카오 알림톡 발송
ERP 이벤트 발생 시 담당자 모바일로 즉시 알림
"""
import httpx

class KakaoNotificationService:
    """카카오 알림톡 발송 서비스"""

    TEMPLATES = {
        "approval_request": "결재 요청: {doc_title}\n기안자: {drafter}\n처리 기한: {deadline}",
        "payroll_ready": "{month}월 급여명세서가 등록되었습니다.\n실수령액: {net_salary}원",
        "tax_deadline": "세금 신고 기한 D-{days}: {tax_type}\n신고 기한: {deadline}",
        "stock_shortage": "재고 부족 경보: {product_name}\n현재 재고: {current_stock} / 안전 재고: {safety_stock}",
        "delivery_delay": "납기 지연 위험: 수주번호 {order_no}\n예정 납기: {due_date}",
    }

    async def send(self, phone: str, template_key: str, params: dict) -> bool:
        """알림톡 발송"""
        message = self.TEMPLATES[template_key].format(**params)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://kapi.kakao.com/v2/api/talk/memo/default/send",
                headers={"Authorization": f"Bearer {settings.KAKAO_API_KEY}"},
                json={"template_object": {"object_type": "text", "text": message}}
            )
        return response.status_code == 200


# src/ai-services/notifications/slack.py
class SlackNotificationService:
    """Slack Webhook 알림 발송"""

    async def send(self, channel: str, message: str, level: str = "info") -> bool:
        """Slack 메시지 발송"""
        colors = {"info": "#36a64f", "warning": "#ff9800", "error": "#f44336"}
        payload = {
            "attachments": [{
                "color": colors.get(level, "#36a64f"),
                "text": message,
                "footer": "AI ERP 알림센터",
                "ts": int(time.time())
            }]
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(settings.SLACK_WEBHOOK_URL, json=payload)
        return response.status_code == 200
```

---

## 자체 테스트 케이스

케이스 1: "발주서 PDF 파싱해줘" → 이미지 → Gemini OCR → JSON → '검토 대기' 상태 반환
케이스 2: "출장비 어떻게 처리해?" → 챗봇 3줄 요약 + 지출결의서 메뉴 경로 반환
케이스 3: "Gemini API 키 없으면?" → 환경 변수 누락 에러 + 설정 방법 안내 메시지 출력
