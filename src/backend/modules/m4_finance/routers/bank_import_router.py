"""
M4 재무/회계 — 은행 입금 내역 임포트 API 라우터
CSV 업로드 → 파싱 → 미리보기 → 전표 자동 생성
"""
from fastapi import APIRouter, Depends, Query, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.bank_import import ConfirmImportRequest, MappingCreate
from ..services import bank_import_service

router = APIRouter()


@router.post("/parse")
async def parse_csv(
    file: UploadFile = File(...),
    bank_code: str = Query("shinhan", description="은행 코드 (shinhan/ibk/kb/woori/hana)"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """CSV 파일 업로드 + 파싱 (미리보기 데이터 반환)"""
    # 파일 크기 제한 (10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(400, "파일 크기는 10MB 이하여야 합니다")

    result = await bank_import_service.parse_bank_csv(
        file_bytes=contents,
        bank_code=bank_code,
        file_name=file.filename or "unknown.csv",
        db=db,
    )
    return success_response(result.model_dump())


@router.post("/confirm")
async def confirm_import(
    data: ConfirmImportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """파싱 결과 확인 후 전표 일괄 생성"""
    ip = request.client.host if request.client else None
    result = await bank_import_service.confirm_import(
        db=db,
        data=data,
        current_user=current_user,
        ip_address=ip,
    )
    return success_response(result)


@router.get("/history")
async def get_history(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """임포트 이력 조회"""
    result = await bank_import_service.get_import_history(db, page, size)
    return success_response(result)


@router.get("/mappings")
async def get_mappings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """적요→계정과목 매핑 규칙 목록"""
    mappings = await bank_import_service.list_mappings(db)
    return success_response([m.model_dump() for m in mappings])


@router.post("/mappings")
async def add_mapping(
    data: MappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """매핑 규칙 추가"""
    result = await bank_import_service.create_mapping(
        db=db,
        keyword=data.keyword,
        account_id=data.account_id,
        priority=data.priority,
        current_user=current_user,
    )
    return success_response(result.model_dump())


@router.delete("/mappings/{mapping_id}")
async def remove_mapping(
    mapping_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """매핑 규칙 삭제"""
    result = await bank_import_service.delete_mapping(db, mapping_id)
    return success_response(result)
