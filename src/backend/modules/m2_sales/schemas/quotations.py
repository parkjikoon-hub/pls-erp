"""
M2 영업/수주 — 견적서 Pydantic 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 견적서 라인 ──

class QuotationLineCreate(BaseModel):
    """견적서 라인 생성 요청"""
    product_id: Optional[str] = None
    product_name: str = Field(..., max_length=200, description="품목명")
    specification: Optional[str] = Field(None, max_length=200, description="규격")
    quantity: float = Field(..., gt=0, description="수량")
    unit_price: float = Field(..., ge=0, description="단가")
    discount_rate: float = Field(0, ge=0, le=100, description="할인율(%)")
    delivery_date: Optional[date] = None
    remark: Optional[str] = Field(None, max_length=500)


class QuotationLineResponse(BaseModel):
    """견적서 라인 응답"""
    id: str
    line_no: int
    product_id: Optional[str] = None
    product_name: str
    specification: Optional[str] = None
    quantity: float
    unit_price: float
    discount_rate: float = 0
    amount: float
    tax_amount: float = 0
    delivery_date: Optional[date] = None
    remark: Optional[str] = None

    model_config = {"from_attributes": True}


# ── 견적서 헤더 ──

class QuotationCreate(BaseModel):
    """견적서 생성 요청"""
    quote_date: date = Field(..., description="견적일")
    valid_until: Optional[date] = Field(None, description="유효기한")
    customer_id: str = Field(..., description="거래처 ID")
    sales_rep_id: Optional[str] = Field(None, description="담당 영업사원 ID")
    notes: Optional[str] = None
    lines: list[QuotationLineCreate] = Field(
        ..., min_length=1, description="견적 품목 (최소 1줄)",
    )


class QuotationUpdate(BaseModel):
    """견적서 수정 요청 (draft 상태만)"""
    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    customer_id: Optional[str] = None
    sales_rep_id: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[list[QuotationLineCreate]] = None


class QuotationListItem(BaseModel):
    """견적서 목록 항목 (간결)"""
    id: str
    quote_no: str
    quote_date: date
    valid_until: Optional[date] = None
    customer_name: Optional[str] = None
    sales_rep_name: Optional[str] = None
    total_amount: float = 0
    tax_amount: float = 0
    grand_total: float = 0
    status: str = "draft"
    created_at: Optional[datetime] = None


class QuotationResponse(BaseModel):
    """견적서 상세 응답"""
    id: str
    quote_no: str
    quote_date: date
    valid_until: Optional[date] = None
    customer_id: str
    customer_name: Optional[str] = None
    sales_rep_id: Optional[str] = None
    sales_rep_name: Optional[str] = None
    total_amount: float = 0
    tax_amount: float = 0
    grand_total: float = 0
    status: str = "draft"
    notes: Optional[str] = None
    lines: list[QuotationLineResponse] = []
    created_at: Optional[datetime] = None
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}
