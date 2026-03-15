"""
M5 생산/SCM — 작업지시서 Pydantic 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class WorkOrderCreate(BaseModel):
    """작업지시서 생성 (계획생산)"""
    order_type: str = Field("make_to_stock", description="유형 (make_to_order/make_to_stock)")
    product_id: str = Field(..., description="생산 품목 ID")
    bom_id: Optional[str] = Field(None, description="BOM ID (없으면 자동 선택)")
    planned_qty: float = Field(..., gt=0, description="계획 수량")
    start_date: Optional[date] = None
    due_date: date = Field(..., description="납기일")
    assigned_to: Optional[str] = Field(None, description="담당자 ID")
    notes: Optional[str] = None


class WorkOrderUpdate(BaseModel):
    """작업지시서 수정 (pending 상태만)"""
    planned_qty: Optional[float] = Field(None, gt=0)
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None
    bom_id: Optional[str] = None
    notes: Optional[str] = None


class WorkOrderStatusUpdate(BaseModel):
    """작업지시서 상태 변경"""
    status: str = Field(..., description="변경할 상태 (in_progress/qc_wait/completed)")


class WorkOrderProgressUpdate(BaseModel):
    """생산 수량 보고"""
    produced_qty: float = Field(..., ge=0, description="생산 완료 수량")


class WorkOrderListItem(BaseModel):
    """작업지시서 목록 항목"""
    id: str
    wo_no: str
    order_type: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    planned_qty: float
    produced_qty: float = 0
    progress_pct: int = 0
    status: str
    due_date: date
    assigned_to_name: Optional[str] = None
    order_no: Optional[str] = None
    created_at: Optional[datetime] = None


class WorkOrderResponse(BaseModel):
    """작업지시서 상세"""
    id: str
    wo_no: str
    order_type: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    bom_id: Optional[str] = None
    planned_qty: float
    produced_qty: float = 0
    progress_pct: int = 0
    status: str
    start_date: Optional[date] = None
    due_date: date
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    order_id: Optional[str] = None
    order_no: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
