"""
M5 생산/SCM — 출하지시서 API 라우터
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.shipments import ShipmentCreate, ShipmentUpdate
from ..services import shipment_service

router = APIRouter()


@router.get("", summary="출하지시서 목록")
async def list_shipments(
    status: Optional[str] = Query(None, description="상태 필터"),
    customer_id: Optional[str] = Query(None, description="거래처 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """출하지시서 목록을 조회합니다"""
    data = await shipment_service.list_shipments(
        db, status_filter=status, customer_id=customer_id,
        search=search, page=page, size=size,
    )
    return success_response(data=data)


@router.get("/{shipment_id}", summary="출하지시서 상세")
async def get_shipment(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """출하지시서 상세 정보를 조회합니다"""
    data = await shipment_service.get_shipment(db, shipment_id)
    return success_response(data=data)


@router.post("", summary="출하지시서 생성")
async def create_shipment(
    data: ShipmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """출하지시서를 수동 생성합니다"""
    ip = request.client.host if request.client else None
    result = await shipment_service.create_shipment(db, data, current_user, ip)
    return success_response(data=result, message=f"출하지시서 {result['shipment_no']}이(가) 생성되었습니다")


@router.post("/from-order/{order_id}", summary="수주→출하지시서 전환")
async def create_from_order(
    order_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """수주서 기반으로 출하지시서를 자동 생성합니다"""
    ip = request.client.host if request.client else None
    result = await shipment_service.create_from_order(db, order_id, current_user, ip)
    return success_response(data=result, message=f"출하지시서 {result['shipment_no']}이(가) 생성되었습니다")


@router.put("/{shipment_id}", summary="출하지시서 수정")
async def update_shipment(
    shipment_id: uuid.UUID,
    data: ShipmentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """출하지시서를 수정합니다 (pending 상태만)"""
    ip = request.client.host if request.client else None
    result = await shipment_service.update_shipment(db, shipment_id, data, current_user, ip)
    return success_response(data=result, message="출하지시서가 수정되었습니다")


@router.patch("/{shipment_id}/status", summary="출하 상태 변경")
async def update_status(
    shipment_id: uuid.UUID,
    new_status: str = Query(..., description="변경할 상태"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """출하 상태를 변경합니다 (pending→picked→shipped→delivered)"""
    ip = request.client.host if request.client else None
    result = await shipment_service.update_status(db, shipment_id, new_status, current_user, ip)
    return success_response(data=result, message=f"상태가 '{new_status}'(으)로 변경되었습니다")


@router.get("/{shipment_id}/delivery-note", summary="거래명세서 데이터")
async def get_delivery_note(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """거래명세서 출력용 데이터를 조회합니다"""
    data = await shipment_service.get_delivery_note(db, shipment_id)
    return success_response(data=data)
