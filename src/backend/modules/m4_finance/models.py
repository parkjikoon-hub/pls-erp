"""
M4 재무/회계 — ORM 모델
계정과목, 회계연도, 전표(헤더+라인), 세금계산서, 뱅킹 테이블을 정의합니다.
"""
import uuid
from datetime import date, datetime
from sqlalchemy import (
    String, Integer, Boolean, Text, Date, DateTime, ForeignKey,
    Numeric, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ...database import Base


# ── 계정과목 마스터 ──
class ChartOfAccounts(Base):
    """계정과목 (자산/부채/자본/수익/비용 분류 체계)"""
    __tablename__ = "chart_of_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="계정 코드"
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="계정명"
    )
    account_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="유형 (asset/liability/equity/revenue/expense)"
    )
    account_group: Mapped[str | None] = mapped_column(
        String(50), comment="계정 그룹 (유동자산, 비유동자산 등)"
    )
    normal_balance: Mapped[str] = mapped_column(
        String(10), default="debit", comment="정상잔액 (debit/credit)"
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), comment="상위 계정"
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # 관계: 계층 구조 (자기참조, async 환경에서 암묵적 로딩 방지)
    parent = relationship("ChartOfAccounts", back_populates="children", remote_side=[id], lazy="noload")
    children = relationship("ChartOfAccounts", back_populates="parent", foreign_keys=[parent_id], lazy="noload")

    __table_args__ = (
        Index("idx_coa_code", "code"),
        Index("idx_coa_type", "account_type"),
    )


# ── 회계연도/기간 관리 ──
class FiscalYear(Base):
    """회계연도 (마감 관리 단위)"""
    __tablename__ = "fiscal_years"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    year: Mapped[int] = mapped_column(
        Integer, unique=True, nullable=False, comment="회계연도"
    )
    start_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="시작일"
    )
    end_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="종료일"
    )
    is_closed: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="마감 여부"
    )
    closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="마감 처리자"
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="마감 일시"
    )

    # 역참조: 이 회계연도에 속하는 전표들
    journal_entries = relationship("JournalEntry", back_populates="fiscal_year")


# ── 전표 헤더 ──
class JournalEntry(Base):
    """전표 (회계 거래 기록의 헤더)"""
    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    entry_no: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, comment="전표번호 (JE-YYYYMM-NNNN)"
    )
    entry_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="전표일자"
    )
    entry_type: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="전표유형 (sales/purchase/expense/payroll/general/adjustment)"
    )
    description: Mapped[str | None] = mapped_column(
        Text, comment="적요"
    )
    total_debit: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0, comment="차변 합계"
    )
    total_credit: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0, comment="대변 합계"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="상태 (draft/review/approved/posted/closed)"
    )
    source_module: Mapped[str | None] = mapped_column(
        String(10), comment="원본 모듈 (M2/M3/M4/M5)"
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), comment="원본 전표 참조 ID"
    )
    fiscal_year_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fiscal_years.id"), comment="회계연도"
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="승인자"
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="승인 일시"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="작성자"
    )

    # 관계
    fiscal_year = relationship("FiscalYear", back_populates="journal_entries")
    lines = relationship(
        "JournalEntryLine", back_populates="journal_entry",
        cascade="all, delete-orphan", order_by="JournalEntryLine.line_no"
    )

    __table_args__ = (
        Index("idx_je_date", "entry_date"),
        Index("idx_je_status", "status"),
        Index("idx_je_type", "entry_type"),
    )


# ── 전표 라인 (분개) ──
class JournalEntryLine(Base):
    """분개 라인 (차변 또는 대변 한 줄)"""
    __tablename__ = "journal_entry_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    journal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False, comment="전표 헤더 ID"
    )
    line_no: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="라인 번호"
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"),
        nullable=False, comment="계정과목 ID"
    )
    debit_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="차변 금액"
    )
    credit_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="대변 금액"
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), comment="거래처 (선택)"
    )
    description: Mapped[str | None] = mapped_column(
        Text, comment="적요"
    )
    tax_code: Mapped[str | None] = mapped_column(
        String(10), comment="세금 코드"
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="세액"
    )

    # 관계
    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccounts")
    customer = relationship("Customer")


