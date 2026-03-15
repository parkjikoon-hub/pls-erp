"""
M3 인사/급여 — 급여 스키마
"""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PayrollCalculateRequest(BaseModel):
    """급여 계산 요청"""
    payroll_year: int = Field(..., description="귀속 연도")
    payroll_month: int = Field(..., ge=1, le=12, description="귀속 월")


class PayrollDetailResponse(BaseModel):
    """급여 상세 내역 (1인)"""
    id: str
    employee_id: str
    employee_no: Optional[str] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None

    # 지급 항목
    base_salary: float
    overtime_pay: float
    bonus: float
    meal_allowance: float
    car_allowance: float
    research_allowance: float
    childcare_allowance: float
    other_allowance: float
    gross_salary: float
    taxable_salary: float

    # 공제 항목
    income_tax: float
    local_tax: float
    national_pension: float
    health_insurance: float
    long_term_care: float
    employment_insurance: float
    total_deduction: float
    net_salary: float

    # 근태
    work_days: int
    leave_days: float
    absent_days: float
    leave_deduction: float

    ai_optimized: bool

    model_config = {"from_attributes": True}


class PayrollHeaderResponse(BaseModel):
    """급여 대장 헤더 응답"""
    id: str
    payroll_year: int
    payroll_month: int
    status: str
    total_employees: int
    total_gross: float
    total_deduction: float
    total_net: float
    payment_date: Optional[date] = None
    journal_id: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    details: Optional[List[PayrollDetailResponse]] = None

    model_config = {"from_attributes": True}


class PayrollApproveRequest(BaseModel):
    """급여 승인 요청"""
    payment_date: Optional[date] = Field(None, description="지급일")
