"""
M2 영업 — 판매가 관리 API
"""
import uuid
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File
from fastapi.responses import StreamingResponse
import io

from ....auth.dependencies import get_current_user, require_role
from ....database import get_db
from ..schemas.price_lists import PriceListCreate, PriceListUpdate
from ..services import price_list_service

router = APIRouter()


# ── 판매가 목록 조회 ──

@router.get("", summary="판매가 목록 조회")
async def list_price_lists(
    customer_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """거래처별 판매가 목록 (필터: 거래처, 품목, 검색어)"""
    return await price_list_service.list_price_lists(
        db, customer_id=customer_id, product_id=product_id,
        search=search, page=page, size=size,
    )


# ── 판매가 단건 등록 ──

@router.post("", summary="판매가 등록")
async def create_price_list(
    data: PriceListCreate,
    request: Request,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """거래처별 특별 단가 등록"""
    result = await price_list_service.create_price_list(
        db, data, current_user, ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


# ── 판매가 수정 ──

@router.put("/{price_list_id}", summary="판매가 수정")
async def update_price_list(
    price_list_id: uuid.UUID,
    data: PriceListUpdate,
    request: Request,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """거래처별 특별 단가 수정"""
    result = await price_list_service.update_price_list(
        db, price_list_id, data, current_user,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


# ── 판매가 삭제 ──

@router.delete("/{price_list_id}", summary="판매가 삭제")
async def delete_price_list(
    price_list_id: uuid.UUID,
    request: Request,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """거래처별 특별 단가 삭제 (논리 삭제)"""
    result = await price_list_service.delete_price_list(
        db, price_list_id, current_user,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return result


# ── 가격 조회 (견적서 작성 시 사용) ──

@router.get("/lookup", summary="품목 가격 조회")
async def lookup_price(
    customer_id: str = Query(..., description="거래처 UUID"),
    product_id: str = Query(..., description="품목 UUID"),
    ref_date: Optional[date] = Query(None, description="기준일 (기본: 오늘)"),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    품목 가격 조회 — 우선순위 적용
    1순위: 거래처별 특별단가 → 2순위: 기본 판매가 → 3순위: 0
    """
    return await price_list_service.get_price(
        db, uuid.UUID(customer_id), uuid.UUID(product_id), ref_date,
    )


# ── 거래처 기준 전체 품목 가격 조회 ──

@router.get("/customer/{customer_id}", summary="거래처 품목별 가격 목록")
async def get_customer_prices(
    customer_id: uuid.UUID,
    ref_date: Optional[date] = Query(None),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """거래처 기준 모든 품목 가격 (특별단가 > 기본가 우선순위 적용)"""
    return await price_list_service.get_customer_prices(db, customer_id, ref_date)


# ── 엑셀 업로드: 기본 판매가 ──

@router.post("/upload-standard", summary="기본 판매가 엑셀 업로드")
async def upload_standard_prices(
    file: UploadFile = File(..., description="엑셀 파일 (.xlsx)"),
    request: Request = None,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """
    기본 판매가 엑셀 업로드 — products.standard_price 일괄 업데이트
    엑셀 형식: [품목코드, 품목명, 판매가]
    """
    content = await file.read()
    result = await price_list_service.upload_standard_prices(
        db, content, current_user,
        ip_address=request.client.host if request and request.client else None,
    )
    await db.commit()
    return result


# ── 엑셀 업로드: 거래처별 특별단가 ──

@router.post("/upload-customer", summary="거래처별 판매가 엑셀 업로드")
async def upload_customer_prices(
    file: UploadFile = File(..., description="엑셀 파일 (.xlsx)"),
    request: Request = None,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """
    거래처별 특별단가 엑셀 업로드 — customer_price_lists upsert
    엑셀 형식: [거래처코드, 품목코드, 판매가, 유효시작일, 유효종료일]
    """
    content = await file.read()
    result = await price_list_service.upload_customer_prices(
        db, content, current_user,
        ip_address=request.client.host if request and request.client else None,
    )
    await db.commit()
    return result


# ── 엑셀 다운로드: 템플릿 ──

@router.get("/download-template", summary="판매가 엑셀 템플릿 다운로드")
async def download_template(
    include_data: bool = Query(False, description="현재 데이터 포함 여부"),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """판매가 엑셀 템플릿 다운로드 (빈 양식 또는 현재 데이터 포함)"""
    content = await price_list_service.download_template(db, include_data)
    filename = "판매가_템플릿.xlsx" if not include_data else "판매가_현재데이터.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
