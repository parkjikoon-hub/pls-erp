"""
M4 재무/회계 — 회계연도 Pydantic 스키마
"""
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class FiscalYearCreate(BaseModel):
    """회계연도 생성"""
    year: int = Field(..., description="회계연도 (예: 2026)")
    start_date: date = Field(..., description="시작일")
    end_date: date = Field(..., description="종료일")


class FiscalYearUpdate(BaseModel):
    """회계연도 수정"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class FiscalYearResponse(BaseModel):
    """회계연도 조회 응답"""
    id: uuid.UUID
    year: int
    start_date: date
    end_date: date
    is_closed: bool
    closed_by: Optional[uuid.UUID] = None
    closed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
