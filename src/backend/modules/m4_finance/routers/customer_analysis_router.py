"""
M4 재무/회계 — 거래처별 수주/세금계산서/입금 분석 API 라우터
거래처 선택 → 수주·세금계산서·입금 내역 조회 + 입금 동향 분석
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user
from ....shared.response import success_response
from ..services import customer_analysis_service

router = APIRouter()


@router.get("/customers")
async def list_customer_options(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """거래처 선택 드롭다운용 목록 (활성 거래처만)"""
    options = await customer_analysis_service.get_customer_options(db)
    return success_response([opt.model_dump() for opt in options])


@router.get("/detail/{customer_id}")
async def get_analysis_detail(
    customer_id: str,
    start_date: Optional[date] = Query(None, description="조회 시작일"),
    end_date: Optional[date] = Query(None, description="조회 종료일"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    거래처별 상세 분석
    - 수주 내역, 세금계산서 내역, 입금 내역
    - 입금 동향 분석 (평균 입금 소요일, 성향 분류)
    """
    result = await customer_analysis_service.get_customer_analysis(
        db=db,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date,
    )
    return success_response(result.model_dump())


@router.get("/rankings")
async def get_rankings(
    start_date: Optional[date] = Query(None, description="조회 시작일"),
    end_date: Optional[date] = Query(None, description="조회 종료일"),
    limit: int = Query(20, ge=1, le=100, description="표시할 거래처 수"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """거래처별 매출/미수금 랭킹 (전체 비교)"""
    rankings = await customer_analysis_service.get_customer_rankings(
        db=db,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )
    return success_response([r.model_dump() for r in rankings])
