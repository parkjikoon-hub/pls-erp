"""
M4 재무/회계 — 결산/재무제표 서비스
시산표, 손익계산서, 재무상태표, 기간 마감
"""
import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from ..models import (
    JournalEntry, JournalEntryLine, ChartOfAccounts, FiscalYear,
)
from ....audit.service import log_action


async def get_trial_balance(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    fiscal_year_id: Optional[uuid.UUID] = None,
) -> dict:
    """시산표 — posted 전표의 계정과목별 차변/대변 합계"""
    # 기본 쿼리: posted 전표의 라인을 계정과목별로 집계
    conditions = [
        JournalEntry.status.in_(["posted", "closed"]),
    ]
    if start_date:
        conditions.append(JournalEntry.entry_date >= start_date)
    if end_date:
        conditions.append(JournalEntry.entry_date <= end_date)
    if fiscal_year_id:
        conditions.append(JournalEntry.fiscal_year_id == fiscal_year_id)

    query = (
        select(
            ChartOfAccounts.id,
            ChartOfAccounts.code,
            ChartOfAccounts.name,
            ChartOfAccounts.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("total_debit"),
            func.coalesce(func.sum(JournalEntryLine.credit_amount), 0).label("total_credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccounts.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_id)
        .where(and_(*conditions))
        .group_by(ChartOfAccounts.id, ChartOfAccounts.code, ChartOfAccounts.name, ChartOfAccounts.account_type)
        .order_by(ChartOfAccounts.code)
    )

    result = await db.execute(query)
    rows = result.all()

    trial_rows = []
    grand_debit = 0.0
    grand_credit = 0.0

    for row in rows:
        total_debit = float(row.total_debit)
        total_credit = float(row.total_credit)
        balance = total_debit - total_credit
        grand_debit += total_debit
        grand_credit += total_credit

        trial_rows.append({
            "account_id": str(row.id),
            "account_code": row.code,
            "account_name": row.name,
            "account_type": row.account_type,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "balance": balance,
        })

    return {
        "rows": trial_rows,
        "total_debit": grand_debit,
        "total_credit": grand_credit,
        "start_date": start_date,
        "end_date": end_date,
    }


async def get_income_statement(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    fiscal_year_id: Optional[uuid.UUID] = None,
) -> dict:
    """손익계산서 — 수익(revenue) - 비용(expense) = 당기순이익"""
    conditions = [
        JournalEntry.status.in_(["posted", "closed"]),
        ChartOfAccounts.account_type.in_(["revenue", "expense"]),
    ]
    if start_date:
        conditions.append(JournalEntry.entry_date >= start_date)
    if end_date:
        conditions.append(JournalEntry.entry_date <= end_date)
    if fiscal_year_id:
        conditions.append(JournalEntry.fiscal_year_id == fiscal_year_id)

    query = (
        select(
            ChartOfAccounts.id,
            ChartOfAccounts.code,
            ChartOfAccounts.name,
            ChartOfAccounts.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("total_debit"),
            func.coalesce(func.sum(JournalEntryLine.credit_amount), 0).label("total_credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccounts.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_id)
        .where(and_(*conditions))
        .group_by(ChartOfAccounts.id, ChartOfAccounts.code, ChartOfAccounts.name, ChartOfAccounts.account_type)
        .order_by(ChartOfAccounts.code)
    )

    result = await db.execute(query)
    rows = result.all()

    revenue_items = []
    expense_items = []
    total_revenue = 0.0
    total_expense = 0.0

    for row in rows:
        debit = float(row.total_debit)
        credit = float(row.total_credit)

        if row.account_type == "revenue":
            # 수익은 대변이 정상 → 대변 - 차변 = 순액
            amount = credit - debit
            total_revenue += amount
            revenue_items.append({
                "account_id": str(row.id),
                "account_code": row.code,
                "account_name": row.name,
                "amount": amount,
            })
        else:
            # 비용은 차변이 정상 → 차변 - 대변 = 순액
            amount = debit - credit
            total_expense += amount
            expense_items.append({
                "account_id": str(row.id),
                "account_code": row.code,
                "account_name": row.name,
                "amount": amount,
            })

    return {
        "revenue_items": revenue_items,
        "expense_items": expense_items,
        "total_revenue": total_revenue,
        "total_expense": total_expense,
        "net_income": total_revenue - total_expense,
        "start_date": start_date,
        "end_date": end_date,
    }


async def get_balance_sheet(
    db: AsyncSession,
    as_of_date: Optional[date] = None,
    fiscal_year_id: Optional[uuid.UUID] = None,
) -> dict:
    """재무상태표 — 자산 = 부채 + 자본 + 당기순이익"""
    conditions = [
        JournalEntry.status.in_(["posted", "closed"]),
    ]
    if as_of_date:
        conditions.append(JournalEntry.entry_date <= as_of_date)
    if fiscal_year_id:
        conditions.append(JournalEntry.fiscal_year_id == fiscal_year_id)

    query = (
        select(
            ChartOfAccounts.id,
            ChartOfAccounts.code,
            ChartOfAccounts.name,
            ChartOfAccounts.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit_amount), 0).label("total_debit"),
            func.coalesce(func.sum(JournalEntryLine.credit_amount), 0).label("total_credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccounts.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_id)
        .where(and_(*conditions))
        .group_by(ChartOfAccounts.id, ChartOfAccounts.code, ChartOfAccounts.name, ChartOfAccounts.account_type)
        .order_by(ChartOfAccounts.code)
    )

    result = await db.execute(query)
    rows = result.all()

    asset_items = []
    liability_items = []
    equity_items = []
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0
    total_revenue = 0.0
    total_expense = 0.0

    for row in rows:
        debit = float(row.total_debit)
        credit = float(row.total_credit)
        item = {
            "account_id": str(row.id),
            "account_code": row.code,
            "account_name": row.name,
        }

        if row.account_type == "asset":
            amount = debit - credit  # 자산: 차변 정상
            item["amount"] = amount
            total_assets += amount
            asset_items.append(item)
        elif row.account_type == "liability":
            amount = credit - debit  # 부채: 대변 정상
            item["amount"] = amount
            total_liabilities += amount
            liability_items.append(item)
        elif row.account_type == "equity":
            amount = credit - debit  # 자본: 대변 정상
            item["amount"] = amount
            total_equity += amount
            equity_items.append(item)
        elif row.account_type == "revenue":
            total_revenue += credit - debit
        elif row.account_type == "expense":
            total_expense += debit - credit

    net_income = total_revenue - total_expense

    return {
        "asset_items": asset_items,
        "liability_items": liability_items,
        "equity_items": equity_items,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "net_income": net_income,
        "as_of_date": as_of_date,
    }


async def close_period(
    db: AsyncSession,
    fiscal_year_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
) -> FiscalYear:
    """기간 마감 — 미결 전표 확인 후 마감 처리"""
    # 회계연도 조회
    result = await db.execute(
        select(FiscalYear).where(FiscalYear.id == fiscal_year_id)
    )
    fiscal_year = result.scalar_one_or_none()
    if not fiscal_year:
        raise HTTPException(404, "회계연도를 찾을 수 없습니다")
    if fiscal_year.is_closed:
        raise HTTPException(400, "이미 마감된 회계연도입니다")

    # 미결 전표 확인 (draft, review, approved 상태)
    pending_count = (await db.execute(
        select(func.count()).where(
            JournalEntry.fiscal_year_id == fiscal_year_id,
            JournalEntry.status.in_(["draft", "review", "approved"]),
        )
    )).scalar() or 0

    if pending_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"미결 전표 {pending_count}건이 있습니다. 모든 전표를 전기하거나 삭제한 후 마감하세요.",
        )

    # posted 전표를 closed로 변경
    from sqlalchemy import update
    await db.execute(
        update(JournalEntry)
        .where(
            JournalEntry.fiscal_year_id == fiscal_year_id,
            JournalEntry.status == "posted",
        )
        .values(status="closed")
    )

    # 회계연도 마감
    fiscal_year.is_closed = True
    fiscal_year.closed_by = current_user.id
    fiscal_year.closed_at = datetime.utcnow()
    await db.flush()

    await log_action(
        db=db,
        table_name="fiscal_years",
        record_id=fiscal_year.id,
        action="UPDATE",
        changed_by=current_user.id,
        old_values={"is_closed": False},
        new_values={"is_closed": True},
        ip_address=ip_address,
        memo=f"{fiscal_year.year}년 기간 마감",
    )

    return fiscal_year


async def reopen_period(
    db: AsyncSession,
    fiscal_year_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
) -> FiscalYear:
    """기간 마감 취소 (관리자 전용)"""
    result = await db.execute(
        select(FiscalYear).where(FiscalYear.id == fiscal_year_id)
    )
    fiscal_year = result.scalar_one_or_none()
    if not fiscal_year:
        raise HTTPException(404, "회계연도를 찾을 수 없습니다")
    if not fiscal_year.is_closed:
        raise HTTPException(400, "마감되지 않은 회계연도입니다")

    # closed 전표를 posted로 복원
    from sqlalchemy import update
    await db.execute(
        update(JournalEntry)
        .where(
            JournalEntry.fiscal_year_id == fiscal_year_id,
            JournalEntry.status == "closed",
        )
        .values(status="posted")
    )

    fiscal_year.is_closed = False
    fiscal_year.closed_by = None
    fiscal_year.closed_at = None
    await db.flush()

    await log_action(
        db=db,
        table_name="fiscal_years",
        record_id=fiscal_year.id,
        action="UPDATE",
        changed_by=current_user.id,
        old_values={"is_closed": True},
        new_values={"is_closed": False},
        ip_address=ip_address,
        memo=f"{fiscal_year.year}년 마감 취소",
    )

    return fiscal_year
