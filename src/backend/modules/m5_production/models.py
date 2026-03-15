"""
M5 생산/SCM — ORM 모델
테이블: Warehouse, BomHeader, BomLine, Inventory, InventoryTransaction,
        WorkOrder, QcInspection, Shipment, ShipmentLine
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    String, Integer, Boolean, Text, Date, DateTime,
    ForeignKey, Numeric, UniqueConstraint, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ...database import Base


# ── 창고 마스터 ─────────────────────────────────────────

class Warehouse(Base):
    """창고 마스터 (원자재/WIP/완제품/불량품)"""
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, comment="창고코드",
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="창고명",
    )
    zone_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="구역유형 (raw/wip/finished/defective)",
    )
    description: Mapped[str | None] = mapped_column(Text, comment="설명")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


# ── BOM 헤더 ───────────────────────────────────────────

class BomHeader(Base):
    """자재명세서(BOM) 헤더 — 제품별 구성 부품 정의"""
    __tablename__ = "bom_headers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False,
        comment="완제품/반제품 ID",
    )
    version: Mapped[int] = mapped_column(Integer, default=1, comment="BOM 버전")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="활성 여부")

    # 감사 필드
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )

    # 관계
    lines: Mapped[list["BomLine"]] = relationship(
        back_populates="bom_header",
        cascade="all, delete-orphan",
        order_by="BomLine.sort_order",
    )
    product = relationship("Product", foreign_keys=[product_id])

    __table_args__ = (
        UniqueConstraint("product_id", "version", name="uq_bom_product_version"),
        Index("idx_bom_product", "product_id"),
    )


# ── BOM 라인 ───────────────────────────────────────────

class BomLine(Base):
    """BOM 구성 부품 라인"""
    __tablename__ = "bom_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bom_headers.id", ondelete="CASCADE"),
        nullable=False,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False,
        comment="구성 자재(부품) ID",
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(15, 4), nullable=False, comment="소요 수량",
    )
    unit: Mapped[str | None] = mapped_column(String(20), comment="단위")
    scrap_rate: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0, comment="스크랩율(%)",
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="정렬 순서")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    # 관계
    bom_header: Mapped["BomHeader"] = relationship(back_populates="lines")
    material = relationship("Product", foreign_keys=[material_id])


# ── 재고 ───────────────────────────────────────────────

class Inventory(Base):
    """품목별 창고별 재고 현황"""
    __tablename__ = "inventory"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False,
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False,
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(15, 3), default=0, comment="재고 수량",
    )
    unit_cost: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="단가",
    )
    status: Mapped[str] = mapped_column(
        String(20), default="available",
        comment="상태 (available/reserved)",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    # 관계
    product = relationship("Product", foreign_keys=[product_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])

    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", "status",
                         name="uq_inventory_product_warehouse_status"),
        CheckConstraint("quantity >= 0", name="ck_inventory_qty_positive"),
        Index("idx_inventory_product", "product_id"),
        Index("idx_inventory_warehouse", "warehouse_id"),
    )


# ── 재고 이동 이력 ─────────────────────────────────────

class InventoryTransaction(Base):
    """재고 입출고/이관/조정 이력"""
    __tablename__ = "inventory_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False,
    )
    from_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id"),
        comment="출발 창고 (NULL이면 외부 입고)",
    )
    to_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id"),
        comment="도착 창고 (NULL이면 외부 출고)",
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(15, 3), nullable=False, comment="이동 수량",
    )
    transaction_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="유형 (receive/issue/transfer/adjust)",
    )
    reference_type: Mapped[str | None] = mapped_column(
        String(30), comment="참조 유형 (work_order/shipment/purchase/qc)",
    )
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), comment="참조 ID",
    )
    notes: Mapped[str | None] = mapped_column(Text, comment="메모")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )

    # 관계
    product = relationship("Product", foreign_keys=[product_id])
    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id])

    __table_args__ = (
        Index("idx_inv_tx_product", "product_id"),
        Index("idx_inv_tx_created", "created_at"),
        Index("idx_inv_tx_reference", "reference_type", "reference_id"),
        Index("idx_inv_tx_product_date", "product_id", "created_at"),
    )


# ── 작업지시서 ─────────────────────────────────────────

class WorkOrder(Base):
    """작업지시서 — 수주생산(MTO) / 계획생산(MTS) 지원"""
    __tablename__ = "work_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    wo_no: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False,
        comment="작업지시번호 (WO-YYYYMM-NNNN)",
    )
    order_type: Mapped[str] = mapped_column(
        String(20), default="make_to_order",
        comment="유형 (make_to_order/make_to_stock)",
    )

    # 수주 연결 (MTO인 경우)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_orders.id"), comment="수주 ID",
    )
    sales_order_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_order_lines.id"),
        comment="수주 라인 ID",
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False,
        comment="생산 품목",
    )
    bom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bom_headers.id"), comment="BOM ID",
    )

    planned_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), nullable=False, comment="계획 수량",
    )
    produced_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), default=0, comment="생산 완료 수량",
    )

    start_date: Mapped[date | None] = mapped_column(Date, comment="시작일")
    due_date: Mapped[date] = mapped_column(Date, nullable=False, comment="납기일")

    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="상태 (pending/in_progress/qc_wait/completed)",
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="담당자",
    )
    notes: Mapped[str | None] = mapped_column(Text, comment="비고")

    # 감사 필드
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )

    # 관계
    product = relationship("Product", foreign_keys=[product_id])
    bom = relationship("BomHeader", foreign_keys=[bom_id])
    sales_order = relationship("SalesOrder", foreign_keys=[order_id])
    sales_order_line = relationship("SalesOrderLine", foreign_keys=[sales_order_line_id])
    assignee = relationship("User", foreign_keys=[assigned_to])

    __table_args__ = (
        Index("idx_wo_status", "status"),
        Index("idx_wo_product", "product_id"),
        Index("idx_wo_order", "order_id"),
        Index("idx_wo_due_date", "due_date"),
    )


# ── QC 검사 ───────────────────────────────────────────

class QcInspection(Base):
    """품질검사 결과 — 합격/불합격/재작업"""
    __tablename__ = "qc_inspections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False,
        comment="작업지시서 ID",
    )

    inspected_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), nullable=False, comment="검사 수량",
    )
    passed_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), default=0, comment="합격 수량",
    )
    failed_qty: Mapped[float] = mapped_column(
        Numeric(15, 3), default=0, comment="불합격 수량",
    )
    result: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="결과 (pass/fail/rework)",
    )
    defect_types: Mapped[dict | None] = mapped_column(
        JSONB, comment="불량 유형 (확장 가능)",
    )
    notes: Mapped[str | None] = mapped_column(Text, comment="검사 메모")

    inspector_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="검사자",
    )
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )

    # 관계
    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    inspector = relationship("User", foreign_keys=[inspector_id])

    __table_args__ = (
        Index("idx_qc_work_order", "work_order_id"),
        Index("idx_qc_result", "result"),
    )


# ── 출하지시서 ─────────────────────────────────────────

class Shipment(Base):
    """출하지시서 — 수주 기반 배송 관리"""
    __tablename__ = "shipments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    shipment_no: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False,
        comment="출하번호 (SH-YYYYMM-NNNN)",
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_orders.id"), comment="수주 ID",
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False,
        comment="거래처",
    )

    shipment_date: Mapped[date | None] = mapped_column(Date, comment="출하일")
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="상태 (pending/picked/shipped/delivered)",
    )

    carrier_name: Mapped[str | None] = mapped_column(
        String(100), comment="택배사명",
    )
    tracking_no: Mapped[str | None] = mapped_column(
        String(100), comment="송장번호",
    )
    delivery_note_no: Mapped[str | None] = mapped_column(
        String(30), comment="거래명세서 번호 (DN-YYYYMM-NNNN)",
    )
    shipping_address: Mapped[str | None] = mapped_column(Text, comment="배송 주소")
    notes: Mapped[str | None] = mapped_column(Text, comment="비고")

    # 감사 필드
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
    )

    # 관계
    lines: Mapped[list["ShipmentLine"]] = relationship(
        back_populates="shipment",
        cascade="all, delete-orphan",
        order_by="ShipmentLine.line_no",
    )
    sales_order = relationship("SalesOrder", foreign_keys=[order_id])
    customer = relationship("Customer", foreign_keys=[customer_id])

    __table_args__ = (
        Index("idx_shipment_status", "status"),
        Index("idx_shipment_order", "order_id"),
        Index("idx_shipment_customer", "customer_id"),
    )


# ── 출하 라인 ──────────────────────────────────────────

class ShipmentLine(Base):
    """출하 품목 라인"""
    __tablename__ = "shipment_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    shipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shipments.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False,
    )
    order_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_order_lines.id"),
        comment="수주 라인 ID",
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(15, 3), nullable=False, comment="출하 수량",
    )
    unit_price: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="단가 (수주 라인 스냅샷)",
    )
    amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="금액 (수량 x 단가)",
    )
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id"), comment="출고 창고",
    )
    line_no: Mapped[int] = mapped_column(Integer, default=1, comment="라인 번호")

    # 관계
    shipment: Mapped["Shipment"] = relationship(back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id])
    order_line = relationship("SalesOrderLine", foreign_keys=[order_line_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
