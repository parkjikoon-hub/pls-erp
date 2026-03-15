# M5 생산/SCM 모듈 설계서
> 작성일: 2026-03-15
> 상태: 승인됨 (리뷰 반영 v2)

---

## 1. 개요

### 목표
PLS ERP의 5번째 모듈로, 생산 및 공급망(SCM) 관리 기능을 구현한다.
수주(M2) → 생산 → QC → 출하까지의 전체 흐름을 관리하며,
BOM 기반 원자재 소요량 계산과 창고별 재고 추적을 포함한다.

### 의존성
- M1 (시스템 아키텍처): users, products, customers 테이블
- M2 (영업/수주): sales_orders, sales_order_lines 테이블 (수주→생산 연동)
- M4 (재무/회계): 출하 시 세금계산서 발행 연동 가능 (Phase 5에서는 연동하지 않음)

### 핵심 요구사항
| 항목 | 결정 |
|---|---|
| 생산 방식 | 혼합 (수주생산 MTO + 계획생산 MTS) |
| BOM 구조 | 다단계 (2~3단계 트리) |
| 창고 관리 | 논리적 구역 구분 (원자재/WIP/완제품/불량품) |
| QC 검사 | 간단한 합격/불합격 (JSONB로 확장 가능) |
| 출하 프로세스 | 출하지시서 + 거래명세서 + 배송 추적 |

---

## 2. DB 스키마 (9개 테이블)

### 2.1 기존 테이블 수정 (Dante 설계 기반)

#### bom_headers (공통 컬럼 추가)
```sql
CREATE TABLE bom_headers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID REFERENCES products(id),
    version         INTEGER DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    UNIQUE(product_id, version)
);
```

#### bom_lines (sort_order + 감사 필드 추가)
```sql
CREATE TABLE bom_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id          UUID REFERENCES bom_headers(id) ON DELETE CASCADE,
    material_id     UUID REFERENCES products(id),
    quantity        DECIMAL(15,4) NOT NULL,
    unit            VARCHAR(20),
    scrap_rate      DECIMAL(5,2) DEFAULT 0,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

> **다단계 BOM 전개 전략**: `bom_lines.material_id`가 다른 `bom_headers.product_id`를
> 가지고 있으면 하위 BOM으로 간주하여 재귀 탐색한다. 별도 `child_bom_id` 컬럼 없이
> products 테이블의 product_type(product/material/semi)으로 반제품을 구분하고,
> 서비스 레이어에서 재귀 쿼리로 트리를 전개한다.

#### inventory (warehouse_id FK + status 컬럼 유지)
```sql
CREATE TABLE inventory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID REFERENCES products(id),
    warehouse_id    UUID REFERENCES warehouses(id) NOT NULL,
    quantity        DECIMAL(15,3) DEFAULT 0 CHECK (quantity >= 0),
    unit_cost       DECIMAL(15,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'available',  -- available / reserved
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id, status)
);
```
> **재고 마이너스 방지**: `CHECK (quantity >= 0)` 제약으로 DB 레벨에서 방지.
> 서비스 레이어에서도 출고 전 잔량 확인 후 부족하면 에러 반환.
> **예약 재고**: status='reserved'로 수주 시 가용 재고와 분리 관리 가능.

#### work_orders (order_type, sales_order_line_id 추가)
```sql
CREATE TABLE work_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wo_no               VARCHAR(30) UNIQUE NOT NULL,
    order_type          VARCHAR(20) DEFAULT 'make_to_order',  -- make_to_order / make_to_stock
    order_id            UUID REFERENCES sales_orders(id),
    sales_order_line_id UUID REFERENCES sales_order_lines(id),
    product_id          UUID REFERENCES products(id),
    bom_id              UUID REFERENCES bom_headers(id),
    planned_qty         DECIMAL(15,3) NOT NULL,
    produced_qty        DECIMAL(15,3) DEFAULT 0,
    start_date          DATE,
    due_date            DATE NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending',
    assigned_to         UUID REFERENCES users(id),
    notes               TEXT,
    is_deleted          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id)
);
```
- status: pending → in_progress → qc_wait → completed
  - pending: 대기 (작업지시서 생성됨)
  - in_progress: 생산 진행 중
  - qc_wait: 생산 완료, QC 검사 대기
  - completed: QC 합격, 최종 완료
- order_type: make_to_order(수주생산) / make_to_stock(계획생산)

#### qc_inspections (notes 추가)
```sql
CREATE TABLE qc_inspections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id   UUID REFERENCES work_orders(id),
    inspected_qty   DECIMAL(15,3) NOT NULL,
    passed_qty      DECIMAL(15,3) DEFAULT 0,
    failed_qty      DECIMAL(15,3) DEFAULT 0,
    result          VARCHAR(20),            -- pass / fail / rework
    defect_types    JSONB,                  -- 불량 유형 (확장 가능)
    notes           TEXT,
    inspector_id    UUID REFERENCES users(id),
    inspected_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by      UUID REFERENCES users(id)
);
```
- result: pass(합격→완제품 창고), fail(불합격→불량품 창고), rework(재작업→작업지시서 재개)
```

