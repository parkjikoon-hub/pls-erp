"""
M6 그룹웨어 — 결재 Pydantic 스키마
"""
from typing import Optional
from pydantic import BaseModel, Field


# ── 결재선 템플릿 ──

class TemplateLineCreate(BaseModel):
    step_order: int = 1
    approver_id: str
    role_label: Optional[str] = None
    line_type: str = "approval"  # approval / reference


class TemplateLineResponse(BaseModel):
    id: str
    step_order: int
    approver_id: str
    approver_name: Optional[str] = None
    role_label: Optional[str] = None
    line_type: str


class TemplateCreate(BaseModel):
    name: str
    document_type: Optional[str] = None
    description: Optional[str] = None
    lines: list[TemplateLineCreate] = Field(min_length=1)


class TemplateResponse(BaseModel):
    id: str
    name: str
    document_type: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    lines: list[TemplateLineResponse] = []
    created_at: Optional[str] = None


# ── 결재 요청 ──

class ApprovalStepCreate(BaseModel):
    step_type: str = "approval"  # approval / reference
    step_order: int = 1
    approver_id: str
    role_label: Optional[str] = None


class ApprovalStepResponse(BaseModel):
    id: str
    step_type: str
    step_order: int
    approver_id: str
    approver_name: Optional[str] = None
    role_label: Optional[str] = None
    status: str
    comment: Optional[str] = None
    acted_at: Optional[str] = None


class ApprovalRequestCreate(BaseModel):
    title: str
    document_type: str = "general"
    content: Optional[dict] = None
    amount: Optional[float] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    steps: list[ApprovalStepCreate] = Field(min_length=1)


class ApprovalListItem(BaseModel):
    id: str
    request_no: str
    title: str
    document_type: str
    amount: Optional[float] = None
    status: str
    requester_id: str
    requester_name: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    current_step: Optional[int] = None
    total_steps: Optional[int] = None
    created_at: Optional[str] = None


class ApprovalResponse(ApprovalListItem):
    content: Optional[dict] = None
    steps: list[ApprovalStepResponse] = []


class ApprovalActionData(BaseModel):
    comment: Optional[str] = None
