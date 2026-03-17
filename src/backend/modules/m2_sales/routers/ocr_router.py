"""
M2 영업/수주 — 발주서 OCR API 라우터
PDF/이미지 업로드 → AI OCR → 수주 데이터 추출 → 사용자 검토 후 확정
"""
from fastapi import APIRouter, Depends, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user
from ....shared.response import success_response
from ..services.ocr_service import extract_order_from_pdf
from ..services import order_service
from ..schemas.orders import SalesOrderCreate

router = APIRouter()

# 허용 파일 형식
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload", summary="발주서 OCR 업로드")
async def upload_and_extract(
    file: UploadFile = File(..., description="발주서 PDF 또는 이미지 파일"),
    current_user=Depends(get_current_user),
):
    """
    발주서 PDF/이미지를 업로드하면 AI가 내용을 읽어 수주 데이터로 변환합니다.
    결과는 사용자가 검토/수정 후 /confirm 엔드포인트로 확정합니다.
    """
    # 파일 형식 검증
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return success_response({
            "success": False,
            "message": f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)} 만 가능)",
        })

    # 파일 크기 검증
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        return success_response({
            "success": False,
            "message": f"파일 크기가 {MAX_FILE_SIZE // (1024*1024)}MB를 초과했습니다.",
        })

    # AI OCR 실행
    result = await extract_order_from_pdf(file_bytes, file.filename or "document.pdf")
    return success_response(result)


@router.post("/confirm", summary="OCR 결과 확정 → 수주 생성")
async def confirm_ocr_result(
    data: SalesOrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    사용자가 OCR 추출 결과를 검토/수정한 후 확정하면 수주를 자동 생성합니다.
    SalesOrderCreate 스키마와 동일한 형식을 사용합니다.
    """
    ip = request.client.host if request.client else None
    result = await order_service.create_order(db, data, current_user, ip)
    await db.commit()
    return success_response(result)
