"""
M5 생산/SCM — QC 검사 서비스
- 검사 등록 + 결과에 따른 자동 재고 이관
- pass: WIP→완제품 + 작업지시서 completed
- fail: WIP→불량품
- rework: 작업지시서 in_progress 복귀
"""
import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import QcInspection, WorkOrder, Warehouse
from ..schemas.qc import QcCreate
from ....audit.service import log_action
from ...m2_sales.models import SalesOrderLine


async def create_inspection(
    db: AsyncSession,
    data: QcCreate,
    current_user,
    ip_address: Optional[str] = None,
):
    """QC 검사 등록 + 결과에 따른 자동 처리"""
    from .inventory_service import transfer_inventory, _get_or_create_inventory
    from ..schemas.inventory import InventoryTransfer

    wo_id = uuid.UUID(data.work_order_id)

    # 작업지시서 조회
    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.product))
        .where(WorkOrder.id == wo_id, WorkOrder.is_deleted.is_(False))
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "작업지시서를 찾을 수 없습니다")
    if wo.status != "qc_wait":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "QC 대기(qc_wait) 상태에서만 검사 가능합니다")

    if data.result not in ("pass", "fail", "rework"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "결과는 pass/fail/rework 중 하나여야 합니다")

    # QC 레코드 생성
    qc = QcInspection(
        work_order_id=wo_id,
        inspected_qty=data.inspected_qty,
        passed_qty=data.passed_qty,
        failed_qty=data.failed_qty,
        result=data.result,
        defect_types=data.defect_types,
        notes=data.notes,
        inspector_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(qc)
    await db.flush()

    # 창고 조회
    wip_wh = await db.execute(
        select(Warehouse).where(Warehouse.zone_type == "wip", Warehouse.is_active.is_(True)).limit(1)
    )
    wip_wh = wip_wh.scalar_one_or_none()

    fin_wh = await db.execute(
        select(Warehouse).where(Warehouse.zone_type == "finished", Warehouse.is_active.is_(True)).limit(1)
    )
    fin_wh = fin_wh.scalar_one_or_none()

    def_wh = await db.execute(
        select(Warehouse).where(Warehouse.zone_type == "defective", Warehouse.is_active.is_(True)).limit(1)
    )
    def_wh = def_wh.scalar_one_or_none()

    if data.result == "pass":
        # 합격: WIP → 완제품 이관
        if wip_wh and fin_wh and data.passed_qty > 0:
            # WIP에 재고가 있으면 이관, 없으면 완제품에 직접 입고
            wip_inv = await _get_or_create_inventory(db, wo.product_id, wip_wh.id)
            if float(wip_inv.quantity) >= data.passed_qty:
                await transfer_inventory(
                    db,
                    InventoryTransfer(
                        product_id=str(wo.product_id),
                        from_warehouse_id=str(wip_wh.id),
                        to_warehouse_id=str(fin_wh.id),
                        quantity=data.passed_qty,
                        notes=f"QC 합격 — {wo.wo_no}",
                    ),
                    current_user, ip_address,
                )
            else:
                # WIP 재고 부족 시 완제품에 직접 입고
                fin_inv = await _get_or_create_inventory(db, wo.product_id, fin_wh.id)
                fin_inv.quantity = float(fin_inv.quantity) + data.passed_qty
                await db.flush()

        # 작업지시서 완료
        wo.status = "completed"
        wo.produced_qty = data.passed_qty
        wo.updated_by = current_user.id

        # 수주 라인 produced_qty 업데이트
        if wo.sales_order_line_id:
            line_result = await db.execute(
                select(SalesOrderLine).where(SalesOrderLine.id == wo.sales_order_line_id)
            )
            sol = line_result.scalar_one_or_none()
            if sol:
                sol.produced_qty = float(sol.produced_qty or 0) + data.passed_qty

    elif data.result == "fail":
        # 불합격: WIP → 불량품 이관
        if wip_wh and def_wh and data.failed_qty > 0:
            wip_inv = await _get_or_create_inventory(db, wo.product_id, wip_wh.id)
            if float(wip_inv.quantity) >= data.failed_qty:
                await transfer_inventory(
                    db,
                    InventoryTransfer(
                        product_id=str(wo.product_id),
                        from_warehouse_id=str(wip_wh.id),
                        to_warehouse_id=str(def_wh.id),
                        quantity=data.failed_qty,
                        notes=f"QC 불합격 — {wo.wo_no}",
                    ),
                    current_user, ip_address,
                )
        # 상태 유지 (qc_wait) — 재검사 가능

    elif data.result == "rework":
        # 재작업: 작업지시서 in_progress 복귀
        wo.status = "in_progress"
        wo.updated_by = current_user.id

    await db.flush()

    await log_action(
        db=db, table_name="qc_inspections", record_id=qc.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"wo_no": wo.wo_no, "result": data.result, "passed": data.passed_qty},
        ip_address=ip_address,
        memo=f"QC {data.result}: {wo.wo_no}",
    )

    return {
        "id": str(qc.id),
        "work_order_id": str(wo_id),
        "wo_no": wo.wo_no,
        "result": data.result,
    }


async def list_inspections(
    db: AsyncSession,
    work_order_id: Optional[str] = None,
    result_filter: Optional[str] = None,
    page: int = 1,
    size: int = 20,
):
    """QC 검사 이력 목록"""
    query = select(QcInspection)

    if work_order_id:
        query = query.where(QcInspection.work_order_id == uuid.UUID(work_order_id))
    if result_filter:
        query = query.where(QcInspection.result == result_filter)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        query
        .options(
            selectinload(QcInspection.work_order).selectinload(WorkOrder.product),
            selectinload(QcInspection.inspector),
        )
        .order_by(QcInspection.inspected_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = (await db.execute(query)).scalars().all()

    return {
        "items": [
            {
                "id": str(qc.id),
                "work_order_id": str(qc.work_order_id),
                "wo_no": qc.work_order.wo_no if qc.work_order else None,
                "product_name": qc.work_order.product.name if qc.work_order and qc.work_order.product else None,
                "inspected_qty": float(qc.inspected_qty),
                "passed_qty": float(qc.passed_qty),
                "failed_qty": float(qc.failed_qty),
                "result": qc.result,
                "defect_types": qc.defect_types,
                "notes": qc.notes,
                "inspector_name": qc.inspector.name if qc.inspector else None,
                "inspected_at": qc.inspected_at,
            }
            for qc in items
        ],
        "total": total,
        "page": page,
        "size": size,
    }
