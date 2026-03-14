"""
ERP 시스템 환경 설정
.env 파일에서 환경변수를 읽어 설정값으로 변환합니다.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """환경변수 기반 설정 클래스"""

    # 데이터베이스
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/erp_db"

    # JWT 인증
    JWT_SECRET_KEY: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Gemini AI
    GEMINI_API_KEY: Optional[str] = None

    # 앱 설정
    APP_NAME: str = "AI 통합 ERP"
    APP_VERSION: str = "1.0.0"
    APP_PORT: int = 8000
    DEBUG: bool = True

    # CORS (프론트엔드 주소)
    FRONTEND_URL: str = "http://localhost:5173"

    # Slack / 카카오
    SLACK_WEBHOOK_URL: Optional[str] = None
    KAKAO_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# 전역 설정 인스턴스
settings = Settings()
