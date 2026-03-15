"""M6 그룹웨어 — 라우터 모음"""
from fastapi import APIRouter

from .template_router import router as template_router
from .approval_router import router as approval_router
from .notice_router import router as notice_router

router = APIRouter()
router.include_router(template_router)
router.include_router(approval_router)
router.include_router(notice_router)
