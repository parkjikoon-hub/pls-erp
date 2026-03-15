"""
M4 재무/회계 — 세금계산서(Tax Invoice) 서비스
CRUD + 확정 시 자동 전표 생성 + 기간 합계
"""
import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import TaxInvoice, ChartOfAccounts, JournalEntry, JournalEntryLine
from ..schemas.invoices import InvoiceCreate, InvoiceUpdate
from .fiscal_year_service import get_fiscal_year_by_date
from ....audit.service import log_action


async def generate_invoice_no(
    db: AsyncSession, invoice_type: str, issue_date: date
) -> str:
    """세금계산서 번호 자동 생성 (TI-YYYYMM-NNNN / TR-YYYYMM-NNNN)"""
    prefix_code = "TI" if invoice_type == "issue" else "TR"
    prefix = f"{prefix_code}-{issue_date.strftime('%Y%m')}-"
    result = await db.execute(
        select(func.max(TaxInvoice.invoice_no)).where(
            TaxInvoice.invoice_no.like(f"{prefix}%")
        )
    )
    last_no = result.scalar()
    if last_no:
        seq = int(last_no.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


async def list_invoices(
    db: AsyncSession,
    invoice_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    invoice_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
):
    """세금계산서 목록 조회"""
    query = select(TaxInvoice).options(selectinload(TaxInvoice.customer))

    if invoice_type:
        query = query.where(TaxInvoice.invoice_type == invoice_type)
    if start_date:
        query = query.where(TaxInvoice.issue_date >= start_date)
    if end_date:
        query = query.where(TaxInvoice.issue_date <= end_date)
    if invoice_status:
        query = query.where(TaxInvoice.status == invoice_status)
    if search:
        sf = f"%{search}%"
        query = query.where(
            or_(
                TaxInvoice.invoice_no.ilike(sf),
                TaxInvoice.description.ilike(sf),
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(TaxInvoice.issue_date.desc())
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


async def get_invoice(db: AsyncSession, invoice_id: uuid.UUID) -> TaxInvoice:
    """세금계산서 상세 조회"""
    result = await db.execute(
        select(TaxInvoice)
        .options(selectinload(TaxInvoice.customer))
        .where(TaxInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="세금계산서를 찾을 수 없습니다",
        )
    return invoice


async def create_invoice(
    db: AsyncSession,
    data: InvoiceCreate,
    current_user,
    ip_address: Optional[str] = None,
) -> TaxInvoice:
    """세금계산서 발행 (draft 상태)"""
    # 부가세 자동 계산 (미입력 시 10%)
    tax_amount = data.tax_amount if data.tax_amount is not None else round(data.supply_amount * 0.1, 0)
    total_amount = data.supply_amount + tax_amount

    # 번호 자동 생성
    invoice_no = await generate_invoice_no(db, data.invoice_type, data.issue_date)

    invoice = TaxInvoice(
        invoice_no=invoice_no,
        invoice_type=data.invoice_type,
        issue_date=data.issue_date,
        customer_id=uuid.UUID(data.customer_id),
        supply_amount=data.supply_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        status="draft",
        description=data.description,
        created_by=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    await log_action(
        db=db,
        table_name="tax_invoices",
        record_id=invoice.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values={
            "invoice_no": invoice_no,
            "invoice_type": data.invoice_type,
            "supply_amount": float(data.supply_amount),
            "tax_amount": float(tax_amount),
        },
        ip_address=ip_address,
    )

    return invoice


async def update_invoice(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    current_user,
    ip_address: Optional[str] = None,
) -> TaxInvoice:
    """세금계산서 수정 (draft 상태만)"""
    invoice = await get_invoice(db, invoice_id)

    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{invoice.status}' 상태의 세금계산서는 수정할 수 없습니다",
        )

    update_fields = data.model_dump(exclude_unset=True)

    for field in ["issue_date", "customer_id", "supply_amount", "tax_amount", "description"]:
        if field in update_fields:
            val = update_fields[field]
            if field == "customer_id":
                val = uuid.UUID(val)
            setattr(invoice, field, val)

    # 금액 변경 시 합계 재계산
    if "supply_amount" in update_fields or "tax_amount" in update_fields:
        invoice.total_amount = float(invoice.supply_amount) + float(invoice.tax_amount)

    await db.flush()

    await log_action(
        db=db,
        table_name="tax_invoices",
        record_id=invoice.id,
        action="UPDATE",
        changed_by=current_user.id,
        new_values={"updated_fields": list(update_fields.keys())},
        ip_address=ip_address,
    )

    return invoice


async def cancel_invoice(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
) -> TaxInvoice:
    """세금계산서 취소"""
    invoice = await get_invoice(db, invoice_id)

    if invoice.status == "cancelled":
        raise HTTPException(400, "이미 취소된 세금계산서입니다")

    old_status = invoice.status
    invoice.status = "cancelled"
    await db.flush()

    await log_action(
        db=db,
        table_name="tax_invoices",
        record_id=invoice.id,
        action="UPDATE",
        changed_by=current_user.id,
        old_values={"status": old_status},
        new_values={"status": "cancelled"},
        ip_address=ip_address,
        memo="세금계산서 취소",
    )

    return invoice


async def _find_account_by_code(db: AsyncSession, code: str) -> uuid.UUID:
    """계정코드로 계정과목 ID 조회 (없으면 에러)"""
    result = await db.execute(
        select(ChartOfAccounts.id).where(
            ChartOfAccounts.code == code,
            ChartOfAccounts.is_active == True,  # noqa: E712
        )
    )
    account_id = result.scalar_one_or_none()
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"계정과목 '{code}'을(를) 찾을 수 없습니다. 시드 데이터를 확인하세요.",
        )
    return account_id


async def confirm_invoice(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
) -> TaxInvoice:
    """세금계산서 확정 + 자동 전표 생성

    매출(issue):
      차변: 매출채권(108)     공급가액+부가세
      대변: 상품매출(501)     공급가액
      대변: 부가세예수금(307)  부가세

    매입(receive):
      차변: 매출원가(601)     공급가액
      차변: 부가세대급금(114)  부가세
      대변: 매입채무(301)     공급가액+부가세
    """
    invoice = await get_invoice(db, invoice_id)

    if invoice.status != "draft":
        raise HTTPException(400, "draft 상태에서만 확정할 수 있습니다")

    # 회계기간 확인
    fiscal_year = await get_fiscal_year_by_date(db, invoice.issue_date)
    if fiscal_year.is_closed:
        raise HTTPException(400, "마감된 회계기간에는 세금계산서를 확정할 수 없습니다")

    supply = float(invoice.supply_amount)
    tax = float(invoice.tax_amount)
    total = supply + tax

    # 전표번호 생성 (journal_service 재사용)
    from .journal_service import generate_entry_no
    entry_no = await generate_entry_no(db, invoice.issue_date)

    # 전표 헤더 생성
    journal = JournalEntry(
        entry_no=entry_no,
        entry_date=invoice.issue_date,
        entry_type="sales" if invoice.invoice_type == "issue" else "purchase",
        description=f"세금계산서 {invoice.invoice_no} 자동 전표",
        total_debit=total,
        total_credit=total,
        status="posted",  # 확정 시 바로 전기
        source_module="M4",
        source_id=invoice.id,
        fiscal_year_id=fiscal_year.id,
        created_by=current_user.id,
        approved_by=current_user.id,
        approved_at=datetime.utcnow(),
    )
    db.add(journal)
    await db.flush()

    # 분개 라인 생성
    if invoice.invoice_type == "issue":
        # 매출 세금계산서
        acc_receivable = await _find_account_by_code(db, "108")  # 매출채권
        acc_sales = await _find_account_by_code(db, "501")       # 상품매출
        acc_vat_payable = await _find_account_by_code(db, "307") # 부가세예수금

        lines = [
            JournalEntryLine(
                journal_id=journal.id, line_no=1,
                account_id=acc_receivable,
                debit_amount=total, credit_amount=0,
                customer_id=invoice.customer_id,
                description="매출채권",
            ),
            JournalEntryLine(
                journal_id=journal.id, line_no=2,
                account_id=acc_sales,
                debit_amount=0, credit_amount=supply,
                description="상품매출",
            ),
        ]
        if tax > 0:
            lines.append(
                JournalEntryLine(
                    journal_id=journal.id, line_no=3,
                    account_id=acc_vat_payable,
                    debit_amount=0, credit_amount=tax,
                    description="부가세예수금",
                )
            )
    else:
        # 매입 세금계산서
        acc_cogs = await _find_account_by_code(db, "601")        # 매출원가
        acc_vat_input = await _find_account_by_code(db, "114")   # 부가세대급금
        acc_payable = await _find_account_by_code(db, "301")     # 매입채무

        lines = [
            JournalEntryLine(
                journal_id=journal.id, line_no=1,
                account_id=acc_cogs,
                debit_amount=supply, credit_amount=0,
                description="매출원가(매입)",
            ),
        ]
        if tax > 0:
            lines.append(
                JournalEntryLine(
                    journal_id=journal.id, line_no=2,
                    account_id=acc_vat_input,
                    debit_amount=tax, credit_amount=0,
                    description="부가세대급금",
                )
            )
        lines.append(
            JournalEntryLine(
                journal_id=journal.id, line_no=len(lines) + 1,
                account_id=acc_payable,
                debit_amount=0, credit_amount=total,
                customer_id=invoice.customer_id,
                description="매입채무",
            )
        )

    for line in lines:
        db.add(line)

    # 세금계산서 상태 업데이트
    invoice.status = "confirmed"
    invoice.journal_id = journal.id
    await db.flush()

    await log_action(
        db=db,
        table_name="tax_invoices",
        record_id=invoice.id,
        action="UPDATE",
        changed_by=current_user.id,
        old_values={"status": "draft"},
        new_values={
            "status": "confirmed",
            "journal_id": str(journal.id),
            "journal_entry_no": entry_no,
        },
        ip_address=ip_address,
        memo="세금계산서 확정 + 자동 전표 생성",
    )

    return invoice


async def get_invoice_summary(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[dict]:
    """기간별 세금계산서 합계 (부가세 신고용)"""
    query = select(
        TaxInvoice.invoice_type,
        func.count().label("count"),
        func.sum(TaxInvoice.supply_amount).label("total_supply"),
        func.sum(TaxInvoice.tax_amount).label("total_tax"),
        func.sum(TaxInvoice.total_amount).label("total_amount"),
    ).where(
        TaxInvoice.status != "cancelled"
    ).group_by(TaxInvoice.invoice_type)

    if start_date:
        query = query.where(TaxInvoice.issue_date >= start_date)
    if end_date:
        query = query.where(TaxInvoice.issue_date <= end_date)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "invoice_type": row.invoice_type,
            "count": row.count,
            "total_supply": float(row.total_supply or 0),
            "total_tax": float(row.total_tax or 0),
            "total_amount": float(row.total_amount or 0),
        }
        for row in rows
    ]
