"""
M2 영업/수주 — 수주 API 라우터
"""
import io
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.orders import SalesOrderCreate, SalesOrderUpdate, OrderStatusUpdate
from ..services import order_service

router = APIRouter()


@router.get("", summary="수주 목록")
async def list_orders(
    customer_id: Optional[str] = Query(None, description="거래처 ID 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """수주 목록을 조회합니다"""
    data = await order_service.list_orders(
        db, customer_id=customer_id, status_filter=status,
        search=search, page=page, size=size,
    )
    return success_response(data=data)


@router.get("/{order_id}", summary="수주 상세")
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """수주 상세 정보를 조회합니다 (라인 포함)"""
    data = await order_service.get_order(db, order_id)
    return success_response(data=data)


@router.post("", summary="수주 생성")
async def create_order(
    data: SalesOrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """새 수주를 생성합니다"""
    ip = request.client.host if request.client else None
    result = await order_service.create_order(db, data, current_user, ip)
    return success_response(data=result, message=f"수주 {result['order_no']}이(가) 생성되었습니다")


@router.post("/from-quotation/{quotation_id}", summary="견적서 → 수주 전환")
async def create_order_from_quotation(
    quotation_id: uuid.UUID,
    order_date: date = Query(..., description="수주일"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """견적서를 기반으로 수주를 생성합니다"""
    ip = request.client.host if request.client else None
    result = await order_service.create_order_from_quotation(
        db, quotation_id, order_date, current_user, ip,
    )
    return success_response(data=result, message=f"수주 {result['order_no']}이(가) 생성되었습니다")


@router.put("/{order_id}", summary="수주 수정")
async def update_order(
    order_id: uuid.UUID,
    data: SalesOrderUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """수주를 수정합니다 (confirmed 상태만)"""
    ip = request.client.host if request.client else None
    result = await order_service.update_order(db, order_id, data, current_user, ip)
    return success_response(data=result, message=f"수주 {result['order_no']}이(가) 수정되었습니다")


@router.patch("/{order_id}/status", summary="수주 상태 변경")
async def update_order_status(
    order_id: uuid.UUID,
    body: OrderStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """수주 상태를 변경합니다 (confirmed→in_production→shipped→completed→invoiced)"""
    ip = request.client.host if request.client else None
    result = await order_service.update_order_status(
        db, order_id, body.status, current_user, ip, body.memo,
    )
    return success_response(data=result, message=f"수주 상태가 '{body.status}'(으)로 변경되었습니다")


@router.delete("/{order_id}", summary="수주 삭제")
async def delete_order(
    order_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """수주를 삭제합니다 (confirmed 상태만)"""
    ip = request.client.host if request.client else None
    result = await order_service.delete_order(db, order_id, current_user, ip)
    return success_response(data=result, message=result["message"])


@router.get("/{order_id}/download-statement", summary="거래명세서 Excel 다운로드")
async def download_statement_excel(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """수주 데이터를 거래명세서 양식 Excel로 다운로드합니다"""
    content = await order_service.generate_statement_excel(db, order_id)
    filename = f"거래명세서_{order_id}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
