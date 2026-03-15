"""
M5 생산/SCM — BOM(자재명세서) Pydantic 스키마
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── BOM 라인 ──

class BomLineCreate(BaseModel):
    """BOM 구성 부품 라인 생성"""
    material_id: str = Field(..., description="구성 자재(부품) ID")
    quantity: float = Field(..., gt=0, description="소요 수량")
    unit: Optional[str] = Field(None, max_length=20, description="단위")
    scrap_rate: float = Field(0, ge=0, le=100, description="스크랩율(%)")
    sort_order: int = Field(0, ge=0, description="정렬 순서")


class BomLineResponse(BaseModel):
    """BOM 라인 응답"""
    id: str
    material_id: str
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    scrap_rate: float = 0
    sort_order: int = 0


# ── BOM 헤더 ──

class BomCreate(BaseModel):
    """BOM 생성 요청"""
    product_id: str = Field(..., description="완제품/반제품 ID")
    version: int = Field(1, ge=1, description="BOM 버전")
    lines: list[BomLineCreate] = Field(
        ..., min_length=1, description="구성 부품 목록 (최소 1줄)",
    )


class BomUpdate(BaseModel):
    """BOM 수정 요청"""
    version: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    lines: Optional[list[BomLineCreate]] = None


class BomListItem(BaseModel):
    """BOM 목록 항목"""
    id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    version: int
    is_active: bool
    line_count: int = 0
    created_at: Optional[datetime] = None


class BomResponse(BaseModel):
    """BOM 상세 응답 (라인 포함)"""
    id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    version: int
    is_active: bool
    lines: list[BomLineResponse] = []
    created_at: Optional[datetime] = None


# ── BOM 트리 전개 ──

class BomTreeNode(BaseModel):
    """BOM 트리 노드 (재귀 구조)"""
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    product_type: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    scrap_rate: float = 0
    children: list[BomTreeNode] = []


class MaterialRequirement(BaseModel):
    """소요 원자재 항목"""
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    unit: Optional[str] = None
    total_quantity: float = Field(..., description="총 소요량")
