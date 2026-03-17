"""
M5 생산/SCM — 재고 관리 서비스
- 창고 CRUD
- 입고/출고/이관/조정
- 이동 이력
- 부족 재고 조회
- 수주 기준 원자재 소요량 사전 조회
"""
import uuid
from typing import Optional

from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import (
    Warehouse, Inventory, InventoryTransaction,
    BomHeader, BomLine,
)
from ..schemas.inventory import (
    InventoryReceive, InventoryIssue, InventoryTransfer, InventoryAdjust,
    WarehouseCreate,
)
from ....audit.service import log_action
from ...m1_system.models import Product
from ...m2_sales.models import SalesOrder, SalesOrderLine


# ── 창고 관리 ──

async def list_warehouses(db: AsyncSession):
    """활성 창고 목록"""
    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.is_active.is_(True))
        .order_by(Warehouse.code)
    )
    items = result.scalars().all()
    return [
        {
            "id": str(w.id), "code": w.code, "name": w.name,
            "zone_type": w.zone_type, "description": w.description,
            "is_active": w.is_active,
        }
        for w in items
    ]


async def create_warehouse(
    db: AsyncSession, data: WarehouseCreate, current_user,
):
    """창고 생성"""
    wh = Warehouse(
        code=data.code, name=data.name,
        zone_type=data.zone_type, description=data.description,
    )
    db.add(wh)
    await db.flush()
    return {"id": str(wh.id), "code": wh.code, "name": wh.name}


# ── 재고 현황 ──

async def list_inventory(
    db: AsyncSession,
    warehouse_id: Optional[str] = None,
    zone_type: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 50,
):
    """재고 현황 조회"""
    query = (
        select(Inventory)
        .join(Product, Inventory.product_id == Product.id)
        .join(Warehouse, Inventory.warehouse_id == Warehouse.id)
        .where(Inventory.quantity > 0)
    )

    if warehouse_id:
        query = query.where(Inventory.warehouse_id == uuid.UUID(warehouse_id))
    if zone_type:
        query = query.where(Warehouse.zone_type == zone_type)
    if search:
        sf = f"%{search}%"
        query = query.where(or_(
            Product.name.ilike(sf),
            Product.code.ilike(sf),
        ))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        query
        .options(selectinload(Inventory.product), selectinload(Inventory.warehouse))
        .order_by(Product.code)
        .offset((page - 1) * size)
        .limit(size)
    )
    items = (await db.execute(query)).scalars().all()

    return {
        "items": [
            {
                "id": str(inv.id),
                "product_id": str(inv.product_id),
                "product_name": inv.product.name if inv.product else None,
                "product_code": inv.product.code if inv.product else None,
                "warehouse_id": str(inv.warehouse_id),
                "warehouse_name": inv.warehouse.name if inv.warehouse else None,
                "zone_type": inv.warehouse.zone_type if inv.warehouse else None,
                "quantity": float(inv.quantity),
                "unit_cost": float(inv.unit_cost or 0),
                "status": inv.status,
                "safety_stock": inv.product.safety_stock if inv.product else 0,
            }
            for inv in items
        ],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 1,
    }


# ── 내부 헬퍼: 재고 레코드 가져오기/생성 ──

