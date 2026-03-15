"""
M4 재무/회계 — 시드 데이터
한국 표준 계정과목 ~60개 + 2026년 회계연도를 투입합니다.

실행: cd PLS_ERP_Program && python -m src.backend.seeds.m4_seed
"""
import asyncio
from datetime import date
from sqlalchemy import select
from src.backend.database import AsyncSessionLocal
# M1 모델을 먼저 import하여 relationship 해석에 필요한 Customer 등록
from src.backend.modules.m1_system.models import Customer  # noqa: F401
from src.backend.modules.m4_finance.models import ChartOfAccounts, FiscalYear


# 한국 표준 계정과목 (코드, 이름, 유형, 그룹, 정상잔액)
ACCOUNTS = [
    # ── 자산 (Asset) ──
    ("101", "현금",           "asset", "유동자산", "debit"),
    ("102", "보통예금",       "asset", "유동자산", "debit"),
    ("103", "정기예금",       "asset", "유동자산", "debit"),
    ("104", "정기적금",       "asset", "유동자산", "debit"),
    ("108", "매출채권",       "asset", "유동자산", "debit"),
    ("109", "받을어음",       "asset", "유동자산", "debit"),
    ("110", "미수금",         "asset", "유동자산", "debit"),
    ("111", "선급금",         "asset", "유동자산", "debit"),
    ("112", "선급비용",       "asset", "유동자산", "debit"),
    ("113", "부가세대급금",   "asset", "유동자산", "debit"),
    ("120", "재고자산",       "asset", "유동자산", "debit"),
    ("121", "원재료",         "asset", "유동자산", "debit"),
    ("122", "재공품",         "asset", "유동자산", "debit"),
    ("123", "제품",           "asset", "유동자산", "debit"),
    ("124", "상품",           "asset", "유동자산", "debit"),
    ("201", "토지",           "asset", "비유동자산", "debit"),
    ("202", "건물",           "asset", "비유동자산", "debit"),
    ("203", "기계장치",       "asset", "비유동자산", "debit"),
    ("204", "차량운반구",     "asset", "비유동자산", "debit"),
    ("205", "비품",           "asset", "비유동자산", "debit"),
    ("206", "감가상각누계액", "asset", "비유동자산", "credit"),  # 차감 계정
    ("210", "영업권",         "asset", "비유동자산", "debit"),
    ("211", "특허권",         "asset", "비유동자산", "debit"),
    ("212", "소프트웨어",     "asset", "비유동자산", "debit"),

    # ── 부채 (Liability) ──
    ("301", "매입채무",       "liability", "유동부채", "credit"),
    ("302", "지급어음",       "liability", "유동부채", "credit"),
    ("303", "미지급금",       "liability", "유동부채", "credit"),
    ("304", "미지급비용",     "liability", "유동부채", "credit"),
    ("305", "선수금",         "liability", "유동부채", "credit"),
    ("306", "예수금",         "liability", "유동부채", "credit"),
    ("307", "부가세예수금",   "liability", "유동부채", "credit"),
    ("308", "단기차입금",     "liability", "유동부채", "credit"),
    ("309", "미지급법인세",   "liability", "유동부채", "credit"),
    ("351", "장기차입금",     "liability", "비유동부채", "credit"),
    ("352", "퇴직급여충당부채", "liability", "비유동부채", "credit"),

    # ── 자본 (Equity) ──
    ("401", "자본금",         "equity", "자본금", "credit"),
    ("402", "자본잉여금",     "equity", "자본잉여금", "credit"),
    ("403", "이익잉여금",     "equity", "이익잉여금", "credit"),
    ("404", "미처분이익잉여금", "equity", "이익잉여금", "credit"),

    # ── 수익 (Revenue) ──
    ("501", "상품매출",       "revenue", "매출", "credit"),
    ("502", "제품매출",       "revenue", "매출", "credit"),
    ("503", "용역매출",       "revenue", "매출", "credit"),
    ("510", "이자수익",       "revenue", "영업외수익", "credit"),
    ("511", "잡이익",         "revenue", "영업외수익", "credit"),
    ("512", "유형자산처분이익", "revenue", "영업외수익", "credit"),

    # ── 비용 (Expense) ──
    ("601", "매출원가",       "expense", "매출원가", "debit"),
    ("602", "급여",           "expense", "판관비", "debit"),
    ("603", "퇴직급여",       "expense", "판관비", "debit"),
    ("604", "복리후생비",     "expense", "판관비", "debit"),
    ("605", "임차료",         "expense", "판관비", "debit"),
    ("606", "접대비",         "expense", "판관비", "debit"),
    ("607", "감가상각비",     "expense", "판관비", "debit"),
    ("608", "통신비",         "expense", "판관비", "debit"),
    ("609", "수도광열비",     "expense", "판관비", "debit"),
    ("610", "소모품비",       "expense", "판관비", "debit"),
    ("611", "세금과공과",     "expense", "판관비", "debit"),
    ("612", "보험료",         "expense", "판관비", "debit"),
    ("613", "운반비",         "expense", "판관비", "debit"),
    ("614", "외주가공비",     "expense", "제조원가", "debit"),
    ("615", "여비교통비",     "expense", "판관비", "debit"),
    ("616", "차량유지비",     "expense", "판관비", "debit"),
    ("617", "광고선전비",     "expense", "판관비", "debit"),
    ("618", "이자비용",       "expense", "영업외비용", "debit"),
    ("619", "잡손실",         "expense", "영업외비용", "debit"),
    ("620", "연구개발비",     "expense", "판관비", "debit"),
    ("621", "교육훈련비",     "expense", "판관비", "debit"),
    ("622", "도서인쇄비",     "expense", "판관비", "debit"),
    ("623", "지급수수료",     "expense", "판관비", "debit"),
    ("624", "법인세비용",     "expense", "법인세", "debit"),
]


async def seed_m4_data():
    """M4 시드 데이터 투입 (계정과목 + 회계연도)"""
    async with AsyncSessionLocal() as db:
        try:
            # 1. 이미 시드 데이터가 있는지 확인
            existing = await db.execute(
                select(ChartOfAccounts).limit(1)
            )
            if existing.scalar_one_or_none():
                print("[SKIP] 계정과목 데이터가 이미 존재합니다. 시드를 건너뜁니다.")
                return

            # 2. 계정과목 투입
            sort = 0
            for code, name, acc_type, group, balance in ACCOUNTS:
                sort += 10
                account = ChartOfAccounts(
                    code=code,
                    name=name,
                    account_type=acc_type,
                    account_group=group,
                    normal_balance=balance,
                    sort_order=sort,
                    is_active=True,
                )
                db.add(account)

            await db.flush()
            print(f"[OK] 계정과목 {len(ACCOUNTS)}개 투입 완료")

            # 3. 2026년 회계연도 생성
            existing_fy = await db.execute(
                select(FiscalYear).where(FiscalYear.year == 2026)
            )
            if not existing_fy.scalar_one_or_none():
                fy = FiscalYear(
                    year=2026,
                    start_date=date(2026, 1, 1),
                    end_date=date(2026, 12, 31),
                    is_closed=False,
                )
                db.add(fy)
                print("[OK] 2026년 회계연도 생성 완료")

            await db.commit()
            print("[DONE] M4 시드 데이터 투입 완료!")

        except Exception as e:
            await db.rollback()
            print(f"[ERROR] 시드 데이터 투입 실패: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(seed_m4_data())
