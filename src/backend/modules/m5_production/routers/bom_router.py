"""
M5 생산/SCM — BOM(자재명세서) API 라우터
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.bom import BomCreate, BomUpdate
from ..services import bom_service

router = APIRouter()


@router.get("", summary="BOM 목록")
async def list_boms(
    product_id: Optional[str] = Query(None, description="품목 ID 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """BOM 목록을 조회합니다"""
    data = await bom_service.list_boms(
        db, product_id=product_id, search=search, page=page, size=size,
    )
    return success_response(data=data)


@router.get("/{bom_id}", summary="BOM 상세")
async def get_bom(
    bom_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """BOM 상세 정보를 조회합니다 (라인 포함)"""
    data = await bom_service.get_bom(db, bom_id)
    return success_response(data=data)


@router.post("", summary="BOM 생성")
async def create_bom(
    data: BomCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """새 BOM을 생성합니다"""
    ip = request.client.host if request.client else None
    result = await bom_service.create_bom(db, data, current_user, ip)
    return success_response(data=result, message="BOM이 생성되었습니다")


@router.put("/{bom_id}", summary="BOM 수정")
async def update_bom(
    bom_id: uuid.UUID,
    data: BomUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """BOM을 수정합니다 (라인 교체)"""
    ip = request.client.host if request.client else None
    result = await bom_service.update_bom(db, bom_id, data, current_user, ip)
    return success_response(data=result, message="BOM이 수정되었습니다")


@router.delete("/{bom_id}", summary="BOM 삭제")
async def delete_bom(
    bom_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """BOM을 삭제합니다"""
    ip = request.client.host if request.client else None
    result = await bom_service.delete_bom(db, bom_id, current_user, ip)
    return success_response(data=result, message=result["message"])


@router.get("/{bom_id}/tree", summary="BOM 트리 전개")
async def get_bom_tree(
    bom_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """BOM을 다단계 트리로 전개합니다"""
    data = await bom_service.get_bom_tree(db, bom_id)
    return success_response(data=data)


@router.get("/{bom_id}/materials", summary="소요 원자재 목록")
async def get_material_requirements(
    bom_id: uuid.UUID,
    quantity: float = Query(1.0, gt=0, description="생산 수량"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """BOM 기반 소요 원자재 목록을 계산합니다"""
    data = await bom_service.get_material_requirements(db, bom_id, quantity)
    return success_response(data=data)
