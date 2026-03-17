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


# ──────────────────────────────────────────────
# 품목 카테고리 (ProductCategory) 스키마
# ──────────────────────────────────────────────

class ProductCategoryCreate(BaseModel):
    """품목 카테고리 생성 요청"""
    code: str = Field(..., min_length=1, max_length=30, description="분류 코드 (예: CAT001)")
    name: str = Field(..., min_length=1, max_length=100, description="분류명")
    parent_id: Optional[uuid.UUID] = Field(None, description="상위 카테고리 ID (없으면 최상위)")
    sort_order: int = Field(0, ge=0, description="정렬 순서")


class ProductCategoryResponse(BaseModel):
    """품목 카테고리 응답"""
    id: uuid.UUID
    code: str
    name: str
    parent_id: Optional[uuid.UUID] = None
    sort_order: int

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# 품목 (Product) 스키마
# ──────────────────────────────────────────────

class ProductCreate(BaseModel):
    """품목 생성 요청"""
    code: str = Field(..., min_length=1, max_length=50, description="품목 코드 (예: P001)")
    name: str = Field(..., min_length=1, max_length=200, description="품목명")
    category_id: Optional[uuid.UUID] = Field(None, description="카테고리 ID")
    product_type: str = Field("product", description="유형: product(제품), material(자재), semi(반제품)")
    unit: str = Field("EA", max_length=20, description="단위 (EA, KG, M 등)")
    standard_price: float = Field(0, ge=0, description="기준 단가 (원)")
    cost_price: float = Field(0, ge=0, description="원가 (원)")
    safety_stock: int = Field(0, ge=0, description="안전재고 수량")
    inventory_method: str = Field("fifo", description="재고평가 방법: fifo(선입선출), avg(이동평균)")
    tax_rate: float = Field(10.00, ge=0, le=100, description="부가세율 (%)")

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v: str) -> str:
        """품목 유형은 product/material/semi 중 하나"""
        allowed = ("product", "material", "semi")
        if v not in allowed:
            raise ValueError(f"허용된 유형: {', '.join(allowed)}")
        return v

    @field_validator("inventory_method")
    @classmethod
    def validate_inventory_method(cls, v: str) -> str:
        """재고평가 방법은 fifo/avg 중 하나"""
        allowed = ("fifo", "avg")
        if v not in allowed:
            raise ValueError(f"허용된 방법: {', '.join(allowed)}")
        return v


class ProductUpdate(BaseModel):
    """품목 수정 요청 (변경할 필드만 전송)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category_id: Optional[uuid.UUID] = None
    product_type: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=20)
    standard_price: Optional[float] = Field(None, ge=0)
    cost_price: Optional[float] = Field(None, ge=0)
    safety_stock: Optional[int] = Field(None, ge=0)
    inventory_method: Optional[str] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ("product", "material", "semi")
        if v not in allowed:
            raise ValueError(f"허용된 유형: {', '.join(allowed)}")
        return v

    @field_validator("inventory_method")
    @classmethod
    def validate_inventory_method(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ("fifo", "avg")
        if v not in allowed:
            raise ValueError(f"허용된 방법: {', '.join(allowed)}")
        return v


class ProductResponse(BaseModel):
    """품목 단건 응답"""
    id: uuid.UUID
    code: str
    name: str
    category_id: Optional[uuid.UUID] = None
    product_type: str
    unit: str
    standard_price: float
    cost_price: float
    safety_stock: int
    inventory_method: str
    tax_rate: float
    is_active: bool
    mdm_status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# 부서 (Department) 스키마
# ──────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    """부서 생성 요청"""
    code: str = Field(..., min_length=1, max_length=20, description="부서 코드 (예: D001)")
    name: str = Field(..., min_length=1, max_length=100, description="부서명")
    parent_id: Optional[uuid.UUID] = Field(None, description="상위 부서 ID (없으면 최상위)")
    sort_order: int = Field(0, ge=0, description="정렬 순서")


class DepartmentUpdate(BaseModel):
    """부서 수정 요청"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    parent_id: Optional[uuid.UUID] = None
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    """부서 응답"""
    id: uuid.UUID
    code: str
    name: str
    parent_id: Optional[uuid.UUID] = None
    sort_order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# 직급 (Position) 스키마
# ──────────────────────────────────────────────

class PositionCreate(BaseModel):
    """직급 생성 요청"""
    code: str = Field(..., min_length=1, max_length=20, description="직급 코드 (예: POS001)")
    name: str = Field(..., min_length=1, max_length=50, description="직급명")
    level: int = Field(..., ge=1, le=20, description="직급 레벨 (높을수록 상위)")


