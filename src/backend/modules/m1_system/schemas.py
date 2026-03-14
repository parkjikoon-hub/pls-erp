"""
M1 시스템 — Pydantic 스키마
거래처/품목 등 마스터 데이터의 요청·응답 형식을 정의합니다.
"""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


# ──────────────────────────────────────────────
# 거래처 (Customer) 스키마
# ──────────────────────────────────────────────

class CustomerCreate(BaseModel):
    """거래처 생성 요청"""
    code: str = Field(..., min_length=1, max_length=30, description="거래처 코드 (예: C001)")
    name: str = Field(..., min_length=1, max_length=200, description="거래처명")
    business_no: Optional[str] = Field(None, max_length=20, description="사업자등록번호 (000-00-00000)")
    ceo_name: Optional[str] = Field(None, max_length=50, description="대표자명")
    business_type: Optional[str] = Field(None, max_length=100, description="업태")
    business_item: Optional[str] = Field(None, max_length=100, description="종목")
    address: Optional[str] = Field(None, description="주소")
    phone: Optional[str] = Field(None, max_length=30, description="전화번호")
    email: Optional[str] = Field(None, max_length=255, description="이메일")
    fax: Optional[str] = Field(None, max_length=30, description="팩스")
    contact_person: Optional[str] = Field(None, max_length=50, description="담당자명")
    customer_type: str = Field("both", description="유형: customer(매출처), supplier(매입처), both(겸용)")
    credit_limit: float = Field(0, ge=0, description="신용한도 (원)")
    payment_terms: int = Field(30, ge=0, le=365, description="결제조건 (일)")
    bank_name: Optional[str] = Field(None, max_length=50, description="은행명")
    bank_account: Optional[str] = Field(None, max_length=50, description="계좌번호")
    bank_account_name: Optional[str] = Field(None, max_length=50, description="예금주")

    @field_validator("customer_type")
    @classmethod
    def validate_customer_type(cls, v: str) -> str:
        """거래처 유형은 customer/supplier/both 중 하나"""
        allowed = ("customer", "supplier", "both")
        if v not in allowed:
            raise ValueError(f"허용된 유형: {', '.join(allowed)}")
        return v

    @field_validator("business_no")
    @classmethod
    def validate_business_no(cls, v: Optional[str]) -> Optional[str]:
        """사업자등록번호 형식 검증 (숫자만 또는 000-00-00000 형식)"""
        if v is None or v == "":
            return None
        # 하이픈 제거 후 숫자 10자리인지 확인
        digits = re.sub(r"[^0-9]", "", v)
        if len(digits) != 10:
            raise ValueError("사업자등록번호는 10자리 숫자여야 합니다")
        # 000-00-00000 형식으로 통일
        return f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"


class CustomerUpdate(BaseModel):
    """거래처 수정 요청 (변경할 필드만 전송)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    business_no: Optional[str] = Field(None, max_length=20)
    ceo_name: Optional[str] = Field(None, max_length=50)
    business_type: Optional[str] = Field(None, max_length=100)
    business_item: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=255)
    fax: Optional[str] = Field(None, max_length=30)
    contact_person: Optional[str] = Field(None, max_length=50)
    customer_type: Optional[str] = None
    credit_limit: Optional[float] = Field(None, ge=0)
    payment_terms: Optional[int] = Field(None, ge=0, le=365)
    bank_name: Optional[str] = Field(None, max_length=50)
    bank_account: Optional[str] = Field(None, max_length=50)
    bank_account_name: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

    @field_validator("customer_type")
    @classmethod
    def validate_customer_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ("customer", "supplier", "both")
        if v not in allowed:
            raise ValueError(f"허용된 유형: {', '.join(allowed)}")
        return v

    @field_validator("business_no")
    @classmethod
    def validate_business_no(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        digits = re.sub(r"[^0-9]", "", v)
        if len(digits) != 10:
            raise ValueError("사업자등록번호는 10자리 숫자여야 합니다")
        return f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"


class CustomerResponse(BaseModel):
    """거래처 단건 응답"""
    id: uuid.UUID
    code: str
    name: str
    business_no: Optional[str] = None
    ceo_name: Optional[str] = None
    business_type: Optional[str] = None
    business_item: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    contact_person: Optional[str] = None
    customer_type: str
    credit_limit: float
    payment_terms: int
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_account_name: Optional[str] = None
    is_active: bool
    mdm_status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
