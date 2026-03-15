"""
M5 생산/SCM — QC 검사 API 라우터
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.qc import QcCreate
from ..services import qc_service

router = APIRouter()


@router.post("", summary="QC 검사 등록")
async def create_inspection(
    data: QcCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """QC 검사를 등록합니다 (합격 시 완제품 자동 이관)"""
    ip = request.client.host if request.client else None
    result = await qc_service.create_inspection(db, data, current_user, ip)
    return success_response(data=result, message=f"QC 검사 완료 ({result['result']})")


@router.get("", summary="QC 검사 이력")
async def list_inspections(
    work_order_id: Optional[str] = Query(None),
    result: Optional[str] = Query(None, description="결과 필터 (pass/fail/rework)"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """QC 검사 이력을 조회합니다"""
    data = await qc_service.list_inspections(
        db, work_order_id=work_order_id, result_filter=result,
        page=page, size=size,
    )
    return success_response(data=data)