### 2.2 신규 테이블 (4개)

#### warehouses (창고 마스터)
```sql
CREATE TABLE warehouses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    zone_type   VARCHAR(20) NOT NULL,       -- raw / wip / finished / defective
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

시드 데이터:
| code | name | zone_type |
|---|---|---|
| WH-RAW | 원자재 창고 | raw |
| WH-WIP | 생산중(WIP) | wip |
| WH-FIN | 완제품 창고 | finished |
| WH-DEF | 불량품 창고 | defective |

#### inventory_transactions (재고 이동 이력)
```sql
CREATE TABLE inventory_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID REFERENCES products(id),
    from_warehouse_id   UUID REFERENCES warehouses(id),    -- NULL이면 외부 입고
    to_warehouse_id     UUID REFERENCES warehouses(id),    -- NULL이면 외부 출고
    quantity            DECIMAL(15,3) NOT NULL,
    transaction_type    VARCHAR(20) NOT NULL,               -- receive / issue / transfer / adjust
    reference_type      VARCHAR(30),                        -- work_order / shipment / purchase / qc
    reference_id        UUID,
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by          UUID REFERENCES users(id)
);
CREATE INDEX idx_inv_tx_product ON inventory_transactions(product_id);
CREATE INDEX idx_inv_tx_created ON inventory_transactions(created_at);
CREATE INDEX idx_inv_tx_reference ON inventory_transactions(reference_type, reference_id);
CREATE INDEX idx_inv_tx_product_date ON inventory_transactions(product_id, created_at);
```

#### shipments (출하지시서)
```sql
CREATE TABLE shipments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_no         VARCHAR(30) UNIQUE NOT NULL,        -- SH-YYYYMM-NNNN
    order_id            UUID REFERENCES sales_orders(id),
    customer_id         UUID REFERENCES customers(id),
    shipment_date       DATE,
    status              VARCHAR(20) DEFAULT 'pending',      -- pending / picked / shipped / delivered
    carrier_name        VARCHAR(100),                       -- 택배사명
    tracking_no         VARCHAR(100),                       -- 송장번호
    delivery_note_no    VARCHAR(30),                        -- 거래명세서 번호 (DN-YYYYMM-NNNN)
    shipping_address    TEXT,
    notes               TEXT,
    is_deleted          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id)
);
```
> **거래명세서 금액**: 금액은 shipment_lines → sales_order_lines JOIN으로 계산.
> 출하 시점의 단가/수량은 수주 라인에서 참조하므로 별도 금액 컬럼 불필요.
```

#### shipment_lines (출하 라인)
```sql
CREATE TABLE shipment_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id         UUID REFERENCES shipments(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES products(id),
    order_line_id       UUID REFERENCES sales_order_lines(id),
    quantity            DECIMAL(15,3) NOT NULL,
    unit_price          DECIMAL(15,2) DEFAULT 0,            -- 수주 라인 단가 스냅샷
    amount              DECIMAL(15,2) DEFAULT 0,            -- 금액 (수량 x 단가)
    warehouse_id        UUID REFERENCES warehouses(id),     -- 출고 창고
    line_no             INTEGER DEFAULT 1
);
```

---

## 3. 데이터 흐름

### 3.1 수주생산 (Make-to-Order) 흐름
```
수주 확정 (M2)
  → 작업지시서 생성 (수주→작업지시서 전환)
  → BOM 기반 원자재 출고 (원자재 창고 → WIP)
  → 생산 진행 (produced_qty 업데이트)
  → 생산 완료 → QC 검사 요청
  → QC 합격 → 완제품 창고 입고
  → QC 불합격 → 불량품 창고 / 재작업
  → 출하지시서 생성 (수주→출하 전환)
  → 피킹 → 출하 → 배송 추적 → 배송 완료
```

### 3.2 계획생산 (Make-to-Stock) 흐름
```
생산 계획 수립
  → 작업지시서 수동 생성 (order_type=make_to_stock)
  → 이하 동일 (BOM 출고 → 생산 → QC → 완제품 입고)
```

### 3.3 수주 상태 연동
```
작업지시서 생성 → sales_orders.status = 'in_production'
작업지시서 완료 (QC 합격) → sales_order_lines.produced_qty 업데이트
출하 완료 → sales_order_lines.shipped_qty 업데이트
전체 라인 출하 완료 → sales_orders.status = 'shipped'
```

### 3.4 MRP 부족 재고 알림
```
BOM 트리 전개 → 총 소요 원자재 계산 (재귀 탐색)
  → 현재 원자재 창고(WH-RAW) 가용 재고(status=available)와 비교
  → products.safety_stock(안전재고) 기준 미달 품목 식별
  → 부족분 목록 생성 → 발주 알림
```
> **안전재고 참조**: `products.safety_stock` (M1 테이블) 값을 기준으로 판단.

---

## 4. API 설계

