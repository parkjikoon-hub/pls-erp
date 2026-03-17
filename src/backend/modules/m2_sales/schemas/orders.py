"""
M2 영업/수주 — 수주 Pydantic 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 수주 라인 ──

class SalesOrderLineCreate(BaseModel):
    """수주 라인 생성 요청"""
    product_id: Optional[str] = None
    product_name: str = Field(..., max_length=200, description="품목명")
    specification: Optional[str] = Field(None, max_length=200, description="규격")
    quantity: float = Field(..., gt=0, description="수주수량")
    unit_price: float = Field(..., ge=0, description="단가")
    delivery_date: Optional[date] = None
    remark: Optional[str] = Field(None, max_length=500)


class SalesOrderLineResponse(BaseModel):
    """수주 라인 응답"""
    id: str
    line_no: int
    product_id: Optional[str] = None
    product_name: str
    specification: Optional[str] = None
    quantity: float
    unit_price: float
    amount: float
    tax_amount: float = 0
    delivery_date: Optional[date] = None
    produced_qty: float = 0
    shipped_qty: float = 0
    remark: Optional[str] = None

    model_config = {"from_attributes": True}


# ── 수주 헤더 ──

class SalesOrderCreate(BaseModel):
    """수주 생성 요청"""
    order_date: date = Field(..., description="수주일")
    delivery_date: Optional[date] = Field(None, description="납기일")
    customer_id: str = Field(..., description="거래처 ID")
    quotation_id: Optional[str] = Field(None, description="연결 견적서 ID")
    sales_rep_id: Optional[str] = Field(None, description="담당 영업사원 ID")
    notes: Optional[str] = None
    auto_create_wo: bool = Field(False, description="수주 확정 시 작업지시서 자동 생성 여부")
    lines: list[SalesOrderLineCreate] = Field(
        ..., min_length=1, description="수주 품목 (최소 1줄)",
    )


class SalesOrderUpdate(BaseModel):
    """수주 수정 요청 (confirmed 상태만)"""
    order_date: Optional[date] = None
    delivery_date: Optional[date] = None
    customer_id: Optional[str] = None
    sales_rep_id: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[list[SalesOrderLineCreate]] = None


class SalesOrderListItem(BaseModel):
    """수주 목록 항목"""
    id: str
    order_no: str
    order_date: date
    delivery_date: Optional[date] = None
    customer_name: Optional[str] = None
    sales_rep_name: Optional[str] = None
    total_amount: float = 0
    tax_amount: float = 0
    grand_total: float = 0
    status: str = "confirmed"
    progress_pct: int = 0
    created_at: Optional[datetime] = None


class SalesOrderResponse(BaseModel):
    """수주 상세 응답"""
    id: str
    order_no: str
    order_date: date
    delivery_date: Optional[date] = None
    customer_id: str
    customer_name: Optional[str] = None
    quotation_id: Optional[str] = None
    quotation_no: Optional[str] = None
    sales_rep_id: Optional[str] = None
    sales_rep_name: Optional[str] = None
    total_amount: float = 0
    tax_amount: float = 0
    grand_total: float = 0
    status: str = "confirmed"
    progress_pct: int = 0
    notes: Optional[str] = None
    lines: list[SalesOrderLineResponse] = []
    created_at: Optional[datetime] = None
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderStatusUpdate(BaseModel):
    """수주 상태 변경 요청"""
    status: str = Field(..., description="변경할 상태")
    memo: Optional[str] = Field(None, description="상태 변경 사유")
