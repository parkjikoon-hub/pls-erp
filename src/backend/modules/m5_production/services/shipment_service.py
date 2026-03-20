"""
M5 생산/SCM — 출하 관리 서비스
출하지시서 CRUD + 수주 기반 자동 생성 + 거래명세서 번호 발행
"""
import uuid
from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy import select, func, and_, case, literal_column, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Shipment, ShipmentLine, Inventory, InventoryTransaction
from ...m2_sales.models import SalesOrder, SalesOrderLine
from ...m1_system.models import Product, Customer
from ..models import Warehouse
from ....audit.service import log_action


async def _generate_shipment_no(db: AsyncSession) -> str:
    """출하번호 자동 생성 (SH-YYYYMM-NNNN)"""
    prefix = f"SH-{date.today().strftime('%Y%m')}-"
    stmt = (
        select(func.count())
        .select_from(Shipment)
        .where(Shipment.shipment_no.like(f"{prefix}%"))
    )
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"


async def _generate_dn_no(db: AsyncSession) -> str:
    """거래명세서 번호 자동 생성 (DN-YYYYMM-NNNN)"""
    prefix = f"DN-{date.today().strftime('%Y%m')}-"
    stmt = (
        select(func.count())
        .select_from(Shipment)
        .where(Shipment.delivery_note_no.like(f"{prefix}%"))
    )
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"


# ── 목록 조회 ──

