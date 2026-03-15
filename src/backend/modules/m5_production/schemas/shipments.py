"""
M5 생산/SCM — 출하지시서 Pydantic 스키마
"""
from typing import Optional
from pydantic import BaseModel, Field


# ── 출하 라인 ──

class ShipmentLineCreate(BaseModel):
    """출하 라인 생성"""
    product_id: str
    order_line_id: Optional[str] = None
    quantity: float = Field(gt=0, description="출하 수량")
    unit_price: float = Field(ge=0, default=0, description="단가")
    warehouse_id: Optional[str] = None
    line_no: int = 1


class ShipmentLineResponse(BaseModel):
    """출하 라인 응답"""
    id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    order_line_id: Optional[str] = None
    quantity: float
    unit_price: float
    amount: float
    warehouse_id: Optional[str] = None
    warehouse_name: Optional[str] = None
    line_no: int


# ── 출하지시서 ──

class ShipmentCreate(BaseModel):
    """출하지시서 생성"""
    order_id: Optional[str] = None
    customer_id: str
    shipment_date: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_no: Optional[str] = None
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    lines: list[ShipmentLineCreate] = Field(min_length=1, description="출하 품목")


class ShipmentUpdate(BaseModel):
    """출하지시서 수정"""
    carrier_name: Optional[str] = None
    tracking_no: Optional[str] = None
    shipping_address: Optional[str] = None
    notes: Optional[str] = None


class ShipmentListItem(BaseModel):
    """출하 목록 아이템"""
    id: str
    shipment_no: str
    order_id: Optional[str] = None
    order_no: Optional[str] = None
    customer_id: str
    customer_name: Optional[str] = None
    shipment_date: Optional[str] = None
    status: str
    carrier_name: Optional[str] = None
    tracking_no: Optional[str] = None
    delivery_note_no: Optional[str] = None
    line_count: int = 0
    total_amount: float = 0
    created_at: Optional[str] = None


class ShipmentResponse(ShipmentListItem):
    """출하 상세 응답"""
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    lines: list[ShipmentLineResponse] = []
