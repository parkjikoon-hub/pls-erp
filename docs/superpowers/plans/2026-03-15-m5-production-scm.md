# M5 생산/SCM 모듈 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M5 생산/SCM 모듈 전체 구현 (BOM, 재고, 작업지시서, QC, 출하, 대시보드)

**Architecture:** M2/M3/M4와 동일한 수직 슬라이스 패턴. 백엔드는 FastAPI + SQLAlchemy ORM (async), 프론트엔드는 React + Tailwind. 도메인별 파일 분리 구조 (schemas/, services/, routers/).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x (async), Alembic, PostgreSQL (Neon), React 18, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-15-m5-production-scm-design.md`

---

## Chunk 1: Task 1 — DB 스키마 + Alembic 마이그레이션

### Task 1: ORM 모델 + Alembic 마이그레이션 + 시드 데이터

**Files:**
- Create: `src/backend/modules/m5_production/__init__.py`
- Create: `src/backend/modules/m5_production/models.py`
- Modify: `alembic/env.py` — M5 모델 import 추가
- Create: `alembic/versions/xxxx_m5_production.py` (autogenerate)

**패턴 참조:** `src/backend/modules/m2_sales/models.py` (ORM 구조 동일하게)

- [ ] **Step 1: M5 모듈 디렉토리 생성**

```bash
mkdir -p src/backend/modules/m5_production/schemas
mkdir -p src/backend/modules/m5_production/services
mkdir -p src/backend/modules/m5_production/routers
```

빈 `__init__.py` 파일 4개 생성:
- `src/backend/modules/m5_production/__init__.py`
- `src/backend/modules/m5_production/schemas/__init__.py`
- `src/backend/modules/m5_production/services/__init__.py`
- `src/backend/modules/m5_production/routers/__init__.py`

- [ ] **Step 2: ORM 모델 작성 (models.py)**

`src/backend/modules/m5_production/models.py`에 9개 테이블 ORM 모델 작성.

M2 models.py 패턴 따르기:
- `from ...database import Base`
- UUID PK with `uuid.uuid4`, `mapped_column`
- `DateTime(timezone=True)`, `server_default=func.now()`
- `Numeric(15,2)` / `Numeric(15,3)` / `Numeric(15,4)`
- relationship + back_populates
- `__table_args__` 에 Index 정의

모델 순서 (FK 의존성 순):
1. `Warehouse` — 창고 마스터 (FK 없음)
2. `BomHeader` — BOM 헤더 (products FK)
3. `BomLine` — BOM 라인 (bom_headers, products FK)
4. `Inventory` — 재고 (products, warehouses FK) + `CheckConstraint("quantity >= 0")`
5. `InventoryTransaction` — 재고 이동 (products, warehouses FK)
6. `WorkOrder` — 작업지시서 (sales_orders, sales_order_lines, products, bom_headers, users FK)
7. `QcInspection` — QC 검사 (work_orders, users FK)
8. `Shipment` — 출하지시서 (sales_orders, customers, users FK)
9. `ShipmentLine` — 출하 라인 (shipments, products, sales_order_lines, warehouses FK)

각 모델의 주요 필드는 스펙 문서의 SQL DDL 참조.

공통 감사 필드 패턴 (M2 Quotation 기준):
```python
is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(),
)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
)
created_by: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id"),
)
updated_by: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id"),
)
```

Inventory 모델 특별 사항:
```python
from sqlalchemy import CheckConstraint

__table_args__ = (
    UniqueConstraint("product_id", "warehouse_id", "status"),
    CheckConstraint("quantity >= 0", name="ck_inventory_qty_positive"),
)
```

- [ ] **Step 3: alembic/env.py에 M5 모델 import 추가**

`alembic/env.py`의 기존 M2 import 블록 아래에 추가:
```python
# M5 생산/SCM
from src.backend.modules.m5_production.models import (
    Warehouse, BomHeader, BomLine, Inventory, InventoryTransaction,
    WorkOrder, QcInspection, Shipment, ShipmentLine,
)
```

- [ ] **Step 4: Alembic 마이그레이션 자동 생성**

```bash
cd c:/Users/admin/Antigravity/PLS_ERP_Program
python -m alembic revision --autogenerate -m "M5 생산SCM 테이블 생성"
```

생성된 마이그레이션 파일 확인: 9개 테이블 CREATE + 인덱스 확인.
특히 `inventory_transactions` 테이블의 4개 인덱스 확인:
- `idx_inv_tx_product`, `idx_inv_tx_created`, `idx_inv_tx_reference`, `idx_inv_tx_product_date`

- [ ] **Step 5: 마이그레이션 실행**

```bash
python -m alembic upgrade head
```

Expected: 9개 테이블 생성 성공

- [ ] **Step 6: 시드 데이터 — 창고 4개 생성**

`src/backend/modules/m5_production/seed.py` 생성:

```python
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
```

main.py의 lifespan 함수에 시드 호출 추가. 기존 lifespan은 비어있으므로 아래와 같이 수정:
```python
from .database import async_session_factory  # 또는 기존 세션 생성 방식 확인
from .modules.m5_production.seed import seed_warehouses

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작: 시드 데이터 실행
    async with async_session_factory() as db:
        await seed_warehouses(db)
        await db.commit()
    yield
    await engine.dispose()
