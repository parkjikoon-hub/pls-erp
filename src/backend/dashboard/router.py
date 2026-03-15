"""
대시보드 API — 메인 화면에 표시할 요약 데이터
거래처 수, 품목 수, 사용자 수, 부서 수, 월별 매출, 제품별 매출 등
"""
from datetime import datetime, timezone
from calendar import monthrange

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, and_

from ..database import get_db
from ..auth.dependencies import get_current_user
from ..modules.m1_system.models import Customer, Product, User, Department
from ..modules.m2_sales.models import SalesOrder, SalesOrderLine
from ..modules.m5_production.models import Inventory

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """대시보드 요약 카드 데이터 (거래처/품목/사용자/부서 수 + 매출 합계)"""
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month

    # 각 테이블의 활성 레코드 수 조회
    customer_count = (await db.execute(
        select(func.count()).select_from(Customer).where(Customer.is_active == True)
    )).scalar() or 0

    product_count = (await db.execute(
        select(func.count()).select_from(Product).where(Product.is_active == True)
    )).scalar() or 0

    user_count = (await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )).scalar() or 0

    dept_count = (await db.execute(
        select(func.count()).select_from(Department).where(Department.is_active == True)
    )).scalar() or 0

    # 이번 달 매출 합계 (수주 기준)
    month_sales = (await db.execute(
        select(func.coalesce(func.sum(SalesOrder.grand_total), 0))
        .where(
            and_(
                extract('year', SalesOrder.order_date) == year,
                extract('month', SalesOrder.order_date) == month,
                SalesOrder.is_active == True,
            )
        )
    )).scalar() or 0

    # 전체 매출 합계
    total_sales = (await db.execute(
        select(func.coalesce(func.sum(SalesOrder.grand_total), 0))
        .where(SalesOrder.is_active == True)
    )).scalar() or 0

    # 진행 중 수주 건수
    active_orders = (await db.execute(
        select(func.count()).select_from(SalesOrder)
        .where(
            and_(
                SalesOrder.is_active == True,
                SalesOrder.status.in_(['confirmed', 'in_production']),
            )
        )
    )).scalar() or 0

    # 재고 품목 수
    inventory_items = (await db.execute(
        select(func.count(func.distinct(Inventory.product_id)))
        .where(Inventory.quantity > 0)
    )).scalar() or 0

    return {
        "cards": {
            "customer_count": customer_count,
            "product_count": product_count,
            "user_count": user_count,
            "dept_count": dept_count,
            "month_sales": float(month_sales),
            "total_sales": float(total_sales),
            "active_orders": active_orders,
            "inventory_items": inventory_items,
        },
        "current_month": f"{year}-{month:02d}",
    }


@router.get("/monthly-sales")
async def monthly_sales(
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """월별 매출 그래프 데이터 (해당 연도 1~12월)"""
    if year is None:
        year = datetime.now(timezone.utc).year

    # 월별 매출 합계
    rows = (await db.execute(
        select(
            extract('month', SalesOrder.order_date).label('month'),
            func.coalesce(func.sum(SalesOrder.grand_total), 0).label('amount'),
            func.count().label('order_count'),
        )
        .where(
            and_(
                extract('year', SalesOrder.order_date) == year,
                SalesOrder.is_active == True,
            )
        )
        .group_by(extract('month', SalesOrder.order_date))
        .order_by(extract('month', SalesOrder.order_date))
    )).all()

    # 1~12월 데이터 채우기 (데이터 없는 달은 0으로)
    month_data = {int(r.month): {"amount": float(r.amount), "order_count": r.order_count} for r in rows}
    result = []
    for m in range(1, 13):
        d = month_data.get(m, {"amount": 0, "order_count": 0})
        result.append({
            "month": m,
            "label": f"{m}월",
            "amount": d["amount"],
            "order_count": d["order_count"],
        })

    return {"year": year, "data": result}


@router.get("/monthly-sales/{month}/products")
async def monthly_product_sales(
    month: int,
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """특정 월의 제품별 매출 상세 (호버/클릭 시 표시)"""
    if year is None:
        year = datetime.now(timezone.utc).year

    # 해당 월의 수주 라인에서 제품별 매출 집계
    rows = (await db.execute(
        select(
            SalesOrderLine.product_name,
            func.sum(SalesOrderLine.amount).label('total_amount'),
            func.sum(SalesOrderLine.quantity).label('total_qty'),
            func.count().label('line_count'),
        )
        .join(SalesOrder, SalesOrderLine.order_id == SalesOrder.id)
        .where(
            and_(
                extract('year', SalesOrder.order_date) == year,
                extract('month', SalesOrder.order_date) == month,
                SalesOrder.is_active == True,
            )
        )
        .group_by(SalesOrderLine.product_name)
        .order_by(func.sum(SalesOrderLine.amount).desc())
        .limit(10)
    )).all()

    products = [
        {
            "product_name": r.product_name,
            "total_amount": float(r.total_amount or 0),
            "total_qty": float(r.total_qty or 0),
            "line_count": r.line_count,
        }
        for r in rows
    ]

    return {
        "year": year,
        "month": month,
        "products": products,
    }
