"""
공통 페이지네이션 유틸리티
목록 조회 시 페이지 나누기 기능을 제공합니다.
"""
from typing import Optional
from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    """페이지네이션 요청 파라미터"""
    page: int = Field(default=1, ge=1, description="페이지 번호 (1부터 시작)")
    size: int = Field(default=20, ge=1, le=100, description="한 페이지당 항목 수")
    search: Optional[str] = Field(default=None, description="검색어")
    sort_by: Optional[str] = Field(default=None, description="정렬 기준 컬럼")
    sort_order: str = Field(default="desc", description="정렬 방향 (asc/desc)")

    @property
    def offset(self) -> int:
        """SQL OFFSET 값 계산"""
        return (self.page - 1) * self.size


class PaginatedResponse(BaseModel):
    """페이지네이션 응답 형식"""
    items: list          # 실제 데이터 목록
    total: int           # 전체 항목 수
    page: int            # 현재 페이지
    size: int            # 페이지 크기
    total_pages: int     # 전체 페이지 수

    @classmethod
    def create(cls, items: list, total: int, page: int, size: int):
        """페이지네이션 응답 생성"""
        total_pages = (total + size - 1) // size  # 올림 나눗셈
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            total_pages=total_pages,
        )
