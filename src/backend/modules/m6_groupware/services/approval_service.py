"""
M6 그룹웨어 — 결재 요청/승인/반려 서비스
"""
import uuid
from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import ApprovalRequest, ApprovalStep
from ...m1_system.models import User
from ....audit.service import log_action


async def _generate_request_no(db: AsyncSession) -> str:
    """결재번호 자동 생성 (AP-YYYYMM-NNNN)"""
    prefix = f"AP-{date.today().strftime('%Y%m')}-"
    stmt = (
        select(func.count())
        .select_from(ApprovalRequest)
        .where(ApprovalRequest.request_no.like(f"{prefix}%"))
    )
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"


def _build_step_response(step, approver_name=None):
    """단계 응답 딕셔너리"""
    return {
        "id": str(step.id),
        "step_type": step.step_type,
        "step_order": step.step_order,
        "approver_id": str(step.approver_id),
        "approver_name": approver_name,
        "role_label": step.role_label,
        "status": step.status,
        "comment": step.comment,
        "acted_at": step.acted_at.isoformat() if step.acted_at else None,
    }


async def _build_response(db: AsyncSession, req: ApprovalRequest, include_steps=True):
    """결재 요청 응답 딕셔너리"""
    requester = await db.get(User, req.requester_id)

    # 현재 결재 단계 계산
    approval_steps = [s for s in req.steps if s.step_type == "approval"]
    current_step = None
    for s in approval_steps:
        if s.status == "pending":
            current_step = s.step_order
            break
    if current_step is None and req.status == "approved":
        current_step = len(approval_steps)

    result = {
        "id": str(req.id),
        "request_no": req.request_no,
        "title": req.title,
        "document_type": req.document_type,
        "amount": float(req.amount) if req.amount else None,
        "status": req.status,
        "requester_id": str(req.requester_id),
        "requester_name": requester.name if requester else None,
        "reference_type": req.reference_type,
        "reference_id": str(req.reference_id) if req.reference_id else None,
        "current_step": current_step,
        "total_steps": len(approval_steps),
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }

    if include_steps:
        steps = []
        for s in req.steps:
            user = await db.get(User, s.approver_id)
            steps.append(_build_step_response(s, user.name if user else None))
        result["content"] = req.content
        result["steps"] = steps

    return result


# ── 기안 ──

async def create_request(db: AsyncSession, data, current_user, ip: str | None = None):
    """결재 기안 (draft 상태로 생성 후 바로 상신)"""
    request_no = await _generate_request_no(db)

    req = ApprovalRequest(
        request_no=request_no,
        title=data.title,
        document_type=data.document_type,
        content=data.content,
        amount=data.amount,
        reference_type=data.reference_type,
        reference_id=uuid.UUID(data.reference_id) if data.reference_id else None,
        status="pending",  # 바로 상신
        requester_id=current_user.id,
    )
    db.add(req)
    await db.flush()

    for step_data in data.steps:
        step = ApprovalStep(
            request_id=req.id,
            step_type=step_data.step_type,
            step_order=step_data.step_order,
            approver_id=uuid.UUID(step_data.approver_id),
            role_label=step_data.role_label,
            status="pending" if step_data.step_type == "approval" else "pending",
        )
        db.add(step)

    await db.commit()
    await log_action(
        db=db, table_name="approval_requests", record_id=req.id,
        action="CREATE", changed_by=current_user.id, ip_address=ip,
    )

    # 재조회 (steps 포함)
    stmt = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.steps))
        .where(ApprovalRequest.id == req.id)
    )
    req = (await db.execute(stmt)).scalar_one()
    return await _build_response(db, req)


# ── 목록 조회 ──

async def list_requests(
    db: AsyncSession, *,
    status_filter: str | None = None,
    document_type: str | None = None,
    page: int = 1, size: int = 20,
):
    """전체 결재 목록"""
    base = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.steps))
        .where(ApprovalRequest.is_deleted == False)
        .order_by(ApprovalRequest.created_at.desc())
    )
    if status_filter:
        base = base.where(ApprovalRequest.status == status_filter)
    if document_type:
        base = base.where(ApprovalRequest.document_type == document_type)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = base.offset((page - 1) * size).limit(size)
    rows = (await db.execute(stmt)).scalars().unique().all()

    items = [await _build_response(db, r, include_steps=False) for r in rows]
    return {"items": items, "total": total, "page": page, "size": size}


async def my_requests(db: AsyncSession, user_id: uuid.UUID, page: int = 1, size: int = 20):
    """내가 올린 결재"""
    base = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.steps))
        .where(and_(
            ApprovalRequest.requester_id == user_id,
            ApprovalRequest.is_deleted == False,
        ))
        .order_by(ApprovalRequest.created_at.desc())
    )
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    rows = (await db.execute(base.offset((page - 1) * size).limit(size))).scalars().unique().all()
    items = [await _build_response(db, r, include_steps=False) for r in rows]
    return {"items": items, "total": total}


