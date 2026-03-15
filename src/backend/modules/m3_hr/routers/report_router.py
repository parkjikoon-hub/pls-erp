"""
M3 인사/급여 — 보고서 + 국세청 신고파일 API 라우터
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..services import report_service

router = APIRouter()


@router.get("/payslip/{employee_id}", summary="개인 급여명세서")
async def get_payslip(
    employee_id: str,
    year: int = Query(..., description="연도"),
    month: int = Query(..., ge=1, le=12, description="월"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """직원 개인 급여명세서 조회"""
    data = await report_service.get_payslip(db, employee_id, year, month)
    return success_response(data=data)


@router.get("/summary", summary="인사 통계 보고서")
async def get_hr_summary(
    year: int = Query(..., description="연도"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """연간 인사 통계 보고서 (인원/급여/근태 집계)"""
    data = await report_service.get_hr_summary(db, year)
    return success_response(data=data)


@router.get("/tax-filing", summary="국세청 원천세 신고파일 다운로드")
async def download_tax_filing(
    year: int = Query(..., description="연도"),
    month: int = Query(..., ge=1, le=12, description="월"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """
    국세청 원천세 신고용 CSV 파일 다운로드.
    담당자가 이 파일을 홈택스에 수동 업로드하여 신고합니다.
    """
    csv_content = await report_service.generate_tax_filing_csv(db, year, month)

    # BOM 추가 (엑셀에서 한국어 깨짐 방지)
    bom = "\ufeff"
    content = bom + csv_content

    filename = f"원천세신고_{year}년{month:02d}월.csv"
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8-sig",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        },
    )
