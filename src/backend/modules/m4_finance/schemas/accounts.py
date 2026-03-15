"""
M4 재무/회계 — 계정과목 Pydantic 스키마
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 생성 요청 ──
class AccountCreate(BaseModel):
    """계정과목 생성 시 필요한 필드"""
    code: str = Field(..., max_length=20, description="계정 코드")
    name: str = Field(..., max_length=100, description="계정명")
    account_type: str = Field(
        ..., description="유형 (asset/liability/equity/revenue/expense)"
    )
    account_group: Optional[str] = Field(
        None, max_length=50, description="계정 그룹"
    )
    normal_balance: str = Field(
        "debit", description="정상잔액 (debit/credit)"
    )
    parent_id: Optional[str] = Field(None, description="상위 계정 ID")
    sort_order: int = Field(0, description="정렬 순서")


# ── 수정 요청 ──
class AccountUpdate(BaseModel):
    """계정과목 수정 시 변경 가능한 필드"""
    name: Optional[str] = Field(None, max_length=100)
    account_type: Optional[str] = None
    account_group: Optional[str] = Field(None, max_length=50)
    normal_balance: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


# ── 응답 ──
class AccountResponse(BaseModel):
    """계정과목 조회 응답"""
    id: str
    code: str
    name: str
    account_type: str
    account_group: Optional[str] = None
    normal_balance: str
    parent_id: Optional[str] = None
    sort_order: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── 검색 결과 (드롭다운용, 간결한 응답) ──
class AccountSearchResult(BaseModel):
    """계정과목 검색 결과 (전표 입력 시 드롭다운)"""
    id: str
    code: str
    name: str
    account_type: str
    normal_balance: str

    model_config = {"from_attributes": True}
