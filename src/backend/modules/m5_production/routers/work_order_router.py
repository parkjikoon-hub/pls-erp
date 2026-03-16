"""
M5 생산/SCM — 작업지시서 API 라우터
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.work_orders import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderProgressUpdate,
)
from ..services import work_order_service

router = APIRouter()


@router.get("", summary="작업지시서 목록")
async def list_work_orders(
    status: Optional[str] = Query(None, description="상태 필터"),
    order_type: Optional[str] = Query(None, description="유형 필터"),
    order_id: Optional[str] = Query(None, description="수주 ID 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """작업지시서 목록을 조회합니다"""
    data = await work_order_service.list_work_orders(
        db, status_filter=status, order_type=order_type,
        order_id=order_id,
        search=search, page=page, size=size,
    )
    return success_response(data=data)


@router.get("/{wo_id}", summary="작업지시서 상세")
async def get_work_order(
    wo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """작업지시서 상세 정보를 조회합니다"""
    data = await work_order_service.get_work_order(db, wo_id)
    return success_response(data=data)


@router.post("", summary="작업지시서 생성")
async def create_work_order(
    data: WorkOrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """계획생산 작업지시서를 생성합니다"""
    ip = request.client.host if request.client else None
    result = await work_order_service.create_work_order(db, data, current_user, ip)
    return success_response(data=result, message=f"작업지시서 {result['wo_no']}이(가) 생성되었습니다")


@router.put("/{wo_id}", summary="작업지시서 수정")
async def update_work_order(
    wo_id: uuid.UUID,
    data: WorkOrderUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """작업지시서를 수정합니다 (pending 상태만)"""
    ip = request.client.host if request.client else None
    result = await work_order_service.update_work_order(db, wo_id, data, current_user, ip)
    return success_response(data=result, message="작업지시서가 수정되었습니다")


@router.post("/from-order/{order_id}", summary="수주→작업지시서 전환")
async def create_from_order(
    order_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """수주를 기반으로 작업지시서를 자동 생성합니다 (원자재 부족 정보 포함)"""
    ip = request.client.host if request.client else None
    result = await work_order_service.create_from_order(db, order_id, current_user, ip)
    return success_response(data=result, message=f"수주 {result['order_no']}에서 작업지시서가 생성되었습니다")


@router.patch("/{wo_id}/status", summary="작업지시서 상태 변경")
async def update_status(
    wo_id: uuid.UUID,
    new_status: str = Query(..., description="변경할 상태"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """작업지시서 상태를 변경합니다"""
    ip = request.client.host if request.client else None
    result = await work_order_service.update_status(db, wo_id, new_status, current_user, ip)
    return success_response(data=result, message=f"상태가 '{new_status}'(으)로 변경되었습니다")


@router.patch("/{wo_id}/progress", summary="생산 수량 보고")
async def update_progress(
    wo_id: uuid.UUID,
    data: WorkOrderProgressUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """생산 완료 수량을 보고합니다"""
    ip = request.client.host if request.client else None
    result = await work_order_service.update_progress(
        db, wo_id, data.produced_qty, current_user, ip,
    )
    return success_response(data=result, message=f"생산 수량이 보고되었습니다 ({data.produced_qty}개)")