# ── 세금계산서 ──
class TaxInvoice(Base):
    """세금계산서 (매출/매입 발행 관리)"""
    __tablename__ = "tax_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_no: Mapped[str | None] = mapped_column(
        String(50), unique=True, comment="발행번호 (TI-/TR-YYYYMM-NNNN)"
    )
    invoice_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="유형 (issue=매출/receive=매입)"
    )
    issue_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="발행일"
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"),
        nullable=False, comment="거래처 ID"
    )
    supply_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="공급가액"
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="부가세액"
    )
    total_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="합계 금액"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="상태 (draft/sent/confirmed/cancelled)"
    )
    nts_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="국세청 전송 일시"
    )
    nts_result: Mapped[str | None] = mapped_column(
        String(20), comment="국세청 전송 결과"
    )
    journal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id"),
        comment="연결된 전표 ID"
    )
    description: Mapped[str | None] = mapped_column(
        Text, comment="비고"
    )
    file_path: Mapped[str | None] = mapped_column(
        String(500), comment="첨부파일 저장 경로"
    )
    file_original_name: Mapped[str | None] = mapped_column(
        String(255), comment="첨부파일 원본 파일명"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="작성자"
    )

    # 관계
    customer = relationship("Customer")
    journal_entry = relationship("JournalEntry")

    __table_args__ = (
        Index("idx_ti_date", "issue_date"),
        Index("idx_ti_type", "invoice_type"),
        Index("idx_ti_status", "status"),
    )


# ── 뱅킹 이체 관리 (테이블만 생성, CRUD는 나중에) ──
class BankTransfer(Base):
    """뱅킹 이체 헤더 (M4-F05, 향후 구현)"""
    __tablename__ = "bank_transfers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transfer_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="이체일"
    )
    bank_name: Mapped[str | None] = mapped_column(
        String(50), comment="은행명"
    )
    account_no: Mapped[str | None] = mapped_column(
        String(50), comment="계좌번호"
    )
    total_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="총 이체 금액"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="상태 (pending/approved/completed/failed)"
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    transfer_file: Mapped[str | None] = mapped_column(
        Text, comment="이체 파일 경로"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    lines = relationship(
        "BankTransferLine", back_populates="transfer",
        cascade="all, delete-orphan"
    )


class BankTransferLine(Base):
    """뱅킹 이체 라인 (M4-F05, 향후 구현)"""
    __tablename__ = "bank_transfer_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transfer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bank_transfers.id", ondelete="CASCADE"),
        nullable=False
    )
    payee_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="수취인명"
    )
    bank_name: Mapped[str | None] = mapped_column(
        String(50), comment="은행명"
    )
    account_no: Mapped[str | None] = mapped_column(
        String(50), comment="계좌번호"
    )
    amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, comment="이체 금액"
    )
    memo: Mapped[str | None] = mapped_column(
        String(100), comment="적요"
    )
    source_type: Mapped[str | None] = mapped_column(
        String(20), comment="원본 유형 (payroll/expense 등)"
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), comment="원본 ID"
    )

    transfer = relationship("BankTransfer", back_populates="lines")


# ── 은행 입금 내역 임포트 ──
class BankImportHistory(Base):
    """은행 CSV 임포트 이력"""
    __tablename__ = "bank_import_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    import_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="임포트 일시"
    )
    bank_code: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="은행 코드 (shinhan/ibk/kb/woori/hana)"
    )
    file_name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="원본 파일명"
    )
    total_rows: Mapped[int] = mapped_column(
        Integer, default=0, comment="파일 내 총 행수"
    )
    imported_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="실제 임포트된 건수"
    )
    skipped_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="건너뛴 건수 (중복 등)"
    )
    total_deposit: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총 입금액"
    )
    source: Mapped[str] = mapped_column(
        String(20), default="csv", comment="데이터 소스 (csv/api_codef)"
    )
    transaction_hashes: Mapped[str | None] = mapped_column(
        Text, comment="임포트된 거래 해시 목록 (중복 방지용, JSON)"
    )
    imported_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="임포트 수행자"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BankAccountMapping(Base):
    """적요 키워드 → 계정과목 자동 매핑 규칙"""
    __tablename__ = "bank_account_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    keyword: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="적요 키워드"
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"),
        nullable=False, comment="매핑 계정과목"
    )
    priority: Mapped[int] = mapped_column(
        Integer, default=0, comment="우선순위 (높을수록 우선)"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    account = relationship("ChartOfAccounts")


# ── 회사 은행 계좌 ──
class CompanyBankAccount(Base):
    """회사가 보유한 은행 계좌 (여러 은행/여러 계좌 관리)"""
    __tablename__ = "company_bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bank_code: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="은행 코드 (shinhan/ibk/kb/woori/hana)"
    )
    bank_name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="은행명"
    )
    account_no: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="계좌번호"
    )
    account_holder: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="예금주"
    )
    account_type: Mapped[str] = mapped_column(
        String(30), default="보통예금", comment="계좌 유형 (보통예금/정기예금/당좌예금)"
    )
    chart_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"),
        nullable=False, comment="연결 계정과목 (보통예금 등)"
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="기본 계좌 여부"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    memo: Mapped[str | None] = mapped_column(String(200), comment="메모")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="등록자"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    chart_account = relationship("ChartOfAccounts")