```
> 주의: `async_session_factory`는 `database.py`에서 실제 사용하는 세션 팩토리 이름 확인 필요.

- [ ] **Step 7: 커밋**

```bash
git add src/backend/modules/m5_production/ alembic/
git commit -m "feat: M5 생산/SCM DB 스키마 9개 테이블 + 마이그레이션 (Step 5-1)"
```

---

## Chunk 2: Task 2 — BOM 관리 CRUD

### Task 2: BOM 관리 (스키마 + 서비스 + 라우터 + 프론트엔드)

**Files:**
- Create: `src/backend/modules/m5_production/schemas/bom.py`
- Create: `src/backend/modules/m5_production/services/bom_service.py`
- Create: `src/backend/modules/m5_production/routers/bom_router.py`
- Modify: `src/backend/modules/m5_production/routers/__init__.py` — bom_router 등록
- Modify: `src/backend/main.py` — M5 라우터 활성화
- Create: `src/frontend/src/pages/BomPage.tsx`

**패턴 참조:** `src/backend/modules/m2_sales/schemas/quotations.py`, `services/quotation_service.py`, `routers/quotation_router.py`

- [ ] **Step 1: BOM Pydantic 스키마 작성**

`src/backend/modules/m5_production/schemas/bom.py`:

```python
# BomLineCreate: material_id(str), quantity(float>0), unit(str|None), scrap_rate(float>=0), sort_order(int)
# BomLineResponse: id, material_id, material_name, material_code, quantity, unit, scrap_rate, sort_order
# BomCreate: product_id(str), version(int=1), lines(list[BomLineCreate], min_length=1)
# BomUpdate: version(int|None), lines(list[BomLineCreate]|None)
# BomListItem: id, product_id, product_name, product_code, version, is_active, line_count, created_at
# BomResponse: id, product_id, product_name, product_code, version, is_active, lines, created_at
# BomTreeNode: product_id, product_name, product_code, product_type, quantity, unit, scrap_rate, children(list[BomTreeNode])
# MaterialRequirement: product_id, product_name, product_code, unit, total_quantity(소요량 합계)
```

- [ ] **Step 2: BOM 서비스 작성**

`src/backend/modules/m5_production/services/bom_service.py`:

함수 목록:
- `_generate_bom_version(db, product_id)` — 해당 품목의 다음 BOM 버전 번호
- `list_boms(db, product_id, search, page, size)` — BOM 목록 (is_deleted=False)
- `get_bom(db, bom_id)` — BOM 상세 + 라인
- `create_bom(db, data, current_user, ip)` — BOM 생성 + 라인 + 감사로그
- `update_bom(db, bom_id, data, current_user, ip)` — BOM 수정 (라인 교체)
- `delete_bom(db, bom_id, current_user, ip)` — 소프트 삭제 (is_deleted=True)
- `get_bom_tree(db, bom_id)` — 다단계 BOM 트리 전개 (재귀)
- `get_material_requirements(db, bom_id, quantity)` — 소요 원자재 평탄화

트리 전개 로직 (핵심):
```python
async def _build_tree(db, product_id, parent_qty=1.0, visited=None):
    """재귀적 BOM 트리 전개. visited로 순환 참조 방지"""
    if visited is None:
        visited = set()
    if product_id in visited:
        return []  # 순환 참조 방지

    visited.add(product_id)

    # 해당 품목의 활성 BOM 조회
    bom = await db.execute(
        select(BomHeader)
        .options(selectinload(BomHeader.lines).selectinload(BomLine.material))
        .where(BomHeader.product_id == product_id,
               BomHeader.is_active.is_(True),
               BomHeader.is_deleted.is_(False))
        .order_by(BomHeader.version.desc())
        .limit(1)
    )
    bom = bom.scalar_one_or_none()
    if not bom:
        return []

    children = []
    for line in bom.lines:
        adjusted_qty = float(line.quantity) * parent_qty * (1 + float(line.scrap_rate or 0) / 100)
        sub_children = await _build_tree(db, line.material_id, adjusted_qty, visited.copy())
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
```

소요 원자재 평탄화:
```python
async def get_material_requirements(db, bom_id, quantity=1.0):
    """BOM 트리를 전개하여 최하위 원자재(product_type='material')만 추출"""
    # 트리 전개 후 재귀적으로 leaf 노드(children=[])만 수집
    # 동일 품목은 수량 합산
