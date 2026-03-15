"""
M4 재무/회계 — 회계연도 API 라우터
"""
import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.fiscal_years import (
    FiscalYearCreate, FiscalYearUpdate, FiscalYearResponse,
)
from ..services import fiscal_year_service

router = APIRouter()


@router.get("", summary="회계연도 목록")
async def list_fiscal_years(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """전체 회계연도 목록을 조회합니다 (최신순)"""
    years = await fiscal_year_service.list_fiscal_years(db)
    return success_response(
        data=[
            FiscalYearResponse.model_validate(fy).model_dump(mode="json")
            for fy in years
        ]
    )


@router.post("", summary="회계연도 생성")
async def create_fiscal_year(
    data: FiscalYearCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """새 회계연도를 생성합니다 (관리자 전용)"""
    ip = request.client.host if request.client else None
    fy = await fiscal_year_service.create_fiscal_year(db, data, current_user, ip)
    return success_response(
        data=FiscalYearResponse.model_validate(fy).model_dump(mode="json"),
        message=f"{fy.year}년 회계연도가 생성되었습니다",
    )


@router.put("/{fy_id}", summary="회계연도 수정")
async def update_fiscal_year(
    fy_id: uuid.UUID,
    data: FiscalYearUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """회계연도 정보를 수정합니다 (마감된 연도는 수정 불가)"""
    ip = request.client.host if request.client else None
    fy = await fiscal_year_service.update_fiscal_year(
        db, fy_id, data, current_user, ip
    )
    return success_response(
        data=FiscalYearResponse.model_validate(fy).model_dump(mode="json"),
        message=f"{fy.year}년 회계연도가 수정되었습니다",
    )
