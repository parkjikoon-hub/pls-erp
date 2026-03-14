"""
M1 시스템 아키텍처 & MDM 라우터
거래처 마스터 CRUD + Excel 일괄 업로드 API 엔드포인트를 제공합니다.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...auth.dependencies import get_current_user, require_role
from ...shared.response import success_response, error_response
from ...shared.excel_import import (
    parse_excel_headers, auto_match_columns, import_excel_data,
    ColumnMapping, FIELD_REGISTRY,
)
from .models import User
from .schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from . import service

router = APIRouter()


# ──────────────────────────────────────────────
# 거래처 마스터 CRUD (Step 1-6)
# ──────────────────────────────────────────────

@router.post("/customers", summary="거래처 생성")
async def create_customer(
    data: CustomerCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    """새 거래처를 등록합니다. (관리자/매니저 전용)"""
    ip = request.client.host if request.client else None
    customer = await service.create_customer(db, data, current_user, ip)
    return success_response(
        data=CustomerResponse.model_validate(customer).model_dump(mode="json"),
        message=f"거래처 '{customer.name}'이(가) 등록되었습니다",
    )


@router.get("/customers", summary="거래처 목록 조회")
async def list_customers(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="검색어 (거래처명/사업자번호/코드)"),
    sort_by: str = Query("created_at", description="정렬 기준"),
    sort_order: str = Query("desc", description="정렬 방향 (asc/desc)"),
    customer_type: Optional[str] = Query(None, description="거래처 유형 필터"),
    is_active: Optional[bool] = Query(None, description="활성화 필터"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """거래처 목록을 검색·정렬·페이지네이션하여 조회합니다."""
    result = await service.list_customers(
        db, page=page, size=size, search=search,
        sort_by=sort_by, sort_order=sort_order,
        customer_type=customer_type, is_active=is_active,
    )
    # items 내 모델을 dict로 변환
    result["items"] = [item.model_dump(mode="json") for item in result["items"]]
    return success_response(data=result)


@router.get("/customers/{customer_id}", summary="거래처 상세 조회")
async def get_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """거래처 ID로 상세 정보를 조회합니다."""
    customer = await service.get_customer(db, customer_id)
    return success_response(
        data=CustomerResponse.model_validate(customer).model_dump(mode="json"),
    )


@router.put("/customers/{customer_id}", summary="거래처 수정")
async def update_customer(
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    """거래처 정보를 수정합니다. (관리자/매니저 전용)"""
    ip = request.client.host if request.client else None
    customer = await service.update_customer(db, customer_id, data, current_user, ip)
    return success_response(
        data=CustomerResponse.model_validate(customer).model_dump(mode="json"),
        message=f"거래처 '{customer.name}'이(가) 수정되었습니다",
    )


@router.delete("/customers/{customer_id}", summary="거래처 삭제 (비활성화)")
async def delete_customer(
    customer_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    """거래처를 비활성화합니다. (실제 삭제 아님, 관리자/매니저 전용)"""
    ip = request.client.host if request.client else None
    customer = await service.delete_customer(db, customer_id, current_user, ip)
    return success_response(
        message=f"거래처 '{customer.name}'이(가) 비활성화되었습니다",
    )


# ──────────────────────────────────────────────
# Excel 일괄 업로드 (이카운트 데이터 이관용)
# ──────────────────────────────────────────────

@router.post("/import/analyze", summary="Excel 파일 분석 (컬럼 추출 + 자동 매핑)")
async def analyze_excel(
    file: UploadFile = File(..., description="업로드할 Excel 파일 (.xlsx)"),
    module: str = Form("customers", description="대상 모듈 (customers, products 등)"),
    sheet_name: Optional[str] = Form(None, description="시트명 (미지정 시 첫 번째 시트)"),
    current_user: User = Depends(require_role("admin", "manager")),
):
    """
    Excel 파일을 분석하여 컬럼 목록과 자동 매핑 결과를 반환합니다.
    이카운트에서 다운받은 엑셀의 컬럼명을 자동으로 PLS ERP 필드에 매칭합니다.
    """
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        return error_response("Excel 파일(.xlsx)만 업로드 가능합니다")

    if module not in FIELD_REGISTRY:
        return error_response(f"지원하지 않는 모듈입니다: {module}")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB 제한
        return error_response("파일 크기가 10MB를 초과합니다")

    # 엑셀 헤더 분석
    parsed = parse_excel_headers(file_bytes, sheet_name)

    # 자동 매핑
    mappings = auto_match_columns(parsed["headers"], module)

    # PLS ERP 필드 목록 (프론트에서 드롭다운으로 표시)
    target_fields = [
        {"field_name": f.field_name, "display_name": f.display_name, "required": f.required}
        for f in FIELD_REGISTRY[module]
    ]

    return success_response(data={
        **parsed,
        "mappings": [m.model_dump() for m in mappings],
        "target_fields": target_fields,
        "module": module,
    })


@router.post("/import/preview", summary="Excel 임포트 미리보기 (검증)")
async def preview_import(
    file: UploadFile = File(...),
    module: str = Form("customers"),
    mappings_json: str = Form(..., description="컬럼 매핑 JSON 배열"),
    sheet_name: Optional[str] = Form(None),
    current_user: User = Depends(require_role("admin", "manager")),
):
    """
    매핑 정보를 바탕으로 데이터를 변환하고 검증 결과를 미리보기합니다.
    실제 DB에는 저장하지 않습니다.
    """
    import json

    if module not in FIELD_REGISTRY:
        return error_response(f"지원하지 않는 모듈입니다: {module}")

    file_bytes = await file.read()
    column_mappings = [ColumnMapping(**m) for m in json.loads(mappings_json)]

    valid_rows, error_rows = import_excel_data(file_bytes, module, column_mappings, sheet_name)

    return success_response(data={
        "valid_count": len(valid_rows),
        "error_count": len(error_rows),
        "valid_preview": valid_rows[:10],  # 정상 데이터 미리보기 (최대 10건)
        "errors": error_rows[:20],         # 에러 목록 (최대 20건)
        "total_rows": len(valid_rows) + len(error_rows),
    })


@router.post("/import/execute", summary="Excel 일괄 등록 실행")
async def execute_import(
    file: UploadFile = File(...),
    module: str = Form("customers"),
    mappings_json: str = Form(..., description="컬럼 매핑 JSON 배열"),
    sheet_name: Optional[str] = Form(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    """
    Excel 데이터를 실제 DB에 일괄 등록합니다.
    중복 코드/사업자번호는 건너뛰고 결과를 반환합니다.
    """
    import json

    if module not in FIELD_REGISTRY:
        return error_response(f"지원하지 않는 모듈입니다: {module}")

    file_bytes = await file.read()
    column_mappings = [ColumnMapping(**m) for m in json.loads(mappings_json)]
    ip = request.client.host if request and request.client else None

    valid_rows, error_rows = import_excel_data(file_bytes, module, column_mappings, sheet_name)

    success_count = 0
    skip_count = 0
    import_errors = list(error_rows)  # 기존 검증 에러

    for row_data in valid_rows:
        try:
            if module == "customers":
                # CustomerCreate 스키마로 검증 후 생성
                create_data = CustomerCreate(
                    code=row_data.get("code", ""),
                    name=row_data.get("name", ""),
                    business_no=row_data.get("business_no"),
                    ceo_name=row_data.get("ceo_name"),
                    business_type=row_data.get("business_type"),
                    business_item=row_data.get("business_item"),
                    address=row_data.get("address"),
                    phone=row_data.get("phone"),
                    email=row_data.get("email"),
                    fax=row_data.get("fax"),
                    contact_person=row_data.get("contact_person"),
                    customer_type=row_data.get("customer_type", "both"),
                    credit_limit=float(row_data.get("credit_limit", 0) or 0),
                    payment_terms=int(row_data.get("payment_terms", 30) or 30),
                    bank_name=row_data.get("bank_name"),
                    bank_account=row_data.get("bank_account"),
                    bank_account_name=row_data.get("bank_account_name"),
                )
                await service.create_customer(db, create_data, current_user, ip)
                success_count += 1
            # Phase 2 이후: products, inventory 등 추가
        except Exception as e:
            error_detail = str(e.detail) if hasattr(e, "detail") else str(e)
            # 중복 에러는 건너뛰기
            if "이미 존재" in error_detail or "이미 등록" in error_detail:
                skip_count += 1
                import_errors.append({
                    "row": None,
                    "data": row_data,
                    "errors": [f"건너뜀: {error_detail}"],
                })
            else:
                import_errors.append({
                    "row": None,
                    "data": row_data,
                    "errors": [error_detail],
                })

    return success_response(
        data={
            "success_count": success_count,
            "skip_count": skip_count,
            "error_count": len(import_errors),
            "errors": import_errors[:50],  # 최대 50건
            "total_rows": len(valid_rows) + len(error_rows),
        },
        message=f"{success_count}건 등록 완료, {skip_count}건 건너뜀, {len(import_errors)}건 오류",
    )


# Step 1-7에서 구현 예정: 품목 마스터 CRUD
# Step 1-8에서 구현 예정: 부서/직급/사용자 관리
