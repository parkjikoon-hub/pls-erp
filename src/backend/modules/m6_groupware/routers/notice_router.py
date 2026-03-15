"""
M6 그룹웨어 — 공지사항 API 라우터
"""
import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import AsyncSessionLocal
from ....shared.response import success_response
from ...m1_system.dependencies import get_current_user, require_role
from ..schemas.notices import NoticeCreate, NoticeUpdate
from ..services import notice_service

router = APIRouter(prefix="/notices", tags=["M6-공지사항"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("")
async def list_notices(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """공지사항 목록"""
    data = await notice_service.list_notices(db, page, size)
    return success_response(data)


@router.get("/{notice_id}")
async def get_notice(
    notice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """공지사항 상세 (조회수 자동 증가)"""
    data = await notice_service.get_notice(db, notice_id)
    return success_response(data)


@router.post("")
async def create_notice(
    body: NoticeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """공지사항 작성 (관리자/매니저만)"""
    ip = request.client.host if request.client else None
    data = await notice_service.create_notice(db, body, current_user, ip)
    return success_response(data, "공지사항이 등록되었습니다")


@router.put("/{notice_id}")
async def update_notice(
    notice_id: uuid.UUID,
    body: NoticeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """공지사항 수정"""
    ip = request.client.host if request.client else None
    data = await notice_service.update_notice(db, notice_id, body, current_user, ip)
    return success_response(data, "수정되었습니다")


@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """공지사항 삭제"""
    ip = request.client.host if request.client else None
    data = await notice_service.delete_notice(db, notice_id, current_user, ip)
    return success_response(data)
