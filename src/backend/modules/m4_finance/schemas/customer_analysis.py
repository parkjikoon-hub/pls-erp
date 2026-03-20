"""
M4 재무/회계 — 거래처별 수주/세금계산서/입금 분석 Pydantic 스키마
"""
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# ── 거래처 요약 정보 ──

class CustomerAnalysisSummary(BaseModel):
    """거래처 분석 요약 카드 데이터"""
    customer_id: str
    customer_name: str
    customer_code: str
    customer_type: str = ""  # customer/supplier/both
    business_no: str = ""  # 사업자등록번호

    # 수주 요약
    total_orders: int = 0  # 총 수주 건수
    total_order_amount: float = 0  # 총 수주 금액 (공급가)

    # 세금계산서 요약
    total_invoices: int = 0  # 총 세금계산서 건수
    total_invoice_amount: float = 0  # 총 세금계산서 금액

    # 입금 요약
    total_payments: int = 0  # 총 입금 건수
    total_payment_amount: float = 0  # 총 입금 금액

    # 미수금
    outstanding_amount: float = 0  # 미수금액 (세금계산서 - 입금)

    # 입금 동향
    avg_payment_days: Optional[float] = None  # 평균 입금 소요일
    payment_grade: str = "정보없음"  # 즉시입금/정상입금/지연입금/미입금경향/정보없음


# ── 수주 내역 ──

class OrderItem(BaseModel):
    """거래처별 수주 내역"""
    id: str
    order_no: str  # SO-YYYYMM-NNNN
    order_date: str  # YYYY-MM-DD
    delivery_date: Optional[str] = None
    total_amount: float = 0  # 공급가액
    tax_amount: float = 0  # 부가세
    grand_total: float = 0  # 총액
    status: str = ""  # confirmed/in_production/shipped/completed/invoiced
    progress_pct: int = 0
    items_summary: str = ""  # 주요 품목 요약 (예: "품목A 외 2건")


# ── 세금계산서 내역 ──

class InvoiceItem(BaseModel):
    """거래처별 세금계산서 내역"""
    id: str
    invoice_no: str  # TI-YYYYMM-NNNN
    invoice_type: str  # issue(매출)/receive(매입)
    issue_date: str  # YYYY-MM-DD
    supply_amount: float = 0  # 공급가액
    tax_amount: float = 0  # 부가세액
    total_amount: float = 0  # 합계
    status: str = ""  # draft/sent/confirmed/cancelled
    payment_status: str = "미입금"  # 입금완료/부분입금/미입금
    days_to_payment: Optional[int] = None  # 입금까지 걸린 일수 (없으면 None)


# ── 입금 내역 ──

class PaymentItem(BaseModel):
    """거래처별 입금 내역 (전표 기반)"""
    id: str
    entry_no: str  # JE-YYYYMM-NNNN
    entry_date: str  # YYYY-MM-DD
    amount: float = 0  # 입금액
    description: str = ""  # 적요
    source: str = ""  # 입금 출처 (은행임포트/수동입력)


# ── 입금 동향 분석 ──

class PaymentTrendItem(BaseModel):
    """월별 입금 동향"""
    month: str  # YYYY-MM
    invoice_amount: float = 0  # 해당월 세금계산서 발행액
    payment_amount: float = 0  # 해당월 입금액
    avg_days: Optional[float] = None  # 해당월 평균 입금 소요일


class PaymentTrendAnalysis(BaseModel):
    """입금 동향 분석 결과"""
    # 전체 통계
    avg_days: Optional[float] = None  # 전체 평균 입금 소요일
    median_days: Optional[float] = None  # 중앙값
    min_days: Optional[int] = None  # 최소
    max_days: Optional[int] = None  # 최대

    # 성향 분류
    grade: str = "정보없음"  # 즉시입금/정상입금/지연입금/미입금경향
    grade_description: str = ""  # 성향 설명

    # 미수금 현황
    unpaid_invoices: int = 0  # 미입금 세금계산서 건수
    unpaid_amount: float = 0  # 미입금 금액

    # 월별 추이
    monthly_trend: list[PaymentTrendItem] = []


# ── 전체 분석 응답 ──

class CustomerAnalysisResponse(BaseModel):
    """거래처 분석 전체 응답"""
    summary: CustomerAnalysisSummary
    orders: list[OrderItem] = []
    invoices: list[InvoiceItem] = []
    payments: list[PaymentItem] = []
    trend: PaymentTrendAnalysis = PaymentTrendAnalysis()


# ── 거래처 목록 (검색 드롭다운용) ──

class CustomerOption(BaseModel):
    """거래처 선택 드롭다운용"""
    id: str
    code: str
    name: str
    business_no: str = ""
    customer_type: str = ""


# ── 거래처 랭킹 ──

class CustomerRanking(BaseModel):
    """거래처별 랭킹 (전체 거래처 비교)"""
    customer_id: str
    customer_name: str
    customer_code: str
    total_order_amount: float = 0
    total_invoice_amount: float = 0
    total_payment_amount: float = 0
    outstanding_amount: float = 0
    avg_payment_days: Optional[float] = None
    payment_grade: str = "정보없음"
