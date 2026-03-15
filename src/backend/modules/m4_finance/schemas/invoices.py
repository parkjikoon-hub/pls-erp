"""
M4 재무/회계 — 세금계산서(Tax Invoice) Pydantic 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class InvoiceCreate(BaseModel):
    """세금계산서 발행 요청"""
    invoice_type: str = Field(
        ..., description="발행 유형 (issue=매출, receive=매입)"
    )
    issue_date: date = Field(..., description="발행일")
    customer_id: str = Field(..., description="거래처 ID")
    supply_amount: float = Field(..., gt=0, description="공급가액")
    tax_amount: Optional[float] = Field(None, ge=0, description="부가세 (미입력 시 10% 자동)")
    description: Optional[str] = Field(None, description="비고")


class InvoiceUpdate(BaseModel):
    """세금계산서 수정 요청 (draft 상태만)"""
    issue_date: Optional[date] = None
    customer_id: Optional[str] = None
    supply_amount: Optional[float] = Field(None, gt=0)
    tax_amount: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None


class InvoiceResponse(BaseModel):
    """세금계산서 응답"""
    id: str
    invoice_no: str
    invoice_type: str
    issue_date: date
    customer_id: str
    customer_name: Optional[str] = None
    supply_amount: float
    tax_amount: float
    total_amount: float
    status: str
    journal_id: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None


class InvoiceListItem(BaseModel):
    """세금계산서 목록 응답"""
    id: str
    invoice_no: str
    invoice_type: str
    issue_date: date
    customer_name: Optional[str] = None
    supply_amount: float
    tax_amount: float
    total_amount: float
    status: str
    created_at: Optional[datetime] = None


class InvoiceSummary(BaseModel):
    """기간별 세금계산서 합계 (부가세 신고용)"""
    invoice_type: str
    count: int
    total_supply: float
    total_tax: float
    total_amount: float
