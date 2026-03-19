"""
M3 인사/급여 — 직원(인사카드) 서비스
CRUD + 검색 + 감사 로그 기록
"""
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import Employee
from ..schemas.employees import EmployeeCreate, EmployeeUpdate
from ...m1_system.models import Department, Position, User
from ....audit.service import log_action, get_changed_fields


def _make_serializable(data: dict) -> dict:
    """UUID/date 등을 문자열로 변환 (감사 로그용)"""
    result = {}
    for k, v in data.items():
        if isinstance(v, (uuid.UUID, date)):
            result[k] = str(v)
        else:
            result[k] = v
    return result


def _to_response(emp: Employee) -> dict:
    """Employee ORM → 응답 dict 변환 (관계 필드 포함)"""
    return {
        "id": str(emp.id),
        "employee_no": emp.employee_no,
        "name": emp.name,
        "user_id": str(emp.user_id) if emp.user_id else None,
        "department_id": str(emp.department_id) if emp.department_id else None,
        "department_name": emp.department.name if emp.department else None,
        "position_id": str(emp.position_id) if emp.position_id else None,
        "position_name": emp.position.name if emp.position else None,
        "employee_type": emp.employee_type,
        "hire_date": emp.hire_date,
        "resign_date": emp.resign_date,
        "base_salary": float(emp.base_salary),
        "is_research_staff": emp.is_research_staff,
        "annual_leave_days": emp.annual_leave_days,
        "remaining_leaves": float(emp.remaining_leaves),
        "bank_name": emp.bank_name,
        "bank_account": emp.bank_account,
        "phone": emp.phone,
        "email": emp.email,
        "address": emp.address,
        "has_childcare": emp.has_childcare,
        "has_car_allowance": emp.has_car_allowance,
        "ins_national_pension": getattr(emp, 'ins_national_pension', True),
        "ins_health": getattr(emp, 'ins_health', True),
        "ins_longterm_care": getattr(emp, 'ins_longterm_care', True),
        "ins_employment": getattr(emp, 'ins_employment', True),
        "memo": emp.memo,
        "is_active": emp.is_active,
        "created_at": emp.created_at,
        "updated_at": emp.updated_at,
    }


async def list_employees(
    db: AsyncSession,
    search: Optional[str] = None,
    department_id: Optional[str] = None,
    employee_type: Optional[str] = None,
    is_active: bool = True,
    page: int = 1,
    size: int = 50,
):
    """직원 목록 조회 (필터/검색/페이지네이션)"""
    # 카운트 쿼리
    count_q = select(func.count()).select_from(Employee)
    count_q = count_q.where(Employee.is_active == is_active)

    # 데이터 쿼리
    query = (
        select(Employee)
        .options(
            selectinload(Employee.department),
            selectinload(Employee.position),
        )
        .where(Employee.is_active == is_active)
    )

    # 필터 적용
    if search:
        search_filter = or_(
            Employee.name.ilike(f"%{search}%"),
            Employee.employee_no.ilike(f"%{search}%"),
            Employee.phone.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_q = count_q.where(search_filter)

    if department_id:
        dept_uuid = uuid.UUID(department_id)
        query = query.where(Employee.department_id == dept_uuid)
        count_q = count_q.where(Employee.department_id == dept_uuid)

    if employee_type:
        query = query.where(Employee.employee_type == employee_type)
        count_q = count_q.where(Employee.employee_type == employee_type)

    # 총 건수
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # 페이지네이션
    query = query.order_by(Employee.employee_no)
    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    employees = result.scalars().all()

    return {
        "items": [_to_response(e) for e in employees],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 0,
    }


async def get_employee(db: AsyncSession, employee_id: str):
    """직원 단건 조회"""
    query = (
        select(Employee)
        .options(
            selectinload(Employee.department),
            selectinload(Employee.position),
        )
        .where(Employee.id == uuid.UUID(employee_id))
    )
    result = await db.execute(query)
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    return _to_response(emp)


async def search_employees(db: AsyncSession, q: str, limit: int = 20):
    """직원 검색 (드롭다운용 축약 응답)"""
    query = (
        select(Employee)
        .options(
            selectinload(Employee.department),
            selectinload(Employee.position),
        )
        .where(Employee.is_active == True)
        .where(
            or_(
                Employee.name.ilike(f"%{q}%"),
                Employee.employee_no.ilike(f"%{q}%"),
            )
        )
        .order_by(Employee.employee_no)
        .limit(limit)
    )
    result = await db.execute(query)
    employees = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "employee_no": e.employee_no,
            "name": e.name,
            "department_name": e.department.name if e.department else None,
            "position_name": e.position.name if e.position else None,
        }
        for e in employees
    ]


