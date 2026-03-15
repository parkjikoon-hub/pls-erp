"""
M6 그룹웨어 — 결재선 템플릿 서비스
"""
import uuid

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import ApprovalTemplate, ApprovalTemplateLine
from ...m1_system.models import User


async def list_templates(db: AsyncSession, current_user_id: uuid.UUID):
    """내 결재선 템플릿 목록"""
    stmt = (
        select(ApprovalTemplate)
        .options(selectinload(ApprovalTemplate.lines))
        .where(ApprovalTemplate.is_active == True)
        .order_by(ApprovalTemplate.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for t in rows:
        lines = []
        for ln in t.lines:
            user = await db.get(User, ln.approver_id)
            lines.append({
                "id": str(ln.id),
                "step_order": ln.step_order,
                "approver_id": str(ln.approver_id),
                "approver_name": user.name if user else None,
                "role_label": ln.role_label,
                "line_type": ln.line_type,
            })
        items.append({
            "id": str(t.id),
            "name": t.name,
            "document_type": t.document_type,
            "description": t.description,
            "is_active": t.is_active,
            "lines": lines,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return items


async def create_template(db: AsyncSession, data, current_user):
    """결재선 템플릿 생성"""
    t = ApprovalTemplate(
        name=data.name,
        document_type=data.document_type,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(t)
    await db.flush()

    for ln_data in data.lines:
        ln = ApprovalTemplateLine(
            template_id=t.id,
            step_order=ln_data.step_order,
            approver_id=uuid.UUID(ln_data.approver_id),
            role_label=ln_data.role_label,
            line_type=ln_data.line_type,
        )
        db.add(ln)

    await db.commit()
    return {"id": str(t.id), "name": t.name}


async def delete_template(db: AsyncSession, template_id: uuid.UUID):
    """결재선 템플릿 삭제 (비활성화)"""
    t = await db.get(ApprovalTemplate, template_id)
    if not t:
        raise HTTPException(404, "템플릿을 찾을 수 없습니다")
    t.is_active = False
    await db.commit()
    return {"message": "삭제되었습니다"}