async def _get_or_create_inventory(
    db: AsyncSession,
    product_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    status_val: str = "available",
) -> Inventory:
    """재고 레코드 조회 또는 신규 생성"""
    result = await db.execute(
        select(Inventory).where(
            Inventory.product_id == product_id,
            Inventory.warehouse_id == warehouse_id,
            Inventory.status == status_val,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        inv = Inventory(
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity=0,
            status=status_val,
        )
        db.add(inv)
        await db.flush()
    return inv


# ── 입고 ──

async def receive_inventory(
    db: AsyncSession, data: InventoryReceive, current_user,
    ip_address: Optional[str] = None,
):
    """입고 처리 — 재고 증가 + 이력 기록"""
    product_uuid = uuid.UUID(data.product_id)
    warehouse_uuid = uuid.UUID(data.warehouse_id)

    inv = await _get_or_create_inventory(db, product_uuid, warehouse_uuid)
    inv.quantity = float(inv.quantity) + data.quantity
    if data.unit_cost > 0:
        inv.unit_cost = data.unit_cost
    await db.flush()

    # 이력 기록
    tx = InventoryTransaction(
        product_id=product_uuid,
        to_warehouse_id=warehouse_uuid,
        quantity=data.quantity,
        transaction_type="receive",
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(tx)
    await db.flush()

    await log_action(
        db=db, table_name="inventory", record_id=inv.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"action": "receive", "quantity": data.quantity},
        ip_address=ip_address,
    )

    return {"message": f"입고 완료 ({data.quantity}개)", "inventory_id": str(inv.id)}


# ── 출고 ──

async def issue_inventory(
    db: AsyncSession, data: InventoryIssue, current_user,
    ip_address: Optional[str] = None,
):
    """출고 처리 — 재고 차감 + 잔량 검증"""
    product_uuid = uuid.UUID(data.product_id)
    warehouse_uuid = uuid.UUID(data.warehouse_id)

    result = await db.execute(
        select(Inventory).where(
            Inventory.product_id == product_uuid,
            Inventory.warehouse_id == warehouse_uuid,
            Inventory.status == "available",
        )
    )
    inv = result.scalar_one_or_none()
    if not inv or float(inv.quantity) < data.quantity:
        current = float(inv.quantity) if inv else 0
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"재고 부족 (현재: {current}, 요청: {data.quantity})",
        )

    inv.quantity = float(inv.quantity) - data.quantity
    await db.flush()

    tx = InventoryTransaction(
        product_id=product_uuid,
        from_warehouse_id=warehouse_uuid,
        quantity=data.quantity,
        transaction_type="issue",
        reference_type=data.reference_type,
        reference_id=uuid.UUID(data.reference_id) if data.reference_id else None,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(tx)
    await db.flush()

    await log_action(
        db=db, table_name="inventory", record_id=inv.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"action": "issue", "quantity": data.quantity},
        ip_address=ip_address,
    )

    # ── M7 알림: 출고 후 안전재고 미달 시 알림 ──
    try:
        product = await db.get(Product, product_uuid)
        if product and product.safety_stock > 0:
            remaining_qty = float(inv.quantity)
            if remaining_qty < product.safety_stock:
                from ....shared.notification_helper import notify_safety_stock_alert
                await notify_safety_stock_alert(
                    db, product.name, remaining_qty,
                    float(product.safety_stock), product_uuid,
                )
    except Exception:
        pass  # 알림 실패는 무시

    return {"message": f"출고 완료 ({data.quantity}개)", "inventory_id": str(inv.id)}


# ── 이관 ──

async def transfer_inventory(
    db: AsyncSession, data: InventoryTransfer, current_user,
    ip_address: Optional[str] = None,
):
    """창고 간 이관 — 출발 창고 차감 + 도착 창고 증가"""
    product_uuid = uuid.UUID(data.product_id)
    from_wh = uuid.UUID(data.from_warehouse_id)
    to_wh = uuid.UUID(data.to_warehouse_id)

    if from_wh == to_wh:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "출발/도착 창고가 같습니다")

    # 출발 창고 차감
    result = await db.execute(
        select(Inventory).where(
            Inventory.product_id == product_uuid,
            Inventory.warehouse_id == from_wh,
            Inventory.status == "available",
        )
    )
    from_inv = result.scalar_one_or_none()
    if not from_inv or float(from_inv.quantity) < data.quantity:
        current = float(from_inv.quantity) if from_inv else 0
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"출발 창고 재고 부족 (현재: {current}, 요청: {data.quantity})",
        )

    from_inv.quantity = float(from_inv.quantity) - data.quantity

    # 도착 창고 증가
    to_inv = await _get_or_create_inventory(db, product_uuid, to_wh)
    to_inv.quantity = float(to_inv.quantity) + data.quantity
    await db.flush()

    tx = InventoryTransaction(
        product_id=product_uuid,
        from_warehouse_id=from_wh,
        to_warehouse_id=to_wh,
        quantity=data.quantity,
        transaction_type="transfer",
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(tx)
    await db.flush()

    await log_action(
        db=db, table_name="inventory", record_id=from_inv.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"action": "transfer", "quantity": data.quantity},
        ip_address=ip_address,
    )

    return {"message": f"이관 완료 ({data.quantity}개)"}


# ── 조정 ──

async def adjust_inventory(
    db: AsyncSession, data: InventoryAdjust, current_user,
    ip_address: Optional[str] = None,
):
    """재고 조정 — 절대값으로 설정"""
    product_uuid = uuid.UUID(data.product_id)
    warehouse_uuid = uuid.UUID(data.warehouse_id)

    inv = await _get_or_create_inventory(db, product_uuid, warehouse_uuid)
    old_qty = float(inv.quantity)
    inv.quantity = data.new_quantity
    await db.flush()

    diff = data.new_quantity - old_qty
    tx = InventoryTransaction(
        product_id=product_uuid,
        from_warehouse_id=warehouse_uuid if diff < 0 else None,
        to_warehouse_id=warehouse_uuid if diff >= 0 else None,
        quantity=abs(diff),
        transaction_type="adjust",
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(tx)
    await db.flush()

    await log_action(
        db=db, table_name="inventory", record_id=inv.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"quantity": old_qty},
        new_values={"quantity": data.new_quantity, "reason": data.notes},
        ip_address=ip_address,
    )

    return {"message": f"조정 완료 ({old_qty} → {data.new_quantity})"}


# ── 이동 이력 ──

