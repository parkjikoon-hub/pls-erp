"""
M7 알림센터 — API 라우터
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import AsyncSessionLocal
from ....shared.response import success_response
from ....auth.dependencies import get_current_user
from ..schemas.notifications import NotificationSettingUpdate
from ..services import notification_service

router = APIRouter(tags=["M7-알림센터"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/")
async def list_notifications(
    notification_type: str | None = None,
    is_read: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """내 알림 목록"""
    data = await notification_service.list_notifications(
        db, current_user.id,
        notification_type=notification_type, is_read=is_read,
        page=page, size=size,
    )
    return success_response(data)


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """읽지 않은 알림 수"""
    data = await notification_service.unread_count(db, current_user.id)
    return success_response(data)


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """단건 읽음 처리"""
    data = await notification_service.mark_read(db, current_user.id, notification_id)
    return success_response(data)


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """전체 읽음 처리"""
    data = await notification_service.mark_all_read(db, current_user.id)
    return success_response(data)


@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """알림 수신 설정 조회"""
    data = await notification_service.get_settings(db, current_user.id)
    return success_response(data)


@router.put("/settings")
async def update_setting(
    body: NotificationSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """알림 설정 변경"""
    data = await notification_service.update_setting(db, current_user.id, body)
    return success_response(data)