```

- [ ] **Step 3: BOM 라우터 작성**

`src/backend/modules/m5_production/routers/bom_router.py`:

```python
router = APIRouter()

# GET  ""                    — list_boms
# POST ""                    — create_bom (admin/manager)
# GET  "/{bom_id}"           — get_bom
# PUT  "/{bom_id}"           — update_bom (admin/manager)
# DELETE "/{bom_id}"         — delete_bom (admin/manager)
# GET  "/{bom_id}/tree"      — get_bom_tree
# GET  "/{bom_id}/materials" — get_material_requirements (query param: quantity)
```

패턴: `quotation_router.py`와 동일 — Depends(get_db), Depends(get_current_user/require_role), success_response

- [ ] **Step 4: routers/__init__.py에 bom_router 등록**

```python
from fastapi import APIRouter
from .bom_router import router as bom_router

router = APIRouter()
router.include_router(bom_router, prefix="/bom", tags=["BOM 관리"])
```

- [ ] **Step 5: main.py — M5 라우터 활성화**

`src/backend/main.py`의 기존 주석 라인(77~78행)을 **삭제**하고 아래 코드로 **교체** (기존 라인은 `router` 단수형으로 잘못 되어있음):
```python
# Phase 5: M5 생산/SCM
from .modules.m5_production.routers import router as m5_router
app.include_router(m5_router, prefix="/api/v1/production", tags=["M5-생산SCM"])
```

- [ ] **Step 6: 백엔드 동작 확인**

```bash
cd c:/Users/admin/Antigravity/PLS_ERP_Program
python -m uvicorn src.backend.main:app --reload --port 8000
```

브라우저에서 `http://localhost:8000/api/docs` 접속하여 M5 BOM 엔드포인트 확인.

- [ ] **Step 7: BomPage.tsx 프론트엔드 작성**

`src/frontend/src/pages/BomPage.tsx`:

UI 구성:
- 상단: 제목 + "BOM 등록" 버튼
- BOM 목록 테이블 (품목명, 품목코드, 버전, 라인 수, 등록일)
- 행 클릭 → BOM 상세 모달 (트리 구조 시각화)
- BOM 등록/수정 모달: 품목 선택 + 동적 라인 추가/삭제
- 트리 뷰: 들여쓰기 + 접기/펼치기 (재귀 컴포넌트)

API 호출: `api.get/post/put/delete('/production/bom/...')`

시안 C 스타일: 기존 QuotationsPage.tsx 패턴 참조
- 다크 사이드바 + 슬레이트 블루그레이 콘텐츠
- 카드/모달/테이블 스타일 동일

- [ ] **Step 8: App.tsx에 BomPage 라우트 추가**

```tsx
import BomPage from './pages/BomPage';
// Routes 안에:
<Route path="/production/bom" element={<BomPage />} />
```

- [ ] **Step 9: 커밋**

```bash
git add src/backend/modules/m5_production/ src/backend/main.py src/frontend/src/
git commit -m "feat: M5 BOM 관리 CRUD + 다단계 트리 전개 (Step 5-2)"
```

---

## Chunk 3: Task 3 — 재고 관리

### Task 3: 재고 관리 (창고 + 입출고/이관 + 이력 + 부족 알림)

**Files:**
- Create: `src/backend/modules/m5_production/schemas/inventory.py`
- Create: `src/backend/modules/m5_production/services/inventory_service.py`
- Create: `src/backend/modules/m5_production/routers/inventory_router.py`
- Modify: `src/backend/modules/m5_production/routers/__init__.py` — inventory_router 등록
- Create: `src/frontend/src/pages/InventoryPage.tsx`

- [ ] **Step 1: 재고 Pydantic 스키마 작성**

`schemas/inventory.py`:

```python
# WarehouseCreate: code, name, zone_type, description
# WarehouseResponse: id, code, name, zone_type, description, is_active
# InventoryItem: id, product_id, product_name, product_code, warehouse_id,
#                warehouse_name, zone_type, quantity, unit_cost, status, safety_stock
# InventoryReceive: product_id, warehouse_id, quantity(>0), unit_cost, notes
# InventoryIssue: product_id, warehouse_id, quantity(>0), notes, reference_type, reference_id
# InventoryTransfer: product_id, from_warehouse_id, to_warehouse_id, quantity(>0), notes
# InventoryAdjust: product_id, warehouse_id, new_quantity(>=0), notes(필수 - 사유)
# TransactionResponse: id, product_name, from_warehouse, to_warehouse, quantity,
#                       transaction_type, reference_type, notes, created_at, created_by_name
# ShortageItem: product_id, product_name, product_code, current_qty, safety_stock, shortage_qty
```