async def list_transactions(
    db: AsyncSession,
    product_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    tx_type: Optional[str] = None,
    page: int = 1,
    size: int = 30,
):
    """재고 이동 이력 조회"""
    query = select(InventoryTransaction)

    if product_id:
        query = query.where(InventoryTransaction.product_id == uuid.UUID(product_id))
    if warehouse_id:
        wh_uuid = uuid.UUID(warehouse_id)
        query = query.where(or_(
            InventoryTransaction.from_warehouse_id == wh_uuid,
            InventoryTransaction.to_warehouse_id == wh_uuid,
        ))
    if tx_type:
        query = query.where(InventoryTransaction.transaction_type == tx_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        query
        .options(
            selectinload(InventoryTransaction.product),
            selectinload(InventoryTransaction.from_warehouse),
            selectinload(InventoryTransaction.to_warehouse),
        )
        .order_by(InventoryTransaction.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = (await db.execute(query)).scalars().all()

    return {
        "items": [
            {
                "id": str(tx.id),
                "product_name": tx.product.name if tx.product else None,
                "product_code": tx.product.code if tx.product else None,
                "from_warehouse": tx.from_warehouse.name if tx.from_warehouse else None,
                "to_warehouse": tx.to_warehouse.name if tx.to_warehouse else None,
                "quantity": float(tx.quantity),
                "transaction_type": tx.transaction_type,
                "reference_type": tx.reference_type,
                "notes": tx.notes,
                "created_at": tx.created_at,
            }
            for tx in items
        ],
        "total": total,
        "page": page,
        "size": size,
    }


# ── 부족 재고 (안전재고 미달) ──

async def get_shortage_list(db: AsyncSession):
    """안전재고 미달 품목 목록 — 원자재 창고 가용재고 vs products.safety_stock"""
    # 원자재 창고 조회
    raw_wh = await db.execute(
        select(Warehouse).where(Warehouse.zone_type == "raw", Warehouse.is_active.is_(True))
    )
    raw_warehouses = raw_wh.scalars().all()
    raw_wh_ids = [w.id for w in raw_warehouses]

    if not raw_wh_ids:
        return []

    # safety_stock > 0 인 품목 조회
    products_result = await db.execute(
        select(Product).where(Product.safety_stock > 0, Product.is_active.is_(True))
    )
    products_with_safety = products_result.scalars().all()

    shortage_items = []
    for prod in products_with_safety:
        # 해당 품목의 원자재 창고 가용 재고 합산
        inv_result = await db.execute(
            select(func.coalesce(func.sum(Inventory.quantity), 0))
            .where(
                Inventory.product_id == prod.id,
                Inventory.warehouse_id.in_(raw_wh_ids),
                Inventory.status == "available",
            )
        )
        current_qty = float(inv_result.scalar() or 0)

        if current_qty < prod.safety_stock:
            shortage_items.append({
                "product_id": str(prod.id),
                "product_name": prod.name,
                "product_code": prod.code,
                "current_qty": current_qty,
                "safety_stock": prod.safety_stock,
                "shortage_qty": round(prod.safety_stock - current_qty, 3),
            })

    return shortage_items


# ── 수주 기준 원자재 소요량 사전 조회 ──

async def check_order_materials(db: AsyncSession, order_id: uuid.UUID):
    """수주서 기준 BOM 전개 → 소요 원자재 vs 현재 재고 비교"""
    from .bom_service import _build_tree, _flatten_tree

    # 수주 조회
    order_result = await db.execute(
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines).selectinload(SalesOrderLine.product))
        .where(SalesOrder.id == order_id)
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "수주를 찾을 수 없습니다")

    # 각 수주 라인별 BOM 전개 → 소요 원자재 합산
    total_requirements: dict = {}
    for line in order.lines:
        if not line.product_id:
            continue

        # 해당 품목의 활성 BOM 트리 전개
        children = await _build_tree(db, line.product_id, float(line.quantity))
        root_node = {
            "product_id": str(line.product_id),
            "children": children,
        }
        _flatten_tree(root_node, total_requirements)

    # 원자재 창고 가용 재고 조회
    raw_wh = await db.execute(
        select(Warehouse).where(Warehouse.zone_type == "raw", Warehouse.is_active.is_(True))
    )
    raw_wh_ids = [w.id for w in raw_wh.scalars().all()]

    results = []
    for pid_str, req in total_requirements.items():
        pid = uuid.UUID(pid_str)
        # 현재 가용 재고
        if raw_wh_ids:
            inv_result = await db.execute(
                select(func.coalesce(func.sum(Inventory.quantity), 0))
                .where(
                    Inventory.product_id == pid,
                    Inventory.warehouse_id.in_(raw_wh_ids),
                    Inventory.status == "available",
                )
            )
            current_qty = float(inv_result.scalar() or 0)
        else:
            current_qty = 0

        # 안전재고
        prod_result = await db.execute(
            select(Product.safety_stock).where(Product.id == pid)
        )
        safety = prod_result.scalar() or 0

        needed = req["total_quantity"]
        shortage = max(0, needed - current_qty)

        results.append({
            "product_id": pid_str,
            "product_name": req.get("product_name", ""),
            "product_code": req.get("product_code", ""),
            "required_qty": round(needed, 4),
            "current_qty": current_qty,
            "safety_stock": safety,
            "shortage_qty": round(shortage, 4),
            "is_shortage": shortage > 0,
        })

    return {
        "order_id": str(order_id),
        "order_no": order.order_no,
        "materials": results,
        "has_shortage": any(r["is_shortage"] for r in results),
    }
