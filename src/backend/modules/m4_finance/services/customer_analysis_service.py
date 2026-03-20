"""
M4 재무/회계 — 거래처별 수주/세금계산서/입금 분석 서비스
거래처 선택 → 수주·세금계산서·입금 내역 조회 + 입금 동향 분석(입금 소요일, 성향 분류)
"""
import uuid
import statistics
from datetime import date, datetime
from collections import defaultdict
from typing import Optional

from sqlalchemy import select, func, and_, or_, case, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import (
    TaxInvoice, JournalEntry, JournalEntryLine, ChartOfAccounts,
)
from ...m2_sales.models import SalesOrder, SalesOrderLine
from ...m1_system.models import Customer
from ..schemas.customer_analysis import (
    CustomerAnalysisSummary, OrderItem, InvoiceItem, PaymentItem,
    PaymentTrendItem, PaymentTrendAnalysis, CustomerAnalysisResponse,
    CustomerOption, CustomerRanking,
)


# ── 입금 성향 분류 기준 (일수) ──
GRADE_IMMEDIATE = 7    # 즉시입금: 7일 이내
GRADE_NORMAL = 30      # 정상입금: 30일 이내
GRADE_DELAYED = 60     # 지연입금: 60일 이내
# 60일 초과 또는 미입금 → 미입금경향


def _classify_grade(avg_days: Optional[float], unpaid_ratio: float) -> tuple[str, str]:
    """평균 입금 일수 + 미입금 비율로 성향 분류"""
    if unpaid_ratio > 0.5:
        return "미입금경향", f"미입금 비율 {unpaid_ratio*100:.0f}% — 채권 회수 주의 필요"
    if avg_days is None:
        return "정보없음", "입금 데이터가 없습니다"
    if avg_days <= GRADE_IMMEDIATE:
        return "즉시입금", f"평균 {avg_days:.1f}일 — 매우 우수한 거래처"
    if avg_days <= GRADE_NORMAL:
        return "정상입금", f"평균 {avg_days:.1f}일 — 정상적인 결제 패턴"
    if avg_days <= GRADE_DELAYED:
        return "지연입금", f"평균 {avg_days:.1f}일 — 결제 지연 경향"
    return "미입금경향", f"평균 {avg_days:.1f}일 — 장기 지연, 채권 관리 필요"


async def get_customer_options(db: AsyncSession) -> list[CustomerOption]:
    """거래처 선택 드롭다운용 목록 (활성 거래처만)"""
    stmt = (
        select(Customer)
        .where(Customer.is_active == True)
        .order_by(Customer.name)
    )
    result = await db.execute(stmt)
    customers = result.scalars().all()
    return [
        CustomerOption(
            id=str(c.id),
            code=c.code or "",
            name=c.name,
            business_no=c.business_no or "",
            customer_type=c.customer_type or "",
        )
        for c in customers
    ]


