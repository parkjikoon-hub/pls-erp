"""
M7 알림센터 — 알림 CRUD + 설정 서비스
"""
import uuid
from datetime import datetime

from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Notification, NotificationSetting

# 알림 유형 정의
NOTIFICATION_TYPES = {
    "approval": "결재",
    "sales": "영업",
    "production": "생산",
    "finance": "재무",
    "hr": "인사",
    "system": "시스템",
}


def _build_item(n: Notification) -> dict:
    """알림 응답 딕셔너리"""
    return {
        "id": str(n.id),
        "notification_type": n.notification_type,
        "title": n.title,
        "message": n.message,
        "reference_type": n.reference_type,
        "reference_id": str(n.reference_id) if n.reference_id else None,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── 알림 생성 (다른 모듈에서 호출) ──

async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    link: str | None = None,
):
    """알림 생성 (다른 모듈의 서비스에서 호출)"""
    n = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        link=link,
    )
    db.add(n)
    await db.flush()
    return _build_item(n)


# ── 알림 조회 ──

async def list_notifications(
    db: AsyncSession, user_id: uuid.UUID, *,
    notification_type: str | None = None,
    is_read: bool | None = None,
    page: int = 1, size: int = 30,
):
    """내 알림 목록"""
    base = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    if notification_type:
        base = base.where(Notification.notification_type == notification_type)
    if is_read is not None:
        base = base.where(Notification.is_read == is_read)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    rows = (await db.execute(base.offset((page - 1) * size).limit(size))).scalars().all()
    items = [_build_item(n) for n in rows]
    return {"items": items, "total": total, "page": page, "size": size}


async def unread_count(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """읽지 않은 알림 수"""
    stmt = select(func.count()).select_from(Notification).where(
        and_(Notification.user_id == user_id, Notification.is_read == False)
    )
    count = (await db.execute(stmt)).scalar() or 0
    return {"unread_count": count}


# ── 읽음 처리 ──

async def mark_read(db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID):
    """단건 읽음 처리"""
    n = await db.get(Notification, notification_id)
    if n and n.user_id == user_id:
        n.is_read = True
        await db.commit()
    return {"message": "읽음 처리되었습니다"}


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID):
    """전체 읽음 처리"""
    stmt = (
        update(Notification)
        .where(and_(Notification.user_id == user_id, Notification.is_read == False))
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "전체 읽음 처리되었습니다"}


# ── 알림 설정 ──

async def get_settings(db: AsyncSession, user_id: uuid.UUID):
    """알림 수신 설정 조회 (없으면 기본값 생성)"""
    stmt = select(NotificationSetting).where(NotificationSetting.user_id == user_id)
    rows = (await db.execute(stmt)).scalars().all()

    existing = {r.notification_type: r for r in rows}
    items = []

    for ntype, label in NOTIFICATION_TYPES.items():
        if ntype in existing:
            s = existing[ntype]
            items.append({
                "notification_type": ntype,
                "label": label,
                "in_app_enabled": s.in_app_enabled,
                "email_enabled": s.email_enabled,
            })
        else:
            # 기본값 생성
            ns = NotificationSetting(
                user_id=user_id,
                notification_type=ntype,
                in_app_enabled=True,
                email_enabled=False,
            )
            db.add(ns)
            items.append({
                "notification_type": ntype,
                "label": label,
                "in_app_enabled": True,
                "email_enabled": False,
            })

    await db.commit()
    return items


async def update_setting(db: AsyncSession, user_id: uuid.UUID, data):
    """알림 설정 변경"""
    stmt = select(NotificationSetting).where(and_(
        NotificationSetting.user_id == user_id,
        NotificationSetting.notification_type == data.notification_type,
    ))
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if not setting:
        setting = NotificationSetting(
            user_id=user_id,
            notification_type=data.notification_type,
        )
        db.add(setting)

    if data.in_app_enabled is not None:
        setting.in_app_enabled = data.in_app_enabled
    if data.email_enabled is not None:
        setting.email_enabled = data.email_enabled

    await db.commit()
    return {"message": "설정이 변경되었습니다"}
