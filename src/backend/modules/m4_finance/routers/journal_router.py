"""
M4 재무/회계 — 전표(Journal Entry) API 라우터
CRUD + 상태 워크플로우 (draft → review → approved → posted)
"""
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.journals import (
    JournalCreate, JournalUpdate, JournalResponse,
    JournalListItem, JournalLineResponse, RejectRequest,
)
from ..services import journal_service

router = APIRouter()


# ── 유틸: ORM → Response 변환 ──

def _journal_to_response(journal) -> dict:
    """전표 ORM 객체를 JournalResponse dict로 변환 (라인 포함)"""
    lines = []
    for line in getattr(journal, "lines", []):
        lines.append(
            JournalLineResponse(
                id=str(line.id),
                line_no=line.line_no,
                account_id=str(line.account_id),
                account_code=line.account.code if line.account else None,
                account_name=line.account.name if line.account else None,
                debit_amount=float(line.debit_amount),
                credit_amount=float(line.credit_amount),
                customer_id=str(line.customer_id) if line.customer_id else None,
                customer_name=line.customer.name if getattr(line, "customer", None) else None,
                description=line.description,
                tax_code=line.tax_code,
                tax_amount=float(line.tax_amount) if line.tax_amount else 0,
            ).model_dump(mode="json")
        )

    return JournalResponse(
        id=str(journal.id),
        entry_no=journal.entry_no,
        entry_date=journal.entry_date,
        entry_type=journal.entry_type,
        description=journal.description,
        total_debit=float(journal.total_debit),
        total_credit=float(journal.total_credit),
        status=journal.status,
        source_module=journal.source_module,
        source_id=str(journal.source_id) if journal.source_id else None,
        fiscal_year_id=str(journal.fiscal_year_id) if journal.fiscal_year_id else None,
        approved_by=str(journal.approved_by) if journal.approved_by else None,
        approved_at=journal.approved_at,
        created_at=journal.created_at,
        created_by=str(journal.created_by) if journal.created_by else None,
        lines=lines,
    ).model_dump(mode="json")


def _journal_to_list_item(journal) -> dict:
    """전표 ORM 객체를 JournalListItem dict로 변환 (라인 미포함)"""
    return JournalListItem(
        id=str(journal.id),
        entry_no=journal.entry_no,
        entry_date=journal.entry_date,
        entry_type=journal.entry_type,
        description=journal.description,
        total_debit=float(journal.total_debit),
        total_credit=float(journal.total_credit),
        status=journal.status,
        created_at=journal.created_at,
    ).model_dump(mode="json")


# ── 다음 전표번호 미리보기 (path parameter 라우트보다 위에 배치) ──

@router.get("/next-entry-no", summary="다음 전표번호 미리보기")
async def get_next_entry_no(
    entry_date: date = Query(..., description="전표일자"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """해당 날짜의 다음 전표번호를 미리 조회합니다"""
    entry_no = await journal_service.get_next_entry_no(db, entry_date)
    return success_response(data={"entry_no": entry_no})


# ── CRUD ──

@router.get("", summary="전표 목록")
async def list_journals(
    start_date: Optional[date] = Query(None, description="시작일"),
    end_date: Optional[date] = Query(None, description="종료일"),
    entry_type: Optional[str] = Query(None, description="전표유형"),
    status: Optional[str] = Query(None, description="상태"),
    search: Optional[str] = Query(None, description="전표번호/적요 검색"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("entry_date"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """전표 목록을 조회합니다 (기간/유형/상태 필터)"""
    result = await journal_service.list_journals(
        db, start_date=start_date, end_date=end_date,
        entry_type=entry_type, entry_status=status,
        search=search, page=page, size=size,
        sort_by=sort_by, sort_order=sort_order,
    )
    return success_response(
        data={
            "items": [_journal_to_list_item(j) for j in result["items"]],
            "total": result["total"],
            "page": result["page"],
            "size": result["size"],
            "total_pages": result["total_pages"],
        }
    )


@router.get("/{journal_id}", summary="전표 상세")
async def get_journal(
    journal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """전표 상세 정보를 조회합니다 (분개 라인 포함)"""
    journal = await journal_service.get_journal(db, journal_id)
    return success_response(data=_journal_to_response(journal))


@router.post("", summary="전표 생성")
async def create_journal(
    data: JournalCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """새 전표를 생성합니다 (복식부기 검증 포함)"""
    ip = request.client.host if request.client else None
    journal = await journal_service.create_journal(db, data, current_user, ip)
    return success_response(
        data={"id": str(journal.id), "entry_no": journal.entry_no},
        message=f"전표 {journal.entry_no}이(가) 생성되었습니다",
    )


@router.put("/{journal_id}", summary="전표 수정")
async def update_journal(
    journal_id: uuid.UUID,
    data: JournalUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """전표를 수정합니다 (draft 상태에서만 가능)"""
    ip = request.client.host if request.client else None
    journal = await journal_service.update_journal(
        db, journal_id, data, current_user, ip
    )
    return success_response(
        data={"id": str(journal.id), "entry_no": journal.entry_no},
        message=f"전표 {journal.entry_no}이(가) 수정되었습니다",
    )


@router.delete("/{journal_id}", summary="전표 삭제")
async def delete_journal(
    journal_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """전표를 삭제합니다 (draft 상태에서만 가능, 관리자 전용)"""
    ip = request.client.host if request.client else None
    await journal_service.delete_journal(db, journal_id, current_user, ip)
    return success_response(message="전표가 삭제되었습니다")


# ── 상태 워크플로우 ──

@router.post("/{journal_id}/submit", summary="검토 요청")
async def submit_journal(
    journal_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """전표를 검토 요청합니다 (draft → review)"""
    ip = request.client.host if request.client else None
    journal = await journal_service.submit_journal(db, journal_id, current_user, ip)
    return success_response(
        data={"id": str(journal.id), "status": journal.status},
        message=f"전표 {journal.entry_no}이(가) 검토 요청되었습니다",
    )


@router.post("/{journal_id}/approve", summary="전표 승인")
async def approve_journal(
    journal_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """전표를 승인합니다 (review → approved)"""
    ip = request.client.host if request.client else None
    journal = await journal_service.approve_journal(db, journal_id, current_user, ip)
    return success_response(
        data={"id": str(journal.id), "status": journal.status},
        message=f"전표 {journal.entry_no}이(가) 승인되었습니다",
    )


@router.post("/{journal_id}/post", summary="전기 (회계 반영)")
async def post_journal(
    journal_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """전표를 전기합니다 (approved → posted, 회계에 최종 반영)"""
    ip = request.client.host if request.client else None
    journal = await journal_service.post_journal(db, journal_id, current_user, ip)
    return success_response(
        data={"id": str(journal.id), "status": journal.status},
        message=f"전표 {journal.entry_no}이(가) 전기(회계 반영)되었습니다",
    )


@router.post("/{journal_id}/reject", summary="전표 반려")
async def reject_journal(
    journal_id: uuid.UUID,
    data: RejectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """전표를 반려합니다 (review → draft)"""
    ip = request.client.host if request.client else None
    journal = await journal_service.reject_journal(
        db, journal_id, current_user, data.reason, ip
    )
    return success_response(
        data={"id": str(journal.id), "status": journal.status},
        message=f"전표 {journal.entry_no}이(가) 반려되었습니다",
    )