- [ ] **Step 2: 재고 서비스 작성**

`services/inventory_service.py`:

함수 목록:
- `list_warehouses(db)` — 활성 창고 목록
- `create_warehouse(db, data, current_user)` — 창고 생성
- `list_inventory(db, warehouse_id, product_id, zone_type, search, page, size)` — 재고 현황
- `receive_inventory(db, data, current_user, ip)` — 입고 (to_warehouse에 수량 추가)
- `issue_inventory(db, data, current_user, ip)` — 출고 (from_warehouse에서 차감, 잔량 검증)
- `transfer_inventory(db, data, current_user, ip)` — 이관 (from→to)
- `adjust_inventory(db, data, current_user, ip)` — 조정 (절대값으로 설정)
- `list_transactions(db, product_id, warehouse_id, tx_type, page, size)` — 이동 이력
- `get_shortage_list(db)` — 부족 재고 (원자재 창고 가용재고 < products.safety_stock)
- `check_order_materials(db, order_id)` — **수주 기준 원자재 소요량 사전 조회**
  - 수주 라인 → 각 품목의 BOM 트리 전개 → 소요 원자재 합산
  - 원자재 창고(WH-RAW) 가용 재고와 비교
  - 부족한 원자재 목록 반환: 품목명, 필요수량, 현재재고, 안전재고, 부족수량

핵심 로직 — 입고:
```python
async def receive_inventory(db, data, current_user, ip):
    # 1. inventory 레코드 조회 (product_id + warehouse_id + status='available')
    # 2. 없으면 새로 생성, 있으면 quantity += data.quantity
    # 3. inventory_transactions에 기록 (type='receive', to_warehouse_id=warehouse_id)
    # 4. 감사 로그
```

핵심 로직 — 출고:
```python
async def issue_inventory(db, data, current_user, ip):
    # 1. inventory 조회 (available)
    # 2. quantity < data.quantity면 HTTPException 400 "재고 부족"
    # 3. quantity -= data.quantity
    # 4. inventory_transactions 기록 (type='issue', from_warehouse_id)
```

- [ ] **Step 3: 재고 라우터 작성**

`routers/inventory_router.py`:

```python
# 창고
# GET  /warehouses        — list_warehouses
# POST /warehouses        — create_warehouse (admin)

# 재고
# GET  /inventory         — list_inventory (query: warehouse_id, zone_type, search)
# POST /inventory/receive — receive_inventory (admin/manager)
# POST /inventory/issue   — issue_inventory (admin/manager)
# POST /inventory/transfer — transfer_inventory (admin/manager)
# POST /inventory/adjust  — adjust_inventory (admin)

# 이력
# GET  /inventory/transactions — list_transactions
# GET  /inventory/shortage     — get_shortage_list
# POST /inventory/check-order/{order_id} — check_order_materials (수주 기준 소요량 조회)
```

- [ ] **Step 4: routers/__init__.py에 inventory_router 등록**

```python
from .inventory_router import router as inventory_router
router.include_router(inventory_router, tags=["재고 관리"])
```

prefix 없이 등록 (라우터 내부에서 /warehouses, /inventory 경로 직접 지정)

- [ ] **Step 5: InventoryPage.tsx 프론트엔드 작성**

UI 구성:
- 상단: 제목 + "입고" / "출고" / "이관" / "조정" 버튼
- 4개 탭: 원자재(raw) / WIP / 완제품(finished) / 불량(defective)
- 각 탭: 품목별 재고 테이블 (품목코드, 품목명, 수량, 단가, 안전재고)
- 안전재고 미달 행: 빨간색 배경 강조
- 입고/출고/이관/조정 모달: 품목 검색 + 수량 입력
- 하단 탭: "이동 이력" 테이블 (날짜, 유형, 품목, 출발→도착, 수량, 메모)

App.tsx에 라우트 추가: `<Route path="/production/inventory" element={<InventoryPage />} />`

- [ ] **Step 6: 커밋**

```bash
git add src/backend/modules/m5_production/ src/frontend/src/
git commit -m "feat: M5 재고 관리 — 창고/입출고/이관/부족 알림 (Step 5-3)"
```

---

## Chunk 4: Task 4 — 작업지시서

### Task 4: 작업지시서 (CRUD + 수주 전환 + 칸반 UI)

**Files:**
- Create: `src/backend/modules/m5_production/schemas/work_orders.py`
- Create: `src/backend/modules/m5_production/services/work_order_service.py`
- Create: `src/backend/modules/m5_production/routers/work_order_router.py`
- Modify: `src/backend/modules/m5_production/routers/__init__.py`
- Create: `src/frontend/src/pages/WorkOrdersPage.tsx`

- [ ] **Step 1: 작업지시서 Pydantic 스키마 작성**

`schemas/work_orders.py`:

