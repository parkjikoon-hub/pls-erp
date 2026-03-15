"""
M5 생산/SCM — BOM(자재명세서) 서비스
- BOM CRUD
- 다단계 트리 전개 (재귀)
- 소요 원자재 평탄화
"""
import uuid
from typing import Optional
from collections import defaultdict

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..models import BomHeader, BomLine
from ..schemas.bom import BomCreate, BomUpdate
from ....audit.service import log_action


# ── 내부 헬퍼 ──

async def _next_version(db: AsyncSession, product_id: uuid.UUID) -> int:
    """해당 품목의 다음 BOM 버전 번호"""
    result = await db.execute(
        select(func.max(BomHeader.version))
        .where(BomHeader.product_id == product_id)
    )
    max_ver = result.scalar() or 0
    return max_ver + 1


# ── 목록 조회 ──

async def list_boms(
    db: AsyncSession,
    product_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
):
    """BOM 목록 조회 (소프트 삭제 제외)"""
    query = select(BomHeader).where(BomHeader.is_deleted.is_(False))

    if product_id:
        query = query.where(BomHeader.product_id == uuid.UUID(product_id))

    # 전체 건수
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # 정렬 + 페이지네이션 + 관계 로딩
    query = (
        query
        .options(selectinload(BomHeader.product), selectinload(BomHeader.lines))
        .order_by(BomHeader.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = (await db.execute(query)).scalars().all()

    return {
        "items": [
            {
                "id": str(b.id),
                "product_id": str(b.product_id),
                "product_name": b.product.name if b.product else None,
                "product_code": b.product.code if b.product else None,
                "version": b.version,
                "is_active": b.is_active,
                "line_count": len(b.lines),
                "created_at": b.created_at,
            }
            for b in items
        ],
        "total": total,
        "page": page,
        "size": size,
        "total_pages": (total + size - 1) // size if total > 0 else 1,
    }


# ── 상세 조회 ──

async def get_bom(db: AsyncSession, bom_id: uuid.UUID):
    """BOM 상세 조회 (라인 포함)"""
    result = await db.execute(
        select(BomHeader)
        .options(
            selectinload(BomHeader.product),
            selectinload(BomHeader.lines).selectinload(BomLine.material),
        )
        .where(BomHeader.id == bom_id, BomHeader.is_deleted.is_(False))
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM을 찾을 수 없습니다")

    return {
        "id": str(b.id),
        "product_id": str(b.product_id),
        "product_name": b.product.name if b.product else None,
        "product_code": b.product.code if b.product else None,
        "version": b.version,
        "is_active": b.is_active,
        "lines": [
            {
                "id": str(ln.id),
                "material_id": str(ln.material_id),
                "material_name": ln.material.name if ln.material else None,
                "material_code": ln.material.code if ln.material else None,
                "quantity": float(ln.quantity),
                "unit": ln.unit,
                "scrap_rate": float(ln.scrap_rate or 0),
                "sort_order": ln.sort_order,
            }
            for ln in b.lines
        ],
        "created_at": b.created_at,
    }


# ── 생성 ──

async def create_bom(
    db: AsyncSession,
    data: BomCreate,
    current_user,
    ip_address: Optional[str] = None,
):
    """BOM 생성 + 라인 + 감사 로그"""
    product_uuid = uuid.UUID(data.product_id)

    # 동일 품목+버전 중복 확인
    exists = await db.execute(
        select(BomHeader).where(
            BomHeader.product_id == product_uuid,
            BomHeader.version == data.version,
            BomHeader.is_deleted.is_(False),
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"해당 품목의 버전 {data.version} BOM이 이미 존재합니다",
        )

    bom = BomHeader(
        product_id=product_uuid,
        version=data.version,
        is_active=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(bom)
    await db.flush()

    # 라인 생성
    for idx, line_data in enumerate(data.lines):
        line = BomLine(
            bom_id=bom.id,
            material_id=uuid.UUID(line_data.material_id),
            quantity=line_data.quantity,
            unit=line_data.unit,
            scrap_rate=line_data.scrap_rate,
            sort_order=line_data.sort_order or idx,
        )
        db.add(line)
    await db.flush()

    await log_action(
        db=db, table_name="bom_headers", record_id=bom.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"product_id": data.product_id, "version": data.version},
        ip_address=ip_address,
    )

    return {"id": str(bom.id), "product_id": data.product_id, "version": data.version}


# ── 수정 ──

async def update_bom(
    db: AsyncSession,
    bom_id: uuid.UUID,
    data: BomUpdate,
    current_user,
    ip_address: Optional[str] = None,
):
    """BOM 수정 (라인 교체 방식)"""
    result = await db.execute(
        select(BomHeader)
        .options(selectinload(BomHeader.lines))
        .where(BomHeader.id == bom_id, BomHeader.is_deleted.is_(False))
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM을 찾을 수 없습니다")

    if data.version is not None:
        b.version = data.version
    if data.is_active is not None:
        b.is_active = data.is_active
    b.updated_by = current_user.id

    # 라인 교체
    if data.lines is not None:
        for old_line in b.lines:
            await db.delete(old_line)
        await db.flush()

        for idx, line_data in enumerate(data.lines):
            line = BomLine(
                bom_id=b.id,
                material_id=uuid.UUID(line_data.material_id),
                quantity=line_data.quantity,
                unit=line_data.unit,
                scrap_rate=line_data.scrap_rate,
                sort_order=line_data.sort_order or idx,
            )
            db.add(line)

    await db.flush()

    await log_action(
        db=db, table_name="bom_headers", record_id=b.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"version": b.version},
        ip_address=ip_address,
    )

    return {"id": str(b.id), "product_id": str(b.product_id), "version": b.version}


# ── 삭제 ──

async def delete_bom(
    db: AsyncSession,
    bom_id: uuid.UUID,
    current_user,
    ip_address: Optional[str] = None,
):
    """BOM 소프트 삭제"""
    result = await db.execute(
        select(BomHeader).where(BomHeader.id == bom_id, BomHeader.is_deleted.is_(False))
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM을 찾을 수 없습니다")

    b.is_deleted = True
    b.updated_by = current_user.id

    await log_action(
        db=db, table_name="bom_headers", record_id=b.id,
        action="DELETE", changed_by=current_user.id,
        old_values={"product_id": str(b.product_id), "version": b.version},
        ip_address=ip_address,
    )

    return {"message": f"BOM (버전 {b.version})이(가) 삭제되었습니다"}


# ── 다단계 BOM 트리 전개 ──

async def _build_tree(
    db: AsyncSession,
    product_id: uuid.UUID,
    parent_qty: float = 1.0,
    visited: set | None = None,
):
    """재귀적 BOM 트리 전개. visited로 순환 참조 방지"""
    if visited is None:
        visited = set()
    if product_id in visited:
        return []

    visited.add(product_id)

    # 해당 품목의 활성 BOM 조회 (최신 버전)
    result = await db.execute(
        select(BomHeader)
        .options(selectinload(BomHeader.lines).selectinload(BomLine.material))
        .where(
            BomHeader.product_id == product_id,
            BomHeader.is_active.is_(True),
            BomHeader.is_deleted.is_(False),
        )
        .order_by(BomHeader.version.desc())
        .limit(1)
    )
    bom = result.scalar_one_or_none()
    if not bom:
        return []

    children = []
    for line in bom.lines:
        # 스크랩율 반영한 실소요량 계산
        adjusted_qty = float(line.quantity) * parent_qty * (1 + float(line.scrap_rate or 0) / 100)
        sub_children = await _build_tree(
            db, line.material_id, adjusted_qty, visited.copy(),
        )
        children.append({
            "product_id": str(line.material_id),
            "product_name": line.material.name if line.material else "",
            "product_code": line.material.code if line.material else "",
            "product_type": line.material.product_type if line.material else "",
            "quantity": round(adjusted_qty, 4),
            "unit": line.unit,
            "scrap_rate": float(line.scrap_rate or 0),
            "children": sub_children,
        })
    return children


async def get_bom_tree(db: AsyncSession, bom_id: uuid.UUID):
    """BOM 트리 전개 결과 반환"""
    result = await db.execute(
        select(BomHeader)
        .options(selectinload(BomHeader.product))
        .where(BomHeader.id == bom_id, BomHeader.is_deleted.is_(False))
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM을 찾을 수 없습니다")

    children = await _build_tree(db, b.product_id, 1.0)

    return {
        "product_id": str(b.product_id),
        "product_name": b.product.name if b.product else "",
        "product_code": b.product.code if b.product else "",
        "product_type": b.product.product_type if b.product else "",
        "quantity": 1.0,
        "unit": None,
        "scrap_rate": 0,
        "children": children,
    }


# ── 소요 원자재 평탄화 ──

def _flatten_tree(node: dict, requirements: dict):
    """트리 노드를 순회하며 최하위 노드(children 없음)의 수량을 합산"""
    if not node.get("children"):
        # 리프 노드 = 최하위 원자재
        pid = node["product_id"]
        if pid not in requirements:
            requirements[pid] = {
                "product_id": pid,
                "product_name": node.get("product_name", ""),
                "product_code": node.get("product_code", ""),
                "unit": node.get("unit"),
                "total_quantity": 0,
            }
        requirements[pid]["total_quantity"] += node.get("quantity", 0)
    else:
        for child in node["children"]:
            _flatten_tree(child, requirements)


async def get_material_requirements(
    db: AsyncSession,
    bom_id: uuid.UUID,
    quantity: float = 1.0,
):
    """BOM 트리를 전개하여 최하위 원자재 소요량 반환"""
    result = await db.execute(
        select(BomHeader)
        .where(BomHeader.id == bom_id, BomHeader.is_deleted.is_(False))
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM을 찾을 수 없습니다")

    children = await _build_tree(db, b.product_id, quantity)

    requirements: dict = {}
    for child in children:
        _flatten_tree(child, requirements)

    # 수량 반올림
    for req in requirements.values():
        req["total_quantity"] = round(req["total_quantity"], 4)

    return {
        "bom_id": str(bom_id),
        "production_quantity": quantity,
        "materials": list(requirements.values()),
    }
