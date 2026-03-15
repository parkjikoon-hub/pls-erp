"""
M3 인사/급여 — 근태/휴가 API 라우터
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.attendance import AttendanceCreate
from ..services import attendance_service

router = APIRouter()


@router.get("", summary="근태 기록 목록")
async def list_attendance(
    employee_id: Optional[str] = Query(None, description="직원 ID 필터"),
    year: Optional[int] = Query(None, description="연도"),
    month: Optional[int] = Query(None, ge=1, le=12, description="월"),
    attendance_type: Optional[str] = Query(None, description="유형 필터"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """근태 기록 목록 조회 (필터/페이지네이션)"""
    data = await attendance_service.list_attendance(
        db, employee_id=employee_id, year=year, month=month,
        attendance_type=attendance_type, page=page, size=size,
    )
    return success_response(data=data)


@router.get("/summary/{employee_id}", summary="직원 근태 요약")
async def get_leave_summary(
    employee_id: str,
    year: int = Query(..., description="조회 연도"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """직원의 연간 근태 요약 (연차/병가/결근 집계)"""
    data = await attendance_service.get_employee_leave_summary(db, employee_id, year)
    return success_response(data=data)


@router.post("", summary="근태 기록 등록")
async def create_attendance(
    data: AttendanceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """근태 기록 등록 (휴가/병가/결근 등 예외 기록)"""
    ip = request.client.host if request.client else None
    result = await attendance_service.create_attendance(db, data, current_user, ip)
    return success_response(data=result, message="근태 기록이 등록되었습니다")


@router.delete("/{record_id}", summary="근태 기록 삭제")
async def delete_attendance(
    record_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """근태 기록 삭제 (연차 복원)"""
    ip = request.client.host if request.client else None
    result = await attendance_service.delete_attendance(db, record_id, current_user, ip)
    return success_response(data=result, message=result["message"])