```python
# WorkOrderCreate: order_type, product_id, bom_id(optional), planned_qty(>0),
#                  start_date, due_date, assigned_to(optional), notes
# WorkOrderFromOrder: order_id(수주 ID) — 수주의 모든 라인에 대해 작업지시서 자동 생성
# WorkOrderUpdate: planned_qty, start_date, due_date, assigned_to, bom_id, notes
# WorkOrderStatusUpdate: status(in_progress/qc_wait/completed)
# WorkOrderProgressUpdate: produced_qty(>=0)
# WorkOrderListItem: id, wo_no, order_type, product_name, product_code, planned_qty,
#                    produced_qty, progress_pct, status, due_date, assigned_to_name,
#                    order_no(수주번호|None), created_at
# WorkOrderResponse: 위 + bom_id, start_date, notes, lines(수주라인 정보)
```

- [ ] **Step 2: 작업지시서 서비스 작성**

`services/work_order_service.py`:

함수 목록:
- `_generate_wo_no(db, date)` — WO-YYYYMM-NNNN
- `list_work_orders(db, status, order_type, search, page, size)` — 목록
- `get_work_order(db, wo_id)` — 상세
- `create_work_order(db, data, current_user, ip)` — 계획생산 작업지시서 생성
- `create_from_order(db, order_id, current_user, ip)` — 수주→작업지시서 전환
  - 수주의 각 라인별 작업지시서 생성
  - 해당 품목의 활성 BOM 자동 연결
  - sales_orders.status → 'in_production' 업데이트
  - **원자재 부족 자동 판단**: BOM 기반 소요량 계산 → 현재 재고 비교
  - 응답에 `material_shortage` 필드 포함 (부족 원자재 목록)
  - 프론트엔드에서 부족분 있으면 경고 배너 표시
- `update_work_order(db, wo_id, data, current_user, ip)` — 수정 (pending만)
- `update_status(db, wo_id, new_status, current_user, ip)` — 상태 변경
  - valid_transitions: pending→in_progress, in_progress→qc_wait, qc_wait→completed
  - qc_wait 진입 시: 원자재 자동 출고 (BOM 기반, 원자재 창고→WIP)
  - 주의: 원자재 출고는 in_progress 시작 시 하는 게 자연스러우므로 여기서 처리
    - pending→in_progress: BOM 기반 원자재 출고 (원자재→WIP)
- `update_progress(db, wo_id, produced_qty, current_user, ip)` — 생산 수량 보고
  - produced_qty 업데이트
  - progress_pct는 서비스에서 계산하여 응답에 포함 (DB에 저장하지 않음, 매번 produced_qty/planned_qty*100 계산)

- [ ] **Step 3: 작업지시서 라우터 작성**

```python
# prefix="/work-orders"가 __init__.py에서 설정되므로 라우터 내부 경로는:
# GET  ""                        — list_work_orders
# POST ""                        — create_work_order (admin/manager)
# GET  "/{wo_id}"                — get_work_order
# PUT  "/{wo_id}"                — update_work_order (admin/manager)
# POST "/from-order/{order_id}"  — create_from_order (admin/manager)
# PATCH "/{wo_id}/status"        — update_status (admin/manager)
# PATCH "/{wo_id}/progress"      — update_progress (admin/manager)
```

- [ ] **Step 4: routers/__init__.py 업데이트**

```python
from .work_order_router import router as work_order_router
router.include_router(work_order_router, tags=["작업지시서"])
```

- [ ] **Step 5: WorkOrdersPage.tsx 프론트엔드 작성**

UI 구성 (핵심: 칸반 보드):

**뷰 모드 토글**: 칸반 뷰 / 리스트 뷰

칸반 뷰:
- 4개 컬럼: 대기(pending) | 진행중(in_progress) | QC대기(qc_wait) | 완료(completed)
- 각 카드: 작업지시번호, 품목명, 수량(생산/계획), 납기일, 담당자
- 상태 변경 버튼 (드래그 아닌 버튼 클릭)
- 생산 수량 보고 버튼 (모달로 produced_qty 입력)

리스트 뷰:
- 테이블: 작업지시번호, 유형(수주/계획), 품목, 수량, 진행률(프로그레스바), 상태, 납기일, 담당자
- 상태/유형 필터

공통:
- "작업지시서 생성" 버튼 (계획생산)
- "수주→작업지시서 전환" 버튼 (수주 선택 모달)

App.tsx에 라우트: `<Route path="/production/work-orders" element={<WorkOrdersPage />} />`

- [ ] **Step 6: 커밋**

```bash
git add src/backend/modules/m5_production/ src/frontend/src/
git commit -m "feat: M5 작업지시서 CRUD + 수주 전환 + 칸반 UI (Step 5-4)"
```

---

## Chunk 5: Task 5 — QC 검사

