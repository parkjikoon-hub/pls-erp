"""
M4 재무/회계 — 결산/재무제표 Pydantic 스키마
"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class TrialBalanceRow(BaseModel):
    """시산표 행"""
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    total_debit: float
    total_credit: float
    balance: float  # 차변 합계 - 대변 합계 (자산/비용: 양수 정상, 부채/자본/수익: 음수 정상)


class TrialBalanceResponse(BaseModel):
    """시산표 응답"""
    rows: list[TrialBalanceRow]
    total_debit: float
    total_credit: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class IncomeStatementRow(BaseModel):
    """손익계산서 항목"""
    account_id: str
    account_code: str
    account_name: str
    amount: float


class IncomeStatementResponse(BaseModel):
    """손익계산서 응답"""
    revenue_items: list[IncomeStatementRow]
    expense_items: list[IncomeStatementRow]
    total_revenue: float
    total_expense: float
    net_income: float  # 당기순이익
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class BalanceSheetRow(BaseModel):
    """재무상태표 항목"""
    account_id: str
    account_code: str
    account_name: str
    amount: float


class BalanceSheetResponse(BaseModel):
    """재무상태표 응답"""
    asset_items: list[BalanceSheetRow]
    liability_items: list[BalanceSheetRow]
    equity_items: list[BalanceSheetRow]
    total_assets: float
    total_liabilities: float
    total_equity: float
    net_income: float  # 당기순이익
    as_of_date: Optional[date] = None


class ClosePeriodRequest(BaseModel):
    """기간 마감 요청"""
    fiscal_year_id: str = Field(..., description="마감할 회계연도 ID")