class PositionUpdate(BaseModel):
    """직급 수정 요청"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    level: Optional[int] = Field(None, ge=1, le=20)
    is_active: Optional[bool] = None


class PositionResponse(BaseModel):
    """직급 응답"""
    id: uuid.UUID
    code: str
    name: str
    level: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# 사용자 (User) 관리 스키마
# ──────────────────────────────────────────────

class UserCreate(BaseModel):
    """사용자 생성 요청 (관리자가 계정 등록)"""
    employee_no: str = Field(..., min_length=1, max_length=20, description="사번")
    name: str = Field(..., min_length=1, max_length=50, description="이름")
    email: str = Field(..., max_length=255, description="이메일 (로그인 ID)")
    password: str = Field(..., min_length=4, max_length=100, description="초기 비밀번호")
    department_id: Optional[uuid.UUID] = Field(None, description="부서 ID")
    position_id: Optional[uuid.UUID] = Field(None, description="직급 ID")
    role: str = Field("user", description="역할: admin, manager, user")
    allowed_modules: Optional[list[str]] = Field(None, description="접근 가능 모듈 목록 (null=전체)")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = ("admin", "manager", "user")
        if v not in allowed:
            raise ValueError(f"허용된 역할: {', '.join(allowed)}")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("올바른 이메일 형식이 아닙니다")
        return v.lower().strip()


class UserUpdate(BaseModel):
    """사용자 수정 요청 (비밀번호 변경은 별도)"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    department_id: Optional[uuid.UUID] = None
    position_id: Optional[uuid.UUID] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    allowed_modules: Optional[list[str]] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ("admin", "manager", "user")
        if v not in allowed:
            raise ValueError(f"허용된 역할: {', '.join(allowed)}")
        return v


class UserPasswordReset(BaseModel):
    """비밀번호 초기화 요청 (관리자 전용)"""
    new_password: str = Field(..., min_length=4, max_length=100, description="새 비밀번호")


class UserResponse(BaseModel):
    """사용자 응답 (비밀번호 제외)"""
    id: uuid.UUID
    employee_no: str
    name: str
    email: str
    department_id: Optional[uuid.UUID] = None
    position_id: Optional[uuid.UUID] = None
    role: str
    allowed_modules: Optional[list[str]] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# 동적 폼 빌더 (FormConfig) 스키마
# ──────────────────────────────────────────────

class FormFieldConfig(BaseModel):
    """폼 필드 하나의 구성 정보"""
    key: str = Field(..., min_length=1, max_length=50, description="필드 키 (영문, 언더스코어)")
    label: str = Field(..., min_length=1, max_length=100, description="필드 표시명 (한국어)")
    field_type: str = Field(..., description="필드 유형: text, number, date, select, checkbox, textarea, email, phone")
    required: bool = Field(False, description="필수 여부")
    placeholder: Optional[str] = Field(None, max_length=200, description="입력 힌트")
    default_value: Optional[str] = Field(None, description="기본값")
    options: Optional[list[str]] = Field(None, description="선택지 목록 (select 유형일 때)")
    min_length: Optional[int] = Field(None, ge=0, description="최소 길이 (text/textarea)")
    max_length: Optional[int] = Field(None, ge=1, description="최대 길이 (text/textarea)")
    min_value: Optional[float] = Field(None, description="최소값 (number)")
    max_value: Optional[float] = Field(None, description="최대값 (number)")
    sort_order: int = Field(0, ge=0, description="표시 순서")
    width: str = Field("full", description="너비: full(전체), half(반), third(1/3)")
    description: Optional[str] = Field(None, max_length=300, description="필드 설명 (도움말)")

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: str) -> str:
        """허용된 필드 유형 검증"""
        allowed = ("text", "number", "date", "select", "checkbox", "textarea", "email", "phone")
        if v not in allowed:
            raise ValueError(f"허용된 필드 유형: {', '.join(allowed)}")
        return v

    @field_validator("width")
    @classmethod
    def validate_width(cls, v: str) -> str:
        allowed = ("full", "half", "third")
        if v not in allowed:
            raise ValueError(f"허용된 너비: {', '.join(allowed)}")
        return v

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        """키는 영문 소문자 + 언더스코어만 허용"""
        if not re.match(r"^[a-z][a-z0-9_]*$", v):
            raise ValueError("키는 영문 소문자로 시작하고, 영문 소문자/숫자/언더스코어만 사용 가능합니다")
        return v


class FormConfigCreate(BaseModel):
    """폼 구성 생성 요청"""
    module: str = Field(..., min_length=1, max_length=10, description="모듈 코드 (M1~M7)")
    form_name: str = Field(..., min_length=1, max_length=100, description="폼 이름 (예: customer_extra, product_extra)")
    fields: list[FormFieldConfig] = Field(..., min_length=1, description="폼 필드 구성 목록")

    @field_validator("module")
    @classmethod
    def validate_module(cls, v: str) -> str:
        allowed = ("M1", "M2", "M3", "M4", "M5", "M6", "M7")
        if v not in allowed:
            raise ValueError(f"허용된 모듈: {', '.join(allowed)}")
        return v


class FormConfigUpdate(BaseModel):
    """폼 구성 수정 요청 (필드 전체 교체)"""
    fields: list[FormFieldConfig] = Field(..., min_length=1, description="폼 필드 구성 목록 (전체 교체)")
    is_active: Optional[bool] = None


class FormConfigResponse(BaseModel):
    """폼 구성 응답"""
    id: uuid.UUID
    module: str
    form_name: str
    config_json: dict
    version: int
    is_active: bool
    created_at: datetime
    created_by: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}
