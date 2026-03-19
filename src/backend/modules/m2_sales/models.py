"""
M2 영업/수주 — ORM 모델
테이블: Quotation, QuotationLine, SalesOrder, SalesOrderLine
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    String, Integer, Boolean, Text, Date, DateTime,
    ForeignKey, Numeric, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ...database import Base


# ── 견적서 헤더 ──────────────────────────────────────────

class Quotation(Base):
    """견적서 헤더"""
    __tablename__ = "quotations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    quote_no: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, comment="견적번호 (QT-YYYYMM-NNNN)",
    )
    quote_date: Mapped[date] = mapped_column(Date, nullable=False, comment="견적일")
    valid_until: Mapped[date | None] = mapped_column(Date, comment="유효기한")

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, comment="거래처",
    )
    sales_rep_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="담당 영업사원",
    )

    total_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="공급가액 합계",
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="부가세 합계",
    )
    grand_total: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총액 (공급가+부가세)",
    )

    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="상태 (draft/sent/accepted/rejected)",
    )
    notes: Mapped[str | None] = mapped_column(Text, comment="비고")

    # 감사 필드
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="작성자",
    )

    # 관계
    lines: Mapped[list["QuotationLine"]] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="QuotationLine.line_no",
    )
    customer = relationship("Customer", foreign_keys=[customer_id])
    sales_rep = relationship("User", foreign_keys=[sales_rep_id])

    __table_args__ = (
        Index("idx_quotation_status", "status"),
        Index("idx_quotation_customer", "customer_id"),
        Index("idx_quotation_date", "quote_date"),
    )


# ── 견적서 라인 ──────────────────────────────────────────

class QuotationLine(Base):
    """견적서 품목 라인"""
    __tablename__ = "quotation_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False, comment="라인 번호")

    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), comment="품목",
    )
    product_name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="품목명 (스냅샷)",
    )
    specification: Mapped[str | None] = mapped_column(String(200), comment="규격")

    quantity: Mapped[float] = mapped_column(
        Numeric(15, 3), nullable=False, comment="수량",
    )
    unit_price: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="단가",
    )
    discount_rate: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0, comment="할인율(%)",
    )
    amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="금액 (수량×단가×(1-할인))",
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="부가세",
    )
    delivery_date: Mapped[date | None] = mapped_column(Date, comment="납기일")
    remark: Mapped[str | None] = mapped_column(String(500), comment="비고")

    # 관계
    quotation: Mapped["Quotation"] = relationship(back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id])


# ── 수주 헤더 ────────────────────────────────────────────

class SalesOrder(Base):
    """수주 헤더"""
    __tablename__ = "sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    order_no: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, comment="수주번호 (SO-YYYYMM-NNNN)",
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False, comment="수주일")
    delivery_date: Mapped[date | None] = mapped_column(Date, comment="납기일")

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, comment="거래처",
    )
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotations.id"), comment="연결 견적서",
    )
    sales_rep_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="담당 영업사원",
    )

    total_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="공급가액 합계",
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="부가세 합계",
    )
    grand_total: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총액 (공급가+부가세)",
    )

    status: Mapped[str] = mapped_column(
        String(20), default="confirmed",
        comment="상태 (confirmed/in_production/shipped/completed/invoiced)",
    )
    progress_pct: Mapped[int] = mapped_column(
        Integer, default=0, comment="진행률 0~100%",
    )
    notes: Mapped[str | None] = mapped_column(Text, comment="비고")

    # 감사 필드
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="작성자",
    )

    # 관계
    lines: Mapped[list["SalesOrderLine"]] = relationship(
        back_populates="sales_order",
        cascade="all, delete-orphan",
        order_by="SalesOrderLine.line_no",
    )
    customer = relationship("Customer", foreign_keys=[customer_id])
    quotation = relationship("Quotation", foreign_keys=[quotation_id])
    sales_rep = relationship("User", foreign_keys=[sales_rep_id])

    __table_args__ = (
        Index("idx_order_status", "status"),
        Index("idx_order_customer", "customer_id"),
        Index("idx_order_date", "order_date"),
    )


# ── 수주 라인 ────────────────────────────────────────────

class SalesOrderLine(Base):
    """수주 품목 라인"""
    __tablename__ = "sales_order_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False, comment="라인 번호")

    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), comment="품목",
    )
    product_name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="품목명 (스냅샷)",
    )
    specification: Mapped[str | None] = mapped_column(String(200), comment="규격")

    quantity: Mapped[float] = mapped_column(
        Numeric(15, 3), nullable=False, comment="수주수량",
    )
    unit_price: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="단가",
    )
    amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="금액",
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="부가세",
    )
    delivery_date: Mapped[date | None] = mapped_column(Date, comment="납기일")

    produced_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), default=0, comment="생산 완료 수량",
    )
    shipped_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), default=0, comment="출하 완료 수량",
    )
    remark: Mapped[str | None] = mapped_column(String(500), comment="비고")

    # 관계
    sales_order: Mapped["SalesOrder"] = relationship(back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id])


# ── 거래처별 판매가 ──────────────────────────────────────

class CustomerPriceList(Base):
    """거래처별 품목 특별 단가 — 기본가(products.standard_price)보다 우선 적용"""
    __tablename__ = "customer_price_lists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, comment="거래처",
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, comment="품목",
    )
    unit_price: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="특별 단가",
    )
    valid_from: Mapped[date | None] = mapped_column(Date, comment="유효 시작일")
    valid_until: Mapped[date | None] = mapped_column(Date, comment="유효 종료일")
    notes: Mapped[str | None] = mapped_column(String(500), comment="비고")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="작성자",
    )

    # 관계
    customer = relationship("Customer", foreign_keys=[customer_id])
    product = relationship("Product", foreign_keys=[product_id])

    __table_args__ = (
        UniqueConstraint("customer_id", "product_id", "valid_from", name="uq_customer_product_valid"),
        Index("idx_price_customer", "customer_id"),
        Index("idx_price_product", "product_id"),
    )
