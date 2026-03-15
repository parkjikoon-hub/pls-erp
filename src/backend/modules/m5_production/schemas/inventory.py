"""
M5 생산/SCM — 재고 관리 Pydantic 스키마
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 창고 ──

class WarehouseCreate(BaseModel):
    """창고 생성"""
    code: str = Field(..., max_length=30, description="창고코드")
    name: str = Field(..., max_length=100, description="창고명")
    zone_type: str = Field(..., description="구역유형 (raw/wip/finished/defective)")
    description: Optional[str] = None


class WarehouseResponse(BaseModel):
    """창고 응답"""
    id: str
    code: str
    name: str
    zone_type: str
    description: Optional[str] = None
    is_active: bool = True


# ── 재고 현황 ──

class InventoryItem(BaseModel):
    """재고 항목"""
    id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    warehouse_id: str
    warehouse_name: Optional[str] = None
    zone_type: Optional[str] = None
    quantity: float = 0
    unit_cost: float = 0
    status: str = "available"
    safety_stock: int = 0


# ── 입출고/이관/조정 ──

class InventoryReceive(BaseModel):
    """입고"""
    product_id: str = Field(..., description="품목 ID")
    warehouse_id: str = Field(..., description="입고 창고 ID")
    quantity: float = Field(..., gt=0, description="입고 수량")
    unit_cost: float = Field(0, ge=0, description="단가")
    notes: Optional[str] = None


class InventoryIssue(BaseModel):
    """출고"""
    product_id: str = Field(..., description="품목 ID")
    warehouse_id: str = Field(..., description="출고 창고 ID")
    quantity: float = Field(..., gt=0, description="출고 수량")
    notes: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None


class InventoryTransfer(BaseModel):
    """이관 (창고 간 이동)"""
    product_id: str = Field(..., description="품목 ID")
    from_warehouse_id: str = Field(..., description="출발 창고 ID")
    to_warehouse_id: str = Field(..., description="도착 창고 ID")
    quantity: float = Field(..., gt=0, description="이동 수량")
    notes: Optional[str] = None


class InventoryAdjust(BaseModel):
    """재고 조정 (절대값)"""
    product_id: str = Field(..., description="품목 ID")
    warehouse_id: str = Field(..., description="창고 ID")
    new_quantity: float = Field(..., ge=0, description="조정 후 수량")
    notes: str = Field(..., min_length=1, description="조정 사유 (필수)")


# ── 이동 이력 ──

class TransactionResponse(BaseModel):
    """재고 이동 이력 항목"""
    id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    from_warehouse: Optional[str] = None
    to_warehouse: Optional[str] = None
    quantity: float
    transaction_type: str
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    created_by_name: Optional[str] = None


# ── 부족 재고 ──

class ShortageItem(BaseModel):
    """안전재고 미달 항목"""
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    current_qty: float = 0
    safety_stock: int = 0
    shortage_qty: float = 0
