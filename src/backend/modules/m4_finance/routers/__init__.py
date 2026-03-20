"""M4 재무/회계 — 라우터 통합"""
from fastapi import APIRouter

from .account_router import router as account_router
from .fiscal_year_router import router as fiscal_year_router
from .journal_router import router as journal_router
from .invoice_router import router as invoice_router
from .closing_router import router as closing_router
from .bank_import_router import router as bank_import_router
from .customer_analysis_router import router as customer_analysis_router
from .bank_realtime_router import router as bank_realtime_router

router = APIRouter()

# 계정과목 CRUD (Step 2-2)
router.include_router(account_router, prefix="/accounts", tags=["M4-계정과목"])
router.include_router(fiscal_year_router, prefix="/fiscal-years", tags=["M4-회계연도"])

# 전표 관리 (Step 2-3)
router.include_router(journal_router, prefix="/journals", tags=["M4-전표"])

# 세금계산서 (Step 2-4)
router.include_router(invoice_router, prefix="/invoices", tags=["M4-세금계산서"])

# 결산/재무제표 (Step 2-5)
router.include_router(closing_router, prefix="/closing", tags=["M4-결산"])

# 은행 입금 내역 임포트
router.include_router(bank_import_router, prefix="/bank-import", tags=["M4-은행임포트"])

# 거래처 분석
router.include_router(customer_analysis_router, prefix="/customer-analysis", tags=["M4-거래처분석"])

# CODEF 은행 실시간 연동
router.include_router(bank_realtime_router, prefix="/bank-realtime", tags=["M4-은행실시간연동"])
