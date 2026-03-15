"""
M1 시스템 — 거래처 + 품목 마스터 서비스
CRUD 비즈니스 로직 + 감사 로그 연동
"""
import uuid
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from passlib.context import CryptContext

from .models import Customer, Product, ProductCategory, User, Department, Position, FormConfig
from .schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    ProductCategoryCreate, ProductCategoryResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    PositionCreate, PositionUpdate, PositionResponse,
    UserCreate, UserUpdate, UserResponse,
    FormConfigCreate, FormConfigUpdate, FormConfigResponse,
)
from ...audit.service import log_action, get_changed_fields

# 비밀번호 해싱 (auth 모듈과 동일한 설정)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


# ══════════════════════════════════════════════
# 품목 카테고리 (ProductCategory) 서비스
# ══════════════════════════════════════════════

async def list_categories(db: AsyncSession) -> list[ProductCategory]:
    """전체 카테고리 목록을 정렬 순서대로 반환 (드롭다운용)"""
    result = await db.execute(
        select(ProductCategory).order_by(ProductCategory.sort_order, ProductCategory.name)
    )
    return list(result.scalars().all())


async def create_category(
    db: AsyncSession,
    data: ProductCategoryCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> ProductCategory:
    """품목 카테고리 생성"""
    # 코드 중복 확인
    existing = await db.execute(
        select(ProductCategory).where(ProductCategory.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"카테고리 코드 '{data.code}'가 이미 존재합니다",
        )

    category = ProductCategory(**data.model_dump())
    db.add(category)
    await db.flush()

    # 감사 로그
    await log_action(
        db=db, table_name="product_categories", record_id=category.id,
        action="INSERT", changed_by=current_user.id,
        new_values=data.model_dump(exclude_none=True, mode="json"),
        ip_address=ip_address,
    )
    return category


# ══════════════════════════════════════════════
# 품목 (Product) 서비스
# ══════════════════════════════════════════════

async def list_products(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    product_type: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
) -> dict:
    """품목 목록을 검색·정렬·페이지네이션하여 반환"""
    query = select(Product)
    count_query = select(func.count(Product.id))

    # 검색 필터 (품목명, 코드에서 검색)
    if search:
        search_filter = or_(
            Product.name.ilike(f"%{search}%"),
            Product.code.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # 품목 유형 필터
    if product_type:
        query = query.where(Product.product_type == product_type)
        count_query = count_query.where(Product.product_type == product_type)

    # 카테고리 필터
    if category_id:
        query = query.where(Product.category_id == category_id)
        count_query = count_query.where(Product.category_id == category_id)

    # 활성/비활성 필터
    if is_active is not None:
        query = query.where(Product.is_active == is_active)
        count_query = count_query.where(Product.is_active == is_active)

    # 전체 개수
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # 정렬
    allowed_sort = {"name", "code", "created_at", "updated_at", "product_type", "standard_price", "cost_price"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    sort_column = getattr(Product, sort_by)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 페이지네이션
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)

    result = await db.execute(query)
    products = result.scalars().all()

    return {
        "items": [ProductResponse.model_validate(p) for p in products],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 0,
    }


async def get_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    """품목 ID로 단건 조회. 없으면 404 에러"""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="품목을 찾을 수 없습니다",
        )
    return product


async def create_product(
    db: AsyncSession,
    data: ProductCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Product:
    """새 품목을 생성하고 감사 로그를 기록"""
    # 코드 중복 확인
    existing = await db.execute(
        select(Product).where(Product.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"품목 코드 '{data.code}'가 이미 존재합니다",
        )

    # 카테고리 존재 확인
    if data.category_id:
        cat_result = await db.execute(
            select(ProductCategory).where(ProductCategory.id == data.category_id)
        )
        if not cat_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="존재하지 않는 카테고리입니다",
            )

    product = Product(
        **data.model_dump(),
        created_by=current_user.id,
    )
    db.add(product)
    await db.flush()

    # 감사 로그
    await log_action(
        db=db, table_name="products", record_id=product.id,
        action="INSERT", changed_by=current_user.id,
        new_values=data.model_dump(exclude_none=True, mode="json"),
        ip_address=ip_address,
    )
    return product


async def update_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    data: ProductUpdate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Product:
    """품목 정보를 수정하고 변경된 필드만 감사 로그에 기록"""
    product = await get_product(db, product_id)

    # 변경 전 데이터 스냅샷
    update_fields = data.model_dump(exclude_unset=True)
    old_data = {
        field: getattr(product, field)
        for field in update_fields.keys()
    }
    old_data_serializable = _make_serializable(old_data)

    # 카테고리 변경 시 존재 확인
    if "category_id" in update_fields and update_fields["category_id"]:
        cat_result = await db.execute(
            select(ProductCategory).where(ProductCategory.id == update_fields["category_id"])
        )
        if not cat_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="존재하지 않는 카테고리입니다",
            )

    # 필드 업데이트
    for field, value in update_fields.items():
        setattr(product, field, value)

    await db.flush()

    # 변경된 필드만 감사 로그
    new_data_serializable = _make_serializable(update_fields)
    old_changed, new_changed = get_changed_fields(old_data_serializable, new_data_serializable)

    if old_changed:
        await log_action(
            db=db, table_name="products", record_id=product.id,
            action="UPDATE", changed_by=current_user.id,
            old_values=old_changed, new_values=new_changed,
            ip_address=ip_address,
        )
    return product


async def delete_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Product:
    """품목을 비활성화(논리 삭제)하고 감사 로그를 기록"""
    product = await get_product(db, product_id)

    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 비활성화된 품목입니다",
        )

    product.is_active = False
    await db.flush()

    await log_action(
        db=db, table_name="products", record_id=product.id,
        action="DELETE", changed_by=current_user.id,
        old_values={"is_active": True},
        new_values={"is_active": False},
        ip_address=ip_address,
        memo="품목 비활성화 (논리 삭제)",
    )
    return product


# ══════════════════════════════════════════════
# 부서 (Department) 서비스
# ══════════════════════════════════════════════

async def list_departments(db: AsyncSession) -> list[Department]:
    """전체 부서 목록을 정렬 순서대로 반환"""
    result = await db.execute(
        select(Department).order_by(Department.sort_order, Department.name)
    )
    return list(result.scalars().all())


async def create_department(
    db: AsyncSession,
    data: DepartmentCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Department:
    """부서 생성"""
    existing = await db.execute(
        select(Department).where(Department.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"부서 코드 '{data.code}'가 이미 존재합니다",
        )

    dept = Department(**data.model_dump())
    db.add(dept)
    await db.flush()

    await log_action(
        db=db, table_name="departments", record_id=dept.id,
        action="INSERT", changed_by=current_user.id,
        new_values=data.model_dump(exclude_none=True, mode="json"),
        ip_address=ip_address,
    )
    return dept


async def update_department(
    db: AsyncSession,
    dept_id: uuid.UUID,
    data: DepartmentUpdate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Department:
    """부서 수정"""
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="부서를 찾을 수 없습니다")

    update_fields = data.model_dump(exclude_unset=True)
    old_data = _make_serializable({f: getattr(dept, f) for f in update_fields.keys()})

    for field, value in update_fields.items():
        setattr(dept, field, value)
    await db.flush()

    new_data = _make_serializable(update_fields)
    old_changed, new_changed = get_changed_fields(old_data, new_data)
    if old_changed:
        await log_action(
            db=db, table_name="departments", record_id=dept.id,
            action="UPDATE", changed_by=current_user.id,
            old_values=old_changed, new_values=new_changed,
            ip_address=ip_address,
        )
    return dept


# ══════════════════════════════════════════════
# 직급 (Position) 서비스
# ══════════════════════════════════════════════

async def list_positions(db: AsyncSession) -> list[Position]:
    """전체 직급 목록을 레벨 순으로 반환"""
    result = await db.execute(
        select(Position).order_by(Position.level.desc(), Position.name)
    )
    return list(result.scalars().all())


async def create_position(
    db: AsyncSession,
    data: PositionCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Position:
    """직급 생성"""
    existing = await db.execute(
        select(Position).where(Position.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"직급 코드 '{data.code}'가 이미 존재합니다",
        )

    pos = Position(**data.model_dump())
    db.add(pos)
    await db.flush()

    await log_action(
        db=db, table_name="positions", record_id=pos.id,
        action="INSERT", changed_by=current_user.id,
        new_values=data.model_dump(mode="json"),
        ip_address=ip_address,
    )
    return pos


async def update_position(
    db: AsyncSession,
    pos_id: uuid.UUID,
    data: PositionUpdate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Position:
    """직급 수정"""
    result = await db.execute(select(Position).where(Position.id == pos_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="직급을 찾을 수 없습니다")

    update_fields = data.model_dump(exclude_unset=True)
    old_data = _make_serializable({f: getattr(pos, f) for f in update_fields.keys()})

    for field, value in update_fields.items():
        setattr(pos, field, value)
    await db.flush()

    new_data = _make_serializable(update_fields)
    old_changed, new_changed = get_changed_fields(old_data, new_data)
    if old_changed:
        await log_action(
            db=db, table_name="positions", record_id=pos.id,
            action="UPDATE", changed_by=current_user.id,
            old_values=old_changed, new_values=new_changed,
            ip_address=ip_address,
        )
    return pos


# ══════════════════════════════════════════════
# 사용자 (User) 관리 서비스
# ══════════════════════════════════════════════

async def list_users(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = None,
    department_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
) -> dict:
    """사용자 목록을 검색·페이지네이션하여 반환"""
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        search_filter = or_(
            User.name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
            User.employee_no.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)

    if department_id:
        query = query.where(User.department_id == department_id)
        count_query = count_query.where(User.department_id == department_id)

    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(User.created_at.desc())
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)

    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 0,
    }


async def create_user(
    db: AsyncSession,
    data: UserCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> User:
    """새 사용자 계정 생성 (관리자 전용)"""
    # 이메일 중복 확인
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"이메일 '{data.email}'이 이미 등록되어 있습니다",
        )

    # 사번 중복 확인
    existing_no = await db.execute(select(User).where(User.employee_no == data.employee_no))
    if existing_no.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"사번 '{data.employee_no}'이 이미 존재합니다",
        )

    user = User(
        employee_no=data.employee_no,
        name=data.name,
        email=data.email,
        password_hash=pwd_context.hash(data.password),
        department_id=data.department_id,
        position_id=data.position_id,
        role=data.role,
    )
    db.add(user)
    await db.flush()

    await log_action(
        db=db, table_name="users", record_id=user.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"employee_no": data.employee_no, "name": data.name, "email": data.email, "role": data.role},
        ip_address=ip_address,
    )
    return user


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> User:
    """사용자 정보 수정 (비밀번호 제외)"""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    update_fields = data.model_dump(exclude_unset=True)
    old_data = _make_serializable({f: getattr(target_user, f) for f in update_fields.keys()})

    for field, value in update_fields.items():
        setattr(target_user, field, value)
    await db.flush()

    new_data = _make_serializable(update_fields)
    old_changed, new_changed = get_changed_fields(old_data, new_data)
    if old_changed:
        await log_action(
            db=db, table_name="users", record_id=target_user.id,
            action="UPDATE", changed_by=current_user.id,
            old_values=old_changed, new_values=new_changed,
            ip_address=ip_address,
        )
    return target_user


async def reset_user_password(
    db: AsyncSession,
    user_id: uuid.UUID,
    new_password: str,
    current_user: User,
    ip_address: Optional[str] = None,
) -> User:
    """사용자 비밀번호 초기화 (관리자 전용)"""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    target_user.password_hash = pwd_context.hash(new_password)
    await db.flush()

    await log_action(
        db=db, table_name="users", record_id=target_user.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"password": "(변경됨)"},
        new_values={"password": "(초기화됨)"},
        ip_address=ip_address,
        memo="관리자에 의한 비밀번호 초기화",
    )
    return target_user


# ══════════════════════════════════════════════
# 동적 폼 빌더 (FormConfig) 서비스
# ══════════════════════════════════════════════

async def list_form_configs(
    db: AsyncSession,
    module: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> list[FormConfig]:
    """폼 구성 목록을 반환 (모듈별 필터 가능)"""
    query = select(FormConfig).order_by(FormConfig.module, FormConfig.form_name)

    if module:
        query = query.where(FormConfig.module == module)
    if is_active is not None:
        query = query.where(FormConfig.is_active == is_active)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_form_config(db: AsyncSession, config_id: uuid.UUID) -> FormConfig:
    """폼 구성 ID로 단건 조회. 없으면 404"""
    result = await db.execute(select(FormConfig).where(FormConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="폼 구성을 찾을 수 없습니다",
        )
    return config


async def get_form_config_by_name(
    db: AsyncSession, module: str, form_name: str
) -> Optional[FormConfig]:
    """모듈+폼이름으로 활성 폼 구성 조회 (프론트엔드 렌더링용)"""
    result = await db.execute(
        select(FormConfig).where(
            FormConfig.module == module,
            FormConfig.form_name == form_name,
            FormConfig.is_active == True,
        ).order_by(FormConfig.version.desc())
    )
    return result.scalar_one_or_none()


async def create_form_config(
    db: AsyncSession,
    data: FormConfigCreate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> FormConfig:
    """새 폼 구성을 생성하고 감사 로그를 기록"""
    # 동일 모듈+폼이름의 최신 버전 확인
    existing = await db.execute(
        select(FormConfig).where(
            FormConfig.module == data.module,
            FormConfig.form_name == data.form_name,
        ).order_by(FormConfig.version.desc())
    )
    latest = existing.scalar_one_or_none()
    next_version = (latest.version + 1) if latest else 1

    # 필드 목록을 config_json에 저장
    fields_data = [f.model_dump() for f in data.fields]

    config = FormConfig(
        module=data.module,
        form_name=data.form_name,
        config_json={"fields": fields_data},
        version=next_version,
        created_by=current_user.id,
    )
    db.add(config)
    await db.flush()

    # 감사 로그
    await log_action(
        db=db, table_name="form_configs", record_id=config.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"module": data.module, "form_name": data.form_name, "version": next_version, "field_count": len(fields_data)},
        ip_address=ip_address,
    )
    return config


async def update_form_config(
    db: AsyncSession,
    config_id: uuid.UUID,
    data: FormConfigUpdate,
    current_user: User,
    ip_address: Optional[str] = None,
) -> FormConfig:
    """폼 구성을 수정 (필드 전체 교체)하고 감사 로그 기록"""
    config = await get_form_config(db, config_id)

    old_field_count = len(config.config_json.get("fields", []))

    # 필드 교체
    fields_data = [f.model_dump() for f in data.fields]
    config.config_json = {"fields": fields_data}

    # 활성화 상태 변경
    if data.is_active is not None:
        config.is_active = data.is_active

    await db.flush()

    # 감사 로그
    await log_action(
        db=db, table_name="form_configs", record_id=config.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"field_count": old_field_count},
        new_values={"field_count": len(fields_data), "is_active": config.is_active},
        ip_address=ip_address,
    )
    return config


async def delete_form_config(
    db: AsyncSession,
    config_id: uuid.UUID,
    current_user: User,
    ip_address: Optional[str] = None,
) -> FormConfig:
    """폼 구성을 비활성화 (논리 삭제)"""
    config = await get_form_config(db, config_id)

    if not config.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 비활성화된 폼 구성입니다",
        )

    config.is_active = False
    await db.flush()

    await log_action(
        db=db, table_name="form_configs", record_id=config.id,
        action="DELETE", changed_by=current_user.id,
        old_values={"is_active": True},
        new_values={"is_active": False},
        ip_address=ip_address,
        memo="폼 구성 비활성화 (논리 삭제)",
    )
    return config


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
