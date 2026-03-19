"""
M4 재무/회계 — 세금계산서(Tax Invoice) API 라우터
"""
import uuid
import os
from pathlib import Path
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, UploadFile, File
from fastapi.responses import FileResponse as FastFileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
    d = InvoiceListItem(
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
    # 첨부파일 정보 추가
    d["file_original_name"] = getattr(inv, "file_original_name", None)
    d["has_file"] = bool(getattr(inv, "file_path", None))
    return d


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


# ── 파일 첨부 (매입 세금계산서) ──

UPLOAD_DIR = Path(__file__).resolve().parents[4] / "uploads" / "invoices"


@router.post("/{invoice_id}/upload", summary="세금계산서 파일 첨부")
async def upload_invoice_file(
    invoice_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """매입 세금계산서에 PDF/이미지 파일을 첨부합니다"""
    from ..models import TaxInvoice
    result = await db.execute(select(TaxInvoice).where(TaxInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="세금계산서를 찾을 수 없습니다")

    # 파일 저장
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "file").suffix or ".pdf"
    saved_name = f"{invoice_id}{ext}"
    save_path = UPLOAD_DIR / saved_name

    content = await file.read()
    save_path.write_bytes(content)

    # DB 업데이트
    invoice.file_path = str(save_path)
    invoice.file_original_name = file.filename
    await db.commit()

    return success_response(
        data={"file_name": file.filename},
        message="파일이 첨부되었습니다",
    )


@router.get("/{invoice_id}/file", summary="세금계산서 첨부파일 다운로드")
async def download_invoice_file(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """세금계산서 첨부파일을 다운로드합니다"""
    from ..models import TaxInvoice
    from fastapi import HTTPException
    result = await db.execute(select(TaxInvoice).where(TaxInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice or not invoice.file_path:
        raise HTTPException(status_code=404, detail="첨부파일이 없습니다")

    file_path = Path(invoice.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 서버에서 삭제되었습니다")

    from urllib.parse import quote
    encoded = quote(invoice.file_original_name or "file.pdf")
    return FastFileResponse(
        path=str(file_path),
        filename=invoice.file_original_name or "file.pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


@router.delete("/{invoice_id}/file", summary="세금계산서 첨부파일 삭제")
async def delete_invoice_file(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """세금계산서 첨부파일을 삭제합니다"""
    from ..models import TaxInvoice
    from fastapi import HTTPException
    result = await db.execute(select(TaxInvoice).where(TaxInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="세금계산서를 찾을 수 없습니다")

    if invoice.file_path:
        file_path = Path(invoice.file_path)
        if file_path.exists():
            file_path.unlink()
        invoice.file_path = None
        invoice.file_original_name = None
        await db.commit()

    return success_response(message="첨부파일이 삭제되었습니다")
