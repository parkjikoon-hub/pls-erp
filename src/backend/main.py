"""
PLS ERP — FastAPI 메인 애플리케이션
모든 모듈 라우터를 등록하고 미들웨어를 설정합니다.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import engine, AsyncSessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 수행 작업"""
    # 시작: M5 창고 시드 데이터
    from .modules.m5_production.seed import seed_warehouses
    async with AsyncSessionLocal() as db:
        await seed_warehouses(db)
        await db.commit()
    yield
    # 종료: DB 연결 정리
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="PLS ERP — AI 통합 ERP REST API",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS 설정 (프론트엔드에서 API 호출 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 헬스체크 엔드포인트 (서버 동작 확인용)
@app.get("/api/health", tags=["시스템"])
async def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# ── 모듈 라우터 등록 (개발 순서에 따라 순차 추가) ──

# Phase 1: M1 시스템 아키텍처 & MDM
from .auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/v1/auth", tags=["인증"])

from .modules.m1_system.router import router as m1_router
app.include_router(m1_router, prefix="/api/v1/system", tags=["M1-시스템"])

from .audit.router import router as audit_router
app.include_router(audit_router, prefix="/api/v1/audit", tags=["감사로그"])

# Phase 2: M4 재무/회계
from .modules.m4_finance.routers import router as m4_router
app.include_router(m4_router, prefix="/api/v1/finance", tags=["M4-재무회계"])

# Phase 3: M3 인사/급여
from .modules.m3_hr.routers import router as m3_router
app.include_router(m3_router, prefix="/api/v1/hr", tags=["M3-인사급여"])

# Phase 4: M2 영업/수주
from .modules.m2_sales.routers import router as m2_router
app.include_router(m2_router, prefix="/api/v1/sales", tags=["M2-영업수주"])

# Phase 5: M5 생산/SCM
from .modules.m5_production.routers import router as m5_router
app.include_router(m5_router, prefix="/api/v1/production", tags=["M5-생산SCM"])

# Phase 6: M6 그룹웨어
from .modules.m6_groupware.routers import router as m6_router
app.include_router(m6_router, prefix="/api/v1/groupware", tags=["M6-그룹웨어"])

# Phase 7: M7 알림 (M1~M6 완료 후 활성화)
# from .modules.m7_notification.router import router as m7_router
# app.include_router(m7_router, prefix="/api/v1/notifications", tags=["M7-알림"])
