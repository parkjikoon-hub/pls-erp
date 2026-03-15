"""
M5 생산/SCM — QC 검사 Pydantic 스키마
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class QcCreate(BaseModel):
    """QC 검사 등록"""
    work_order_id: str = Field(..., description="작업지시서 ID")
    inspected_qty: float = Field(..., gt=0, description="검사 수량")
    passed_qty: float = Field(0, ge=0, description="합격 수량")
    failed_qty: float = Field(0, ge=0, description="불합격 수량")
    result: str = Field(..., description="결과 (pass/fail/rework)")
    defect_types: Optional[dict] = Field(None, description="불량 유형 (선택)")
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_qty(self):
        if round(self.passed_qty + self.failed_qty, 3) != round(self.inspected_qty, 3):
            raise ValueError("합격 수량 + 불합격 수량 = 검사 수량이어야 합니다")
        return self


class QcResponse(BaseModel):
    """QC 검사 응답"""
    id: str
    work_order_id: str
    wo_no: Optional[str] = None
    product_name: Optional[str] = None
    inspected_qty: float
    passed_qty: float
    failed_qty: float
    result: str
    defect_types: Optional[dict] = None
    notes: Optional[str] = None
    inspector_name: Optional[str] = None
    inspected_at: Optional[datetime] = None
