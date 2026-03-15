"""M5 생산/SCM — 라우터 모음"""
from fastapi import APIRouter
from .bom_router import router as bom_router
from .inventory_router import router as inventory_router
from .work_order_router import router as work_order_router
from .qc_router import router as qc_router
from .shipment_router import router as shipment_router

router = APIRouter()
router.include_router(bom_router, prefix="/bom", tags=["BOM 관리"])
router.include_router(inventory_router, tags=["재고 관리"])
router.include_router(work_order_router, prefix="/work-orders", tags=["작업지시서"])
router.include_router(qc_router, prefix="/qc", tags=["QC 검사"])
router.include_router(shipment_router, prefix="/shipments", tags=["출하 관리"])
