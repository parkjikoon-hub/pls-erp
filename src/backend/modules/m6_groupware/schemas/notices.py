"""
M6 그룹웨어 — 공지사항 Pydantic 스키마
"""
from typing import Optional
from pydantic import BaseModel


class NoticeCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False
    is_important: bool = False


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_important: Optional[bool] = None


class NoticeListItem(BaseModel):
    id: str
    title: str
    is_pinned: bool
    is_important: bool
    view_count: int
    author_id: str
    author_name: Optional[str] = None
    created_at: Optional[str] = None


class NoticeResponse(NoticeListItem):
    content: str
    updated_at: Optional[str] = None