async def get_customer_analysis(
    db: AsyncSession,
    customer_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> CustomerAnalysisResponse:
    """거래처별 수주/세금계산서/입금 전체 분석"""

    cid = uuid.UUID(customer_id)

    # 1) 거래처 기본 정보
    customer = await db.get(Customer, cid)
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(404, "거래처를 찾을 수 없습니다")

    # 2) 수주 내역 조회
    orders = await _get_orders(db, cid, start_date, end_date)

    # 3) 세금계산서 내역 조회 (매출만)
    invoices = await _get_invoices(db, cid, start_date, end_date)

    # 4) 입금 내역 조회 (전표 기반)
    payments = await _get_payments(db, cid, start_date, end_date)

    # 5) 입금 매칭 (세금계산서 ↔ 입금)
    invoice_items, payment_days_list = _match_invoices_to_payments(invoices, payments)

    # 6) 입금 동향 분석
    trend = _analyze_payment_trend(invoice_items, payment_days_list, invoices)

    # 7) 요약 카드 계산
    total_order_amount = sum(o.grand_total for o in orders)
    total_invoice_amount = sum(inv["total_amount"] for inv in invoices)
    total_payment_amount = sum(p["amount"] for p in payments)
    outstanding = total_invoice_amount - total_payment_amount

    summary = CustomerAnalysisSummary(
        customer_id=str(customer.id),
        customer_name=customer.name,
        customer_code=customer.code or "",
        customer_type=customer.customer_type or "",
        business_no=customer.business_no or "",
        total_orders=len(orders),
        total_order_amount=total_order_amount,
        total_invoices=len(invoices),
        total_invoice_amount=total_invoice_amount,
        total_payments=len(payments),
        total_payment_amount=total_payment_amount,
        outstanding_amount=max(outstanding, 0),
        avg_payment_days=trend.avg_days,
        payment_grade=trend.grade,
    )

    # 8) 응답 구성
    payment_items = [
        PaymentItem(
            id=p["id"],
            entry_no=p["entry_no"],
            entry_date=p["entry_date"],
            amount=p["amount"],
            description=p["description"],
            source=p["source"],
        )
        for p in payments
    ]

    return CustomerAnalysisResponse(
        summary=summary,
        orders=orders,
        invoices=invoice_items,
        payments=payment_items,
        trend=trend,
    )


async def _get_orders(
    db: AsyncSession, customer_id: uuid.UUID,
    start_date: Optional[date], end_date: Optional[date],
) -> list[OrderItem]:
    """수주 내역 조회"""
    stmt = (
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.customer_id == customer_id)
        .order_by(desc(SalesOrder.order_date))
    )
    if start_date:
        stmt = stmt.where(SalesOrder.order_date >= start_date)
    if end_date:
        stmt = stmt.where(SalesOrder.order_date <= end_date)

    result = await db.execute(stmt)
    orders = result.scalars().all()

    items = []
    for o in orders:
        # 품목 요약 생성
        line_names = [ln.product_name for ln in (o.lines or []) if ln.product_name]
        if len(line_names) == 0:
            items_summary = ""
        elif len(line_names) == 1:
            items_summary = line_names[0]
        else:
            items_summary = f"{line_names[0]} 외 {len(line_names)-1}건"

        items.append(OrderItem(
            id=str(o.id),
            order_no=o.order_no or "",
            order_date=str(o.order_date) if o.order_date else "",
            delivery_date=str(o.delivery_date) if o.delivery_date else None,
            total_amount=float(o.total_amount or 0),
            tax_amount=float(o.tax_amount or 0),
            grand_total=float(o.grand_total or 0),
            status=o.status or "",
            progress_pct=o.progress_pct or 0,
            items_summary=items_summary,
        ))
    return items


async def _get_invoices(
    db: AsyncSession, customer_id: uuid.UUID,
    start_date: Optional[date], end_date: Optional[date],
) -> list[dict]:
    """세금계산서(매출) 내역 조회 — dict 리스트로 반환 (후에 매칭용)"""
    stmt = (
        select(TaxInvoice)
        .where(
            TaxInvoice.customer_id == customer_id,
            TaxInvoice.invoice_type == "issue",  # 매출 세금계산서만
        )
        .order_by(desc(TaxInvoice.issue_date))
    )
    if start_date:
        stmt = stmt.where(TaxInvoice.issue_date >= start_date)
    if end_date:
        stmt = stmt.where(TaxInvoice.issue_date <= end_date)

    result = await db.execute(stmt)
    invoices = result.scalars().all()

    return [
        {
            "id": str(inv.id),
            "invoice_no": inv.invoice_no or "",
            "invoice_type": inv.invoice_type,
            "issue_date": str(inv.issue_date) if inv.issue_date else "",
            "supply_amount": float(inv.supply_amount or 0),
            "tax_amount": float(inv.tax_amount or 0),
            "total_amount": float(inv.total_amount or 0),
            "status": inv.status or "",
            "issue_date_obj": inv.issue_date,  # 매칭 계산용
        }
        for inv in invoices
    ]


