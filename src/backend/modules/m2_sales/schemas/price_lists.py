"""
M2 영업 — 판매가 관리 스키마
"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class PriceListCreate(BaseModel):
    """거래처별 판매가 등록"""
    customer_id: str = Field(..., description="거래처 UUID")
    product_id: str = Field(..., description="품목 UUID")
    unit_price: float = Field(..., ge=0, description="특별 단가")
    valid_from: Optional[date] = Field(None, description="유효 시작일")
    valid_until: Optional[date] = Field(None, description="유효 종료일")
    notes: Optional[str] = Field(None, max_length=500, description="비고")


class PriceListUpdate(BaseModel):
    """거래처별 판매가 수정"""
    unit_price: Optional[float] = Field(None, ge=0, description="특별 단가")
    valid_from: Optional[date] = Field(None, description="유효 시작일")
    valid_until: Optional[date] = Field(None, description="유효 종료일")
    notes: Optional[str] = Field(None, max_length=500, description="비고")


class PriceLookupResult(BaseModel):
    """가격 조회 결과"""
    product_id: str
    product_name: str
    product_code: str
    unit_price: float
    source: str  # "customer_special" | "standard" | "none"
