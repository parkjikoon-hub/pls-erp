"""
M4 재무/회계 — 은행 입금 내역 임포트 Pydantic 스키마
"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


# ── CSV 파싱 결과 (미리보기용) ──

class ParsedTransaction(BaseModel):
    """CSV에서 파싱된 개별 거래"""
    row_index: int = Field(..., description="원본 CSV 행 번호")
    transaction_date: str = Field(..., description="거래일자 (YYYY-MM-DD)")
    description: str = Field("", description="적요")
    deposit_amount: float = Field(0, description="입금액")
    withdrawal_amount: float = Field(0, description="출금액")
    balance: float = Field(0, description="거래후 잔액")
    hash: str = Field(..., description="중복 감지용 해시")
    is_duplicate: bool = Field(False, description="기존 임포트 중복 여부")
    mapped_account_id: Optional[str] = Field(None, description="자동 매핑된 계정과목 ID")
    mapped_account_name: Optional[str] = Field(None, description="자동 매핑된 계정과목명")


class ParseResult(BaseModel):
    """CSV 파싱 전체 결과"""
    bank_code: str
    file_name: str
    total_rows: int = Field(0, description="전체 행 수")
    deposit_rows: int = Field(0, description="입금 건 수")
    transactions: list[ParsedTransaction] = []


# ── 전표 생성 확인 요청 ──

class ConfirmTransaction(BaseModel):
    """사용자가 선택/수정한 개별 거래"""
    transaction_date: str = Field(..., description="거래일자 (YYYY-MM-DD)")
    description: str = Field("", description="적요")
    amount: float = Field(..., description="입금액")
    account_id: str = Field(..., description="계정과목 ID (대변)")
    hash: str = Field(..., description="중복 방지용 해시")


class ConfirmImportRequest(BaseModel):
    """전표 생성 확인 요청"""
    bank_code: str = Field(..., description="은행 코드")
    file_name: str = Field("", description="원본 파일명")
    bank_account_id: Optional[str] = Field(None, description="보통예금 계정과목 ID (차변)")
    transactions: list[ConfirmTransaction] = Field(..., min_length=1)


# ── 매핑 규칙 ──

class MappingCreate(BaseModel):
    """적요→계정과목 매핑 규칙 생성"""
    keyword: str = Field(..., min_length=1, description="적요 키워드")
    account_id: str = Field(..., description="계정과목 ID")
    priority: int = Field(0, description="우선순위 (높을수록 우선)")


class MappingResponse(BaseModel):
    """매핑 규칙 응답"""
    id: str
    keyword: str
    account_id: str
    account_name: Optional[str] = None
    priority: int = 0
    is_active: bool = True


# ── 회사 은행 계좌 ──

class BankAccountCreate(BaseModel):
    """회사 은행 계좌 등록"""
    bank_code: str = Field(..., description="은행 코드 (shinhan/ibk/kb/woori/hana)")
    bank_name: str = Field(..., description="은행명")
    account_no: str = Field(..., min_length=1, description="계좌번호")
    account_holder: str = Field(..., min_length=1, description="예금주")
    account_type: str = Field("보통예금", description="계좌 유형")
    chart_account_id: str = Field(..., description="연결 계정과목 ID")
    is_primary: bool = Field(False, description="기본 계좌 여부")
    memo: Optional[str] = Field(None, description="메모")


class BankAccountUpdate(BaseModel):
    """회사 은행 계좌 수정"""
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    account_holder: Optional[str] = None
    account_type: Optional[str] = None
    chart_account_id: Optional[str] = None
    is_primary: Optional[bool] = None
    memo: Optional[str] = None


class BankAccountResponse(BaseModel):
    """회사 은행 계좌 응답"""
    id: str
    bank_code: str
    bank_name: str
    account_no: str
    account_holder: str
    account_type: str
    chart_account_id: str
    chart_account_name: Optional[str] = None
    is_primary: bool = False
    is_active: bool = True
    memo: Optional[str] = None
