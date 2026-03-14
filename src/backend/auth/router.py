"""
인증 라우터 — 로그인, 현재 사용자 정보 조회
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..modules.m1_system.models import User
from .security import verify_password, create_access_token
from .dependencies import get_current_user
from .schemas import LoginRequest, TokenResponse, UserInfo

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """이메일 + 비밀번호로 로그인하여 JWT 토큰 발급"""
    # 이메일로 사용자 조회
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()

    # 사용자 없거나 비밀번호 불일치
    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    # 비활성 계정 체크
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요",
        )

    # JWT 토큰 생성 (sub에 사용자 ID 저장)
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})

    # 마지막 로그인 시각 업데이트
    user.last_login_at = datetime.now(timezone.utc)

    return TokenResponse(
        access_token=access_token,
        user_name=user.name,
        user_role=user.role,
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회"""
    return UserInfo(
        id=str(current_user.id),
        employee_no=current_user.employee_no,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department_name=current_user.department.name if current_user.department else None,
        position_name=current_user.position.name if current_user.position else None,
    )
