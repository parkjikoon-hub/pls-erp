"""
Audit Log 서비스 — 데이터 변경 이력을 자동 기록합니다.
모든 CRUD 작업에서 이 서비스를 호출하여 변경 내역을 추적합니다.
"""
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..modules.m1_system.models import AuditLog


async def log_action(
    db: AsyncSession,
    table_name: str,
    record_id: uuid.UUID,
    action: str,
    changed_by: Optional[uuid.UUID] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
    memo: Optional[str] = None,
):
    """
    변경 이력을 audit_logs 테이블에 기록합니다.

    사용 예:
        await log_action(db, "customers", customer.id, "INSERT",
                         changed_by=current_user.id, new_values={"name": "신규거래처"})
    """
    audit_entry = AuditLog(
        table_name=table_name,
        record_id=record_id,
        action=action,
        changed_by=changed_by,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        memo=memo,
    )
    db.add(audit_entry)


def get_changed_fields(old_data: dict, new_data: dict) -> tuple[dict, dict]:
    """
    변경된 필드만 추출하여 (old_values, new_values) 반환합니다.
    변경되지 않은 필드는 제외하여 로그 크기를 줄입니다.
    """
    old_changed = {}
    new_changed = {}
    for key in new_data:
        if key in old_data and old_data[key] != new_data[key]:
            old_changed[key] = old_data[key]
            new_changed[key] = new_data[key]
    return old_changed, new_changed
