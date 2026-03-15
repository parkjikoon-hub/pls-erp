"""
M4 재무/회계 — 계정과목 서비스
CRUD + 검색 + 트리 구성 로직
"""
import uuid
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from ..models import ChartOfAccounts, JournalEntryLine
from ..schemas.accounts import AccountCreate, AccountUpdate
from ....audit.service import log_action, get_changed_fields


def _make_serializable(data: dict) -> dict:
    """UUID 등을 문자열로 변환 (감사 로그용)"""
    result = {}
    for k, v in data.items():
        if isinstance(v, uuid.UUID):
            result[k] = str(v)
        else:
            result[k] = v
    return result


async def list_accounts(
    db: AsyncSession,
    account_type: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    size: int = 100,
    sort_by: str = "code",
    sort_order: str = "asc",
):
    """계정과목 목록 조회 (필터/검색/페이지네이션)"""
    query = select(ChartOfAccounts)

    # 필터: 계정 유형
    if account_type:
        query = query.where(ChartOfAccounts.account_type == account_type)

    # 필터: 활성 상태
    if is_active is not None:
        query = query.where(ChartOfAccounts.is_active == is_active)

    # 검색: 코드 또는 이름
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                ChartOfAccounts.code.ilike(search_filter),
                ChartOfAccounts.name.ilike(search_filter),
            )
        )

    # 전체 건수
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 정렬
    sort_column = getattr(ChartOfAccounts, sort_by, ChartOfAccounts.code)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # 페이지네이션
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)

    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 1,
    }


async def get_account(db: AsyncSession, account_id: uuid.UUID) -> ChartOfAccounts:
    """계정과목 상세 조회 (없으면 404)"""
    result = await db.execute(
        select(ChartOfAccounts).where(ChartOfAccounts.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="계정과목을 찾을 수 없습니다",
        )
    return account


async def search_accounts(
    db: AsyncSession,
    q: str = "",
    limit: int = 20,
):
    """계정과목 검색 (전표 입력 시 드롭다운용)"""
    query = select(ChartOfAccounts).where(ChartOfAccounts.is_active == True)  # noqa: E712

    if q:
        search_filter = f"%{q}%"
        query = query.where(
            or_(
                ChartOfAccounts.code.ilike(search_filter),
                ChartOfAccounts.name.ilike(search_filter),
            )
        )

    query = query.order_by(ChartOfAccounts.code).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_account(
    db: AsyncSession,
    data: AccountCreate,
    current_user,
    ip_address: Optional[str] = None,
) -> ChartOfAccounts:
    """계정과목 생성 (코드 중복 검사 포함)"""
    # 코드 중복 확인
    existing = await db.execute(
        select(ChartOfAccounts).where(ChartOfAccounts.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"계정 코드 '{data.code}'가 이미 존재합니다",
        )

    # 상위 계정 존재 확인
    if data.parent_id:
        parent = await db.execute(
            select(ChartOfAccounts).where(
                ChartOfAccounts.id == uuid.UUID(data.parent_id)
            )
        )
        if not parent.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="상위 계정과목을 찾을 수 없습니다",
            )

    account_data = data.model_dump()
    if account_data.get("parent_id"):
        account_data["parent_id"] = uuid.UUID(account_data["parent_id"])

    account = ChartOfAccounts(**account_data)
    db.add(account)
    await db.flush()

    # 감사 로그
    await log_action(
        db=db,
        table_name="chart_of_accounts",
        record_id=account.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values=_make_serializable(data.model_dump(exclude_none=True)),
        ip_address=ip_address,
    )

    return account


async def update_account(
    db: AsyncSession,
    account_id: uuid.UUID,
    data: AccountUpdate,
    current_user,
    ip_address: Optional[str] = None,
) -> ChartOfAccounts:
    """계정과목 수정 (전표에서 사용 중이면 유형 변경 금지)"""
    account = await get_account(db, account_id)

    update_fields = data.model_dump(exclude_unset=True)

    # 유형 변경 시: 전표에서 사용 중인지 확인
    if "account_type" in update_fields and update_fields["account_type"] != account.account_type:
        used = await db.execute(
            select(func.count()).where(JournalEntryLine.account_id == account_id)
        )
        if (used.scalar() or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="전표에서 사용 중인 계정은 유형을 변경할 수 없습니다",
            )

    # 변경 전 스냅샷
    old_data = {}
    for field in update_fields.keys():
        old_data[field] = getattr(account, field)
    old_data_ser = _make_serializable(old_data)

    # 필드 업데이트
    for field, value in update_fields.items():
        if field == "parent_id" and value:
            setattr(account, field, uuid.UUID(value))
        else:
            setattr(account, field, value)

    await db.flush()

    # 감사 로그 (변경된 필드만)
    new_data_ser = _make_serializable(update_fields)
    old_changed, new_changed = get_changed_fields(old_data_ser, new_data_ser)
    if old_changed:
        await log_action(
            db=db,
            table_name="chart_of_accounts",
            record_id=account.id,
            action="UPDATE",
            changed_by=current_user.id,
            old_values=old_changed,
            new_values=new_changed,
            ip_address=ip_address,
        )

    return account


async def delete_account(
    db: AsyncSession,
    account_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
) -> ChartOfAccounts:
    """계정과목 비활성화 (하위 계정이 있으면 금지)"""
    account = await get_account(db, account_id)

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 비활성화된 계정과목입니다",
        )

    # 하위 계정 확인
    children = await db.execute(
        select(func.count()).where(
            ChartOfAccounts.parent_id == account_id,
            ChartOfAccounts.is_active == True,  # noqa: E712
        )
    )
    if (children.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="하위 계정과목이 있어 비활성화할 수 없습니다",
        )

    account.is_active = False
    await db.flush()

    await log_action(
        db=db,
        table_name="chart_of_accounts",
        record_id=account.id,
        action="DELETE",
        changed_by=current_user.id,
        old_values={"is_active": True},
        new_values={"is_active": False},
        ip_address=ip_address,
        memo="계정과목 비활성화 (논리 삭제)",
    )

    return account
