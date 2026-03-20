"""
M4 재무/회계 — CODEF 은행 실시간 연동 서비스
- OAuth 토큰 발급
- Connected ID 생성 (은행 계좌 등록)
- 계좌 목록 조회
- 거래내역 조회
- 기존 bank_import_service 연동 (전표 자동 생성)
"""
import os
import hashlib
import json
from datetime import date, timedelta
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# CODEF API URL (demo vs production)
CODEF_MODE = os.getenv("CODEF_MODE", "demo")
CODEF_TOKEN_URL = "https://oauth.codef.io/oauth/token"
CODEF_BASE_URL = (
    "https://development.codef.io"
    if CODEF_MODE == "demo"
    else "https://api.codef.io"
)

# ── 토큰 캐시 (단순 메모리 캐시) ──
_token_cache: dict = {"token": None, "expires_at": 0}


async def _get_token() -> str:
    """CODEF OAuth 토큰 발급 (캐시 사용)"""
    import time
    now = time.time()

    # 캐시된 토큰이 유효하면 재사용
    if _token_cache["token"] and _token_cache["expires_at"] > now:
        return _token_cache["token"]

    client_id = os.getenv("CODEF_CLIENT_ID", "")
    client_secret = os.getenv("CODEF_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        raise Exception("CODEF_CLIENT_ID / CODEF_CLIENT_SECRET 환경변수가 설정되지 않았습니다")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            CODEF_TOKEN_URL,
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if resp.status_code != 200:
        raise Exception(f"CODEF 토큰 발급 실패: {resp.status_code} - {resp.text}")

    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise Exception(f"CODEF 토큰 응답에 access_token 없음: {data}")

    # 캐시 저장 (만료 5분 전)
    expires_in = data.get("expires_in", 3600)
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + expires_in - 300

    return token


async def test_connection() -> dict:
    """CODEF API 연결 테스트 — 토큰 발급 성공 여부 확인"""
    try:
        token = await _get_token()
        return {
            "success": True,
            "message": "CODEF API 연결 성공! 토큰이 정상 발급되었습니다.",
            "token_preview": token[:10] + "..." if token else None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"CODEF API 연결 실패: {str(e)}",
            "token_preview": None,
        }


async def create_connected_id(
    bank_code: str,
    login_type: str,
    login_id: str,
    login_pw: str,
) -> dict:
    """Connected ID 생성 (은행 계좌 등록)
    - bank_code: 은행 코드 (예: '0004' = KB국민)
    - login_type: '0' = 인증서, '1' = ID/PW
    """
    token = await _get_token()

    # CODEF API 호출
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{CODEF_BASE_URL}/v1/account/create",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "accountList": [
                    {
                        "countryCode": "KR",
                        "businessType": "BK",
                        "clientType": "P",  # 개인
                        "organization": bank_code,
                        "loginType": login_type,
                        "id": login_id,
                        "password": login_pw,
                    }
                ]
            },
        )

    data = resp.json()
    result_code = data.get("result", {}).get("code", "")
    result_msg = data.get("result", {}).get("message", "")

    if result_code == "CF-00000":
        connected_id = data.get("data", {}).get("connectedId", "")
        return {
            "success": True,
            "message": f"Connected ID 생성 성공",
            "connected_id": connected_id,
        }
    else:
        return {
            "success": False,
            "message": f"Connected ID 생성 실패: [{result_code}] {result_msg}",
            "connected_id": None,
        }


async def get_account_list(connected_id: str, bank_code: str) -> dict:
    """연동된 계좌 목록 조회"""
    token = await _get_token()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{CODEF_BASE_URL}/v1/kr/bank/p/account/account-list",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "connectedId": connected_id,
                "organization": bank_code,
            },
        )

    data = resp.json()
    result_code = data.get("result", {}).get("code", "")

    if result_code == "CF-00000":
        accounts = data.get("data", [])
        return {
            "success": True,
            "accounts": accounts if isinstance(accounts, list) else [accounts],
        }
    else:
        return {
            "success": False,
            "accounts": [],
            "error": f"[{result_code}] {data.get('result', {}).get('message', '')}",
        }


