"""
인증 관련 Pydantic 스키마 (요청/응답 데이터 형식 정의)
"""
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """로그인 요청"""
    email: str
    password: str


class TokenResponse(BaseModel):
    """로그인 성공 시 토큰 응답"""
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_role: str


class UserInfo(BaseModel):
    """현재 사용자 정보"""
    id: str
    employee_no: str
    name: str
    email: str
    role: str
    department_name: str | None = None
    position_name: str | None = None
    allowed_modules: list[str] | None = None
