"""
M3 인사/급여 — 근태/휴가 스키마
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class AttendanceCreate(BaseModel):
    """근태 기록 등록 (휴가/병가/결근 등 예외만 입력)"""
    employee_id: str = Field(..., description="직원 ID")
    work_date: date = Field(..., description="날짜")
    attendance_type: str = Field(
        "leave", description="유형 (leave=휴가/sick=병가/absent=결근/half=반차/early=조퇴)"
    )
    leave_type: Optional[str] = Field(
        None, description="휴가 종류 (annual=연차/sick=병가/special=특별휴가/half_am=오전반차/half_pm=오후반차)"
    )
    leave_days: float = Field(1.0, ge=0, le=1, description="차감 일수 (0.5=반차, 1=연차)")
    memo: Optional[str] = None


class AttendanceUpdate(BaseModel):
    """근태 기록 수정"""
    attendance_type: Optional[str] = None
    leave_type: Optional[str] = None
    leave_days: Optional[float] = None
    memo: Optional[str] = None


class AttendanceResponse(BaseModel):
    """근태 기록 응답"""
    id: str
    employee_id: str
    employee_no: Optional[str] = None
    employee_name: Optional[str] = None
    work_date: date
    attendance_type: str
    leave_type: Optional[str] = None
    leave_days: float
    memo: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
