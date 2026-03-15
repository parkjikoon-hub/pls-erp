"""
M4 재무/회계 — 결산/재무제표 API 라우터
"""
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.closing import ClosePeriodRequest
from ..schemas.fiscal_years import FiscalYearResponse
from ..services import closing_service

router = APIRouter()


@router.get("/trial-balance", summary="시산표")
async def get_trial_balance(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    fiscal_year_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """시산표를 조회합니다 (posted 전표 기준)"""
    result = await closing_service.get_trial_balance(
        db, start_date=start_date, end_date=end_date,
        fiscal_year_id=fiscal_year_id,
    )
    return success_response(data=result)


@router.get("/income-statement", summary="손익계산서")
async def get_income_statement(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    fiscal_year_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """손익계산서를 조회합니다 (수익 - 비용 = 당기순이익)"""
    result = await closing_service.get_income_statement(
        db, start_date=start_date, end_date=end_date,
        fiscal_year_id=fiscal_year_id,
    )
    return success_response(data=result)


@router.get("/balance-sheet", summary="재무상태표")
async def get_balance_sheet(
    as_of_date: Optional[date] = Query(None),
    fiscal_year_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """재무상태표를 조회합니다 (자산 = 부채 + 자본 + 당기순이익)"""
    result = await closing_service.get_balance_sheet(
        db, as_of_date=as_of_date, fiscal_year_id=fiscal_year_id,
    )
    return success_response(data=result)


@router.post("/close-period", summary="기간 마감")
async def close_period(
    data: ClosePeriodRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """회계연도를 마감합니다 (미결 전표가 있으면 마감 불가)"""
    ip = request.client.host if request.client else None
    fiscal_year = await closing_service.close_period(
        db, uuid.UUID(data.fiscal_year_id), current_user, ip
    )
    return success_response(
        data=FiscalYearResponse.model_validate(fiscal_year).model_dump(mode="json"),
        message=f"{fiscal_year.year}년 회계연도가 마감되었습니다",
    )


@router.post("/reopen-period", summary="마감 취소")
async def reopen_period(
    data: ClosePeriodRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """마감된 회계연도를 다시 엽니다 (관리자 전용)"""
    ip = request.client.host if request.client else None
    fiscal_year = await closing_service.reopen_period(
        db, uuid.UUID(data.fiscal_year_id), current_user, ip
    )
    return success_response(
        data=FiscalYearResponse.model_validate(fiscal_year).model_dump(mode="json"),
        message=f"{fiscal_year.year}년 마감이 취소되었습니다",
    )