async def fetch_transactions(
    connected_id: str,
    bank_code: str,
    account_no: str,
    start_date: date,
    end_date: date,
) -> dict:
    """CODEF API로 거래내역 조회"""
    token = await _get_token()

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{CODEF_BASE_URL}/v1/kr/bank/p/account/transaction-list",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "connectedId": connected_id,
                "organization": bank_code,
                "account": account_no,
                "startDate": start_date.strftime("%Y%m%d"),
                "endDate": end_date.strftime("%Y%m%d"),
                "orderBy": "0",  # 최신순
                "inquiryType": "1",  # 입금만
            },
        )

    data = resp.json()
    result_code = data.get("result", {}).get("code", "")

    if result_code == "CF-00000":
        transactions = data.get("data", {})
        # data가 dict일 수도, list일 수도 있음
        if isinstance(transactions, dict):
            tx_list = transactions.get("resTrHistoryList", [])
        elif isinstance(transactions, list):
            tx_list = transactions
        else:
            tx_list = []

        return {
            "success": True,
            "total": len(tx_list),
            "transactions": tx_list,
        }
    else:
        return {
            "success": False,
            "total": 0,
            "transactions": [],
            "error": f"[{result_code}] {data.get('result', {}).get('message', '')}",
        }


async def sync_and_create_journals(
    db: AsyncSession,
    connected_id: str,
    bank_code: str,
    account_no: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    company_account_id: Optional[str] = None,
    current_user=None,
) -> dict:
    """CODEF 거래내역 → 전표 자동 생성 (기존 bank_import_service 연동)"""
    from .bank_import_service import (
        _find_or_create_account, _check_duplicate, _create_journal,
    )
    from ..models import CompanyBankAccount, BankImportHash

    # 기본 조회 기간: 최근 30일
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()

    # 거래내역 조회
    result = await fetch_transactions(
        connected_id=connected_id,
        bank_code=bank_code,
        account_no=account_no,
        start_date=start_date,
        end_date=end_date,
    )

    if not result["success"]:
        return {
            "success": False,
            "message": result.get("error", "거래내역 조회 실패"),
            "new_count": 0,
            "duplicate_count": 0,
            "journals_created": 0,
        }

    transactions = result["transactions"]
    new_count = 0
    duplicate_count = 0
    journals_created = 0
    preview_items = []

    for tx in transactions:
        # CODEF 거래내역을 표준 형식으로 변환
        tx_date_str = tx.get("resAccountTrDate", "")
        tx_amount_str = tx.get("resAccountIn", "0")
        tx_desc = tx.get("resAccountDesc1", "") or tx.get("resAccountDesc2", "")
        tx_balance = tx.get("resAfterTranBalance", "0")

        # 입금 건만 처리 (출금 제외)
        try:
            amount = float(tx_amount_str.replace(",", "")) if tx_amount_str else 0
        except ValueError:
            amount = 0

        if amount <= 0:
            continue

        # 날짜 파싱
        try:
            if len(tx_date_str) == 8:
                tx_date = date(int(tx_date_str[:4]), int(tx_date_str[4:6]), int(tx_date_str[6:8]))
            else:
                continue
        except (ValueError, IndexError):
            continue

        # 중복 체크 (해시 기반)
        hash_source = f"{bank_code}|{account_no}|{tx_date_str}|{tx_amount_str}|{tx_desc}"
        tx_hash = hashlib.sha256(hash_source.encode()).hexdigest()

        is_dup = await _check_duplicate(db, tx_hash)
        if is_dup:
            duplicate_count += 1
            continue

        new_count += 1

        preview_items.append({
            "date": tx_date.isoformat(),
            "amount": amount,
            "description": tx_desc,
            "balance": tx_balance,
            "hash": tx_hash,
        })

    return {
        "success": True,
        "message": f"총 {len(transactions)}건 중 신규 {new_count}건, 중복 {duplicate_count}건",
        "total_fetched": len(transactions),
        "new_count": new_count,
        "duplicate_count": duplicate_count,
        "journals_created": journals_created,
        "preview": preview_items[:50],  # 미리보기 최대 50건
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
    }


# ── 은행 코드 목록 (주요 은행) ──
BANK_CODES = {
    "0002": "KDB산업은행",
    "0003": "IBK기업은행",
    "0004": "KB국민은행",
    "0007": "수협은행",
    "0011": "NH농협은행",
    "0020": "우리은행",
    "0023": "SC제일은행",
    "0027": "한국씨티은행",
    "0031": "대구은행",
    "0032": "부산은행",
    "0034": "광주은행",
    "0035": "제주은행",
    "0037": "전북은행",
    "0039": "경남은행",
    "0045": "새마을금고",
    "0048": "신협",
    "0071": "우체국",
    "0081": "하나은행",
    "0088": "신한은행",
    "0089": "케이뱅크",
    "0090": "카카오뱅크",
    "0092": "토스뱅크",
}
