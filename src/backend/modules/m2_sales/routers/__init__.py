"""
M2 영업/수주 — 라우터 통합
"""
from fastapi import APIRouter
from .quotation_router import router as quotation_router
from .order_router import router as order_router

router = APIRouter()

router.include_router(quotation_router, prefix="/quotations", tags=["M2-견적서"])
router.include_router(order_router, prefix="/orders", tags=["M2-수주"])
