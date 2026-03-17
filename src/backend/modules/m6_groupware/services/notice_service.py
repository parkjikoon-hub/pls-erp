"""
M6 그룹웨어 — 공지사항 CRUD 서비스
"""
import uuid

from fastapi import HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Notice
from ...m1_system.models import User
from ....audit.service import log_action


def _build_response(notice, author_name=None, include_content=False):
    """공지사항 응답 딕셔너리"""
    result = {
        "id": str(notice.id),
        "title": notice.title,
        "is_pinned": notice.is_pinned,
        "is_important": notice.is_important,
        "view_count": notice.view_count,
        "author_id": str(notice.author_id),
        "author_name": author_name,
        "created_at": notice.created_at.isoformat() if notice.created_at else None,
    }
    if include_content:
        result["content"] = notice.content
        result["updated_at"] = notice.updated_at.isoformat() if notice.updated_at else None
    return result


async def list_notices(db: AsyncSession, page: int = 1, size: int = 20):
    """공지사항 목록 (고정글 우선)"""
    base = (
        select(Notice)
        .where(Notice.is_deleted == False)
        .order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
    )
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    rows = (await db.execute(base.offset((page - 1) * size).limit(size))).scalars().all()

    items = []
    for n in rows:
        author = await db.get(User, n.author_id)
        items.append(_build_response(n, author.name if author else None))

    return {"items": items, "total": total, "page": page, "size": size}


async def get_notice(db: AsyncSession, notice_id: uuid.UUID):
    """공지사항 상세 (조회수 증가)"""
    notice = await db.get(Notice, notice_id)
    if not notice or notice.is_deleted:
        raise HTTPException(404, "공지사항을 찾을 수 없습니다")

    # 조회수 증가
    notice.view_count = (notice.view_count or 0) + 1
    await db.commit()

    author = await db.get(User, notice.author_id)
    return _build_response(notice, author.name if author else None, include_content=True)


async def create_notice(db: AsyncSession, data, current_user, ip: str | None = None):
    """공지사항 작성"""
    notice = Notice(
        title=data.title,
        content=data.content,
        is_pinned=data.is_pinned,
        is_important=data.is_important,
        author_id=current_user.id,
    )
    db.add(notice)
    await db.commit()
    await log_action(
        db=db, table_name="notices", record_id=notice.id,
        action="CREATE", changed_by=current_user.id, ip_address=ip,
    )
    return _build_response(notice, current_user.name, include_content=True)


async def update_notice(db: AsyncSession, notice_id: uuid.UUID, data, current_user, ip: str | None = None):
    """공지사항 수정"""
    notice = await db.get(Notice, notice_id)
    if not notice or notice.is_deleted:
        raise HTTPException(404, "공지사항을 찾을 수 없습니다")

    if data.title is not None:
        notice.title = data.title
    if data.content is not None:
        notice.content = data.content
    if data.is_pinned is not None:
        notice.is_pinned = data.is_pinned
    if data.is_important is not None:
        notice.is_important = data.is_important

    await db.commit()
    await log_action(
        db=db, table_name="notices", record_id=notice.id,
        action="UPDATE", changed_by=current_user.id, ip_address=ip,
    )

    author = await db.get(User, notice.author_id)
    return _build_response(notice, author.name if author else None, include_content=True)


async def delete_notice(db: AsyncSession, notice_id: uuid.UUID, current_user, ip: str | None = None):
    """공지사항 삭제 (소프트 삭제)"""
    notice = await db.get(Notice, notice_id)
    if not notice or notice.is_deleted:
        raise HTTPException(404, "공지사항을 찾을 수 없습니다")

    notice.is_deleted = True
    await db.commit()
    await log_action(
        db=db, table_name="notices", record_id=notice.id,
        action="DELETE", changed_by=current_user.id, ip_address=ip,
    )
    return {"message": "삭제되었습니다"}