### Task 5: QC 검사 (등록 + 합격 시 재고 자동 이관)

**Files:**
- Create: `src/backend/modules/m5_production/schemas/qc.py`
- Create: `src/backend/modules/m5_production/services/qc_service.py`
- Create: `src/backend/modules/m5_production/routers/qc_router.py`
- Modify: `src/backend/modules/m5_production/routers/__init__.py`
- Create: `src/frontend/src/pages/QcPage.tsx`

- [ ] **Step 1: QC Pydantic 스키마 작성**

```python
# QcCreate: work_order_id, inspected_qty(>0), passed_qty(>=0), failed_qty(>=0),
#           result(pass/fail/rework), defect_types(dict|None), notes
#           검증: passed_qty + failed_qty == inspected_qty
# QcResponse: id, work_order_id, wo_no, product_name, inspected_qty, passed_qty,
#             failed_qty, result, defect_types, notes, inspector_name, inspected_at
```

- [ ] **Step 2: QC 서비스 작성**

`services/qc_service.py`:

핵심 로직 — QC 등록:
```python
async def create_inspection(db, data, current_user, ip):
    # 1. 작업지시서 조회 (status == 'qc_wait' 확인)
    # 2. passed_qty + failed_qty == inspected_qty 검증
    # 3. QcInspection 레코드 생성
    # 4. 결과에 따른 자동 처리:
    #    - pass: 합격 수량만큼 WIP→완제품 창고 이관 (inventory_service 호출)
    #            작업지시서 status → completed
    #            수주 라인 produced_qty 업데이트
    #    - fail: 불합격 수량만큼 WIP→불량품 창고 이관
    #            작업지시서 status는 qc_wait 유지 (재검사 가능)
    #    - rework: 작업지시서 status → in_progress (재작업)
    #              재고 이동 없음 (WIP에 그대로)
    # 5. 감사 로그
```

- [ ] **Step 3: QC 라우터 작성**

```python
# POST /qc    — create_inspection (admin/manager)
# GET  /qc    — list_inspections (query: work_order_id, result, page, size)
```

- [ ] **Step 4: QcPage.tsx 프론트엔드 작성**

UI 구성:
- 상단: "QC 검사 등록" 버튼
- 검사 이력 테이블: 작업지시번호, 품목, 검사수량, 합격/불합격, 결과, 검사일, 검사자
- 결과별 색상: pass(초록), fail(빨강), rework(주황)
- 등록 모달: 작업지시서 선택(qc_wait 상태만) → 수량 입력 → 결과 선택 → 불량유형(선택사항)

App.tsx 라우트: `<Route path="/production/qc" element={<QcPage />} />`

- [ ] **Step 5: 커밋**

```bash
git add src/backend/modules/m5_production/ src/frontend/src/
git commit -m "feat: M5 QC 검사 + 합격 시 완제품 자동 이관 (Step 5-5)"
```

---

## Chunk 6: Task 6 — 출하 관리

### Task 6: 출하 관리 (수주→출하 + 배송 추적 + 거래명세서)

**Files:**
- Create: `src/backend/modules/m5_production/schemas/shipments.py`
- Create: `src/backend/modules/m5_production/services/shipment_service.py`
- Create: `src/backend/modules/m5_production/routers/shipment_router.py`
- Modify: `src/backend/modules/m5_production/routers/__init__.py`
- Create: `src/frontend/src/pages/ShipmentsPage.tsx`

- [ ] **Step 1: 출하 Pydantic 스키마 작성**

```python
# ShipmentLineCreate: product_id, order_line_id, quantity(>0), warehouse_id
# ShipmentCreate: order_id, customer_id, shipment_date, shipping_address, notes,
#                 lines(list[ShipmentLineCreate])
# ShipmentFromOrder: order_id — 수주 라인 기반으로 자동 생성
# ShipmentUpdate: shipment_date, carrier_name, tracking_no, shipping_address, notes
# ShipmentStatusUpdate: status(picked/shipped/delivered), carrier_name, tracking_no
# ShipmentLineResponse: id, line_no, product_name, product_code, quantity,
#                        unit_price, amount, warehouse_name
# ShipmentListItem: id, shipment_no, order_no, customer_name, shipment_date,
#                   status, carrier_name, tracking_no, created_at
# ShipmentResponse: 위 + lines, delivery_note_no, shipping_address, notes
# DeliveryNote: shipment_no, delivery_note_no, customer info, lines(품목/수량/단가/금액),
#               total_amount, tax_amount, grand_total
```

- [ ] **Step 2: 출하 서비스 작성**

`services/shipment_service.py`:

