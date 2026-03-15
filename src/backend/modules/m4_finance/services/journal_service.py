"""
M4 재무/회계 — 전표(Journal Entry) 서비스
CRUD + 복식부기 검증 + 상태 워크플로우
"""
import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import JournalEntry, JournalEntryLine, ChartOfAccounts, FiscalYear
from ..schemas.journals import JournalCreate, JournalUpdate, JournalLineCreate
from .fiscal_year_service import get_fiscal_year_by_date
from ....audit.service import log_action

# [AI 확장 포인트] OCR 영수증 이미지 → 자동 분개 생성
# Gemini Vision API로 이미지를 분석하여 JournalCreate 스키마로 변환
# AI가 생성한 전표는 status='review'로 시작 (Human-in-the-Loop)

# [AI 확장 포인트] R&D 대체분개 자동화
# 연구개발비 비율 설정에 따라 경상연구개발비/개발비 자동 배분


async def validate_journal_balance(lines: list[JournalLineCreate]) -> None:
    """복식부기 검증 — 차변/대변 합계 일치 확인"""
    total_debit = sum(line.debit_amount for line in lines)
    total_credit = sum(line.credit_amount for line in lines)

    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"차변({total_debit:,.0f})과 대변({total_credit:,.0f})이 일치하지 않습니다",
        )

    if total_debit == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="전표 금액이 0입니다",
        )

    # 각 라인에 차변 또는 대변 중 하나만 양수
    for i, line in enumerate(lines, 1):
        if line.debit_amount > 0 and line.credit_amount > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"라인 {i}: 차변과 대변을 동시에 입력할 수 없습니다",
            )
        if line.debit_amount == 0 and line.credit_amount == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"라인 {i}: 차변 또는 대변 금액을 입력해주세요",
            )


async def generate_entry_no(db: AsyncSession, entry_date: date) -> str:
    """전표번호 자동 생성 (JE-YYYYMM-NNNN)"""
    prefix = f"JE-{entry_date.strftime('%Y%m')}-"
    result = await db.execute(
        select(func.max(JournalEntry.entry_no)).where(
            JournalEntry.entry_no.like(f"{prefix}%")
        )
    )
    last_no = result.scalar()
    if last_no:
        seq = int(last_no.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


async def list_journals(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    entry_type: Optional[str] = None,
    entry_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    sort_by: str = "entry_date",
    sort_order: str = "desc",
):
    """전표 목록 조회 (기간/유형/상태 필터)"""
    query = select(JournalEntry)

    if start_date:
        query = query.where(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.where(JournalEntry.entry_date <= end_date)
    if entry_type:
        query = query.where(JournalEntry.entry_type == entry_type)
    if entry_status:
        query = query.where(JournalEntry.status == entry_status)
    if search:
        sf = f"%{search}%"
        query = query.where(
            or_(
                JournalEntry.entry_no.ilike(sf),
                JournalEntry.description.ilike(sf),
            )
        )

    # 전체 건수
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # 정렬
    sort_col = getattr(JournalEntry, sort_by, JournalEntry.entry_date)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 1,
    }


async def get_journal(db: AsyncSession, journal_id: uuid.UUID) -> JournalEntry:
    """전표 상세 조회 (라인 포함)"""
    result = await db.execute(
        select(JournalEntry)
        .options(
            selectinload(JournalEntry.lines)
            .selectinload(JournalEntryLine.account),
            selectinload(JournalEntry.lines)
            .selectinload(JournalEntryLine.customer),
        )
        .where(JournalEntry.id == journal_id)
    )
    journal = result.scalar_one_or_none()
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="전표를 찾을 수 없습니다",
        )
    return journal


