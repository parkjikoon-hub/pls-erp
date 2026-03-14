"""
공통 API 응답 형식
모든 API 엔드포인트에서 동일한 형식으로 응답합니다.
"""
from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    """표준 API 응답 형식"""
    status: str = "success"          # success, error, review
    data: Optional[Any] = None       # 실제 데이터
    message: Optional[str] = None    # 사용자 메시지
    requires_review: bool = False    # AI 처리 결과 검토 필요 여부


def success_response(data: Any = None, message: str = "처리 완료") -> dict:
    """성공 응답 생성"""
    return {"status": "success", "data": data, "message": message}


def error_response(detail: str = "오류가 발생했습니다") -> dict:
    """에러 응답 생성"""
    return {"status": "error", "detail": detail}


def review_response(data: Any, message: str = "확인 후 승인해주세요") -> dict:
    """Human-in-the-Loop: AI 처리 결과 검토 요청 응답"""
    return {
        "status": "review",
        "data": data,
        "message": message,
        "requires_review": True,
    }