함수 목록:
- `_generate_shipment_no(db, date)` — SH-YYYYMM-NNNN
- `_generate_delivery_note_no(db, date)` — DN-YYYYMM-NNNN
- `list_shipments(db, status, customer_id, search, page, size)`
- `get_shipment(db, shipment_id)`
- `create_shipment(db, data, current_user, ip)` — 수동 출하 생성
- `create_from_order(db, order_id, current_user, ip)` — 수주→출하지시서 자동 생성
  - 수주 라인의 (quantity - shipped_qty) > 0 인 것만
  - 완제품 창고(WH-FIN) 자동 지정
  - 수주 라인의 unit_price 스냅샷
- `update_shipment(db, shipment_id, data, current_user, ip)` — 수정
- `update_status(db, shipment_id, new_status, carrier, tracking, current_user, ip)`
  - pending→picked: 상태만 변경
  - picked→shipped: 완제품 창고에서 재고 차감 (issue_inventory 호출)
    - carrier_name, tracking_no 필수
  - shipped→delivered: 수주 라인 shipped_qty 업데이트
    - 전체 라인 출하 완료 시 sales_orders.status → 'shipped'
- `get_delivery_note(db, shipment_id)` — 거래명세서 데이터 (출력용)

- [ ] **Step 3: 출하 라우터 작성**

```python
# prefix="/shipments"가 __init__.py에서 설정되므로 라우터 내부 경로는:
# GET  ""                          — list_shipments
# POST ""                          — create_shipment (admin/manager)
# GET  "/{id}"                     — get_shipment
# PUT  "/{id}"                     — update_shipment (admin/manager)
# POST "/from-order/{order_id}"    — create_from_order (admin/manager)
# PATCH "/{id}/status"             — update_status (admin/manager)
# GET  "/{id}/delivery-note"       — get_delivery_note
```

- [ ] **Step 4: ShipmentsPage.tsx 프론트엔드 작성**

UI 구성:
- 상단: "출하 등록" / "수주→출하 생성" 버튼
- 출하 목록 테이블: 출하번호, 수주번호, 거래처, 출하일, 상태, 택배사, 송장번호
- 배송 상태 스텝 인디케이터: ○ 준비 → ○ 피킹 → ○ 출하 → ○ 배송완료
  - 현재 단계 강조 (파란 원), 완료 단계 (초록 체크)
- 상태 변경 모달: 현재→다음 상태 + 택배사/송장번호 입력 (shipped 시)
- 상세 모달: 출하 라인 + 거래명세서 인쇄 버튼

App.tsx 라우트: `<Route path="/production/shipments" element={<ShipmentsPage />} />`

- [ ] **Step 5: 커밋**

```bash
git add src/backend/modules/m5_production/ src/frontend/src/
git commit -m "feat: M5 출하 관리 + 배송 추적 + 거래명세서 (Step 5-6)"
```

---

## Chunk 7: Task 7 — 대시보드 + 보고서 + 메인 페이지

### Task 7: 생산 대시보드 + 보고서 + ProductionPage 메인

**Files:**
- Create: `src/backend/modules/m5_production/services/report_service.py`
- Create: `src/backend/modules/m5_production/routers/report_router.py`
- Modify: `src/backend/modules/m5_production/routers/__init__.py`
- Create: `src/frontend/src/pages/ProductionDashboardPage.tsx`
- Create: `src/frontend/src/pages/ProductionPage.tsx`
- Modify: `src/frontend/src/App.tsx` — 모든 M5 라우트 최종 확인
- Modify: `src/frontend/src/components/Sidebar.tsx` — M5 메뉴 활성화

- [ ] **Step 1: 보고서 서비스 작성**

`services/report_service.py`:

```python
async def get_dashboard_summary(db):
    """대시보드 요약 데이터"""
    return {
        "work_orders": {
            "pending": count(status=pending),
            "in_progress": count(status=in_progress),
            "qc_wait": count(status=qc_wait),
            "completed_today": count(status=completed, today),
        },
        "inventory": {
            "raw_total": sum(raw 창고 재고),
            "wip_total": sum(WIP 창고 재고),
            "finished_total": sum(완제품 창고 재고),
            "shortage_count": count(안전재고 미달 품목),
        },
        "shipments": {
            "pending": count(pending),
            "shipped": count(shipped),
            "delivered_today": count(delivered, today),
        },
        "recent_work_orders": 최근 5건,
        "recent_shipments": 최근 5건,
        "shortage_items": 부족 재고 상위 5건,
    }

async def get_inventory_report(db, warehouse_id, zone_type):
    """재고 보고서 — 창고별/구역별 전체 품목 재고"""

async def get_production_report(db, year, month):
    """생산 현황 보고서 — 월별 생산 실적 (완료 작업지시서 기준)"""
```

- [ ] **Step 2: 보고서 라우터 작성**

```python
# GET /reports/dashboard          — get_dashboard_summary
# GET /reports/inventory-report   — get_inventory_report
# GET /reports/production-report  — get_production_report
```

