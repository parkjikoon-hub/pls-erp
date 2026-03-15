"""
M3 인사/급여 — 급여 API 라우터
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.payroll import PayrollCalculateRequest, PayrollApproveRequest
from ..services import payroll_service

router = APIRouter()


@router.get("", summary="급여대장 목록")
async def list_payrolls(
    year: Optional[int] = Query(None, description="연도 필터"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """급여대장 목록 조회"""
    data = await payroll_service.list_payrolls(db, year=year)
    return success_response(data=data)


@router.get("/{year}/{month}", summary="급여대장 상세")
async def get_payroll(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """특정 월의 급여대장 상세 (헤더 + 직원별 명세)"""
    data = await payroll_service.get_payroll(db, year, month)
    if not data:
        return success_response(data=None, message=f"{year}년 {month}월 급여대장이 없습니다")
    return success_response(data=data)


@router.post("/calculate", summary="급여 일괄 계산")
async def calculate_payroll(
    data: PayrollCalculateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """월별 급여 일괄 계산 (전 직원 대상)"""
    ip = request.client.host if request.client else None
    result = await payroll_service.calculate_payroll(
        db, data.payroll_year, data.payroll_month, current_user, ip
    )
    return success_response(
        data=result,
        message=f"{data.payroll_year}년 {data.payroll_month}월 급여 계산이 완료되었습니다"
    )


@router.post("/{year}/{month}/approve", summary="급여 승인")
async def approve_payroll(
    year: int,
    month: int,
    data: PayrollApproveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """급여 승인 (관리자만)"""
    ip = request.client.host if request.client else None
    result = await payroll_service.approve_payroll(
        db, year, month, data.payment_date, current_user, ip
    )
    return success_response(data=result, message=f"{year}년 {month}월 급여가 승인되었습니다")
