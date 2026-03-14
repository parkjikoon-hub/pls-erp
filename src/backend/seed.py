"""
초기 데이터 시드 — 관리자 계정, 기본 부서/직급 생성
서버 최초 실행 시 한 번만 실행합니다.
실행: python -m src.backend.seed
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from .config import settings
from .auth.security import hash_password
from .modules.m1_system.models import Department, Position, User


async def seed_data():
    """초기 데이터 삽입"""
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession)

    async with async_session() as db:
        # 이미 데이터가 있는지 확인
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is not None:
            print("이미 초기 데이터가 존재합니다. 건너뜁니다.")
            await engine.dispose()
            return

        # 기본 부서 생성
        dept_mgmt = Department(code="MGMT", name="경영관리", sort_order=1)
        dept_dev = Department(code="DEV", name="개발팀", sort_order=2)
        dept_sales = Department(code="SALES", name="영업팀", sort_order=3)
        dept_prod = Department(code="PROD", name="생산팀", sort_order=4)
        db.add_all([dept_mgmt, dept_dev, dept_sales, dept_prod])
        await db.flush()

        # 기본 직급 생성
        positions = [
            Position(code="CEO", name="대표이사", level=10),
            Position(code="DIR", name="이사", level=8),
            Position(code="MGR", name="부장", level=6),
            Position(code="AST_MGR", name="과장", level=5),
            Position(code="SNR", name="대리", level=4),
            Position(code="STF", name="사원", level=2),
        ]
        db.add_all(positions)
        await db.flush()

        # 관리자 계정 생성 (기본 비밀번호: admin1234)
        admin_user = User(
            employee_no="EMP001",
            name="시스템관리자",
            email="admin@pls-erp.com",
            password_hash=hash_password("admin1234"),
            department_id=dept_mgmt.id,
            position_id=positions[0].id,  # 대표이사
            role="admin",
        )
        db.add(admin_user)

        # 테스트 일반 사용자
        test_user = User(
            employee_no="EMP002",
            name="테스트사원",
            email="user@pls-erp.com",
            password_hash=hash_password("user1234"),
            department_id=dept_dev.id,
            position_id=positions[5].id,  # 사원
            role="user",
        )
        db.add(test_user)

        await db.commit()
        print("초기 데이터 생성 완료!")
        print(f"  관리자: admin@pls-erp.com / admin1234")
        print(f"  테스트: user@pls-erp.com / user1234")
        print(f"  부서 4개, 직급 6개 생성")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_data())
