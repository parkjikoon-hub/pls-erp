"""
M3 인사/급여 — 직원(인사카드) API 라우터
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.employees import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from ..services import employee_service

router = APIRouter()


@router.get("", summary="직원 목록")
async def list_employees(
    search: Optional[str] = Query(None, description="이름/사번 검색"),
    department_id: Optional[str] = Query(None, description="부서 필터"),
    employee_type: Optional[str] = Query(None, description="고용유형 필터"),
    is_active: bool = Query(True, description="활성 상태"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """직원 목록 조회 (필터/검색/페이지네이션)"""
    data = await employee_service.list_employees(
        db, search=search, department_id=department_id,
        employee_type=employee_type, is_active=is_active,
        page=page, size=size,
    )
    return success_response(data=data)


@router.get("/search", summary="직원 검색 (드롭다운)")
async def search_employees(
    q: str = Query("", description="검색어"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """직원 검색 (급여/근태에서 드롭다운용)"""
    data = await employee_service.search_employees(db, q=q, limit=limit)
    return success_response(data=data)


@router.get("/{employee_id}", summary="직원 상세")
async def get_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """직원 단건 조회"""
    data = await employee_service.get_employee(db, employee_id)
    return success_response(data=data)


@router.post("", summary="직원 등록")
async def create_employee(
    data: EmployeeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """직원 등록 (관리자/매니저만)"""
    ip = request.client.host if request.client else None
    result = await employee_service.create_employee(db, data, current_user, ip)
    return success_response(data=result, message=f"직원 '{data.name}'이(가) 등록되었습니다")


@router.put("/{employee_id}", summary="직원 수정")
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """직원 정보 수정 (관리자/매니저만)"""
    ip = request.client.host if request.client else None
    result = await employee_service.update_employee(db, employee_id, data, current_user, ip)
    return success_response(data=result, message="직원 정보가 수정되었습니다")


@router.delete("/{employee_id}", summary="직원 비활성화")
async def delete_employee(
    employee_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """직원 비활성화 (관리자만)"""
    ip = request.client.host if request.client else None
    result = await employee_service.delete_employee(db, employee_id, current_user, ip)
    return success_response(data=result, message=result["message"])
