"""
알림 헬퍼 — 각 모듈에서 간편하게 M7 알림을 생성하는 유틸리티
알림 실패해도 메인 비즈니스 로직에 영향을 주지 않도록 try/except 처리합니다.
"""
import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..modules.m1_system.models import User
from ..modules.m7_notifications.services.notification_service import create_notification


async def _get_admin_user_ids(db: AsyncSession) -> list[uuid.UUID]:
    """관리자(admin) 및 매니저(manager) 사용자 ID 목록 조회"""
    result = await db.execute(
        select(User.id).where(
            User.is_active.is_(True),
            User.role.in_(["admin", "manager"]),
        )
    )
    return list(result.scalars().all())


async def _safe_notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    link: str | None = None,
):
    """알림 생성 (실패해도 예외를 던지지 않음)"""
    try:
        await create_notification(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            reference_type=reference_type,
            reference_id=reference_id,
            link=link,
        )
    except Exception:
        pass  # 알림 실패는 무시 — 메인 로직에 영향 없음


# ── 수주 관련 알림 ──

async def notify_order_created(
    db: AsyncSession,
    order_no: str,
    customer_name: str,
    order_id: uuid.UUID,
    created_by_id: uuid.UUID,
):
    """수주 생성 시 관리자/매니저에게 알림"""
    admin_ids = await _get_admin_user_ids(db)
    title = f"새 수주 등록: {order_no}"
    message = f"거래처 '{customer_name}'의 수주({order_no})가 등록되었습니다."

    for uid in admin_ids:
        if uid == created_by_id:
            continue  # 본인에게는 알림 안 보냄
        await _safe_notify(
            db, uid, "sales", title, message,
            reference_type="sales_order",
            reference_id=order_id,
            link=f"/sales/orders",
        )


# ── 작업지시서 관련 알림 ──

async def notify_work_order_created(
    db: AsyncSession,
    wo_list: list[dict],
    order_no: str,
    created_by_id: uuid.UUID,
):
    """작업지시서 생성 시 관리자/매니저에게 알림"""
    admin_ids = await _get_admin_user_ids(db)
    wo_count = len(wo_list)
    title = f"작업지시서 {wo_count}건 생성 (수주: {order_no})"
    wo_names = ", ".join([w.get("wo_no", "") for w in wo_list[:3]])
    message = f"수주 {order_no}에서 작업지시서 {wo_count}건이 생성되었습니다. ({wo_names})"

    for uid in admin_ids:
        if uid == created_by_id:
            continue
        await _safe_notify(
            db, uid, "production", title, message,
            reference_type="work_order",
            link="/production/work-orders",
        )


# ── 원자재 부족 알림 ──

async def notify_material_shortage(
    db: AsyncSession,
    shortage_list: list[dict],
    order_no: str,
):
    """원자재 부족 발견 시 관리자/매니저에게 알림"""
    if not shortage_list:
        return

    admin_ids = await _get_admin_user_ids(db)
    count = len(shortage_list)
    names = ", ".join([s.get("product_name", "?") for s in shortage_list[:3]])
    title = f"원자재 부족 알림: {count}건 (수주: {order_no})"
    message = f"수주 {order_no} 진행 시 원자재 {count}건이 부족합니다: {names}"

    for uid in admin_ids:
        await _safe_notify(
            db, uid, "production", title, message,
            reference_type="inventory",
            link="/production/inventory",
        )


# ── 재고 안전재고 미달 알림 ──

async def notify_safety_stock_alert(
    db: AsyncSession,
    product_name: str,
    current_qty: float,
    safety_stock: float,
    product_id: uuid.UUID,
):
    """재고 출고 후 안전재고 미달 시 알림"""
    admin_ids = await _get_admin_user_ids(db)
    title = f"안전재고 미달: {product_name}"
    message = (
        f"'{product_name}'의 현재 재고({current_qty})가 "
        f"안전재고({safety_stock}) 미만입니다. 발주를 검토해주세요."
    )

    for uid in admin_ids:
        await _safe_notify(
            db, uid, "production", title, message,
            reference_type="inventory",
            reference_id=product_id,
            link="/production/inventory",
        )