async def create_employee(db: AsyncSession, data: EmployeeCreate, current_user, ip_address: Optional[str] = None):
    """직원 등록"""
    # 사번 중복 검사
    existing = await db.execute(
        select(Employee).where(Employee.employee_no == data.employee_no)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"사번 '{data.employee_no}'이(가) 이미 존재합니다")

    # user_id 중복 검사 (이미 다른 직원에 연결된 경우)
    if data.user_id:
        user_linked = await db.execute(
            select(Employee).where(Employee.user_id == uuid.UUID(data.user_id))
        )
        if user_linked.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="해당 사용자 계정은 이미 다른 직원에 연결되어 있습니다")

    emp = Employee(
        employee_no=data.employee_no,
        name=data.name,
        user_id=uuid.UUID(data.user_id) if data.user_id else None,
        department_id=uuid.UUID(data.department_id) if data.department_id else None,
        position_id=uuid.UUID(data.position_id) if data.position_id else None,
        employee_type=data.employee_type,
        hire_date=data.hire_date,
        base_salary=data.base_salary,
        is_research_staff=data.is_research_staff,
        annual_leave_days=data.annual_leave_days,
        remaining_leaves=data.annual_leave_days,
        bank_name=data.bank_name,
        bank_account=data.bank_account,
        phone=data.phone,
        email=data.email,
        address=data.address,
        has_childcare=data.has_childcare,
        has_car_allowance=data.has_car_allowance,
        memo=data.memo,
        created_by=current_user.id,
    )
    db.add(emp)
    await db.flush()

    # 감사 로그
    await log_action(
        db=db,
        table_name="employees",
        record_id=emp.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values=_make_serializable({"employee_no": emp.employee_no, "name": emp.name}),
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(emp)

    # 연결된 사용자 계정에 인사(M3)/그룹웨어(M6) 모듈 접근 권한 자동 부여
    if emp.user_id:
        try:
            linked_user = await db.get(User, emp.user_id)
            if linked_user:
                current_modules = linked_user.allowed_modules
                if current_modules is not None:
                    # allowed_modules가 리스트인 경우에만 추가 (None은 전체 접근)
                    needed = {"M3", "M6"}
                    existing = set(current_modules)
                    if not needed.issubset(existing):
                        linked_user.allowed_modules = list(existing | needed)
                        await db.commit()
        except Exception:
            pass  # 권한 부여 실패해도 직원 등록은 성공

    # 관계 로드 후 반환
    return await get_employee(db, str(emp.id))


async def update_employee(db: AsyncSession, employee_id: str, data: EmployeeUpdate, current_user, ip_address: Optional[str] = None):
    """직원 정보 수정 (부분 수정)"""
    result = await db.execute(
        select(Employee).where(Employee.id == uuid.UUID(employee_id))
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    update_fields = data.model_dump(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="수정할 항목이 없습니다")

    # 변경 전 값 캡처
    old_data = {}
    for k in update_fields:
        old_data[k] = getattr(emp, k)

    # UUID 변환 후 적용
    for field, value in update_fields.items():
        if field in ("department_id", "position_id") and value:
            setattr(emp, field, uuid.UUID(value))
        else:
            setattr(emp, field, value)

    await db.flush()

    # 변경된 필드만 로그
    old_changed, new_changed = get_changed_fields(
        _make_serializable(old_data),
        _make_serializable(update_fields),
    )
    if old_changed:
        await log_action(
            db=db,
            table_name="employees",
            record_id=emp.id,
            action="UPDATE",
            changed_by=current_user.id,
            old_values=old_changed,
            new_values=new_changed,
            ip_address=ip_address,
        )

    await db.commit()
    return await get_employee(db, str(emp.id))


async def delete_employee(db: AsyncSession, employee_id: str, current_user, ip_address: Optional[str] = None):
    """직원 비활성화 (소프트 삭제)"""
    result = await db.execute(
        select(Employee).where(Employee.id == uuid.UUID(employee_id))
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    emp.is_active = False
    await db.flush()

    await log_action(
        db=db,
        table_name="employees",
        record_id=emp.id,
        action="DELETE",
        changed_by=current_user.id,
        old_values=_make_serializable({"is_active": True}),
        new_values=_make_serializable({"is_active": False}),
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": f"직원 '{emp.name}'이(가) 비활성화되었습니다"}