async def _get_payments(
    db: AsyncSession, customer_id: uuid.UUID,
    start_date: Optional[date], end_date: Optional[date],
) -> list[dict]:
    """
    입금 내역 조회 (전표 기반)
    방법: JournalEntryLine에서 customer_id가 일치하고,
          계정과목이 '매출채권'(credit 측) 인 라인 = 입금으로 간주
    또는: 보통예금/현금 계정의 debit 측 (입금) 중 적요에 거래처 관련 내용
    """
    # 매출채권 계정 찾기 (코드 '108' 또는 이름에 '매출채권' 포함)
    acct_stmt = select(ChartOfAccounts.id).where(
        or_(
            ChartOfAccounts.name.contains("매출채권"),
            ChartOfAccounts.code == "108",
        )
    )
    acct_result = await db.execute(acct_stmt)
    ar_account_ids = [row[0] for row in acct_result.all()]

    # 보통예금/현금 계정 찾기 (은행 입금 내역에서 차변으로 기록됨)
    bank_stmt = select(ChartOfAccounts.id).where(
        or_(
            ChartOfAccounts.name.contains("보통예금"),
            ChartOfAccounts.name.contains("현금"),
            ChartOfAccounts.code.in_(["101", "102", "103"]),
        )
    )
    bank_result = await db.execute(bank_stmt)
    bank_account_ids = [row[0] for row in bank_result.all()]

    payments = []

    # 방법 1: 매출채권 대변 (정식 입금 전표)
    if ar_account_ids:
        stmt = (
            select(JournalEntryLine, JournalEntry)
            .join(JournalEntry, JournalEntryLine.journal_id == JournalEntry.id)
            .where(
                JournalEntryLine.customer_id == customer_id,
                JournalEntryLine.account_id.in_(ar_account_ids),
                JournalEntryLine.credit_amount > 0,
            )
            .order_by(desc(JournalEntry.entry_date))
        )
        if start_date:
            stmt = stmt.where(JournalEntry.entry_date >= start_date)
        if end_date:
            stmt = stmt.where(JournalEntry.entry_date <= end_date)

        result = await db.execute(stmt)
        for line, entry in result.all():
            payments.append({
                "id": str(line.id),
                "entry_no": entry.entry_no or "",
                "entry_date": str(entry.entry_date) if entry.entry_date else "",
                "entry_date_obj": entry.entry_date,
                "amount": float(line.credit_amount or 0),
                "description": line.description or entry.description or "",
                "source": "전표",
            })

    # 방법 2: 은행 입금 전표 (은행 임포트 등) — customer_id로 연결된 건
    if bank_account_ids:
        stmt = (
            select(JournalEntryLine, JournalEntry)
            .join(JournalEntry, JournalEntryLine.journal_id == JournalEntry.id)
            .where(
                JournalEntryLine.customer_id == customer_id,
                JournalEntryLine.account_id.in_(bank_account_ids),
                JournalEntryLine.debit_amount > 0,
            )
            .order_by(desc(JournalEntry.entry_date))
        )
        if start_date:
            stmt = stmt.where(JournalEntry.entry_date >= start_date)
        if end_date:
            stmt = stmt.where(JournalEntry.entry_date <= end_date)

        result = await db.execute(stmt)
        seen_ids = {p["id"] for p in payments}
        for line, entry in result.all():
            lid = str(line.id)
            if lid not in seen_ids:
                payments.append({
                    "id": lid,
                    "entry_no": entry.entry_no or "",
                    "entry_date": str(entry.entry_date) if entry.entry_date else "",
                    "entry_date_obj": entry.entry_date,
                    "amount": float(line.debit_amount or 0),
                    "description": line.description or entry.description or "",
                    "source": "은행입금",
                })

    # 날짜 역순 정렬
    payments.sort(key=lambda x: x["entry_date"], reverse=True)
    return payments


