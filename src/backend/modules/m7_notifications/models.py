"""
M7 지능형 알림 센터 — ORM 모델
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from ...database import Base


class Notification(Base):
    """인앱 알림"""
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # 알림 유형: approval, sales, production, finance, hr, system
    notification_type = Column(String(30), nullable=False, default="system")
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)

    # ERP 문서 연결 (선택)
    reference_type = Column(String(50), nullable=True)   # approval_request, sales_order, work_order 등
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    link = Column(String(500), nullable=True)             # 프론트엔드 이동 경로

    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationSetting(Base):
    """사용자별 알림 수신 설정"""
    __tablename__ = "notification_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # 알림 유형별 on/off
    notification_type = Column(String(30), nullable=False)  # approval, sales, production, finance, hr, system
    in_app_enabled = Column(Boolean, default=True)
    email_enabled = Column(Boolean, default=False)

    # unique constraint: user_id + notification_type
    __table_args__ = (
        {"schema": None},
    )
