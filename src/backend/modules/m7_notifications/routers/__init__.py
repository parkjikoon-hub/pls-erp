"""M7 알림센터 — 라우터 모음"""
from fastapi import APIRouter

from .notification_router import router as notification_router

router = APIRouter()
router.include_router(notification_router)
