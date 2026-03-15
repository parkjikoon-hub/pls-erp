"""
M6 그룹웨어 — 결재선 템플릿 API 라우터
"""
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import AsyncSessionLocal
from ....shared.response import success_response
from ....auth.dependencies import get_current_user
from ..schemas.approvals import TemplateCreate
from ..services import template_service

router = APIRouter(prefix="/templates", tags=["M6-결재선 템플릿"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("")
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """결재선 템플릿 목록"""
    data = await template_service.list_templates(db, current_user.id)
    return success_response(data)


@router.post("")
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """결재선 템플릿 생성"""
    data = await template_service.create_template(db, body, current_user)
    return success_response(data, "템플릿이 생성되었습니다")


@router.delete("/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """결재선 템플릿 삭제"""
    data = await template_service.delete_template(db, template_id)
    return success_response(data)
