"""
M6 그룹웨어 — ORM 모델
테이블: ApprovalTemplate, ApprovalTemplateLine, ApprovalRequest, ApprovalStep, Notice
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    String, Integer, Boolean, Text, DateTime,
    ForeignKey, Numeric, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ...database import Base


# ── 결재선 템플릿 ─────────────────────────────────

class ApprovalTemplate(Base):
    """결재선 템플릿 — 자주 쓰는 결재선 저장"""
    __tablename__ = "approval_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="템플릿명",
    )
    document_type: Mapped[str | None] = mapped_column(
        String(30), comment="문서유형 (general/journal/quotation/sales_order/expense)",
    )
    description: Mapped[str | None] = mapped_column(Text, comment="설명")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    # 관계
    lines: Mapped[list["ApprovalTemplateLine"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ApprovalTemplateLine.step_order",
    )


class ApprovalTemplateLine(Base):
    """결재선 템플릿 라인 — 결재/참조 단계"""
    __tablename__ = "approval_template_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_order: Mapped[int] = mapped_column(Integer, default=1, comment="순서")
    approver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
        comment="결재자/참조자 ID",
    )
    role_label: Mapped[str | None] = mapped_column(
        String(50), comment="역할명 (팀장, 대표이사 등)",
    )
    line_type: Mapped[str] = mapped_column(
        String(20), default="approval",
        comment="유형 (approval/reference)",
    )

    # 관계
    template: Mapped["ApprovalTemplate"] = relationship(back_populates="lines")
    approver = relationship("User", foreign_keys=[approver_id])


# ── 결재 요청 ─────────────────────────────────────

class ApprovalRequest(Base):
    """결재 요청 — 범용 전자결재 문서"""
    __tablename__ = "approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    request_no: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False,
        comment="결재번호 (AP-YYYYMM-NNNN)",
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="제목",
    )
    document_type: Mapped[str] = mapped_column(
        String(30), default="general",
        comment="문서유형 (general/journal/quotation/sales_order/expense)",
    )
    content: Mapped[dict | None] = mapped_column(
        JSONB, comment="품의 내용 (자유 형식)",
    )
    amount: Mapped[float | None] = mapped_column(
        Numeric(15, 2), comment="금액",
    )

    # ERP 문서 연결 (M6-F03)
    reference_type: Mapped[str | None] = mapped_column(
        String(30), comment="참조 유형 (journal/quotation/sales_order 등)",
    )
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), comment="참조 문서 ID",
    )

    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="상태 (draft/pending/approved/rejected)",
    )

    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
        comment="기안자",
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    # 관계
    steps: Mapped[list["ApprovalStep"]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ApprovalStep.step_order",
    )
    requester = relationship("User", foreign_keys=[requester_id])

    __table_args__ = (
        Index("idx_approval_status", "status"),
        Index("idx_approval_requester", "requester_id"),
        Index("idx_approval_reference", "reference_type", "reference_id"),
    )


# ── 결재 단계 ─────────────────────────────────────

class ApprovalStep(Base):
    """결재/참조 단계 — 각 결재자의 처리 상태"""
    __tablename__ = "approval_steps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_type: Mapped[str] = mapped_column(
        String(20), default="approval",
        comment="유형 (approval/reference)",
    )
    step_order: Mapped[int] = mapped_column(Integer, default=1, comment="순서")
    approver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
        comment="결재자/참조자",
    )
    role_label: Mapped[str | None] = mapped_column(
        String(50), comment="역할명",
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="상태 (pending/approved/rejected/viewed)",
    )
    comment: Mapped[str | None] = mapped_column(Text, comment="의견")
    acted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="처리일시",
    )

    # 관계
    request: Mapped["ApprovalRequest"] = relationship(back_populates="steps")
    approver = relationship("User", foreign_keys=[approver_id])

    __table_args__ = (
        Index("idx_step_request", "request_id"),
        Index("idx_step_approver", "approver_id"),
        Index("idx_step_approver_status", "approver_id", "status"),
    )


# ── 공지사항 ──────────────────────────────────────

class Notice(Base):
    """공지사항 — 관리자 작성, 전 직원 조회"""
    __tablename__ = "notices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="제목",
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="내용",
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="상단 고정",
    )
    is_important: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="중요 표시",
    )
    view_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="조회수",
    )

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
        comment="작성자",
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    # 관계
    author = relationship("User", foreign_keys=[author_id])

    __table_args__ = (
        Index("idx_notice_pinned", "is_pinned"),
        Index("idx_notice_created", "created_at"),
    )
