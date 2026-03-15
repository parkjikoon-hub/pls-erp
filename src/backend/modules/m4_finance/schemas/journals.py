"""
M4 재무/회계 — 전표(Journal Entry) Pydantic 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 분개 라인 ──

class JournalLineCreate(BaseModel):
    """분개 라인 생성 (전표 생성 시 함께 전달)"""
    account_id: str = Field(..., description="계정과목 ID")
    debit_amount: float = Field(0, ge=0, description="차변 금액")
    credit_amount: float = Field(0, ge=0, description="대변 금액")
    customer_id: Optional[str] = Field(None, description="거래처 ID (선택)")
    description: Optional[str] = Field(None, description="적요")
    tax_code: Optional[str] = Field(None, description="세금 코드")
    tax_amount: float = Field(0, ge=0, description="세액")


class JournalLineResponse(BaseModel):
    """분개 라인 응답"""
    id: str
    line_no: int
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    debit_amount: float
    credit_amount: float
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    description: Optional[str] = None
    tax_code: Optional[str] = None
    tax_amount: float = 0


# ── 전표 헤더 ──

class JournalCreate(BaseModel):
    """전표 생성 요청 (헤더 + 라인 일괄)"""
    entry_date: date = Field(..., description="전표일자")
    entry_type: str = Field(
        ..., description="전표유형 (sales/purchase/expense/payroll/general/adjustment)"
    )
    description: Optional[str] = Field(None, description="적요")
    lines: list[JournalLineCreate] = Field(
        ..., min_length=2, description="분개 라인 (최소 2줄)"
    )


class JournalUpdate(BaseModel):
    """전표 수정 요청 (draft 상태만)"""
    entry_date: Optional[date] = None
    entry_type: Optional[str] = None
    description: Optional[str] = None
    lines: Optional[list[JournalLineCreate]] = Field(
        None, min_length=2, description="분개 라인 (전체 교체)"
    )


class JournalResponse(BaseModel):
    """전표 조회 응답"""
    id: str
    entry_no: str
    entry_date: date
    entry_type: str
    description: Optional[str] = None
    total_debit: float
    total_credit: float
    status: str
    source_module: Optional[str] = None
    source_id: Optional[str] = None
    fiscal_year_id: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    lines: list[JournalLineResponse] = []


class JournalListItem(BaseModel):
    """전표 목록 응답 (라인 미포함)"""
    id: str
    entry_no: str
    entry_date: date
    entry_type: str
    description: Optional[str] = None
    total_debit: float
    total_credit: float
    status: str
    created_at: Optional[datetime] = None
    created_by_name: Optional[str] = None


class RejectRequest(BaseModel):
    """전표 반려 요청"""
    reason: Optional[str] = Field(None, description="반려 사유")
