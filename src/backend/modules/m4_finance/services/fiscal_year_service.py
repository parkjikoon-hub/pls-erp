"""
M4 재무/회계 — 회계연도 서비스
CRUD + 날짜 기반 회계연도 조회
"""
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from ..models import FiscalYear
from ..schemas.fiscal_years import FiscalYearCreate, FiscalYearUpdate
from ....audit.service import log_action


async def list_fiscal_years(db: AsyncSession):
    """회계연도 전체 목록 (최신순)"""
    result = await db.execute(
        select(FiscalYear).order_by(FiscalYear.year.desc())
    )
    return result.scalars().all()


async def get_fiscal_year(db: AsyncSession, fy_id: uuid.UUID) -> FiscalYear:
    """회계연도 상세 조회"""
    result = await db.execute(
        select(FiscalYear).where(FiscalYear.id == fy_id)
    )
    fy = result.scalar_one_or_none()
    if not fy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="회계연도를 찾을 수 없습니다",
        )
    return fy


async def get_fiscal_year_by_date(db: AsyncSession, target_date: date) -> FiscalYear:
    """날짜에 해당하는 회계연도 조회 (전표 생성 시 사용)"""
    result = await db.execute(
        select(FiscalYear).where(
            FiscalYear.start_date <= target_date,
            FiscalYear.end_date >= target_date,
        )
    )
    fy = result.scalar_one_or_none()
    if not fy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{target_date}에 해당하는 회계연도가 없습니다. 회계연도를 먼저 생성해주세요.",
        )
    return fy


async def create_fiscal_year(
    db: AsyncSession,
    data: FiscalYearCreate,
    current_user,
    ip_address: Optional[str] = None,
) -> FiscalYear:
    """회계연도 생성 (중복 확인)"""
    existing = await db.execute(
        select(FiscalYear).where(FiscalYear.year == data.year)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{data.year}년 회계연도가 이미 존재합니다",
        )

    if data.start_date >= data.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="시작일은 종료일보다 이전이어야 합니다",
        )

    fy = FiscalYear(**data.model_dump())
    db.add(fy)
    await db.flush()

    await log_action(
        db=db,
        table_name="fiscal_years",
        record_id=fy.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values={"year": data.year, "start_date": str(data.start_date), "end_date": str(data.end_date)},
        ip_address=ip_address,
    )

    return fy


async def update_fiscal_year(
    db: AsyncSession,
    fy_id: uuid.UUID,
    data: FiscalYearUpdate,
    current_user,
    ip_address: Optional[str] = None,
) -> FiscalYear:
    """회계연도 수정 (마감된 연도는 수정 불가)"""
    fy = await get_fiscal_year(db, fy_id)

    if fy.is_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="마감된 회계연도는 수정할 수 없습니다",
        )

    update_fields = data.model_dump(exclude_unset=True)
    old_data = {k: str(getattr(fy, k)) for k in update_fields.keys()}

    for field, value in update_fields.items():
        setattr(fy, field, value)

    await db.flush()

    new_data = {k: str(v) for k, v in update_fields.items()}
    if old_data != new_data:
        await log_action(
            db=db,
            table_name="fiscal_years",
            record_id=fy.id,
            action="UPDATE",
            changed_by=current_user.id,
            old_values=old_data,
            new_values=new_data,
            ip_address=ip_address,
        )

    return fy