def _match_invoices_to_payments(
    invoices: list[dict],
    payments: list[dict],
) -> tuple[list[InvoiceItem], list[int]]:
    """
    세금계산서 ↔ 입금 매칭
    방법: 세금계산서 발행일 이후, 금액이 유사한 입금 건을 매칭
    반환: (InvoiceItem 리스트, 입금소요일 리스트)
    """
    # 입금 내역을 날짜순 정렬 (오래된 것 먼저)
    sorted_payments = sorted(payments, key=lambda x: x["entry_date"])
    used_payment_indices = set()
    payment_days_list = []
    invoice_items = []

    for inv in invoices:
        issue_date = inv.get("issue_date_obj")
        inv_amount = inv["total_amount"]
        matched = False
        days_to_payment = None

        if issue_date:
            # 발행일 이후의 입금 중 금액이 비슷한 것 찾기
            for idx, pay in enumerate(sorted_payments):
                if idx in used_payment_indices:
                    continue
                pay_date = pay.get("entry_date_obj")
                if not pay_date or pay_date < issue_date:
                    continue
                pay_amount = pay["amount"]
                # 금액이 80% ~ 120% 범위 내이면 매칭 (일부 입금 고려)
                if inv_amount > 0 and 0.8 <= pay_amount / inv_amount <= 1.2:
                    used_payment_indices.add(idx)
                    days_to_payment = (pay_date - issue_date).days
                    payment_days_list.append(days_to_payment)
                    matched = True
                    break

        # 매칭 상태 결정
        if matched and days_to_payment is not None:
            payment_status = "입금완료"
        elif issue_date and any(
            p.get("entry_date_obj") and p["entry_date_obj"] >= issue_date
            for i, p in enumerate(sorted_payments) if i not in used_payment_indices
        ):
            payment_status = "부분입금"
        else:
            payment_status = "미입금"

        invoice_items.append(InvoiceItem(
            id=inv["id"],
            invoice_no=inv["invoice_no"],
            invoice_type=inv["invoice_type"],
            issue_date=inv["issue_date"],
            supply_amount=inv["supply_amount"],
            tax_amount=inv["tax_amount"],
            total_amount=inv["total_amount"],
            status=inv["status"],
            payment_status=payment_status,
            days_to_payment=days_to_payment,
        ))

    return invoice_items, payment_days_list


def _analyze_payment_trend(
    invoice_items: list[InvoiceItem],
    payment_days_list: list[int],
    raw_invoices: list[dict],
) -> PaymentTrendAnalysis:
    """입금 동향 분석 — 통계 + 월별 추이 + 성향 분류"""

    # 통계 계산
    avg_days = None
    median_days = None
    min_days = None
    max_days = None

    if payment_days_list:
        avg_days = round(statistics.mean(payment_days_list), 1)
        median_days = round(statistics.median(payment_days_list), 1)
        min_days = min(payment_days_list)
        max_days = max(payment_days_list)

    # 미입금 현황
    unpaid = [inv for inv in invoice_items if inv.payment_status == "미입금"]
    unpaid_count = len(unpaid)
    unpaid_amount = sum(inv.total_amount for inv in unpaid)

    # 미입금 비율
    total_invoices = len(invoice_items)
    unpaid_ratio = unpaid_count / total_invoices if total_invoices > 0 else 0

    # 성향 분류
    grade, grade_desc = _classify_grade(avg_days, unpaid_ratio)

    # 월별 추이 계산
    monthly_invoice = defaultdict(float)
    monthly_payment = defaultdict(float)
    monthly_days = defaultdict(list)

    for inv in invoice_items:
        if inv.issue_date:
            month_key = inv.issue_date[:7]  # YYYY-MM
            monthly_invoice[month_key] += inv.total_amount
            if inv.days_to_payment is not None:
                monthly_days[month_key].append(inv.days_to_payment)
                monthly_payment[month_key] += inv.total_amount

    # 최근 12개월 추이
    all_months = sorted(set(list(monthly_invoice.keys()) + list(monthly_payment.keys())))
    recent_months = all_months[-12:] if len(all_months) > 12 else all_months

    monthly_trend = []
    for m in recent_months:
        avg_d = None
        if monthly_days.get(m):
            avg_d = round(statistics.mean(monthly_days[m]), 1)
        monthly_trend.append(PaymentTrendItem(
            month=m,
            invoice_amount=monthly_invoice.get(m, 0),
            payment_amount=monthly_payment.get(m, 0),
            avg_days=avg_d,
        ))

    return PaymentTrendAnalysis(
        avg_days=avg_days,
        median_days=median_days,
        min_days=min_days,
        max_days=max_days,
        grade=grade,
        grade_description=grade_desc,
        unpaid_invoices=unpaid_count,
        unpaid_amount=unpaid_amount,
        monthly_trend=monthly_trend,
    )


