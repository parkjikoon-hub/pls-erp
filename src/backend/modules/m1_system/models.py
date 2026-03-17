"""
M1 시스템 아키텍처 & MDM — ORM 모델
부서, 직급, 사용자, 권한, 거래처, 품목 테이블을 정의합니다.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, Text, DateTime, ForeignKey,
    Numeric, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ...database import Base


# ── 부서 마스터 ──
class Department(Base):
    """부서 정보 (계층 구조 지원)"""
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, comment="부서 코드")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="부서명")
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), comment="상위 부서")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 관계 설정 (자기참조: 상위-하위 부서)
    parent = relationship("Department", back_populates="children", remote_side=[id])
    children = relationship("Department", back_populates="parent", foreign_keys=[parent_id])
    users = relationship("User", back_populates="department")


# ── 직급/직책 마스터 ──
class Position(Base):
    """직급 정보 (레벨 숫자가 높을수록 상위)"""
    __tablename__ = "positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, comment="직급 코드")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="직급명")
    level: Mapped[int] = mapped_column(Integer, nullable=False, comment="직급 레벨")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="position")


# ── 사용자 마스터 ──
class User(Base):
    """시스템 사용자 (로그인 계정)"""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, comment="사번")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="이름")
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, comment="이메일")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, comment="비밀번호 해시")
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    position_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("positions.id"))
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="user", comment="역할 (admin/manager/user)")
    allowed_modules: Mapped[list | None] = mapped_column(JSONB, nullable=True, comment="접근 가능 모듈 목록 (null=전체)")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="users")
    position = relationship("Position", back_populates="users")


# ── RBAC 권한 ──
class Permission(Base):
    """기능별 권한 정의"""
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module: Mapped[str] = mapped_column(String(10), nullable=False, comment="모듈 (M1~M7)")
    feature_id: Mapped[str] = mapped_column(String(20), nullable=False, comment="기능 ID")
    action: Mapped[str] = mapped_column(String(20), nullable=False, comment="동작 (read/write/delete/approve)")

    __table_args__ = (
        UniqueConstraint("module", "feature_id", "action", name="uq_permission_module_feature_action"),
    )


class RolePermission(Base):
    """역할-권한 매핑"""
    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permissions.id"))

    __table_args__ = (
        UniqueConstraint("role", "permission_id", name="uq_role_permission"),
    )

    permission = relationship("Permission")


# ── Audit Log (전 모듈 공통) ──
class AuditLog(Base):
    """데이터 변경 이력 추적"""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="변경된 테이블")
    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, comment="변경된 레코드 ID")
    action: Mapped[str] = mapped_column(String(20), nullable=False, comment="INSERT/UPDATE/DELETE")
    old_values: Mapped[dict | None] = mapped_column(JSONB, comment="변경 전 데이터")
    new_values: Mapped[dict | None] = mapped_column(JSONB, comment="변경 후 데이터")
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ip_address: Mapped[str | None] = mapped_column(String(45), comment="요청자 IP")
    memo: Mapped[str | None] = mapped_column(Text, comment="수정 사유")

    __table_args__ = (
        Index("idx_audit_logs_table", "table_name", "record_id"),
        Index("idx_audit_logs_changed_at", "changed_at"),
    )


# ── 거래처 마스터 (MDM) ──
class Customer(Base):
    """거래처 정보 (매출처/매입처/겸용)"""
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, comment="거래처 코드")
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="거래처명")
    business_no: Mapped[str | None] = mapped_column(String(20), unique=True, comment="사업자등록번호")
    ceo_name: Mapped[str | None] = mapped_column(String(50), comment="대표자명")
    business_type: Mapped[str | None] = mapped_column(String(100), comment="업태")
    business_item: Mapped[str | None] = mapped_column(String(100), comment="종목")
    address: Mapped[str | None] = mapped_column(Text, comment="주소")
    phone: Mapped[str | None] = mapped_column(String(30), comment="전화번호")
    email: Mapped[str | None] = mapped_column(String(255), comment="이메일")
    fax: Mapped[str | None] = mapped_column(String(30), comment="팩스")
    contact_person: Mapped[str | None] = mapped_column(String(50), comment="담당자명")
    customer_type: Mapped[str] = mapped_column(String(20), default="both", comment="유형 (customer/supplier/both)")
    credit_limit: Mapped[float] = mapped_column(Numeric(15, 2), default=0, comment="신용한도")
    payment_terms: Mapped[int] = mapped_column(Integer, default=30, comment="결제조건 (일)")
    bank_name: Mapped[str | None] = mapped_column(String(50), comment="은행명")
    bank_account: Mapped[str | None] = mapped_column(String(50), comment="계좌번호")
    bank_account_name: Mapped[str | None] = mapped_column(String(50), comment="예금주")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mdm_status: Mapped[str] = mapped_column(String(20), default="approved", comment="MDM 상태 (pending/approved/rejected)")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    __table_args__ = (
        Index("idx_customers_business_no", "business_no"),
        Index("idx_customers_name", "name"),
    )


# ── 제품 카테고리 ──
class ProductCategory(Base):
    """제품 분류 (계층 구조)"""
    __tablename__ = "product_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, comment="분류 코드")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="분류명")
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("product_categories.id"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    products = relationship("Product", back_populates="category")


# ── 제품/품목 마스터 (MDM) ──
class Product(Base):
    """제품/자재/반제품 정보"""
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="품목 코드")
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="품목명")
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("product_categories.id"))
    product_type: Mapped[str] = mapped_column(String(20), default="product", comment="유형 (product/material/semi)")
    unit: Mapped[str] = mapped_column(String(20), default="EA", comment="단위")
    standard_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0, comment="기준 단가")
    cost_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0, comment="원가")
    safety_stock: Mapped[int] = mapped_column(Integer, default=0, comment="안전재고")
    inventory_method: Mapped[str] = mapped_column(String(20), default="fifo", comment="재고평가 (fifo/avg)")
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=10.00, comment="부가세율")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mdm_status: Mapped[str] = mapped_column(String(20), default="approved", comment="MDM 상태")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    category = relationship("ProductCategory", back_populates="products")


# ── 동적 폼 빌더 설정 (M1-F01) ──
class FormConfig(Base):
    """동적 폼 필드 구성 (모듈별 커스텀 폼)"""
    __tablename__ = "form_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module: Mapped[str] = mapped_column(String(10), nullable=False, comment="모듈 (M1~M7)")
    form_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="폼 이름")
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False, comment="필드 구성 JSON")
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    __table_args__ = (
        UniqueConstraint("module", "form_name", "version", name="uq_form_config_module_name_ver"),
    )