async def create_journal(
    db: AsyncSession,
    data: JournalCreate,
    current_user,
    ip_address: Optional[str] = None,
) -> JournalEntry:
    """전표 생성 (복식부기 검증 + 회계기간 확인)"""
    # 1. 회계연도 확인
    fiscal_year = await get_fiscal_year_by_date(db, data.entry_date)
    if fiscal_year.is_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="마감된 회계기간에는 전표를 생성할 수 없습니다",
        )

    # 2. 복식부기 검증
    await validate_journal_balance(data.lines)

    # 3. 계정과목 유효성 확인
    for i, line in enumerate(data.lines, 1):
        acc = await db.execute(
            select(ChartOfAccounts).where(
                ChartOfAccounts.id == uuid.UUID(line.account_id),
                ChartOfAccounts.is_active == True,  # noqa: E712
            )
        )
        if not acc.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"라인 {i}: 유효하지 않은 계정과목입니다",
            )

    # 4. 전표번호 자동 생성
    entry_no = await generate_entry_no(db, data.entry_date)

    # 5. 전표 헤더 생성
    total_debit = sum(l.debit_amount for l in data.lines)
    total_credit = sum(l.credit_amount for l in data.lines)

    journal = JournalEntry(
        entry_no=entry_no,
        entry_date=data.entry_date,
        entry_type=data.entry_type,
        description=data.description,
        total_debit=total_debit,
        total_credit=total_credit,
        status="draft",
        fiscal_year_id=fiscal_year.id,
        created_by=current_user.id,
    )
    db.add(journal)
    await db.flush()

    # 6. 분개 라인 생성
    for i, line_data in enumerate(data.lines, 1):
        line = JournalEntryLine(
            journal_id=journal.id,
            line_no=i,
            account_id=uuid.UUID(line_data.account_id),
            debit_amount=line_data.debit_amount,
            credit_amount=line_data.credit_amount,
            customer_id=uuid.UUID(line_data.customer_id) if line_data.customer_id else None,
            description=line_data.description,
            tax_code=line_data.tax_code,
            tax_amount=line_data.tax_amount,
        )
        db.add(line)

    await db.flush()

    # 7. 감사 로그
    await log_action(
        db=db,
        table_name="journal_entries",
        record_id=journal.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values={
            "entry_no": entry_no,
            "entry_date": str(data.entry_date),
            "entry_type": data.entry_type,
            "total_debit": float(total_debit),
            "total_credit": float(total_credit),
            "lines_count": len(data.lines),
        },
        ip_address=ip_address,
    )

    return journal


async def update_journal(
    db: AsyncSession,
    journal_id: uuid.UUID,
    data: JournalUpdate,
    current_user,
    ip_address: Optional[str] = None,
) -> JournalEntry:
    """전표 수정 (draft 상태만 가능, 라인은 전체 교체)"""
    journal = await get_journal(db, journal_id)

    if journal.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{journal.status}' 상태의 전표는 수정할 수 없습니다 (draft만 가능)",
        )

    update_fields = data.model_dump(exclude_unset=True)

    # 날짜 변경 시 회계기간 확인
    if "entry_date" in update_fields:
        fiscal_year = await get_fiscal_year_by_date(db, data.entry_date)
        if fiscal_year.is_closed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마감된 회계기간에는 전표를 수정할 수 없습니다",
            )
        journal.fiscal_year_id = fiscal_year.id

    # 라인 교체
    if data.lines is not None:
        await validate_journal_balance(data.lines)

        # 기존 라인 삭제 (cascade)
        for old_line in journal.lines:
            await db.delete(old_line)
        await db.flush()

        # 새 라인 추가
        total_debit = 0.0
        total_credit = 0.0
        for i, line_data in enumerate(data.lines, 1):
            line = JournalEntryLine(
                journal_id=journal.id,
                line_no=i,
                account_id=uuid.UUID(line_data.account_id),
                debit_amount=line_data.debit_amount,
                credit_amount=line_data.credit_amount,
                customer_id=uuid.UUID(line_data.customer_id) if line_data.customer_id else None,
                description=line_data.description,
                tax_code=line_data.tax_code,
                tax_amount=line_data.tax_amount,
            )
            db.add(line)
            total_debit += line_data.debit_amount
            total_credit += line_data.credit_amount

        journal.total_debit = total_debit
        journal.total_credit = total_credit

    # 헤더 필드 업데이트
    for field in ["entry_date", "entry_type", "description"]:
        if field in update_fields:
            setattr(journal, field, update_fields[field])

    await db.flush()

    await log_action(
        db=db,
        table_name="journal_entries",
        record_id=journal.id,
        action="UPDATE",
        changed_by=current_user.id,
        new_values={"updated_fields": list(update_fields.keys())},
        ip_address=ip_address,
    )

    return journal


