"""
M4 재무/회계 — 세금계산서(Tax Invoice) API 라우터
"""
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.invoices import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    InvoiceListItem, InvoiceSummary,
)
from ..services import invoice_service

router = APIRouter()


def _invoice_to_response(inv) -> dict:
    """세금계산서 ORM → Response dict"""
    return InvoiceResponse(
        id=str(inv.id),
        invoice_no=inv.invoice_no,
        invoice_type=inv.invoice_type,
        issue_date=inv.issue_date,
        customer_id=str(inv.customer_id),
        customer_name=inv.customer.name if getattr(inv, "customer", None) else None,
        supply_amount=float(inv.supply_amount),
        tax_amount=float(inv.tax_amount),
        total_amount=float(inv.total_amount),
        status=inv.status,
        journal_id=str(inv.journal_id) if inv.journal_id else None,
        description=inv.description,
        created_at=inv.created_at,
        created_by=str(inv.created_by) if inv.created_by else None,
    ).model_dump(mode="json")


def _invoice_to_list_item(inv) -> dict:
    """세금계산서 ORM → ListItem dict"""
    return InvoiceListItem(
        id=str(inv.id),
        invoice_no=inv.invoice_no,
        invoice_type=inv.invoice_type,
        issue_date=inv.issue_date,
        customer_name=inv.customer.name if getattr(inv, "customer", None) else None,
        supply_amount=float(inv.supply_amount),
        tax_amount=float(inv.tax_amount),
        total_amount=float(inv.total_amount),
        status=inv.status,
        created_at=inv.created_at,
    ).model_dump(mode="json")


# ── 합계 (path param 라우트보다 위에) ──

@router.get("/summary", summary="기간별 합계 (부가세 신고용)")
async def get_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """기간별 매출/매입 세금계산서 합계를 조회합니다"""
    data = await invoice_service.get_invoice_summary(db, start_date, end_date)
    return success_response(data=data)


# ── CRUD ──

@router.get("", summary="세금계산서 목록")
async def list_invoices(
    invoice_type: Optional[str] = Query(None, description="issue/receive"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """세금계산서 목록을 조회합니다"""
    result = await invoice_service.list_invoices(
        db, invoice_type=invoice_type, start_date=start_date,
        end_date=end_date, invoice_status=status, search=search,
        page=page, size=size,
    )
    return success_response(
        data={
            "items": [_invoice_to_list_item(inv) for inv in result["items"]],
            "total": result["total"],
            "page": result["page"],
            "size": result["size"],
            "total_pages": result["total_pages"],
        }
    )


@router.get("/{invoice_id}", summary="세금계산서 상세")
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """세금계산서 상세 정보를 조회합니다"""
    invoice = await invoice_service.get_invoice(db, invoice_id)
    return success_response(data=_invoice_to_response(invoice))


@router.post("", summary="세금계산서 발행")
async def create_invoice(
    data: InvoiceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """새 세금계산서를 발행합니다 (draft 상태)"""
    ip = request.client.host if request.client else None
    invoice = await invoice_service.create_invoice(db, data, current_user, ip)
    return success_response(
        data={"id": str(invoice.id), "invoice_no": invoice.invoice_no},
        message=f"세금계산서 {invoice.invoice_no}이(가) 발행되었습니다",
    )


@router.put("/{invoice_id}", summary="세금계산서 수정")
async def update_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """세금계산서를 수정합니다 (draft 상태에서만 가능)"""
    ip = request.client.host if request.client else None
    invoice = await invoice_service.update_invoice(
        db, invoice_id, data, current_user, ip
    )
    return success_response(
        data={"id": str(invoice.id), "invoice_no": invoice.invoice_no},
        message=f"세금계산서 {invoice.invoice_no}이(가) 수정되었습니다",
    )


@router.delete("/{invoice_id}", summary="세금계산서 취소")
async def cancel_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """세금계산서를 취소합니다 (관리자 전용)"""
    ip = request.client.host if request.client else None
    invoice = await invoice_service.cancel_invoice(
        db, invoice_id, current_user, ip
    )
    return success_response(
        data={"id": str(invoice.id), "status": invoice.status},
        message=f"세금계산서 {invoice.invoice_no}이(가) 취소되었습니다",
    )


@router.post("/{invoice_id}/confirm", summary="세금계산서 확정")
async def confirm_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """세금계산서를 확정하고 자동 전표를 생성합니다"""
    ip = request.client.host if request.client else None
    invoice = await invoice_service.confirm_invoice(
        db, invoice_id, current_user, ip
    )
    return success_response(
        data={
            "id": str(invoice.id),
            "status": invoice.status,
            "journal_id": str(invoice.journal_id) if invoice.journal_id else None,
        },
        message=f"세금계산서 {invoice.invoice_no}이(가) 확정되었습니다 (자동 전표 생성)",
    )
