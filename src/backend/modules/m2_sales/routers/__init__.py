"""
M2 영업/수주 — 라우터 통합
"""
from fastapi import APIRouter
from .quotation_router import router as quotation_router
from .order_router import router as order_router
from .ocr_router import router as ocr_router
from .price_list_router import router as price_list_router

router = APIRouter()

router.include_router(quotation_router, prefix="/quotations", tags=["M2-견적서"])
router.include_router(order_router, prefix="/orders", tags=["M2-수주"])
router.include_router(ocr_router, prefix="/ocr", tags=["M2-발주서OCR"])
router.include_router(price_list_router, prefix="/price-lists", tags=["M2-판매가"])
