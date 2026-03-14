"""
Audit Log 조회 라우터 — 관리자가 변경 이력을 확인할 수 있습니다.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from ..database import get_db
from ..auth.dependencies import get_current_admin
from ..modules.m1_system.models import AuditLog, User
from ..shared.pagination import PaginatedResponse

router = APIRouter()


@router.get("/logs", tags=["감사로그"])
async def get_audit_logs(
    table_name: Optional[str] = Query(None, description="테이블명 필터"),
    record_id: Optional[uuid.UUID] = Query(None, description="레코드 ID 필터"),
    action: Optional[str] = Query(None, description="동작 필터 (INSERT/UPDATE/DELETE)"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """변경 이력 목록 조회 (관리자 전용)"""
    query = select(AuditLog)

    # 필터 적용
    if table_name:
        query = query.where(AuditLog.table_name == table_name)
    if record_id:
        query = query.where(AuditLog.record_id == record_id)
    if action:
        query = query.where(AuditLog.action == action)

    # 전체 개수 조회
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # 페이지네이션 + 최신순 정렬
    offset = (page - 1) * size
    query = query.order_by(desc(AuditLog.changed_at)).offset(offset).limit(size)
    result = await db.execute(query)
    logs = result.scalars().all()

    items = [
        {
            "id": str(log.id),
            "table_name": log.table_name,
            "record_id": str(log.record_id),
            "action": log.action,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "changed_by": str(log.changed_by) if log.changed_by else None,
            "changed_at": log.changed_at.isoformat() if log.changed_at else None,
            "ip_address": log.ip_address,
            "memo": log.memo,
        }
        for log in logs
    ]

    return PaginatedResponse.create(items=items, total=total, page=page, size=size)
