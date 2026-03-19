"""
M3 인사 및 급여/세무 — ORM 모델
직원(인사카드), 근태기록, 급여대장(헤더+상세) 테이블을 정의합니다.
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


# ── 직원 마스터 (인사카드) ──
class Employee(Base):
    """직원 인사 정보 (M1 User와 1:1 연결)"""
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_no: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="사번"
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
        unique=True, comment="시스템 사용자 계정 링크"
    )
    name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="이름"
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), comment="부서"
    )
    position_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("positions.id"), comment="직급"
    )
    employee_type: Mapped[str] = mapped_column(
        String(20), default="regular",
        comment="고용 유형 (regular=정규직/contract=계약직/part=파트타임)"
    )
    hire_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="입사일"
    )
    resign_date: Mapped[date | None] = mapped_column(
        Date, comment="퇴사일"
    )
    base_salary: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0, comment="기본급 (월)"
    )
    is_research_staff: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="R&D 인력 여부 (연구활동비 비과세 적용)"
    )
    annual_leave_days: Mapped[int] = mapped_column(
        Integer, default=15, comment="연차 일수"
    )
    remaining_leaves: Mapped[float] = mapped_column(
        Numeric(5, 1), default=15, comment="잔여 연차"
    )
    bank_name: Mapped[str | None] = mapped_column(
        String(50), comment="급여 계좌 은행"
    )
    bank_account: Mapped[str | None] = mapped_column(
        String(50), comment="급여 계좌번호"
    )
    resident_no_enc: Mapped[str | None] = mapped_column(
        String(255), comment="주민등록번호 (암호화 저장)"
    )
    phone: Mapped[str | None] = mapped_column(
        String(30), comment="연락처"
    )
    email: Mapped[str | None] = mapped_column(
        String(255), comment="개인 이메일"
    )
    address: Mapped[str | None] = mapped_column(
        Text, comment="주소"
    )
    has_childcare: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="육아수당 대상 여부"
    )
    has_car_allowance: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="자가운전보조금 대상 여부"
    )
    # 4대보험 선택적 적용 (기본값: 전부 가입)
    ins_national_pension: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="국민연금 가입 여부"
    )
    ins_health: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="건강보험 가입 여부"
    )
    ins_longterm_care: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="장기요양보험 가입 여부"
    )
    ins_employment: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="고용보험 가입 여부"
    )
    memo: Mapped[str | None] = mapped_column(
        Text, comment="비고"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), comment="작성자"
    )

    # 관계
    user = relationship("User", foreign_keys=[user_id])
    department = relationship("Department", foreign_keys=[department_id])
    position = relationship("Position", foreign_keys=[position_id])
    attendance_records = relationship("AttendanceRecord", back_populates="employee")
    payroll_details = relationship("PayrollDetail", back_populates="employee")

    __table_args__ = (
        Index("idx_emp_department", "department_id"),
        Index("idx_emp_hire_date", "hire_date"),
        Index("idx_emp_active", "is_active"),
    )


# ── 근태 기록 ──
class AttendanceRecord(Base):
    """근태 기록 (예외 기반: 정상출근은 기록 안 함, 휴가/병가/결근만 입력)"""
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"),
        nullable=False, comment="직원 ID"
    )
    work_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="근무일"
    )
    attendance_type: Mapped[str] = mapped_column(
        String(20), default="normal",
        comment="근태 유형 (normal=정상/leave=휴가/sick=병가/absent=결근/half=반차/early=조퇴)"
    )
    leave_type: Mapped[str | None] = mapped_column(
        String(30), comment="휴가 종류 (annual=연차/sick=병가/special=특별휴가/half_am=오전반차/half_pm=오후반차)"
    )
    leave_days: Mapped[float] = mapped_column(
        Numeric(3, 1), default=0, comment="차감 일수 (0.5=반차, 1=연차)"
    )
    memo: Mapped[str | None] = mapped_column(
        Text, comment="사유"
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

    # 관계
    employee = relationship("Employee", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_attendance_emp_date"),
        Index("idx_att_date", "work_date"),
        Index("idx_att_type", "attendance_type"),
    )


# ── 급여 대장 헤더 (월별) ──
class PayrollHeader(Base):
    """급여 대장 (월별 급여 처리 단위)"""
    __tablename__ = "payroll_headers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    payroll_year: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="귀속 연도"
    )
    payroll_month: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="귀속 월"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="상태 (draft=작성중/calculated=계산완료/approved=승인/paid=지급완료)"
    )
    total_employees: Mapped[int] = mapped_column(
        Integer, default=0, comment="급여 대상 인원"
    )
    total_gross: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총 지급액 합계"
    )
    total_deduction: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총 공제액 합계"
    )
    total_net: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총 실수령액 합계"
    )
    payment_date: Mapped[date | None] = mapped_column(
        Date, comment="지급일"
    )
    journal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id"),
        comment="연결된 전표 ID (급여 전표)"
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
    details = relationship(
        "PayrollDetail", back_populates="payroll_header",
        cascade="all, delete-orphan", order_by="PayrollDetail.employee_id"
    )
    journal_entry = relationship("JournalEntry", foreign_keys=[journal_id])

    __table_args__ = (
        UniqueConstraint("payroll_year", "payroll_month", name="uq_payroll_year_month"),
        Index("idx_payroll_status", "status"),
    )


# ── 급여 상세 내역 (개인별) ──
class PayrollDetail(Base):
    """급여 명세서 (직원 1인의 월급여 상세)"""
    __tablename__ = "payroll_details"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    payroll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_headers.id", ondelete="CASCADE"),
        nullable=False, comment="급여대장 헤더 ID"
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"),
        nullable=False, comment="직원 ID"
    )

    # ── 지급 항목 ──
    base_salary: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="기본급"
    )
    overtime_hours: Mapped[float] = mapped_column(
        Numeric(5, 1), default=0, comment="추가근무 시간"
    )
    overtime_pay: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="초과근무수당"
    )
    bonus: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="상여금"
    )
    meal_allowance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="식대 (비과세, 월 20만원 한도)"
    )
    car_allowance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="자가운전보조금 (비과세, 월 20만원 한도)"
    )
    research_allowance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="연구활동비 (비과세, 월 20만원 한도)"
    )
    childcare_allowance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="육아수당 (비과세, 월 10만원 한도)"
    )
    other_allowance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="기타 수당"
    )
    other_allowance_desc: Mapped[str | None] = mapped_column(
        String(200), comment="기타 수당 설명"
    )
    gross_salary: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총 지급액 (과세+비과세 합계)"
    )
    taxable_salary: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="과세 대상 급여 (총 지급액 - 비과세)"
    )

    # ── 공제 항목 ──
    income_tax: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="소득세 (간이세액표)"
    )
    local_tax: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="지방소득세 (소득세의 10%)"
    )
    national_pension: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="국민연금 (4.5%)"
    )
    health_insurance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="건강보험 (3.545%)"
    )
    long_term_care: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="장기요양보험 (건강보험의 12.81%)"
    )
    employment_insurance: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="고용보험 (0.9%)"
    )
    total_deduction: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="총 공제액"
    )
    net_salary: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="실수령액"
    )

    # ── 근태 반영 ──
    work_days: Mapped[int] = mapped_column(
        Integer, default=0, comment="근무 일수"
    )
    leave_days: Mapped[float] = mapped_column(
        Numeric(3, 1), default=0, comment="휴가 일수"
    )
    absent_days: Mapped[float] = mapped_column(
        Numeric(3, 1), default=0, comment="결근 일수"
    )
    leave_deduction: Mapped[float] = mapped_column(
        Numeric(15, 2), default=0, comment="결근 공제액"
    )

    # ── AI 최적화 플래그 ──
    ai_optimized: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="AI 세무 최적화 적용 여부"
    )
    ai_memo: Mapped[str | None] = mapped_column(
        Text, comment="AI 최적화 메모"
    )

    # 관계
    payroll_header = relationship("PayrollHeader", back_populates="details")
    employee = relationship("Employee", back_populates="payroll_details")

    __table_args__ = (
        UniqueConstraint("payroll_id", "employee_id", name="uq_payroll_employee"),
        Index("idx_pd_employee", "employee_id"),
    )
