"""
M3 인사/급여 — 근태/휴가 서비스
예외 기반 근태 관리: 정상출근은 기록하지 않고, 휴가/병가/결근만 기록합니다.
"""
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from ..models import AttendanceRecord, Employee
from ..schemas.attendance import AttendanceCreate, AttendanceUpdate
from ....audit.service import log_action


def _to_response(rec: AttendanceRecord) -> dict:
    """AttendanceRecord ORM → 응답 dict"""
    return {
        "id": str(rec.id),
        "employee_id": str(rec.employee_id),
        "employee_no": rec.employee.employee_no if rec.employee else None,
        "employee_name": rec.employee.name if rec.employee else None,
        "work_date": rec.work_date,
        "attendance_type": rec.attendance_type,
        "leave_type": rec.leave_type,
        "leave_days": float(rec.leave_days),
        "memo": rec.memo,
        "approved_by": str(rec.approved_by) if rec.approved_by else None,
        "approved_at": rec.approved_at,
        "created_at": rec.created_at,
    }


async def list_attendance(
    db: AsyncSession,
    employee_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    attendance_type: Optional[str] = None,
    page: int = 1,
    size: int = 50,
):
    """근태 기록 목록 조회"""
    base_filter = []
    if employee_id:
        base_filter.append(AttendanceRecord.employee_id == uuid.UUID(employee_id))
    if year:
        base_filter.append(func.extract("year", AttendanceRecord.work_date) == year)
    if month:
        base_filter.append(func.extract("month", AttendanceRecord.work_date) == month)
    if attendance_type:
        base_filter.append(AttendanceRecord.attendance_type == attendance_type)

    # 카운트
    count_q = select(func.count()).select_from(AttendanceRecord)
    if base_filter:
        count_q = count_q.where(and_(*base_filter))
    total = (await db.execute(count_q)).scalar() or 0

    # 데이터
    query = (
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.employee))
        .order_by(AttendanceRecord.work_date.desc(), AttendanceRecord.employee_id)
    )
    if base_filter:
        query = query.where(and_(*base_filter))
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "items": [_to_response(r) for r in records],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 0,
    }


async def create_attendance(
    db: AsyncSession, data: AttendanceCreate, current_user, ip_address: Optional[str] = None
):
    """근태 기록 등록 (휴가/병가 등)"""
    # 직원 존재 확인
    emp_result = await db.execute(
        select(Employee).where(Employee.id == uuid.UUID(data.employee_id))
    )
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    if not emp.is_active:
        raise HTTPException(status_code=400, detail="비활성화된 직원입니다")

    # 중복 날짜 검사
    dup = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == uuid.UUID(data.employee_id),
            AttendanceRecord.work_date == data.work_date,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"{data.work_date}에 이미 근태 기록이 있습니다")

    # 연차 차감 (leave 유형일 때만)
    if data.attendance_type in ("leave", "half") and data.leave_days > 0:
        if float(emp.remaining_leaves) < data.leave_days:
            raise HTTPException(
                status_code=400,
                detail=f"잔여 연차({float(emp.remaining_leaves)}일)가 부족합니다"
            )
        emp.remaining_leaves = float(emp.remaining_leaves) - data.leave_days

    rec = AttendanceRecord(
        employee_id=uuid.UUID(data.employee_id),
        work_date=data.work_date,
        attendance_type=data.attendance_type,
        leave_type=data.leave_type,
        leave_days=data.leave_days,
        memo=data.memo,
        approved_by=current_user.id,
        approved_at=func.now(),
    )
    db.add(rec)
    await db.flush()

    await log_action(
        db=db, table_name="attendance_records", record_id=rec.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"employee": emp.name, "date": str(data.work_date), "type": data.attendance_type},
        ip_address=ip_address,
    )
    await db.commit()

    # 관계 로드 후 반환
    result = await db.execute(
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.employee))
        .where(AttendanceRecord.id == rec.id)
    )
    return _to_response(result.scalar_one())


async def delete_attendance(
    db: AsyncSession, record_id: str, current_user, ip_address: Optional[str] = None
):
    """근태 기록 삭제 (연차 복원)"""
    result = await db.execute(
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.employee))
        .where(AttendanceRecord.id == uuid.UUID(record_id))
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="근태 기록을 찾을 수 없습니다")

    # 연차 복원
    if rec.attendance_type in ("leave", "half") and float(rec.leave_days) > 0:
        emp_result = await db.execute(
            select(Employee).where(Employee.id == rec.employee_id)
        )
        emp = emp_result.scalar_one_or_none()
        if emp:
            emp.remaining_leaves = float(emp.remaining_leaves) + float(rec.leave_days)

    await log_action(
        db=db, table_name="attendance_records", record_id=rec.id,
        action="DELETE", changed_by=current_user.id,
        old_values={"date": str(rec.work_date), "type": rec.attendance_type},
        ip_address=ip_address,
    )

    await db.delete(rec)
    await db.commit()
    return {"message": "근태 기록이 삭제되었습니다"}


async def get_employee_leave_summary(db: AsyncSession, employee_id: str, year: int):
    """직원의 연간 근태 요약 (연차 사용/잔여, 결근 일수)"""
    emp_result = await db.execute(
        select(Employee).where(Employee.id == uuid.UUID(employee_id))
    )
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    # 해당 연도 근태 기록 집계
    records = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == uuid.UUID(employee_id),
            func.extract("year", AttendanceRecord.work_date) == year,
        )
    )
    all_records = records.scalars().all()

    leave_used = sum(float(r.leave_days) for r in all_records if r.attendance_type in ("leave", "half"))
    sick_days = sum(float(r.leave_days) for r in all_records if r.attendance_type == "sick")
    absent_days = len([r for r in all_records if r.attendance_type == "absent"])

    return {
        "employee_id": str(emp.id),
        "employee_name": emp.name,
        "year": year,
        "annual_leave_days": emp.annual_leave_days,
        "remaining_leaves": float(emp.remaining_leaves),
        "leave_used": leave_used,
        "sick_days": sick_days,
        "absent_days": absent_days,
        "total_exceptions": len(all_records),
    }
