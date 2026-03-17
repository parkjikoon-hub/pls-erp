"""
M2 영업/수주 — 발주서 PDF OCR 서비스 (Gemini Vision API)
발주서 PDF를 업로드하면 AI가 내용을 읽어 수주 데이터로 변환합니다.
Human-in-the-Loop: AI 추출 결과를 사용자가 검토/수정 후 확정합니다.
"""
import json
import re
from typing import Optional

from ....config import settings


async def extract_order_from_pdf(file_bytes: bytes, filename: str) -> dict:
    """
    PDF/이미지 파일에서 발주서 데이터를 추출합니다.
    Gemini Vision API를 사용하여 문서 내용을 인식합니다.

    반환값:
    {
        "success": True/False,
        "data": {
            "customer_name": "거래처명",
            "order_date": "2026-03-17",
            "delivery_date": "2026-03-24",
            "lines": [
                {
                    "product_name": "품목명",
                    "specification": "규격",
                    "quantity": 100,
                    "unit_price": 5000,
                    "remark": "비고"
                }
            ],
            "notes": "특이사항"
        },
        "confidence": 0.85,
        "raw_text": "원본 추출 텍스트",
        "message": "처리 결과 메시지"
    }
    """
    if not settings.GEMINI_API_KEY:
        return {
            "success": False,
            "data": None,
            "confidence": 0,
            "raw_text": "",
            "message": "Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 추가해주세요.",
        }

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        # 파일 확장자에 따라 MIME 타입 결정
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        mime_map = {
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "webp": "image/webp",
        }
        mime_type = mime_map.get(ext, "application/pdf")

        # Gemini Vision API에 파일 전송
        prompt = """이 문서는 발주서(Purchase Order)입니다.
문서에서 다음 정보를 추출해주세요:

1. 발주 거래처명 (customer_name)
2. 발주일/수주일 (order_date) — YYYY-MM-DD 형식
3. 납기일 (delivery_date) — YYYY-MM-DD 형식, 없으면 null
4. 품목 라인 (lines) — 각 품목마다:
   - product_name: 품목명
   - specification: 규격/사양 (없으면 빈 문자열)
   - quantity: 수량 (숫자)
   - unit_price: 단가 (숫자)
   - remark: 비고 (없으면 빈 문자열)
5. 전체 비고/특이사항 (notes) — 없으면 빈 문자열
6. 신뢰도 (confidence) — 0~1 사이 소수 (추출 정확도에 대한 자체 평가)

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{
  "customer_name": "거래처명",
  "order_date": "2026-03-17",
  "delivery_date": "2026-03-24",
  "lines": [
    {
      "product_name": "품목명",
      "specification": "규격",
      "quantity": 100,
      "unit_price": 5000,
      "remark": ""
    }
  ],
  "notes": "",
  "confidence": 0.85
}

주의사항:
- 수량과 단가는 반드시 숫자(정수 또는 소수)로 변환하세요
- 날짜는 YYYY-MM-DD 형식으로 변환하세요
- 한국어 발주서가 대부분이지만 영문 발주서도 처리해주세요
- 정보가 명확하지 않으면 confidence를 낮게 설정하세요
"""

        # Gemini에 이미지/PDF와 프롬프트 전송
        response = await model.generate_content_async([
            prompt,
            {"mime_type": mime_type, "data": file_bytes},
        ])

        text = response.text.strip()

        # Markdown 코드 블록 제거
        if "```" in text:
            text = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()

        data = json.loads(text)
        confidence = data.pop("confidence", 0.8)

        # 데이터 유효성 검증 및 정리
        lines = data.get("lines", [])
        for line in lines:
            line["quantity"] = float(line.get("quantity", 0))
            line["unit_price"] = float(line.get("unit_price", 0))

        return {
            "success": True,
            "data": data,
            "confidence": round(confidence, 2),
            "raw_text": response.text,
            "message": f"발주서에서 {len(lines)}개 품목을 추출했습니다.",
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "data": None,
            "confidence": 0,
            "raw_text": text if "text" in dir() else "",
            "message": "AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.",
        }
    except Exception as e:
        return {
            "success": False,
            "data": None,
            "confidence": 0,
            "raw_text": "",
            "message": f"OCR 처리 중 오류가 발생했습니다: {str(e)}",
        }
