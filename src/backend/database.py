"""
데이터베이스 연결 설정
비동기(async) SQLAlchemy를 사용하여 PostgreSQL에 연결합니다.
"""
import ssl as _ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from .config import settings


# DATABASE_URL에서 asyncpg가 지원하지 않는 파라미터 제거
def _clean_url(url: str) -> str:
    """asyncpg 호환을 위해 sslmode/channel_binding 파라미터를 제거"""
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    params.pop("sslmode", None)
    params.pop("channel_binding", None)
    clean_query = urlencode({k: v[0] for k, v in params.items()})
    return urlunparse(parsed._replace(query=clean_query))


# SSL 설정 (Neon 등 클라우드 DB 접속 시 필요)
_use_ssl = "neon.tech" in settings.DATABASE_URL
_connect_args = {"ssl": _ssl.create_default_context()} if _use_ssl else {}

# 비동기 엔진 생성 (DB와의 연결 통로)
engine = create_async_engine(
    _clean_url(settings.DATABASE_URL),
    echo=settings.DEBUG,  # 디버그 모드일 때 SQL 쿼리 출력
    pool_size=10,         # 동시 연결 수
    max_overflow=20,      # 추가 허용 연결 수
    connect_args=_connect_args,
)

# 세션 팩토리 (DB 작업을 위한 세션 생성기)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# 모든 ORM 모델의 기본 클래스
class Base(DeclarativeBase):
    pass


async def get_db():
    """
    API 엔드포인트에서 DB 세션을 받아 사용하는 의존성 함수
    사용 예: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