async def list_shipments(
    db: AsyncSession, *,
    status_filter: str | None = None,
    customer_id: str | None = None,
    order_id: str | None = None,
    search: str | None = None,
    page: int = 1, size: int = 20,
):
    """출하지시서 목록"""
    base = (
        select(Shipment)
        .where(Shipment.is_deleted == False)
        .order_by(Shipment.created_at.desc())
    )
    if status_filter:
        base = base.where(Shipment.status == status_filter)
    if customer_id:
        base = base.where(Shipment.customer_id == uuid.UUID(customer_id))
    if order_id:
        base = base.where(Shipment.order_id == uuid.UUID(order_id))
    if search:
        sf = f"%{search}%"
        base = base.join(Customer, Shipment.customer_id == Customer.id, isouter=True)
        base = base.where(or_(
            Shipment.shipment_no.ilike(sf),
            Customer.name.ilike(sf),
        ))

    # 총 건수
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # 페이징
    stmt = base.offset((page - 1) * size).limit(size)
    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for sh in rows:
        # 거래처명
        cust = await db.get(Customer, sh.customer_id)
        # 수주번호
        order_no = None
        if sh.order_id:
            so = await db.get(SalesOrder, sh.order_id)
            order_no = so.order_no if so else None

        # 라인 수/합계
        line_stmt = select(
            func.count().label("cnt"),
            func.coalesce(func.sum(ShipmentLine.amount), 0).label("total"),
        ).where(ShipmentLine.shipment_id == sh.id)
        line_r = (await db.execute(line_stmt)).first()

        items.append({
            "id": str(sh.id),
            "shipment_no": sh.shipment_no,
            "order_id": str(sh.order_id) if sh.order_id else None,
            "order_no": order_no,
            "customer_id": str(sh.customer_id),
            "customer_name": cust.name if cust else None,
            "shipment_date": sh.shipment_date.isoformat() if sh.shipment_date else None,
            "status": sh.status,
            "carrier_name": sh.carrier_name,
            "tracking_no": sh.tracking_no,
            "delivery_note_no": sh.delivery_note_no,
            "line_count": line_r.cnt if line_r else 0,
            "total_amount": float(line_r.total) if line_r else 0,
            "created_at": sh.created_at.isoformat() if sh.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "size": size}


# ── 상세 조회 ──

async def get_shipment(db: AsyncSession, shipment_id: uuid.UUID):
    """출하지시서 상세"""
    stmt = (
        select(Shipment)
        .options(selectinload(Shipment.lines))
        .where(and_(Shipment.id == shipment_id, Shipment.is_deleted == False))
    )
    sh = (await db.execute(stmt)).scalar_one_or_none()
    if not sh:
        raise HTTPException(404, "출하지시서를 찾을 수 없습니다")

    cust = await db.get(Customer, sh.customer_id)
    order_no = None
    if sh.order_id:
        so = await db.get(SalesOrder, sh.order_id)
        order_no = so.order_no if so else None

    lines = []
    for ln in sh.lines:
        prod = await db.get(Product, ln.product_id)
        wh = await db.get(Warehouse, ln.warehouse_id) if ln.warehouse_id else None
        lines.append({
            "id": str(ln.id),
            "product_id": str(ln.product_id),
            "product_name": prod.name if prod else None,
            "product_code": prod.code if prod else None,
            "order_line_id": str(ln.order_line_id) if ln.order_line_id else None,
            "quantity": float(ln.quantity),
            "unit_price": float(ln.unit_price),
            "amount": float(ln.amount),
            "warehouse_id": str(ln.warehouse_id) if ln.warehouse_id else None,
            "warehouse_name": wh.name if wh else None,
            "line_no": ln.line_no,
        })

    return {
        "id": str(sh.id),
        "shipment_no": sh.shipment_no,
        "order_id": str(sh.order_id) if sh.order_id else None,
        "order_no": order_no,
        "customer_id": str(sh.customer_id),
        "customer_name": cust.name if cust else None,
        "shipment_date": sh.shipment_date.isoformat() if sh.shipment_date else None,
        "status": sh.status,
        "carrier_name": sh.carrier_name,
        "tracking_no": sh.tracking_no,
        "delivery_note_no": sh.delivery_note_no,
        "shipping_address": sh.shipping_address,
        "notes": sh.notes,
        "lines": lines,
        "total_amount": sum(ln["amount"] for ln in lines),
        "line_count": len(lines),
        "created_at": sh.created_at.isoformat() if sh.created_at else None,
    }


# ── 생성 ──

async def create_shipment(db: AsyncSession, data, current_user, ip: str | None = None):
    """출하지시서 수동 생성"""
    shipment_no = await _generate_shipment_no(db)

    sh = Shipment(
        shipment_no=shipment_no,
        order_id=uuid.UUID(data.order_id) if data.order_id else None,
        customer_id=uuid.UUID(data.customer_id),
        shipment_date=date.fromisoformat(data.shipment_date) if data.shipment_date else None,
        carrier_name=data.carrier_name,
        tracking_no=data.tracking_no,
        shipping_address=data.shipping_address,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(sh)
    await db.flush()

    for i, ln_data in enumerate(data.lines, 1):
        amount = ln_data.quantity * ln_data.unit_price
        line = ShipmentLine(
            shipment_id=sh.id,
            product_id=uuid.UUID(ln_data.product_id),
            order_line_id=uuid.UUID(ln_data.order_line_id) if ln_data.order_line_id else None,
            quantity=ln_data.quantity,
            unit_price=ln_data.unit_price,
            amount=amount,
            warehouse_id=uuid.UUID(ln_data.warehouse_id) if ln_data.warehouse_id else None,
            line_no=i,
        )
        db.add(line)

    await db.commit()
    await log_action(
        db=db, table_name="shipments", record_id=sh.id,
        action="CREATE", changed_by=current_user.id, ip_address=ip,
    )

    return await get_shipment(db, sh.id)


# ── 수주 기반 자동 생성 ──

async def create_from_order(db: AsyncSession, order_id: uuid.UUID, current_user, ip: str | None = None):
    """수주서 기반 출하지시서 자동 생성 (완제품 창고에서 출고)"""
    order = await db.get(SalesOrder, order_id)
    if not order:
        raise HTTPException(404, "수주서를 찾을 수 없습니다")

    # 수주 라인 조회
    stmt = select(SalesOrderLine).where(SalesOrderLine.order_id == order_id)
    lines_r = (await db.execute(stmt)).scalars().all()
    if not lines_r:
        raise HTTPException(400, "수주 라인이 없습니다")

    # 완제품 창고 찾기
    wh_stmt = select(Warehouse).where(and_(Warehouse.zone_type == "finished", Warehouse.is_active == True))
    fin_wh = (await db.execute(wh_stmt)).scalar_one_or_none()

    shipment_no = await _generate_shipment_no(db)
    sh = Shipment(
        shipment_no=shipment_no,
        order_id=order_id,
        customer_id=order.customer_id,
        shipping_address=order.shipping_address if hasattr(order, 'shipping_address') else None,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(sh)
    await db.flush()

    for i, sol in enumerate(lines_r, 1):
        line = ShipmentLine(
            shipment_id=sh.id,
            product_id=sol.product_id,
            order_line_id=sol.id,
            quantity=float(sol.quantity),
            unit_price=float(sol.unit_price),
            amount=float(sol.quantity) * float(sol.unit_price),
            warehouse_id=fin_wh.id if fin_wh else None,
            line_no=i,
        )
        db.add(line)

    await db.commit()
    await log_action(
        db=db, table_name="shipments", record_id=sh.id,
        action="CREATE_FROM_ORDER", changed_by=current_user.id, ip_address=ip,
    )

    return await get_shipment(db, sh.id)


# ── 수정 ──

async def update_shipment(db: AsyncSession, shipment_id: uuid.UUID, data, current_user, ip: str | None = None):
    """출하지시서 수정 (pending 상태만)"""
    sh = await db.get(Shipment, shipment_id)
    if not sh or sh.is_deleted:
        raise HTTPException(404, "출하지시서를 찾을 수 없습니다")
    if sh.status != "pending":
        raise HTTPException(400, "대기 상태에서만 수정 가능합니다")

    if data.carrier_name is not None:
        sh.carrier_name = data.carrier_name
    if data.tracking_no is not None:
        sh.tracking_no = data.tracking_no
    if data.shipping_address is not None:
        sh.shipping_address = data.shipping_address
    if data.notes is not None:
        sh.notes = data.notes

    sh.updated_by = current_user.id
    await db.commit()
    await log_action(
        db=db, table_name="shipments", record_id=sh.id,
        action="UPDATE", changed_by=current_user.id, ip_address=ip,
    )

    return await get_shipment(db, sh.id)


# ── 상태 변경 ──

VALID_TRANSITIONS = {
    "pending": ["picked"],
    "picked": ["shipped"],
    "shipped": ["delivered"],
}


async def update_status(
    db: AsyncSession, shipment_id: uuid.UUID,
    new_status: str, current_user, ip: str | None = None,
):
    """출하 상태 변경 (pending → picked → shipped → delivered)"""
    sh = await db.get(Shipment, shipment_id)
    if not sh or sh.is_deleted:
        raise HTTPException(404, "출하지시서를 찾을 수 없습니다")

    allowed = VALID_TRANSITIONS.get(sh.status, [])
    if new_status not in allowed:
        raise HTTPException(400, f"'{sh.status}' → '{new_status}' 전환 불가. 허용: {allowed}")

    # picked → 완제품 창고에서 출고 처리
    if new_status == "picked":
        stmt = (
            select(ShipmentLine)
            .where(ShipmentLine.shipment_id == sh.id)
        )
        lines = (await db.execute(stmt)).scalars().all()
        for ln in lines:
            if not ln.warehouse_id:
                continue
            inv_stmt = select(Inventory).where(and_(
                Inventory.product_id == ln.product_id,
                Inventory.warehouse_id == ln.warehouse_id,
                Inventory.status == "available",
            ))
            inv = (await db.execute(inv_stmt)).scalar_one_or_none()
            if not inv or float(inv.quantity) < float(ln.quantity):
                prod = await db.get(Product, ln.product_id)
                pname = prod.name if prod else "알 수 없음"
                raise HTTPException(400, f"재고 부족: {pname} (필요: {ln.quantity}, 현재: {float(inv.quantity) if inv else 0})")

            inv.quantity = float(inv.quantity) - float(ln.quantity)

            # 이동 이력
            tx = InventoryTransaction(
                product_id=ln.product_id,
                from_warehouse_id=ln.warehouse_id,
                quantity=float(ln.quantity),
                transaction_type="issue",
                reference_type="shipment",
                reference_id=sh.id,
                notes=f"출하 {sh.shipment_no}",
                created_by=current_user.id,
            )
            db.add(tx)

    # shipped → 거래명세서 번호 발행
    if new_status == "shipped":
        if not sh.delivery_note_no:
            sh.delivery_note_no = await _generate_dn_no(db)
        sh.shipment_date = date.today()

    # delivered → 수주 상태 업데이트
    if new_status == "delivered" and sh.order_id:
        order = await db.get(SalesOrder, sh.order_id)
        if order:
            order.status = "delivered"

    sh.status = new_status
    sh.updated_by = current_user.id
    await db.commit()
    await log_action(
        db=db, table_name="shipments", record_id=sh.id,
        action=f"STATUS_{new_status.upper()}", changed_by=current_user.id, ip_address=ip,
    )

    return await get_shipment(db, sh.id)


# ── 거래명세서 데이터 ──

async def get_delivery_note(db: AsyncSession, shipment_id: uuid.UUID):
    """거래명세서 출력용 데이터"""
    data = await get_shipment(db, shipment_id)
    if not data.get("delivery_note_no"):
        raise HTTPException(400, "거래명세서가 아직 발행되지 않았습니다. 출하 후 자동 발행됩니다.")
    return data