### 4.1 백엔드 파일 구조
```
src/backend/modules/m5_production/
├── __init__.py
├── models.py
├── schemas/
│   ├── __init__.py
│   ├── bom.py
│   ├── inventory.py
│   ├── work_orders.py
│   ├── qc.py
│   └── shipments.py
├── services/
│   ├── __init__.py
│   ├── bom_service.py
│   ├── inventory_service.py
│   ├── work_order_service.py
│   ├── qc_service.py
│   └── shipment_service.py
└── routers/
    ├── __init__.py
    ├── bom_router.py
    ├── inventory_router.py
    ├── work_order_router.py
    ├── qc_router.py
    └── shipment_router.py
```

### 4.2 엔드포인트 요약 (약 35개)

#### BOM 관리 (/production/bom)
- GET / — 목록 조회 (품목 필터)
- POST / — BOM 등록 (헤더+라인)
- GET /{id} — 상세 조회
- PUT /{id} — 수정
- DELETE /{id} — 삭제
- GET /{id}/tree — 다단계 BOM 트리 전개
- GET /{id}/materials — 소요 원자재 평탄화 목록

#### 창고 관리 (/production/warehouses)
- GET / — 창고 목록
- POST / — 창고 등록

#### 재고 관리 (/production/inventory)
- GET / — 재고 현황 (창고별/품목별)
- POST /receive — 입고
- POST /issue — 출고
- POST /transfer — 창고 간 이관
- POST /adjust — 재고 조정
- GET /transactions — 이동 이력
- GET /shortage — 부족 재고 목록 (안전재고 대비)

#### 작업지시서 (/production/work-orders)
- GET / — 목록 (상태/기간 필터)
- POST / — 등록 (계획생산)
- GET /{id} — 상세
- PUT /{id} — 수정
- POST /from-order/{order_id} — 수주→작업지시서 전환
- PUT /{id}/status — 상태 변경
- PUT /{id}/progress — 생산 수량 보고

#### QC 검사 (/production/qc)
- POST / — 검사 등록 (합격 시 자동 재고 이관)
- GET / — 검사 이력 (작업지시서 필터)

#### 출하 관리 (/production/shipments)
- GET / — 목록 (상태/기간 필터)
- POST / — 등록
- GET /{id} — 상세
- PUT /{id} — 수정
- POST /from-order/{order_id} — 수주→출하지시서 생성
- PUT /{id}/status — 상태 변경 (배송 추적)
- GET /{id}/delivery-note — 거래명세서 데이터

#### 보고서 (/production/reports)
- GET /dashboard — 대시보드 요약
- GET /inventory-report — 재고 보고서
- GET /production-report — 생산 현황 보고서

---

## 5. 프론트엔드 UI

### 5.1 페이지 구성
```
생산관리 (ProductionPage) — 카드 그리드 메인 (M2 SalesPage 패턴)
├── BomPage             — 트리 뷰 + CRUD 모달
├── InventoryPage       — 창고별 탭 + 입출고/이관 모달
├── WorkOrdersPage      — 칸반 보드 + 리스트 뷰 전환
├── QcPage              — 검사 등록/이력 테이블
├── ShipmentsPage       — 출하 목록 + 배송 추적 스텝바
└── ProductionDashboardPage — 요약카드 + 부족재고 알림
```

### 5.2 핵심 UI 컴포넌트
| 페이지 | 핵심 UX |
|---|---|
| BomPage | 트리 구조 시각화 (들여쓰기 + 접기/펼치기), 품목 검색 모달 |
| InventoryPage | 4개 탭 (원자재/WIP/완제품/불량), 안전재고 미달 빨간색 강조 |
| WorkOrdersPage | 칸반 보드 (대기/진행중/QC대기/완료) — status 컬럼으로 직접 구현, 버튼 클릭 상태변경 + 리스트뷰 토글 |
| ShipmentsPage | 배송 상태 스텝 인디케이터 (준비→피킹→출하→배송완료) |
| ProductionDashboardPage | 생산 진행률 카드, 재고 현황, 부족 원자재 알림 목록 |

---

## 6. 구현 Step 순서

```
Step 5-1: DB 스키마 9개 테이블 + Alembic 마이그레이션 + 시드 데이터 (창고 4개)
Step 5-2: BOM 관리 CRUD (다단계 트리 전개 + 소요량 계산)
Step 5-3: 재고 관리 (창고 CRUD + 입출고/이관 + 이력 조회 + 부족 알림)
Step 5-4: 작업지시서 (CRUD + 수주→작업지시서 전환 + 칸반 UI)
Step 5-5: QC 검사 (등록 + 합격 시 완제품 창고 자동 이관)
Step 5-6: 출하 관리 (수주→출하지시서 + 배송 추적 + 거래명세서)
Step 5-7: 생산 대시보드 + 보고서 + ProductionPage 메인
```

---

## 7. 번호 자동 생성 규칙

| 문서 | 패턴 | 예시 |
|---|---|---|
| 작업지시서 | WO-YYYYMM-NNNN | WO-202603-0001 |
| 출하지시서 | SH-YYYYMM-NNNN | SH-202603-0001 |
| 거래명세서 | DN-YYYYMM-NNNN | DN-202603-0001 |
