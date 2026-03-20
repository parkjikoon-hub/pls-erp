"""
M4 재무/회계 — CODEF 은행 실시간 연동 스키마
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date


class CodefTestResponse(BaseModel):
    """CODEF 연결 테스트 결과"""
    success: bool
    message: str
    token_preview: Optional[str] = None  # 토큰 앞 10자만


class CodefConnectedIdCreate(BaseModel):
    """Connected ID 생성 요청 (은행 계좌 등록)"""
    bank_code: str        # 은행 코드 (예: '0004' = KB국민)
    login_type: str = "1"  # 0: 인증서, 1: ID/PW
    login_id: str         # 인터넷뱅킹 아이디
    login_pw: str         # 인터넷뱅킹 비밀번호


class CodefConnectedIdResponse(BaseModel):
    """Connected ID 생성 결과"""
    success: bool
    message: str
    connected_id: Optional[str] = None


class CodefAccountListRequest(BaseModel):
    """계좌 목록 조회 요청"""
    connected_id: str
    bank_code: str


class CodefTransactionRequest(BaseModel):
    """거래내역 조회 요청"""
    connected_id: str
    bank_code: str
    account_no: str
    start_date: date
    end_date: date


class CodefSyncRequest(BaseModel):
    """동기화 요청"""
    connected_id: str
    bank_code: str
    account_no: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    company_account_id: Optional[str] = None  # 기존 회사계좌 ID와 연결


class CodefSettingSave(BaseModel):
    """CODEF 연동 설정 저장"""
    connected_id: str
    bank_code: str
    account_no: str
    account_holder: Optional[str] = None
    company_account_id: Optional[str] = None
