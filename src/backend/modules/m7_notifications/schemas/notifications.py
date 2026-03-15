"""
M7 알림센터 — Pydantic 스키마
"""
from typing import Optional
from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: str
    notification_type: str
    title: str
    message: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[str] = None


class NotificationSettingItem(BaseModel):
    notification_type: str
    label: str
    in_app_enabled: bool
    email_enabled: bool


class NotificationSettingUpdate(BaseModel):
    notification_type: str
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
