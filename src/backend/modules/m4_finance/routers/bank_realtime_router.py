"""
M4 재무/회계 — CODEF 은행 실시간 연동 API 라우터
- 연결 테스트
- Connected ID 생성 (은행 계좌 등록)
- 계좌 목록 조회
- 거래내역 조회 + 전표 생성
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ....database import get_db
from ....auth.dependencies import get_current_user
from ....shared.response import success_response
from ..services import bank_realtime_service
from ..schemas.bank_realtime import (
    CodefConnectedIdCreate,
    CodefTransactionRequest,
    CodefSyncRequest,
    CodefAccountListRequest,
)

router = APIRouter()


@router.get("/test")
async def test_codef_connection(
    current_user=Depends(get_current_user),
):
    """CODEF API 연결 테스트 — 토큰 발급 성공 여부 확인"""
    result = await bank_realtime_service.test_connection()
    return success_response(result)


@router.get("/bank-codes")
async def get_bank_codes(
    current_user=Depends(get_current_user),
):
    """지원 은행 코드 목록"""
    codes = [
        {"code": code, "name": name}
        for code, name in bank_realtime_service.BANK_CODES.items()
    ]
    return success_response(codes)


@router.post("/connected-id")
async def create_connected_id(
    data: CodefConnectedIdCreate,
    current_user=Depends(get_current_user),
):
    """Connected ID 생성 (은행 계좌 등록)"""
    result = await bank_realtime_service.create_connected_id(
        bank_code=data.bank_code,
        login_type=data.login_type,
        login_id=data.login_id,
        login_pw=data.login_pw,
    )
    return success_response(result)


@router.post("/accounts")
async def get_account_list(
    data: CodefAccountListRequest,
    current_user=Depends(get_current_user),
):
    """연동된 계좌 목록 조회"""
    result = await bank_realtime_service.get_account_list(
        connected_id=data.connected_id,
        bank_code=data.bank_code,
    )
    return success_response(result)


@router.post("/transactions")
async def fetch_transactions(
    data: CodefTransactionRequest,
    current_user=Depends(get_current_user),
):
    """CODEF 거래내역 조회 (미리보기)"""
    result = await bank_realtime_service.fetch_transactions(
        connected_id=data.connected_id,
        bank_code=data.bank_code,
        account_no=data.account_no,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    return success_response(result)


@router.post("/sync")
async def sync_transactions(
    data: CodefSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """CODEF 거래내역 동기화 — 조회 + 중복 체크 + 전표 미리보기"""
    result = await bank_realtime_service.sync_and_create_journals(
        db=db,
        connected_id=data.connected_id,
        bank_code=data.bank_code,
        account_no=data.account_no,
        start_date=data.start_date,
        end_date=data.end_date,
        company_account_id=data.company_account_id,
        current_user=current_user,
    )
    return success_response(result)
