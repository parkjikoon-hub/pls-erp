"""
PLS ERP — 더미 데이터 시뮬레이션 스크립트
실제 업무 플로우를 재현하여 전체 시스템을 검증합니다.

사용법:
  python scripts/seed_demo_data.py                              # 로컬 (기본 http://localhost:8000)
  python scripts/seed_demo_data.py --base-url https://pls-erp-api.onrender.com  # 배포 서버

더미 데이터 식별:
  - 모든 코드에 'DEMO-' 접두사 사용
  - 삭제 시: python scripts/seed_demo_data.py --cleanup
"""
import argparse
import sys
import json
from datetime import date, timedelta

try:
    import httpx
except ImportError:
    print("httpx 패키지가 필요합니다. 설치: pip install httpx")
    sys.exit(1)

# ── 설정 ──
DEMO_PREFIX = "DEMO-"
ADMIN_EMAIL = "admin@pls-erp.com"
ADMIN_PASSWORD = "admin1234"


def log(step, msg, ok=True):
    """진행 상황 출력"""
    icon = "[성공]" if ok else "[실패]"
    print(f"  {icon} Step {step}: {msg}")


def api(client, method, path, data=None, token=None, params=None):
    """API 호출 헬퍼"""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = getattr(client, method)(
        path, json=data, headers=headers, params=params, timeout=30.0,
    )
    return resp