- [ ] **Step 3: routers/__init__.py 최종 업데이트**

모든 라우터 등록 확인:
```python
from .bom_router import router as bom_router
from .inventory_router import router as inventory_router
from .work_order_router import router as work_order_router
from .qc_router import router as qc_router
from .shipment_router import router as shipment_router
from .report_router import router as report_router

router = APIRouter()
router.include_router(bom_router, prefix="/bom", tags=["BOM 관리"])
router.include_router(inventory_router, tags=["재고 관리"])  # 내부에서 /warehouses, /inventory 직접 지정
router.include_router(work_order_router, prefix="/work-orders", tags=["작업지시서"])
router.include_router(qc_router, prefix="/qc", tags=["QC 검사"])
router.include_router(shipment_router, prefix="/shipments", tags=["출하 관리"])
router.include_router(report_router, prefix="/reports", tags=["생산 보고서"])
```

- [ ] **Step 4: ProductionDashboardPage.tsx 작성**

UI 구성:
- 요약 카드 (3열): 작업지시서(대기/진행/QC), 재고(원자재/WIP/완제품), 출하(대기/출하/완료)
- 부족 원자재 알림 목록 (빨간 배경 카드)
- 최근 작업지시서 / 최근 출하 테이블

- [ ] **Step 5: ProductionPage.tsx 작성 (메인 카드 그리드)**

M2 SalesPage 패턴:
```tsx
// 카드 그리드 (3x2)
const menuCards = [
  { title: "BOM 관리", desc: "자재명세서 등록/조회", path: "/production/bom", icon: "..." },
  { title: "재고 관리", desc: "창고별 재고 현황", path: "/production/inventory", icon: "..." },
  { title: "작업지시서", desc: "생산 작업 관리", path: "/production/work-orders", icon: "..." },
  { title: "QC 검사", desc: "품질 검사/합격 판정", path: "/production/qc", icon: "..." },
  { title: "출하 관리", desc: "출하/배송 추적", path: "/production/shipments", icon: "..." },
  { title: "생산 대시보드", desc: "생산 현황 한눈에", path: "/production/dashboard", icon: "..." },
];
```

- [ ] **Step 6: App.tsx 최종 라우트 추가**

```tsx
import ProductionPage from './pages/ProductionPage';
import ProductionDashboardPage from './pages/ProductionDashboardPage';

// M5 생산/SCM 라우트 (기존 BOM/Inventory/WorkOrders/QC/Shipments 라우트 아래)
<Route path="/production" element={<ProductionPage />} />
<Route path="/production/dashboard" element={<ProductionDashboardPage />} />
```

- [ ] **Step 7: Sidebar.tsx — M5 메뉴 활성화**

M5 메뉴의 비활성화(30% 투명도 + 개발 예정 툴팁) 제거:
- `disabled: true` → `disabled: false` (또는 해당 속성 삭제)
- 클릭 시 `/production`으로 이동

- [ ] **Step 8: progress-tracker.md 업데이트**

Phase 5 완료 사항 기록:
```markdown
### Phase 5: M5 생산/SCM (2026-03-15 완료)
- [x] Step 5-1: DB 스키마 9개 테이블 + Alembic 마이그레이션
- [x] Step 5-2: BOM 관리 CRUD (다단계 트리 전개 + 소요량 계산)
- [x] Step 5-3: 재고 관리 (창고 + 입출고/이관 + 이력 + 부족 알림)
- [x] Step 5-4: 작업지시서 (CRUD + 수주 전환 + 칸반 UI)
- [x] Step 5-5: QC 검사 (등록 + 합격 시 완제품 자동 이관)
- [x] Step 5-6: 출하 관리 (수주→출하지시서 + 배송 추적 + 거래명세서)
- [x] Step 5-7: 생산 대시보드 + 보고서 + ProductionPage 메인
```

- [ ] **Step 9: 최종 커밋**

```bash
git add src/backend/ src/frontend/ docs/
git commit -m "feat: Phase 5 M5 생산/SCM 모듈 전체 구현 (Step 5-1~5-7)"
```

---

## 참조 문서

| 문서 | 용도 |
|------|------|
| `docs/superpowers/specs/2026-03-15-m5-production-scm-design.md` | M5 설계 스펙 |
| `src/backend/modules/m2_sales/` | 코드 패턴 참조 (M2 영업) |
| `src/frontend/src/pages/QuotationsPage.tsx` | 프론트엔드 패턴 참조 |
| `src/frontend/src/pages/SalesPage.tsx` | 메인 페이지 카드 그리드 패턴 |
| `src/frontend/src/components/Sidebar.tsx` | 사이드바 메뉴 구조 |
| `alembic/env.py` | Alembic 마이그레이션 설정 |
