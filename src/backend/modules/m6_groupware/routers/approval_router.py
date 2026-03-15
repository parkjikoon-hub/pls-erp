"""
M6 그룹웨어 — 결재 요청/승인/반려 API 라우터
"""
import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import AsyncSessionLocal
from ....shared.response import success_response
from ....auth.dependencies import get_current_user
from ..schemas.approvals import ApprovalRequestCreate, ApprovalActionData
from ..services import approval_service

router = APIRouter(prefix="/approvals", tags=["M6-전자결재"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("")
async def list_requests(
    status: str | None = None,
    document_type: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """결재 목록 (필터: status, document_type)"""
    data = await approval_service.list_requests(
        db, status_filter=status, document_type=document_type, page=page, size=size,
    )
    return success_response(data)


@router.get("/my-requests")
async def my_requests(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """내가 올린 결재"""
    data = await approval_service.my_requests(db, current_user.id, page, size)
    return success_response(data)


@router.get("/my-approvals")
async def my_approvals(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """내가 결재할 건"""
    data = await approval_service.my_approvals(db, current_user.id, status)
    return success_response(data)


@router.get("/my-references")
async def my_references(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """참조 문서"""
    data = await approval_service.my_references(db, current_user.id)
    return success_response(data)


@router.get("/{request_id}")
async def get_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """결재 상세"""
    data = await approval_service.get_request(db, request_id)
    return success_response(data)


@router.post("")
async def create_request(
    body: ApprovalRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """결재 기안"""
    ip = request.client.host if request.client else None
    data = await approval_service.create_request(db, body, current_user, ip)
    return success_response(data, "결재가 상신되었습니다")


@router.patch("/{request_id}/approve")
async def approve(
    request_id: uuid.UUID,
    body: ApprovalActionData = ApprovalActionData(),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """승인"""
    ip = request.client.host if request and request.client else None
    data = await approval_service.approve_step(db, request_id, current_user, body.comment, ip)
    return success_response(data, "승인되었습니다")


@router.patch("/{request_id}/reject")
async def reject(
    request_id: uuid.UUID,
    body: ApprovalActionData = ApprovalActionData(),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """반려"""
    ip = request.client.host if request and request.client else None
    data = await approval_service.reject_step(db, request_id, current_user, body.comment, ip)
    return success_response(data, "반려되었습니다")
