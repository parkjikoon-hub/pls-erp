"""M3 인사/급여 — 라우터 통합"""
from fastapi import APIRouter

from .employee_router import router as employee_router
from .attendance_router import router as attendance_router
from .payroll_router import router as payroll_router
from .report_router import router as report_router

router = APIRouter()

# 직원(인사카드) 관리
router.include_router(employee_router, prefix="/employees", tags=["M3-직원"])
# 근태/휴가 관리
router.include_router(attendance_router, prefix="/attendance", tags=["M3-근태"])
# 급여 관리
router.include_router(payroll_router, prefix="/payroll", tags=["M3-급여"])
# 보고서 + 국세청 신고파일
router.include_router(report_router, prefix="/reports", tags=["M3-보고서"])