def run_seed(base_url):
    """더미 데이터 생성 — 실제 업무 플로우 재현"""
    client = httpx.Client(base_url=base_url)
    results = {}  # 생성된 데이터 ID 저장

    print(f"\n{'='*60}")
    print(f"  PLS ERP 더미 데이터 시뮬레이션")
    print(f"  서버: {base_url}")
    print(f"  모든 더미 데이터에 '{DEMO_PREFIX}' 접두사 사용")
    print(f"{'='*60}\n")

    # ──────────────────────────────────────
    # 1. 로그인
    # ──────────────────────────────────────
    print("[1/11] 관리자 로그인...")
    resp = api(client, "post", "/api/v1/auth/login", {
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        print(f"  [실패] 로그인 실패: {resp.status_code} {resp.text}")
        return False
    token = resp.json()["access_token"]
    user_name = resp.json().get("user_name", "관리자")
    log(1, f"로그인 성공 — {user_name}")

    # ──────────────────────────────────────
    # 2. 거래처 5개 생성
    # ──────────────────────────────────────
    print("\n[2/11] 거래처(고객사/공급사) 생성...")
    customers_data = [
        {"code": f"{DEMO_PREFIX}CUST001", "name": "(데모)한빛전자", "business_no": "1234567890",
         "ceo_name": "김한빛", "business_type": "제조업", "business_item": "전자부품",
         "customer_type": "customer", "credit_limit": 50000000, "payment_terms": 30},
        {"code": f"{DEMO_PREFIX}CUST002", "name": "(데모)삼성부품", "business_no": "2345678901",
         "ceo_name": "이삼성", "business_type": "도매업", "business_item": "기계부품",
         "customer_type": "supplier", "credit_limit": 100000000, "payment_terms": 60},
        {"code": f"{DEMO_PREFIX}CUST003", "name": "(데모)대한기계", "business_no": "3456789012",
         "ceo_name": "박대한", "business_type": "제조업", "business_item": "산업기계",
         "customer_type": "both", "credit_limit": 80000000, "payment_terms": 45},
        {"code": f"{DEMO_PREFIX}CUST004", "name": "(데모)서울물산", "business_no": "4567890123",
         "ceo_name": "최서울", "business_type": "도소매", "business_item": "산업자재",
         "customer_type": "customer", "credit_limit": 30000000, "payment_terms": 30},
        {"code": f"{DEMO_PREFIX}CUST005", "name": "(데모)글로벌테크", "business_no": "5678901234",
         "ceo_name": "정글로벌", "business_type": "수출입", "business_item": "IT부품",
         "customer_type": "supplier", "credit_limit": 200000000, "payment_terms": 90},
    ]
    results["customers"] = []
    for c in customers_data:
        resp = api(client, "post", "/api/v1/system/customers", c, token)
        if resp.status_code in (200, 201):
            cid = resp.json()["id"]
            results["customers"].append(cid)
            log(2, f"거래처 '{c['name']}' 생성 (ID: {cid[:8]}...)")
        else:
            log(2, f"거래처 '{c['name']}' 생성 실패: {resp.status_code}", ok=False)

    # ──────────────────────────────────────
    # 3. 품목 카테고리 + 품목 생성
    # ──────────────────────────────────────
    print("\n[3/11] 품목 카테고리 및 품목 생성...")
    categories = [
        {"code": f"{DEMO_PREFIX}CAT01", "name": "(데모)전자부품", "sort_order": 1},
        {"code": f"{DEMO_PREFIX}CAT02", "name": "(데모)기계부품", "sort_order": 2},
        {"code": f"{DEMO_PREFIX}CAT03", "name": "(데모)원자재", "sort_order": 3},
    ]
    results["categories"] = []
    for cat in categories:
        resp = api(client, "post", "/api/v1/system/product-categories", cat, token)
        if resp.status_code in (200, 201):
            results["categories"].append(resp.json()["id"])
            log(3, f"카테고리 '{cat['name']}' 생성")

    products_data = [
        {"code": f"{DEMO_PREFIX}PROD001", "name": "(데모)LED 모듈 A", "product_type": "product",
         "unit": "EA", "standard_price": 15000, "cost_price": 10000, "safety_stock": 100},
        {"code": f"{DEMO_PREFIX}PROD002", "name": "(데모)센서 유닛 B", "product_type": "product",
         "unit": "EA", "standard_price": 25000, "cost_price": 18000, "safety_stock": 50},
        {"code": f"{DEMO_PREFIX}PROD003", "name": "(데모)모터 어셈블리 C", "product_type": "product",
         "unit": "SET", "standard_price": 120000, "cost_price": 85000, "safety_stock": 20},
        {"code": f"{DEMO_PREFIX}PROD004", "name": "(데모)PCB 기판", "product_type": "material",
         "unit": "EA", "standard_price": 5000, "cost_price": 3000, "safety_stock": 500},
        {"code": f"{DEMO_PREFIX}PROD005", "name": "(데모)알루미늄 프레임", "product_type": "material",
         "unit": "M", "standard_price": 8000, "cost_price": 5500, "safety_stock": 200},
        {"code": f"{DEMO_PREFIX}PROD006", "name": "(데모)배선 하네스", "product_type": "material",
         "unit": "SET", "standard_price": 3000, "cost_price": 1800, "safety_stock": 300},
        {"code": f"{DEMO_PREFIX}PROD007", "name": "(데모)반도체 칩 D", "product_type": "semi",
         "unit": "EA", "standard_price": 2000, "cost_price": 1200, "safety_stock": 1000},
        {"code": f"{DEMO_PREFIX}PROD008", "name": "(데모)냉각 팬 유닛", "product_type": "product",
         "unit": "EA", "standard_price": 35000, "cost_price": 22000, "safety_stock": 30},
    ]
    results["products"] = []
    for p in products_data:
        if results["categories"]:
            p["category_id"] = results["categories"][0]
        resp = api(client, "post", "/api/v1/system/products", p, token)
        if resp.status_code in (200, 201):
            pid = resp.json()["id"]
            results["products"].append({"id": pid, "name": p["name"], "price": p["standard_price"]})
            log(3, f"품목 '{p['name']}' 생성")
        else:
            log(3, f"품목 '{p['name']}' 실패: {resp.status_code}", ok=False)

    # ──────────────────────────────────────
    # 4. 견적서 3건 생성
    # ──────────────────────────────────────
    print("\n[4/11] 견적서 생성...")
    results["quotations"] = []
    if results["customers"] and results["products"]:
        today = date.today()
        quotations = [
            {
                "quote_date": str(today),
                "valid_until": str(today + timedelta(days=30)),
                "customer_id": results["customers"][0],
                "notes": f"{DEMO_PREFIX}견적서 — LED 모듈 납품 건",
                "lines": [
                    {"product_id": results["products"][0]["id"],
                     "product_name": results["products"][0]["name"],
                     "quantity": 100, "unit_price": 15000},
                    {"product_id": results["products"][1]["id"],
                     "product_name": results["products"][1]["name"],
                     "quantity": 50, "unit_price": 25000},
                ]
            },
            {
                "quote_date": str(today - timedelta(days=5)),
                "valid_until": str(today + timedelta(days=25)),
                "customer_id": results["customers"][2],
                "notes": f"{DEMO_PREFIX}견적서 — 모터 어셈블리 대량 주문",
                "lines": [
                    {"product_id": results["products"][2]["id"],
                     "product_name": results["products"][2]["name"],
                     "quantity": 30, "unit_price": 120000},
                ]
            },
            {
                "quote_date": str(today - timedelta(days=10)),
                "valid_until": str(today + timedelta(days=20)),
                "customer_id": results["customers"][3],
                "notes": f"{DEMO_PREFIX}견적서 — 냉각팬 시스템 납품",
                "lines": [
                    {"product_id": results["products"][7]["id"],
                     "product_name": results["products"][7]["name"],
                     "quantity": 200, "unit_price": 35000},
                    {"product_id": results["products"][5]["id"],
                     "product_name": results["products"][5]["name"],
                     "quantity": 200, "unit_price": 3000},
                ]
            },
        ]
        for i, q in enumerate(quotations):
            resp = api(client, "post", "/api/v1/sales/quotations", q, token)
            if resp.status_code in (200, 201):
                qid = resp.json()["id"]
                qno = resp.json().get("quote_no", "?")
                results["quotations"].append(qid)
                log(4, f"견적서 {qno} 생성 (총액: {resp.json().get('grand_total', 0):,.0f}원)")
            else:
                log(4, f"견적서 {i+1} 실패: {resp.status_code} {resp.text[:100]}", ok=False)

    # ──────────────────────────────────────
    # 5. 견적서 → 수주 전환 2건
    # ──────────────────────────────────────
    print("\n[5/11] 견적서 → 수주 전환...")
    results["orders"] = []
    for qid in results["quotations"][:2]:
        today_str = str(date.today())
        resp = api(client, "post", f"/api/v1/sales/orders/from-quotation/{qid}",
                   token=token, params={"order_date": today_str})
        if resp.status_code in (200, 201):
            oid = resp.json()["id"]
            ono = resp.json().get("order_no", "?")
            results["orders"].append(oid)
            log(5, f"수주 {ono} 생성 (견적 → 수주 전환 완료)")
        else:
            log(5, f"수주 전환 실패: {resp.status_code} {resp.text[:100]}", ok=False)

    # ──────────────────────────────────────
    # 6. 수주 → 작업지시서 생성
    # ──────────────────────────────────────
    print("\n[6/11] 수주 → 작업지시서 생성...")
    results["work_orders"] = []
    for oid in results["orders"][:1]:
        resp = api(client, "post", f"/api/v1/production/work-orders/from-order/{oid}", token=token)
        if resp.status_code in (200, 201):
            woid = resp.json()["id"]
            wono = resp.json().get("wo_no", "?")
            results["work_orders"].append(woid)
            log(6, f"작업지시서 {wono} 생성")
        else:
            log(6, f"작업지시서 실패: {resp.status_code} {resp.text[:100]}", ok=False)

    # ──────────────────────────────────────
    # 7. 재고 입고
    # ──────────────────────────────────────
    print("\n[7/11] 재고 입고 처리...")
    # 먼저 창고 목록 조회
    resp = api(client, "get", "/api/v1/production/inventory/warehouses", token=token)
    warehouses = {}
    if resp.status_code == 200:
        for w in resp.json():
            warehouses[w["zone_type"]] = w["id"]

    if warehouses.get("raw") and results["products"]:
        materials = [p for p in results["products"] if "PCB" in p["name"] or "알루미늄" in p["name"]
                     or "배선" in p["name"] or "반도체" in p["name"]]
        for mat in materials:
            resp = api(client, "post", "/api/v1/production/inventory/receive", {
                "product_id": mat["id"],
                "warehouse_id": warehouses["raw"],
                "quantity": 500,
                "unit_cost": mat["price"],
                "reference_type": "purchase",
                "reference_no": f"{DEMO_PREFIX}PO-001",
                "memo": f"{DEMO_PREFIX}초기 원자재 입고"
            }, token)
            if resp.status_code in (200, 201):
                log(7, f"입고: {mat['name']} 500개 → 원자재 창고")
            else:
                log(7, f"입고 실패: {mat['name']} — {resp.status_code}", ok=False)

    if warehouses.get("finished") and results["products"]:
        finished = [p for p in results["products"] if "LED" in p["name"] or "센서" in p["name"]]
        for fp in finished:
            resp = api(client, "post", "/api/v1/production/inventory/receive", {
                "product_id": fp["id"],
                "warehouse_id": warehouses["finished"],
                "quantity": 200,
                "unit_cost": fp["price"],
                "reference_type": "production",
                "reference_no": f"{DEMO_PREFIX}PROD-001",
                "memo": f"{DEMO_PREFIX}완제품 입고"
            }, token)
            if resp.status_code in (200, 201):
                log(7, f"입고: {fp['name']} 200개 → 완제품 창고")

    # ──────────────────────────────────────
    # 8. 재고 이관 테스트
    # ──────────────────────────────────────
    print("\n[8/11] 재고 이관 테스트...")
    if warehouses.get("raw") and warehouses.get("wip") and materials:
        resp = api(client, "post", "/api/v1/production/inventory/transfer", {
            "product_id": materials[0]["id"],
            "from_warehouse_id": warehouses["raw"],
            "to_warehouse_id": warehouses["wip"],
            "quantity": 50,
            "memo": f"{DEMO_PREFIX}생산 투입용 이관"
        }, token)
        if resp.status_code in (200, 201):
            log(8, f"이관: {materials[0]['name']} 50개 (원자재 → 생산중)")
        else:
            log(8, f"이관 실패: {resp.status_code}", ok=False)

    # ──────────────────────────────────────
    # 9. 직원 등록
    # ──────────────────────────────────────
    print("\n[9/11] 직원 등록...")
    # 기존 부서/직급 조회
    resp = api(client, "get", "/api/v1/system/departments", token=token)
    depts = resp.json().get("items", []) if resp.status_code == 200 else []
    resp = api(client, "get", "/api/v1/system/positions", token=token)
    positions = resp.json().get("items", []) if resp.status_code == 200 else []

    dept_id = depts[1]["id"] if len(depts) > 1 else None
    pos_id = positions[-1]["id"] if positions else None

    employees = [
        {"employee_no": f"{DEMO_PREFIX}EMP101", "name": "(데모)김영업", "hire_date": "2024-03-01",
         "base_salary": 3500000, "employee_type": "regular"},
        {"employee_no": f"{DEMO_PREFIX}EMP102", "name": "(데모)이생산", "hire_date": "2024-06-15",
         "base_salary": 3200000, "employee_type": "regular"},
        {"employee_no": f"{DEMO_PREFIX}EMP103", "name": "(데모)박회계", "hire_date": "2025-01-10",
         "base_salary": 3800000, "employee_type": "regular"},
        {"employee_no": f"{DEMO_PREFIX}EMP104", "name": "(데모)최인사", "hire_date": "2025-03-01",
         "base_salary": 3000000, "employee_type": "contract"},
        {"employee_no": f"{DEMO_PREFIX}EMP105", "name": "(데모)정개발", "hire_date": "2024-01-15",
         "base_salary": 4200000, "employee_type": "regular"},
    ]
    results["employees"] = []
    for emp in employees:
        if dept_id:
            emp["department_id"] = dept_id
        if pos_id:
            emp["position_id"] = pos_id
        resp = api(client, "post", "/api/v1/hr/employees", emp, token)
        if resp.status_code in (200, 201):
            eid = resp.json()["id"]
            results["employees"].append(eid)
            log(9, f"직원 '{emp['name']}' 등록 (사번: {emp['employee_no']})")
        else:
            log(9, f"직원 '{emp['name']}' 실패: {resp.status_code} {resp.text[:100]}", ok=False)

    # ──────────────────────────────────────
    # 10. 계정과목 + 전표
    # ──────────────────────────────────────
    print("\n[10/11] 계정과목 및 전표 생성...")
    accounts_data = [
        {"code": f"{DEMO_PREFIX}1000", "name": "(데모)현금", "account_type": "asset",
         "account_group": "유동자산", "normal_balance": "debit", "sort_order": 1},
        {"code": f"{DEMO_PREFIX}1100", "name": "(데모)보통예금", "account_type": "asset",
         "account_group": "유동자산", "normal_balance": "debit", "sort_order": 2},
        {"code": f"{DEMO_PREFIX}2000", "name": "(데모)외상매입금", "account_type": "liability",
         "account_group": "유동부채", "normal_balance": "credit", "sort_order": 3},
        {"code": f"{DEMO_PREFIX}4000", "name": "(데모)제품매출", "account_type": "revenue",
         "account_group": "영업수익", "normal_balance": "credit", "sort_order": 4},
        {"code": f"{DEMO_PREFIX}5000", "name": "(데모)원재료비", "account_type": "expense",
         "account_group": "매출원가", "normal_balance": "debit", "sort_order": 5},
    ]
    results["accounts"] = []
    for acc in accounts_data:
        resp = api(client, "post", "/api/v1/finance/accounts", acc, token)
        if resp.status_code in (200, 201):
            aid = resp.json()["id"]
            results["accounts"].append({"id": aid, "name": acc["name"], "type": acc["account_type"]})
            log(10, f"계정과목 '{acc['name']}' 생성")
        else:
            log(10, f"계정과목 '{acc['name']}' 실패: {resp.status_code}", ok=False)

    # 전표 생성 (차변/대변 균형)
    if len(results["accounts"]) >= 4:
        cash = results["accounts"][0]  # 현금
        deposit = results["accounts"][1]  # 보통예금
        revenue = results["accounts"][3]  # 매출
        expense = results["accounts"][4]  # 원재료비

        journals = [
            {
                "entry_date": str(date.today() - timedelta(days=15)),
                "entry_type": "sales",
                "description": f"{DEMO_PREFIX}LED 모듈 매출 — 한빛전자",
                "lines": [
                    {"account_id": cash["id"], "debit_amount": 1650000, "credit_amount": 0,
                     "description": f"{DEMO_PREFIX}현금 수금"},
                    {"account_id": revenue["id"], "debit_amount": 0, "credit_amount": 1650000,
                     "description": f"{DEMO_PREFIX}LED 모듈 100EA 매출"},
                ]
            },
            {
                "entry_date": str(date.today() - timedelta(days=10)),
                "entry_type": "purchase",
                "description": f"{DEMO_PREFIX}PCB 기판 매입 — 삼성부품",
                "lines": [
                    {"account_id": expense["id"], "debit_amount": 1500000, "credit_amount": 0,
                     "description": f"{DEMO_PREFIX}PCB 기판 500EA 매입"},
                    {"account_id": deposit["id"], "debit_amount": 0, "credit_amount": 1500000,
                     "description": f"{DEMO_PREFIX}보통예금 출금"},
                ]
            },
            {
                "entry_date": str(date.today() - timedelta(days=3)),
                "entry_type": "sales",
                "description": f"{DEMO_PREFIX}모터 어셈블리 매출 — 대한기계",
                "lines": [
                    {"account_id": deposit["id"], "debit_amount": 3960000, "credit_amount": 0,
                     "description": f"{DEMO_PREFIX}계좌이체 수금"},
                    {"account_id": revenue["id"], "debit_amount": 0, "credit_amount": 3960000,
                     "description": f"{DEMO_PREFIX}모터 어셈블리 30SET 매출"},
                ]
            },
        ]
        results["journals"] = []
        for j in journals:
            resp = api(client, "post", "/api/v1/finance/journals", j, token)
            if resp.status_code in (200, 201):
                jid = resp.json()["id"]
                jno = resp.json().get("entry_no", "?")
                results["journals"].append(jid)
                log(10, f"전표 {jno} 생성 ({j['entry_type']})")
            else:
                log(10, f"전표 실패: {resp.status_code} {resp.text[:150]}", ok=False)

    # ──────────────────────────────────────
    # 11. 대시보드 검증
    # ──────────────────────────────────────
    print("\n[11/11] 대시보드 데이터 검증...")
    resp = api(client, "get", "/api/v1/dashboard/summary", token=token)
    if resp.status_code == 200:
        cards = resp.json().get("cards", {})
        log(11, f"거래처 수: {cards.get('customer_count', 0)}")
        log(11, f"품목 수: {cards.get('product_count', 0)}")
        log(11, f"사용자 수: {cards.get('user_count', 0)}")
        log(11, f"이번 달 매출: {cards.get('month_sales', 0):,.0f}원")
        log(11, f"진행중 수주: {cards.get('active_orders', 0)}건")
        log(11, f"재고 품목: {cards.get('inventory_items', 0)}종")
    else:
        log(11, f"대시보드 조회 실패: {resp.status_code}", ok=False)

    # 월별 매출 그래프
    resp = api(client, "get", "/api/v1/dashboard/monthly-sales",
               token=token, params={"year": date.today().year})
    if resp.status_code == 200:
        data = resp.json().get("data", [])
        this_month = next((d for d in data if d["month"] == date.today().month), None)
        if this_month:
            log(11, f"이번 달 매출 그래프: {this_month['amount']:,.0f}원 / {this_month['order_count']}건")

    # ── 결과 요약 ──
    print(f"\n{'='*60}")
    print(f"  시뮬레이션 완료!")
    print(f"{'='*60}")
    print(f"  생성된 데이터:")
    print(f"    거래처:    {len(results.get('customers', []))}개")
    print(f"    품목:      {len(results.get('products', []))}개")
    print(f"    견적서:    {len(results.get('quotations', []))}건")
    print(f"    수주:      {len(results.get('orders', []))}건")
    print(f"    작업지시:  {len(results.get('work_orders', []))}건")
    print(f"    직원:      {len(results.get('employees', []))}명")
    print(f"    계정과목:  {len(results.get('accounts', []))}개")
    print(f"    전표:      {len(results.get('journals', []))}건")
    print(f"\n  모든 더미 데이터는 '{DEMO_PREFIX}' 접두사로 식별됩니다.")
    print(f"  삭제: python scripts/seed_demo_data.py --cleanup --base-url {base_url}")
    print(f"{'='*60}\n")

    client.close()
    return True


def run_cleanup(base_url):
    """DEMO- 접두사 데이터만 삭제"""
    client = httpx.Client(base_url=base_url)

    print(f"\n{'='*60}")
    print(f"  PLS ERP 더미 데이터 삭제")
    print(f"  서버: {base_url}")
    print(f"  '{DEMO_PREFIX}' 접두사 데이터만 삭제합니다.")
    print(f"{'='*60}\n")

    # 로그인
    resp = api(client, "post", "/api/v1/auth/login", {
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        print("로그인 실패")
        return
    token = resp.json()["access_token"]

    deleted = {"customers": 0, "products": 0, "categories": 0,
               "employees": 0, "accounts": 0, "quotations": 0, "orders": 0}

    # 견적서 삭제 (수주가 연결되지 않은 것만)
    print("[1/6] 견적서 삭제...")
    resp = api(client, "get", "/api/v1/sales/quotations", token=token, params={"size": 100})
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for item in items:
            if item.get("notes", "").startswith(DEMO_PREFIX) or DEMO_PREFIX in item.get("notes", ""):
                r = api(client, "delete", f"/api/v1/sales/quotations/{item['id']}", token=token)
                if r.status_code in (200, 204):
                    deleted["quotations"] += 1

    # 수주 삭제
    print("[2/6] 수주 삭제...")
    resp = api(client, "get", "/api/v1/sales/orders", token=token, params={"size": 100})
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for item in items:
            if item.get("notes", "").startswith(DEMO_PREFIX) or DEMO_PREFIX in item.get("notes", ""):
                r = api(client, "delete", f"/api/v1/sales/orders/{item['id']}", token=token)
                if r.status_code in (200, 204):
                    deleted["orders"] += 1

    # 거래처 삭제
    print("[3/6] 거래처 삭제...")
    resp = api(client, "get", "/api/v1/system/customers", token=token, params={"size": 100})
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for item in items:
            if item.get("code", "").startswith(DEMO_PREFIX):
                r = api(client, "delete", f"/api/v1/system/customers/{item['id']}", token=token)
                if r.status_code in (200, 204):
                    deleted["customers"] += 1

    # 품목 삭제
    print("[4/6] 품목 삭제...")
    resp = api(client, "get", "/api/v1/system/products", token=token, params={"size": 100})
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for item in items:
            if item.get("code", "").startswith(DEMO_PREFIX):
                r = api(client, "delete", f"/api/v1/system/products/{item['id']}", token=token)
                if r.status_code in (200, 204):
                    deleted["products"] += 1

    # 직원 삭제
    print("[5/6] 직원 삭제...")
    resp = api(client, "get", "/api/v1/hr/employees", token=token, params={"size": 100})
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for item in items:
            if item.get("employee_no", "").startswith(DEMO_PREFIX):
                r = api(client, "delete", f"/api/v1/hr/employees/{item['id']}", token=token)
                if r.status_code in (200, 204):
                    deleted["employees"] += 1

    # 계정과목 삭제 (전표에 연결된 것은 삭제 불가할 수 있음)
    print("[6/6] 계정과목 삭제...")
    resp = api(client, "get", "/api/v1/finance/accounts", token=token, params={"size": 100})
    if resp.status_code == 200:
        items = resp.json().get("items", [])
        for item in items:
            if item.get("code", "").startswith(DEMO_PREFIX):
                # 계정과목은 비활성화로 처리
                r = api(client, "put", f"/api/v1/finance/accounts/{item['id']}",
                        {"is_active": False}, token)
                if r.status_code in (200, 204):
                    deleted["accounts"] += 1

    print(f"\n{'='*60}")
    print(f"  삭제 완료!")
    print(f"  거래처: {deleted['customers']}개")
    print(f"  품목: {deleted['products']}개")
    print(f"  직원: {deleted['employees']}명")
    print(f"  계정과목: {deleted['accounts']}개 (비활성화)")
    print(f"  견적서: {deleted['quotations']}건")
    print(f"  수주: {deleted['orders']}건")
    print(f"{'='*60}\n")

    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PLS ERP 더미 데이터 시뮬레이션")
    parser.add_argument("--base-url", default="http://localhost:8000",
                        help="API 서버 URL (기본: http://localhost:8000)")
    parser.add_argument("--cleanup", action="store_true",
                        help="DEMO- 접두사 데이터만 삭제")
    args = parser.parse_args()

    if args.cleanup:
        run_cleanup(args.base_url)
    else:
        run_seed(args.base_url)