async def my_approvals(db: AsyncSession, user_id: uuid.UUID, status_filter: str | None = None):
    """내가 결재할 건"""
    base = (
        select(ApprovalStep)
        .where(and_(
            ApprovalStep.approver_id == user_id,
            ApprovalStep.step_type == "approval",
        ))
    )
    if status_filter:
        base = base.where(ApprovalStep.status == status_filter)

    steps = (await db.execute(base.order_by(ApprovalStep.step_order))).scalars().all()

    items = []
    seen = set()
    for step in steps:
        if step.request_id in seen:
            continue
        seen.add(step.request_id)
        stmt = (
            select(ApprovalRequest)
            .options(selectinload(ApprovalRequest.steps))
            .where(ApprovalRequest.id == step.request_id)
        )
        req = (await db.execute(stmt)).scalar_one_or_none()
        if req and not req.is_deleted:
            items.append(await _build_response(db, req, include_steps=False))

    return {"items": items, "total": len(items)}


async def my_references(db: AsyncSession, user_id: uuid.UUID):
    """참조 문서"""
    steps = (await db.execute(
        select(ApprovalStep).where(and_(
            ApprovalStep.approver_id == user_id,
            ApprovalStep.step_type == "reference",
        ))
    )).scalars().all()

    items = []
    for step in steps:
        stmt = (
            select(ApprovalRequest)
            .options(selectinload(ApprovalRequest.steps))
            .where(ApprovalRequest.id == step.request_id)
        )
        req = (await db.execute(stmt)).scalar_one_or_none()
        if req and not req.is_deleted:
            items.append(await _build_response(db, req, include_steps=False))

    return {"items": items, "total": len(items)}


# ── 상세 ──

async def get_request(db: AsyncSession, request_id: uuid.UUID):
    """결재 상세"""
    stmt = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.steps))
        .where(and_(ApprovalRequest.id == request_id, ApprovalRequest.is_deleted == False))
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "결재 요청을 찾을 수 없습니다")
    return await _build_response(db, req)


# ── 승인 ──

async def approve_step(db: AsyncSession, request_id: uuid.UUID, current_user, comment: str | None = None, ip: str | None = None):
    """현재 단계 승인"""
    stmt = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.steps))
        .where(ApprovalRequest.id == request_id)
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "결재 요청을 찾을 수 없습니다")
    if req.status != "pending":
        raise HTTPException(400, "진행 중인 결재가 아닙니다")

    # 현재 승인 대기 단계 찾기
    approval_steps = sorted(
        [s for s in req.steps if s.step_type == "approval"],
        key=lambda s: s.step_order,
    )
    current_step = None
    for s in approval_steps:
        if s.status == "pending":
            current_step = s
            break

    if not current_step:
        raise HTTPException(400, "승인 대기 단계가 없습니다")
    if current_step.approver_id != current_user.id:
        raise HTTPException(403, "현재 결재 순서가 아닙니다")

    # 승인 처리
    current_step.status = "approved"
    current_step.comment = comment
    current_step.acted_at = datetime.utcnow()

    # 다음 단계 확인
    remaining = [s for s in approval_steps if s.status == "pending" and s.id != current_step.id]
    if not remaining:
        req.status = "approved"  # 최종 승인

    await db.commit()
    await log_action(
        db=db, table_name="approval_requests", record_id=req.id,
        action="APPROVE", changed_by=current_user.id, ip_address=ip,
    )

    return await _build_response(db, req)


# ── 반려 ──

async def reject_step(db: AsyncSession, request_id: uuid.UUID, current_user, comment: str | None = None, ip: str | None = None):
    """반려 (즉시 전체 반려)"""
    stmt = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.steps))
        .where(ApprovalRequest.id == request_id)
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "결재 요청을 찾을 수 없습니다")
    if req.status != "pending":
        raise HTTPException(400, "진행 중인 결재가 아닙니다")

    # 현재 사용자가 결재자인지 확인
    my_step = None
    for s in req.steps:
        if s.approver_id == current_user.id and s.step_type == "approval" and s.status == "pending":
            my_step = s
            break

    if not my_step:
        raise HTTPException(403, "결재 권한이 없습니다")

    # 반려 처리
    my_step.status = "rejected"
    my_step.comment = comment
    my_step.acted_at = datetime.utcnow()
    req.status = "rejected"

    await db.commit()
    await log_action(
        db=db, table_name="approval_requests", record_id=req.id,
        action="REJECT", changed_by=current_user.id, ip_address=ip,
    )

    return await _build_response(db, req)
