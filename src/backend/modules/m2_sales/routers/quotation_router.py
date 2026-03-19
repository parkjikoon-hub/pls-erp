"""
M2 영업/수주 — 견적서 API 라우터
"""
import io
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.quotations import QuotationCreate, QuotationUpdate
from ..services import quotation_service

router = APIRouter()


@router.get("", summary="견적서 목록")
async def list_quotations(
    customer_id: Optional[str] = Query(None, description="거래처 ID 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """견적서 목록을 조회합니다"""
    data = await quotation_service.list_quotations(
        db, customer_id=customer_id, status_filter=status,
        search=search, page=page, size=size,
    )
    return success_response(data=data)


@router.get("/{quotation_id}", summary="견적서 상세")
async def get_quotation(
    quotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """견적서 상세 정보를 조회합니다 (라인 포함)"""
    data = await quotation_service.get_quotation(db, quotation_id)
    return success_response(data=data)


@router.post("", summary="견적서 생성")
async def create_quotation(
    data: QuotationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """새 견적서를 생성합니다"""
    ip = request.client.host if request.client else None
    result = await quotation_service.create_quotation(db, data, current_user, ip)
    return success_response(data=result, message=f"견적서 {result['quote_no']}이(가) 생성되었습니다")


@router.put("/{quotation_id}", summary="견적서 수정")
async def update_quotation(
    quotation_id: uuid.UUID,
    data: QuotationUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """견적서를 수정합니다 (draft 상태만)"""
    ip = request.client.host if request.client else None
    result = await quotation_service.update_quotation(db, quotation_id, data, current_user, ip)
    return success_response(data=result, message=f"견적서 {result['quote_no']}이(가) 수정되었습니다")


@router.delete("/{quotation_id}", summary="견적서 삭제")
async def delete_quotation(
    quotation_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """견적서를 삭제합니다 (draft 상태만)"""
    ip = request.client.host if request.client else None
    result = await quotation_service.delete_quotation(db, quotation_id, current_user, ip)
    return success_response(data=result, message=result["message"])


@router.patch("/{quotation_id}/status", summary="견적서 상태 변경")
async def update_quotation_status(
    quotation_id: uuid.UUID,
    new_status: str = Query(..., description="변경할 상태 (sent/accepted/rejected)"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """견적서 상태를 변경합니다 (draft→sent→accepted/rejected)"""
    ip = request.client.host if request.client else None
    result = await quotation_service.update_quotation_status(
        db, quotation_id, new_status, current_user, ip,
    )
    return success_response(data=result, message=f"견적서 상태가 '{new_status}'(으)로 변경되었습니다")


@router.get("/{quotation_id}/download-excel", summary="견적서 Excel 다운로드")
async def download_quotation_excel(
    quotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """견적서를 한국 표준 양식 Excel로 다운로드합니다"""
    import logging
    _log = logging.getLogger(__name__)
    try:
        content = await quotation_service.generate_quotation_excel(db, quotation_id)
    except Exception as e:
        _log.error(f"견적서 Excel 생성 실패: {e}", exc_info=True)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Excel 생성 실패: {str(e)}")
    from urllib.parse import quote
    filename = f"견적서_{quotation_id}.xlsx"
    encoded = quote(filename)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )
