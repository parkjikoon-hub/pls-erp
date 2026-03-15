"""
M3 인사/급여 — 직원(인사카드) 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class EmployeeCreate(BaseModel):
    """직원 등록 요청"""
    employee_no: str = Field(..., max_length=20, description="사번")
    name: str = Field(..., max_length=50, description="이름")
    user_id: Optional[str] = Field(None, description="시스템 사용자 계정 ID")
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    employee_type: str = Field("regular", description="고용유형 (regular/contract/part)")
    hire_date: date = Field(..., description="입사일")
    base_salary: float = Field(0, ge=0, description="기본급 (월)")
    is_research_staff: bool = Field(False, description="R&D 인력 여부")
    annual_leave_days: int = Field(15, ge=0, description="연차 일수")
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    has_childcare: bool = False
    has_car_allowance: bool = False
    memo: Optional[str] = None


class EmployeeUpdate(BaseModel):
    """직원 정보 수정 요청 (부분 수정 가능)"""
    name: Optional[str] = None
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    employee_type: Optional[str] = None
    hire_date: Optional[date] = None
    resign_date: Optional[date] = None
    base_salary: Optional[float] = None
    is_research_staff: Optional[bool] = None
    annual_leave_days: Optional[int] = None
    remaining_leaves: Optional[float] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    has_childcare: Optional[bool] = None
    has_car_allowance: Optional[bool] = None
    memo: Optional[str] = None


class EmployeeResponse(BaseModel):
    """직원 응답 (목록/상세 공용)"""
    id: str
    employee_no: str
    name: str
    user_id: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    position_id: Optional[str] = None
    position_name: Optional[str] = None
    employee_type: str
    hire_date: date
    resign_date: Optional[date] = None
    base_salary: float
    is_research_staff: bool
    annual_leave_days: int
    remaining_leaves: float
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    has_childcare: bool
    has_car_allowance: bool
    memo: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmployeeSearchResult(BaseModel):
    """직원 검색 결과 (드롭다운용 축약)"""
    id: str
    employee_no: str
    name: str
    department_name: Optional[str] = None
    position_name: Optional[str] = None

    model_config = {"from_attributes": True}
