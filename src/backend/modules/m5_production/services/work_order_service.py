"""
M5 생산/SCM — 작업지시서 서비스
- CRUD + 수주→작업지시서 전환
- 상태 관리 (pending→in_progress→qc_wait→completed)
- 생산 수량 보고
- 원자재 자동 출고 (in_progress 전환 시)
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import WorkOrder, BomHeader, BomLine, Warehouse, Inventory
from ..schemas.work_orders import WorkOrderCreate, WorkOrderUpdate
from ....audit.service import log_action
from ...m1_system.models import Product
from ...m2_sales.models import SalesOrder, SalesOrderLine


async def _generate_wo_no(db: AsyncSession, wo_date: date | None = None) -> str:
    """작업지시번호 자동 생성 (WO-YYYYMM-NNNN)"""
    d = wo_date or date.today()
    prefix = f"WO-{d.strftime('%Y%m')}-"
    result = await db.execute(
        select(func.count())
        .select_from(WorkOrder)
        .where(WorkOrder.wo_no.like(f"{prefix}%"))
    )
    seq = (result.scalar() or 0) + 1
    return f"{prefix}{seq:04d}"


def _calc_progress(produced: float, planned: float) -> int:
    """진행률 계산"""
    if planned <= 0:
        return 0
    return min(100, int(produced / planned * 100))


def _format_wo(wo: WorkOrder) -> dict:
    """WorkOrder → 응답 딕셔너리"""
    return {
        "id": str(wo.id),
        "wo_no": wo.wo_no,
        "order_type": wo.order_type,
        "product_id": str(wo.product_id),
        "product_name": wo.product.name if wo.product else None,
        "product_code": wo.product.code if wo.product else None,
        "bom_id": str(wo.bom_id) if wo.bom_id else None,
        "planned_qty": float(wo.planned_qty),
        "produced_qty": float(wo.produced_qty or 0),
        "progress_pct": _calc_progress(float(wo.produced_qty or 0), float(wo.planned_qty)),
        "status": wo.status,
        "start_date": wo.start_date,
        "due_date": wo.due_date,
        "assigned_to": str(wo.assigned_to) if wo.assigned_to else None,
        "assigned_to_name": wo.assignee.name if wo.assignee else None,
        "order_id": str(wo.order_id) if wo.order_id else None,
        "order_no": wo.sales_order.order_no if wo.sales_order else None,
        "notes": wo.notes,
        "created_at": wo.created_at,
    }


# ── 목록 ──

async def list_work_orders(
    db: AsyncSession,
    status_filter: Optional[str] = None,
    order_type: Optional[str] = None,
    order_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
):
    """작업지시서 목록"""
    query = select(WorkOrder).where(WorkOrder.is_deleted.is_(False))

    if status_filter:
        query = query.where(WorkOrder.status == status_filter)
    if order_type:
        query = query.where(WorkOrder.order_type == order_type)
    if order_id:
        query = query.where(WorkOrder.order_id == order_id)
    if search:
        sf = f"%{search}%"
        query = query.where(or_(
            WorkOrder.wo_no.ilike(sf),
        ))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        query
        .options(
            selectinload(WorkOrder.product),
            selectinload(WorkOrder.assignee),
            selectinload(WorkOrder.sales_order),
        )
        .order_by(WorkOrder.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = (await db.execute(query)).scalars().all()

    return {
        "items": [_format_wo(wo) for wo in items],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 1,
    }


# ── 상세 ──

async def get_work_order(db: AsyncSession, wo_id: uuid.UUID):
    """작업지시서 상세"""
    result = await db.execute(
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.product),
            selectinload(WorkOrder.assignee),
            selectinload(WorkOrder.sales_order),
            selectinload(WorkOrder.bom),
        )
        .where(WorkOrder.id == wo_id, WorkOrder.is_deleted.is_(False))
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "작업지시서를 찾을 수 없습니다")
    return _format_wo(wo)


# ── 생성 (계획생산) ──

async def create_work_order(
    db: AsyncSession,
    data: WorkOrderCreate,
    current_user,
    ip_address: Optional[str] = None,
):
    """계획생산(MTS) 작업지시서 생성"""
    wo_no = await _generate_wo_no(db, data.start_date)
    product_uuid = uuid.UUID(data.product_id)

    # BOM 자동 선택 (지정되지 않으면 활성 BOM 최신 버전)
    bom_id = None
    if data.bom_id:
        bom_id = uuid.UUID(data.bom_id)
    else:
        bom_result = await db.execute(
            select(BomHeader).where(
                BomHeader.product_id == product_uuid,
                BomHeader.is_active.is_(True),
                BomHeader.is_deleted.is_(False),
            ).order_by(BomHeader.version.desc()).limit(1)
        )
        bom = bom_result.scalar_one_or_none()
        if bom:
            bom_id = bom.id

    wo = WorkOrder(
        wo_no=wo_no,
        order_type=data.order_type,
        product_id=product_uuid,
        bom_id=bom_id,
        planned_qty=data.planned_qty,
        start_date=data.start_date,
        due_date=data.due_date,
        assigned_to=uuid.UUID(data.assigned_to) if data.assigned_to else None,
        notes=data.notes,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(wo)
    await db.flush()

    await log_action(
        db=db, table_name="work_orders", record_id=wo.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"wo_no": wo_no, "product_id": data.product_id},
        ip_address=ip_address,
    )

    return {"id": str(wo.id), "wo_no": wo_no}


# ── 수주→작업지시서 전환 ──

async def create_from_order(
    db: AsyncSession,
    order_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
):
    """수주→작업지시서 자동 생성 + 원자재 부족 판단"""
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

    if order.status not in ("confirmed", "in_production"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{order.status}' 상태에서는 작업지시서를 생성할 수 없습니다")

    created_wos = []
    total_requirements: dict = {}

    for line in order.lines:
        if not line.product_id:
            continue

        remaining = float(line.quantity) - float(line.produced_qty or 0)
        if remaining <= 0:
            continue

        # BOM 자동 선택
        bom_result = await db.execute(
            select(BomHeader).where(
                BomHeader.product_id == line.product_id,
                BomHeader.is_active.is_(True),
                BomHeader.is_deleted.is_(False),
            ).order_by(BomHeader.version.desc()).limit(1)
        )
        bom = bom_result.scalar_one_or_none()

        wo_no = await _generate_wo_no(db)
        wo = WorkOrder(
            wo_no=wo_no,
            order_type="make_to_order",
            order_id=order_id,
            sales_order_line_id=line.id,
            product_id=line.product_id,
            bom_id=bom.id if bom else None,
            planned_qty=remaining,
            due_date=line.delivery_date or order.delivery_date or date.today(),
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(wo)
        created_wos.append({"wo_no": wo_no, "product_name": line.product_name, "qty": remaining})

        # BOM 소요량 합산
        if bom:
            children = await _build_tree(db, line.product_id, remaining)
            root_node = {"product_id": str(line.product_id), "children": children}
            _flatten_tree(root_node, total_requirements)

    # 수주 상태 변경
    order.status = "in_production"
    await db.flush()

    # 원자재 부족 판단
    raw_wh = await db.execute(
        select(Warehouse).where(Warehouse.zone_type == "raw", Warehouse.is_active.is_(True))
    )
    raw_wh_ids = [w.id for w in raw_wh.scalars().all()]

    material_shortage = []
    for pid_str, req in total_requirements.items():
        pid = uuid.UUID(pid_str)
        current_qty = 0
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

        needed = req["total_quantity"]
        if needed > current_qty:
            material_shortage.append({
                "product_id": pid_str,
                "product_name": req.get("product_name", ""),
                "product_code": req.get("product_code", ""),
                "required_qty": round(needed, 4),
                "current_qty": current_qty,
                "shortage_qty": round(needed - current_qty, 4),
            })

    await log_action(
        db=db, table_name="work_orders", record_id=order_id,
        action="INSERT", changed_by=current_user.id,
        new_values={"from_order": str(order_id), "count": len(created_wos)},
        ip_address=ip_address,
        memo=f"수주 {order.order_no}에서 작업지시서 {len(created_wos)}건 생성",
    )

    return {
        "order_no": order.order_no,
        "work_orders": created_wos,
        "material_shortage": material_shortage,
        "has_shortage": len(material_shortage) > 0,
    }


# ── 수정 ──

async def update_work_order(
    db: AsyncSession, wo_id: uuid.UUID, data: WorkOrderUpdate,
    current_user, ip_address: Optional[str] = None,
):
    """작업지시서 수정 (pending 상태만)"""
    result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.is_deleted.is_(False))
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "작업지시서를 찾을 수 없습니다")
    if wo.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "대기(pending) 상태에서만 수정 가능합니다")

    if data.planned_qty is not None:
        wo.planned_qty = data.planned_qty
    if data.start_date is not None:
        wo.start_date = data.start_date
    if data.due_date is not None:
        wo.due_date = data.due_date
    if data.assigned_to is not None:
        wo.assigned_to = uuid.UUID(data.assigned_to) if data.assigned_to else None
    if data.bom_id is not None:
        wo.bom_id = uuid.UUID(data.bom_id) if data.bom_id else None
    if data.notes is not None:
        wo.notes = data.notes
    wo.updated_by = current_user.id
    await db.flush()

    await log_action(
        db=db, table_name="work_orders", record_id=wo.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"wo_no": wo.wo_no},
        ip_address=ip_address,
    )

    return {"id": str(wo.id), "wo_no": wo.wo_no}


# ── 상태 변경 ──

async def update_status(
    db: AsyncSession, wo_id: uuid.UUID, new_status: str,
    current_user, ip_address: Optional[str] = None,
):
    """작업지시서 상태 변경 + 원자재 자동 출고 (in_progress 진입 시)"""
    from .inventory_service import issue_inventory
    from ..schemas.inventory import InventoryIssue

    valid_transitions = {
        "pending": ["in_progress"],
        "in_progress": ["qc_wait"],
        "qc_wait": ["completed"],
    }

    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.bom))
        .where(WorkOrder.id == wo_id, WorkOrder.is_deleted.is_(False))
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "작업지시서를 찾을 수 없습니다")

    allowed = valid_transitions.get(wo.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{wo.status}' → '{new_status}' 전환 불가. 허용: {allowed}",
        )

    old_status = wo.status
    wo.status = new_status
    wo.updated_by = current_user.id

    # pending→in_progress: BOM 기반 원자재 자동 출고 (원자재 창고→WIP)
    if old_status == "pending" and new_status == "in_progress":
        wo.start_date = wo.start_date or date.today()
        if wo.bom_id:
            from .bom_service import _build_tree, _flatten_tree

            children = await _build_tree(db, wo.product_id, float(wo.planned_qty))
            requirements: dict = {}
            for child in children:
                _flatten_tree(child, requirements)

            # 원자재 창고 조회
            raw_wh_result = await db.execute(
                select(Warehouse).where(
                    Warehouse.zone_type == "raw", Warehouse.is_active.is_(True)
                ).limit(1)
            )
            raw_wh = raw_wh_result.scalar_one_or_none()

            if raw_wh and requirements:
                for pid_str, req in requirements.items():
                    try:
                        await issue_inventory(
                            db,
                            InventoryIssue(
                                product_id=pid_str,
                                warehouse_id=str(raw_wh.id),
                                quantity=round(req["total_quantity"], 4),
                                notes=f"작업지시서 {wo.wo_no} 원자재 출고",
                                reference_type="work_order",
                                reference_id=str(wo.id),
                            ),
                            current_user,
                            ip_address,
                        )
                    except HTTPException:
                        pass  # 재고 부족해도 상태 전환은 진행

    await db.flush()

    await log_action(
        db=db, table_name="work_orders", record_id=wo.id,
        action="UPDATE", changed_by=current_user.id,
        old_values={"status": old_status},
        new_values={"status": new_status},
        ip_address=ip_address,
        memo=f"상태 변경: {old_status} → {new_status}",
    )

    return {"id": str(wo.id), "wo_no": wo.wo_no, "status": new_status}


# ── 생산 수량 보고 ──

async def update_progress(
    db: AsyncSession, wo_id: uuid.UUID, produced_qty: float,
    current_user, ip_address: Optional[str] = None,
):
    """생산 완료 수량 업데이트"""
    result = await db.execute(
        select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.is_deleted.is_(False))
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "작업지시서를 찾을 수 없습니다")

    if wo.status not in ("in_progress", "qc_wait"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "진행 중 상태에서만 수량 보고 가능합니다")

    wo.produced_qty = produced_qty
    wo.updated_by = current_user.id
    await db.flush()

    progress = _calc_progress(produced_qty, float(wo.planned_qty))

    await log_action(
        db=db, table_name="work_orders", record_id=wo.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"produced_qty": produced_qty, "progress": f"{progress}%"},
        ip_address=ip_address,
    )

    return {"id": str(wo.id), "produced_qty": produced_qty, "progress_pct": progress}