async def delete_journal(
    db: AsyncSession,
    journal_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
) -> None:
    """전표 삭제 (draft 상태만)"""
    journal = await get_journal(db, journal_id)

    if journal.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{journal.status}' 상태의 전표는 삭제할 수 없습니다 (draft만 가능)",
        )

    await log_action(
        db=db,
        table_name="journal_entries",
        record_id=journal.id,
        action="DELETE",
        changed_by=current_user.id,
        old_values={"entry_no": journal.entry_no, "status": journal.status},
        ip_address=ip_address,
        memo="전표 삭제",
    )

    await db.delete(journal)
    await db.flush()


# ── 상태 워크플로우 ──

async def submit_journal(
    db: AsyncSession, journal_id: uuid.UUID, current_user, ip_address=None
) -> JournalEntry:
    """검토 요청 (draft → review)"""
    journal = await get_journal(db, journal_id)
    if journal.status != "draft":
        raise HTTPException(400, "draft 상태에서만 검토 요청할 수 있습니다")

    journal.status = "review"
    await db.flush()

    await log_action(
        db=db, table_name="journal_entries", record_id=journal.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"status": "draft"}, new_values={"status": "review"},
        ip_address=ip_address, memo="검토 요청",
    )
    return journal


async def approve_journal(
    db: AsyncSession, journal_id: uuid.UUID, current_user, ip_address=None
) -> JournalEntry:
    """승인 (review → approved)"""
    journal = await get_journal(db, journal_id)
    if journal.status != "review":
        raise HTTPException(400, "review 상태에서만 승인할 수 있습니다")

    journal.status = "approved"
    journal.approved_by = current_user.id
    journal.approved_at = datetime.utcnow()
    await db.flush()

    await log_action(
        db=db, table_name="journal_entries", record_id=journal.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"status": "review"}, new_values={"status": "approved"},
        ip_address=ip_address, memo="승인",
    )
    return journal


async def post_journal(
    db: AsyncSession, journal_id: uuid.UUID, current_user, ip_address=None
) -> JournalEntry:
    """전기 (approved → posted)"""
    journal = await get_journal(db, journal_id)
    if journal.status != "approved":
        raise HTTPException(400, "approved 상태에서만 전기할 수 있습니다")

    journal.status = "posted"
    await db.flush()

    await log_action(
        db=db, table_name="journal_entries", record_id=journal.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"status": "approved"}, new_values={"status": "posted"},
        ip_address=ip_address, memo="전기 (회계 반영)",
    )
    return journal


async def reject_journal(
    db: AsyncSession, journal_id: uuid.UUID, current_user,
    reason: Optional[str] = None, ip_address=None
) -> JournalEntry:
    """반려 (review → draft)"""
    journal = await get_journal(db, journal_id)
    if journal.status != "review":
        raise HTTPException(400, "review 상태에서만 반려할 수 있습니다")

    journal.status = "draft"
    journal.approved_by = None
    journal.approved_at = None
    await db.flush()

    await log_action(
        db=db, table_name="journal_entries", record_id=journal.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"status": "review"}, new_values={"status": "draft"},
        ip_address=ip_address, memo=f"반려: {reason}" if reason else "반려",
    )
    return journal


async def get_next_entry_no(db: AsyncSession, entry_date: date) -> str:
    """다음 전표번호 미리보기"""
    return await generate_entry_no(db, entry_date)
