"""M5 시드 데이터 — 기본 창고 4개"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Warehouse

WAREHOUSES = [
    {"code": "WH-RAW", "name": "원자재 창고", "zone_type": "raw"},
    {"code": "WH-WIP", "name": "생산중(WIP)", "zone_type": "wip"},
    {"code": "WH-FIN", "name": "완제품 창고", "zone_type": "finished"},
    {"code": "WH-DEF", "name": "불량품 창고", "zone_type": "defective"},
]


async def seed_warehouses(db: AsyncSession):
    """기본 창고가 없으면 생성"""
    for wh in WAREHOUSES:
        exists = await db.execute(
            select(Warehouse).where(Warehouse.code == wh["code"])
        )
        if not exists.scalar_one_or_none():
            db.add(Warehouse(**wh))
    await db.flush()
