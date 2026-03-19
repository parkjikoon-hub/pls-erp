"""
M5 생산/SCM — 재고 관리 API 라우터
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.inventory import (
    WarehouseCreate, InventoryReceive, InventoryIssue,
    InventoryTransfer, InventoryAdjust,
)
from ..services import inventory_service

router = APIRouter()


# ── 창고 ──

@router.get("/warehouses", summary="창고 목록")
async def list_warehouses(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """활성 창고 목록을 조회합니다"""
    data = await inventory_service.list_warehouses(db)
    return success_response(data=data)


@router.post("/warehouses", summary="창고 생성")
async def create_warehouse(
    data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """새 창고를 생성합니다"""
    result = await inventory_service.create_warehouse(db, data, current_user)
    return success_response(data=result, message=f"창고 '{data.name}'이(가) 생성되었습니다")


# ── 재고 현황 ──

@router.get("/inventory", summary="재고 현황")
async def list_inventory(
    warehouse_id: Optional[str] = Query(None, description="창고 ID 필터"),
    zone_type: Optional[str] = Query(None, description="구역 필터 (raw/wip/finished/defective)"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """재고 현황을 조회합니다"""
    data = await inventory_service.list_inventory(
        db, warehouse_id=warehouse_id, zone_type=zone_type,
        search=search, page=page, size=size,
    )
    return success_response(data=data)


# ── 입출고/이관/조정 ──

@router.post("/inventory/receive", summary="입고")
async def receive_inventory(
    data: InventoryReceive,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """자재를 입고합니다"""
    ip = request.client.host if request.client else None
    result = await inventory_service.receive_inventory(db, data, current_user, ip)
    return success_response(data=result, message=result["message"])


@router.post("/inventory/issue", summary="출고")
async def issue_inventory(
    data: InventoryIssue,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """자재를 출고합니다"""
    ip = request.client.host if request.client else None
    result = await inventory_service.issue_inventory(db, data, current_user, ip)
    return success_response(data=result, message=result["message"])


@router.post("/inventory/transfer", summary="이관")
async def transfer_inventory(
    data: InventoryTransfer,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """창고 간 이관합니다"""
    ip = request.client.host if request.client else None
    result = await inventory_service.transfer_inventory(db, data, current_user, ip)
    return success_response(data=result, message=result["message"])


@router.post("/inventory/adjust", summary="재고 조정")
async def adjust_inventory(
    data: InventoryAdjust,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """재고를 조정합니다 (관리자 전용)"""
    ip = request.client.host if request.client else None
    result = await inventory_service.adjust_inventory(db, data, current_user, ip)
    return success_response(data=result, message=result["message"])


# ── 이력 ──

@router.get("/inventory/transactions", summary="이동 이력")
async def list_transactions(
    product_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    tx_type: Optional[str] = Query(None, description="유형 (receive/issue/transfer/adjust)"),
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """재고 이동 이력을 조회합니다"""
    data = await inventory_service.list_transactions(
        db, product_id=product_id, warehouse_id=warehouse_id,
        tx_type=tx_type, page=page, size=size,
    )
    return success_response(data=data)


# ── 부족 재고 ──

@router.get("/inventory/shortage", summary="부족 재고 목록")
async def get_shortage_list(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """안전재고 미달 품목 목록을 조회합니다"""
    data = await inventory_service.get_shortage_list(db)
    return success_response(data=data)


# ── 수주 기준 소요량 사전 조회 ──

@router.post("/inventory/check-order/{order_id}", summary="수주 기준 원자재 소요량")
async def check_order_materials(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """수주서 기준으로 BOM을 전개하여 필요한 원자재와 부족분을 계산합니다"""
    data = await inventory_service.check_order_materials(db, order_id)
    return success_response(data=data)


# ── 견적서 단계 재고/원자재 사전 체크 ──

from pydantic import BaseModel, Field
from typing import List

class QuotationCheckLine(BaseModel):
    """견적서 품목 라인"""
    product_id: str = Field(..., description="품목 UUID")
    quantity: float = Field(..., gt=0, description="요청 수량")

class QuotationCheckRequest(BaseModel):
    """견적서 재고 사전 체크 요청"""
    lines: List[QuotationCheckLine] = Field(..., min_length=1)

@router.post("/inventory/quotation-check", summary="견적서 재고/원자재 사전 체크")
async def check_quotation_materials(
    body: QuotationCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    견적서 품목 기준 재고/원자재 사전 체크
    - 완제품 재고 확인 → 부족분 BOM 전개 → 원자재 재고 확인
    - 결과: 즉시 출하 가능 / 생산 필요(원자재 확보) / 원자재 구매 필요
    """
    lines = [{"product_id": l.product_id, "quantity": l.quantity} for l in body.lines]
    data = await inventory_service.check_quotation_materials(db, lines)
    return success_response(data=data)