async def get_customer_rankings(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 20,
) -> list[CustomerRanking]:
    """거래처별 랭킹 (매출/미수금/입금 성향 기준)"""

    # 활성 거래처 목록
    cust_stmt = select(Customer).where(Customer.is_active == True).order_by(Customer.name)
    result = await db.execute(cust_stmt)
    customers = result.scalars().all()

    rankings = []
    for cust in customers:
        cid = cust.id

        # 수주 합계
        order_stmt = select(func.coalesce(func.sum(SalesOrder.grand_total), 0)).where(
            SalesOrder.customer_id == cid
        )
        if start_date:
            order_stmt = order_stmt.where(SalesOrder.order_date >= start_date)
        if end_date:
            order_stmt = order_stmt.where(SalesOrder.order_date <= end_date)
        order_total = (await db.execute(order_stmt)).scalar() or 0

        # 세금계산서(매출) 합계
        inv_stmt = select(func.coalesce(func.sum(TaxInvoice.total_amount), 0)).where(
            TaxInvoice.customer_id == cid,
            TaxInvoice.invoice_type == "issue",
        )
        if start_date:
            inv_stmt = inv_stmt.where(TaxInvoice.issue_date >= start_date)
        if end_date:
            inv_stmt = inv_stmt.where(TaxInvoice.issue_date <= end_date)
        inv_total = (await db.execute(inv_stmt)).scalar() or 0

        # 거래 없는 거래처 건너뛰기
        if float(order_total) == 0 and float(inv_total) == 0:
            continue

        # 입금 합계 (매출채권 대변)
        ar_stmt = select(ChartOfAccounts.id).where(
            or_(
                ChartOfAccounts.name.contains("매출채권"),
                ChartOfAccounts.code == "108",
            )
        )
        ar_ids = [r[0] for r in (await db.execute(ar_stmt)).all()]

        pay_total = 0.0
        if ar_ids:
            pay_stmt = (
                select(func.coalesce(func.sum(JournalEntryLine.credit_amount), 0))
                .join(JournalEntry, JournalEntryLine.journal_id == JournalEntry.id)
                .where(
                    JournalEntryLine.customer_id == cid,
                    JournalEntryLine.account_id.in_(ar_ids),
                    JournalEntryLine.credit_amount > 0,
                )
            )
            if start_date:
                pay_stmt = pay_stmt.where(JournalEntry.entry_date >= start_date)
            if end_date:
                pay_stmt = pay_stmt.where(JournalEntry.entry_date <= end_date)
            pay_total = float((await db.execute(pay_stmt)).scalar() or 0)

        outstanding = max(float(inv_total) - pay_total, 0)

        rankings.append(CustomerRanking(
            customer_id=str(cust.id),
            customer_name=cust.name,
            customer_code=cust.code or "",
            total_order_amount=float(order_total),
            total_invoice_amount=float(inv_total),
            total_payment_amount=pay_total,
            outstanding_amount=outstanding,
            avg_payment_days=None,  # 개별 분석에서만 계산
            payment_grade="정보없음",
        ))

    # 매출액 기준 내림차순 정렬
    rankings.sort(key=lambda r: r.total_invoice_amount, reverse=True)
    return rankings[:limit]
