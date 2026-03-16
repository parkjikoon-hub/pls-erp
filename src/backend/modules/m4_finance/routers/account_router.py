"""
M4 재무/회계 — 계정과목 API 라우터
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user, require_role
from ....shared.response import success_response
from ..schemas.accounts import (
    AccountCreate, AccountUpdate, AccountResponse, AccountSearchResult,
)
from ..services import account_service

router = APIRouter()


@router.get("", summary="계정과목 목록")
async def list_accounts(
    account_type: Optional[str] = Query(None, description="유형 필터"),
    search: Optional[str] = Query(None, description="코드/이름 검색"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    sort_by: str = Query("code"),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """계정과목 목록을 조회합니다 (검색/필터/페이지네이션)"""
    result = await account_service.list_accounts(
        db, account_type=account_type, search=search,
        is_active=is_active, page=page, size=size,
        sort_by=sort_by, sort_order=sort_order,
    )
    return success_response(
        data={
            "items": [
                AccountResponse.model_validate(a).model_dump(mode="json")
                for a in result["items"]
            ],
            "total": result["total"],
            "page": result["page"],
            "size": result["size"],
            "total_pages": result["total_pages"],
        }
    )


@router.get("/search", summary="계정과목 검색 (드롭다운용)")
async def search_accounts(
    q: str = Query("", description="검색어 (코드 또는 이름)"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """전표 입력 시 계정과목 검색 드롭다운용"""
    accounts = await account_service.search_accounts(db, q=q, limit=limit)
    return success_response(
        data=[
            AccountSearchResult.model_validate(a).model_dump(mode="json")
            for a in accounts
        ]
    )


@router.get("/{account_id}", summary="계정과목 상세")
async def get_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """계정과목 상세 정보를 조회합니다"""
    account = await account_service.get_account(db, account_id)
    return success_response(
        data=AccountResponse.model_validate(account).model_dump(mode="json")
    )


@router.post("", summary="계정과목 생성")
async def create_account(
    data: AccountCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """새 계정과목을 등록합니다 (관리자/매니저 전용)"""
    ip = request.client.host if request.client else None
    account = await account_service.create_account(db, data, current_user, ip)
    return success_response(
        data=AccountResponse.model_validate(account).model_dump(mode="json"),
        message=f"계정과목 '{account.name}'이(가) 등록되었습니다",
    )


@router.put("/{account_id}", summary="계정과목 수정")
async def update_account(
    account_id: uuid.UUID,
    data: AccountUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),
):
    """계정과목 정보를 수정합니다"""
    ip = request.client.host if request.client else None
    account = await account_service.update_account(
        db, account_id, data, current_user, ip
    )
    return success_response(
        data=AccountResponse.model_validate(account).model_dump(mode="json"),
        message=f"계정과목 '{account.name}'이(가) 수정되었습니다",
    )


@router.delete("/{account_id}", summary="계정과목 비활성화")
async def delete_account(
    account_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """계정과목을 비활성화합니다 (관리자 전용, 논리 삭제)"""
    ip = request.client.host if request.client else None
    account = await account_service.delete_account(
        db, account_id, current_user, ip
    )
    return success_response(
        data=AccountResponse.model_validate(account).model_dump(mode="json"),
        message=f"계정과목 '{account.name}'이(가) 비활성화되었습니다",
    )
