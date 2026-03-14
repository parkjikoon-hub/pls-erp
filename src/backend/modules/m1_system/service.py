"""
M1 시스템 — 거래처 마스터 서비스
거래처 CRUD 비즈니스 로직 + 감사 로그 연동
"""
import uuid
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from .models import Customer, User
from .schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from ...audit.service import log_action, get_changed_fields


# ── 거래처 목록 조회 (검색 + 정렬 + 페이지네이션) ──
async def list_customers(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    customer_type: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> dict:
    """거래처 목록을 검색·정렬·페이지네이션하여 반환"""
    # 기본 쿼리
    query = select(Customer)
    count_query = select(func.count(Customer.id))

    # 검색 필터 (거래처명, 사업자번호, 코드에서 검색)
    if search:
        search_filter = or_(
            Customer.name.ilike(f"%{search}%"),
            Customer.business_no.ilike(f"%{search}%"),
            Customer.code.ilike(f"%{search}%"),
            Customer.ceo_name.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # 거래처 유형 필터
    if customer_type:
        query = query.where(Customer.customer_type == customer_type)
        count_query = count_query.where(Customer.customer_type == customer_type)

    # 활성/비활성 필터
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)
        count_query = count_query.where(Customer.is_active == is_active)

    # 전체 개수 조회
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # 정렬
    allowed_sort = {"name", "code", "created_at", "updated_at", "customer_type", "business_no"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"

    sort_column = getattr(Customer, sort_by)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 페이지네이션
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)

    result = await db.execute(query)
    customers = result.scalars().all()

    return {
        "items": [CustomerResponse.model_validate(c) for c in customers],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 0,
    }


# ── 거래처 단건 조회 ──
async def get_customer(db: AsyncSession, customer_id: uuid.UUID) -> Customer:
    """거래처 ID로 단건 조회. 없으면 404 에러"""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="거래처를 찾을 수 없습니다",
        )
    return customer


# ── 거래처 생성 ──
async def create_customer(
    db: AsyncSession,
    data: CustomerCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Customer:
    """새 거래처를 생성하고 감사 로그를 기록"""
    # 코드 중복 확인
    existing = await db.execute(
        select(Customer).where(Customer.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"거래처 코드 '{data.code}'가 이미 존재합니다",
        )

    # 사업자등록번호 중복 확인 (값이 있을 경우만)
    if data.business_no:
        existing_biz = await db.execute(
            select(Customer).where(Customer.business_no == data.business_no)
        )
        if existing_biz.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"사업자등록번호 '{data.business_no}'가 이미 등록되어 있습니다",
            )

    # 거래처 생성
    customer = Customer(
        **data.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(customer)
    await db.flush()  # ID를 먼저 확보 (커밋 전)

    # 감사 로그 기록
    await log_action(
        db=db,
        table_name="customers",
        record_id=customer.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values=data.model_dump(exclude_none=True),
        ip_address=ip_address,
    )

    return customer


# ── 거래처 수정 ──
async def update_customer(
    db: AsyncSession,
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Customer:
    """거래처 정보를 수정하고 변경된 필드만 감사 로그에 기록"""
    customer = await get_customer(db, customer_id)

    # 변경 전 데이터 스냅샷
    old_data = {
        field: getattr(customer, field)
        for field in data.model_dump(exclude_unset=True).keys()
    }
    # JSON 직렬화를 위해 UUID/datetime 변환
    old_data_serializable = _make_serializable(old_data)

    # 사업자등록번호 변경 시 중복 확인
    update_fields = data.model_dump(exclude_unset=True)
    if "business_no" in update_fields and update_fields["business_no"]:
        existing_biz = await db.execute(
            select(Customer).where(
                Customer.business_no == update_fields["business_no"],
                Customer.id != customer_id,
            )
        )
        if existing_biz.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"사업자등록번호 '{update_fields['business_no']}'가 이미 등록되어 있습니다",
            )

    # 필드 업데이트 (전송된 필드만)
    for field, value in update_fields.items():
        setattr(customer, field, value)
    customer.updated_by = current_user.id

    await db.flush()

    # 변경된 필드만 감사 로그에 기록
    new_data_serializable = _make_serializable(update_fields)
    old_changed, new_changed = get_changed_fields(old_data_serializable, new_data_serializable)

    if old_changed:  # 실제 변경된 내용이 있을 때만 기록
        await log_action(
            db=db,
            table_name="customers",
            record_id=customer.id,
            action="UPDATE",
            changed_by=current_user.id,
            old_values=old_changed,
            new_values=new_changed,
            ip_address=ip_address,
        )

    return customer


# ── 거래처 삭제 (논리 삭제) ──
async def delete_customer(
    db: AsyncSession,
    customer_id: uuid.UUID,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Customer:
    """거래처를 비활성화(논리 삭제)하고 감사 로그를 기록"""
    customer = await get_customer(db, customer_id)

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 비활성화된 거래처입니다",
        )

    customer.is_active = False
    customer.updated_by = current_user.id
    await db.flush()

    # 감사 로그 기록
    await log_action(
        db=db,
        table_name="customers",
        record_id=customer.id,
        action="DELETE",
        changed_by=current_user.id,
        old_values={"is_active": True},
        new_values={"is_active": False},
        ip_address=ip_address,
        memo="거래처 비활성화 (논리 삭제)",
    )

    return customer


# ── 유틸리티 ──
def _make_serializable(data: dict) -> dict:
    """UUID, datetime 등을 JSON 직렬화 가능한 형태로 변환"""
    result = {}
    for key, value in data.items():
        if isinstance(value, uuid.UUID):
            result[key] = str(value)
        elif hasattr(value, "isoformat"):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result
