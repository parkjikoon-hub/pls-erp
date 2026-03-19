"""
M3 인사/급여 — 급여 계산 서비스
4대보험, 소득세, 비과세 항목 자동 계산 + 급여대장 관리
"""
import uuid
import calendar
from typing import Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from ..models import Employee, AttendanceRecord, PayrollHeader, PayrollDetail
from ....audit.service import log_action


# ── 2026년 기준 4대보험 요율 (근로자 부담분) ──
RATES = {
    "national_pension": 0.045,      # 국민연금 4.5%
    "health_insurance": 0.03545,    # 건강보험 3.545%
    "long_term_care_ratio": 0.1281, # 장기요양: 건강보험의 12.81%
    "employment_insurance": 0.009,  # 고용보험 0.9%
}

# ── 비과세 한도 (월, 원) ──
TAX_FREE_LIMITS = {
    "meal_allowance": 200_000,        # 식대
    "car_allowance": 200_000,         # 자가운전보조금
    "research_allowance": 200_000,    # 연구활동비
    "childcare_allowance": 200_000,   # 육아수당 (2026년 기준 20만원)
}

# ── 월 소정근무일수 기본값 ──
DEFAULT_WORK_DAYS = 22


def _calc_income_tax(annual_taxable: float) -> float:
    """
    근로소득 간이세액표 기반 월 소득세 계산 (2026년 기준 근사치).
    실제 간이세액표는 수천 행이지만, 구간별 요율로 간이 계산합니다.
    """
    # 연간 과세소득 기준 세율 (누진세)
    brackets = [
        (14_000_000,   0.06, 0),
        (50_000_000,   0.15,   840_000),
        (88_000_000,   0.24, 6_240_000),
        (150_000_000,  0.35, 15_360_000),
        (300_000_000,  0.38, 37_060_000),
        (500_000_000,  0.40, 94_060_000),
        (1_000_000_000, 0.42, 174_060_000),
        (float("inf"), 0.45, 384_060_000),
    ]

    tax = 0
    for limit, rate, cumulative in brackets:
        if annual_taxable <= limit:
            tax = cumulative + (annual_taxable - (cumulative / rate if rate > 0 else 0)) * rate
            # 간이 계산: 구간 초과분 * 세율 + 누적세액
            prev_limit = 0
            for i, (l, r, c) in enumerate(brackets):
                if l == limit:
                    prev_limit = brackets[i - 1][0] if i > 0 else 0
                    break
            tax = cumulative + (annual_taxable - prev_limit) * rate
            break

    # 월 소득세 = 연간 세액 / 12
    monthly_tax = max(0, tax / 12)
    # 원 단위 절사 (10원 단위 버림)
    return int(monthly_tax / 10) * 10


def calculate_employee_payroll(
    emp: Employee,
    absent_days: float,
    leave_days: float,
    year: int,
    month: int,
) -> dict:
    """
    직원 1인의 월급여를 계산합니다.

    1. 비과세 항목 최적화 (세법 한도 내 최대 적용)
    2. 결근 공제 계산
    3. 4대보험 계산
    4. 소득세/지방소득세 계산
    5. 실수령액 산출
    """
    base = float(emp.base_salary)
    work_days_in_month = DEFAULT_WORK_DAYS

    # ── 1. 비과세 수당 결정 ──
    meal = min(TAX_FREE_LIMITS["meal_allowance"], 200_000)  # 모든 직원에게 식대 지급
    car = min(TAX_FREE_LIMITS["car_allowance"], 200_000) if emp.has_car_allowance else 0
    research = min(TAX_FREE_LIMITS["research_allowance"], 200_000) if emp.is_research_staff else 0
    childcare = min(TAX_FREE_LIMITS["childcare_allowance"], 200_000) if emp.has_childcare else 0

    total_tax_free = meal + car + research + childcare

    # ── 2. 결근 공제 ──
    daily_rate = base / work_days_in_month if work_days_in_month > 0 else 0
    leave_deduction = round(daily_rate * absent_days, 0)

    # ── 3. 총 지급액 ──
    gross = base + total_tax_free - leave_deduction
    taxable = base - leave_deduction  # 과세 대상 = 기본급 - 결근공제 (비과세 제외)
    if taxable < 0:
        taxable = 0

    # ── 4. 4대보험 계산 (과세소득 기준, 직원별 가입 여부 반영) ──
    national_pension = round(taxable * RATES["national_pension"]) if getattr(emp, 'ins_national_pension', True) else 0
    health_insurance = round(taxable * RATES["health_insurance"]) if getattr(emp, 'ins_health', True) else 0
    long_term_care = round(health_insurance * RATES["long_term_care_ratio"]) if getattr(emp, 'ins_longterm_care', True) else 0
    employment_insurance = round(taxable * RATES["employment_insurance"]) if getattr(emp, 'ins_employment', True) else 0

    # ── 5. 소득세 (간이세액표 기반) ──
    annual_taxable = taxable * 12
    income_tax = _calc_income_tax(annual_taxable)
    local_tax = round(income_tax * 0.1)  # 지방소득세 = 소득세의 10%

    # ── 6. 총 공제 및 실수령액 ──
    total_deduction = (
        income_tax + local_tax +
        national_pension + health_insurance +
        long_term_care + employment_insurance
    )
    net = gross - total_deduction
    if net < 0:
        net = 0

    actual_work_days = work_days_in_month - absent_days

    return {
        "base_salary": base,
        "overtime_pay": 0,
        "bonus": 0,
        "meal_allowance": meal,
        "car_allowance": car,
        "research_allowance": research,
        "childcare_allowance": childcare,
        "other_allowance": 0,
        "gross_salary": gross,
        "taxable_salary": taxable,
        "income_tax": income_tax,
        "local_tax": local_tax,
        "national_pension": national_pension,
        "health_insurance": health_insurance,
        "long_term_care": long_term_care,
        "employment_insurance": employment_insurance,
        "total_deduction": total_deduction,
        "net_salary": net,
        "work_days": int(actual_work_days),
        "leave_days": leave_days,
        "absent_days": absent_days,
        "leave_deduction": leave_deduction,
        "ai_optimized": True,  # 비과세 최적화 적용됨
    }


async def calculate_payroll(db: AsyncSession, year: int, month: int, current_user, ip_address: Optional[str] = None):
    """
    월별 급여 일괄 계산.
    활성 직원 전원에 대해 급여를 계산하고 급여대장을 생성합니다.
    """
    # 기존 급여대장 확인
    existing = await db.execute(
        select(PayrollHeader).where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = existing.scalar_one_or_none()

    if header:
        if header.status in ("approved", "paid"):
            raise HTTPException(status_code=400, detail=f"{year}년 {month}월 급여는 이미 승인/지급 완료되었습니다")
        # 기존 draft/calculated 삭제 후 재계산
        await db.execute(
            select(PayrollDetail).where(PayrollDetail.payroll_id == header.id)
        )
        # 상세 내역 삭제
        for detail in (await db.execute(
            select(PayrollDetail).where(PayrollDetail.payroll_id == header.id)
        )).scalars().all():
            await db.delete(detail)
        await db.flush()
    else:
        header = PayrollHeader(
            payroll_year=year,
            payroll_month=month,
            created_by=current_user.id,
        )
        db.add(header)
        await db.flush()

    # 활성 직원 목록
    emp_result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.is_active == True)
    )
    employees = emp_result.scalars().all()

    if not employees:
        raise HTTPException(status_code=400, detail="급여 계산 대상 직원이 없습니다")

    total_gross = 0
    total_deduction = 0
    total_net = 0

    for emp in employees:
        # 해당 월 근태 기록 조회
        att_result = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == emp.id,
                func.extract("year", AttendanceRecord.work_date) == year,
                func.extract("month", AttendanceRecord.work_date) == month,
            )
        )
        records = att_result.scalars().all()

        absent_days = sum(1 for r in records if r.attendance_type == "absent")
        leave_days = sum(float(r.leave_days) for r in records if r.attendance_type in ("leave", "half", "sick"))

        # 급여 계산
        calc = calculate_employee_payroll(emp, absent_days, leave_days, year, month)

        detail = PayrollDetail(
            payroll_id=header.id,
            employee_id=emp.id,
            **calc,
        )
        db.add(detail)

        total_gross += calc["gross_salary"]
        total_deduction += calc["total_deduction"]
        total_net += calc["net_salary"]

    # 헤더 업데이트
    header.status = "calculated"
    header.total_employees = len(employees)
    header.total_gross = total_gross
    header.total_deduction = total_deduction
    header.total_net = total_net

    await db.flush()

    await log_action(
        db=db, table_name="payroll_headers", record_id=header.id,
        action="INSERT", changed_by=current_user.id,
        new_values={"year": year, "month": month, "employees": len(employees)},
        ip_address=ip_address,
    )
    await db.commit()

    return await get_payroll(db, year, month)


async def get_payroll(db: AsyncSession, year: int, month: int):
    """급여대장 조회 (헤더 + 상세)"""
    result = await db.execute(
        select(PayrollHeader)
        .options(
            selectinload(PayrollHeader.details).selectinload(PayrollDetail.employee).selectinload(Employee.department),
        )
        .where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = result.scalar_one_or_none()
    if not header:
        return None

    details = []
    for d in sorted(header.details, key=lambda x: x.employee.employee_no if x.employee else ""):
        details.append({
            "id": str(d.id),
            "employee_id": str(d.employee_id),
            "employee_no": d.employee.employee_no if d.employee else None,
            "employee_name": d.employee.name if d.employee else None,
            "department_name": d.employee.department.name if d.employee and d.employee.department else None,
            "base_salary": float(d.base_salary),
            "overtime_hours": float(getattr(d, 'overtime_hours', 0) or 0),
            "overtime_pay": float(d.overtime_pay),
            "bonus": float(d.bonus),
            "meal_allowance": float(d.meal_allowance),
            "car_allowance": float(d.car_allowance),
            "research_allowance": float(d.research_allowance),
            "childcare_allowance": float(d.childcare_allowance),
            "other_allowance": float(d.other_allowance),
            "gross_salary": float(d.gross_salary),
            "taxable_salary": float(d.taxable_salary),
            "income_tax": float(d.income_tax),
            "local_tax": float(d.local_tax),
            "national_pension": float(d.national_pension),
            "health_insurance": float(d.health_insurance),
            "long_term_care": float(d.long_term_care),
            "employment_insurance": float(d.employment_insurance),
            "total_deduction": float(d.total_deduction),
            "net_salary": float(d.net_salary),
            "work_days": d.work_days,
            "leave_days": float(d.leave_days),
            "absent_days": float(d.absent_days),
            "leave_deduction": float(d.leave_deduction),
            "ai_optimized": d.ai_optimized,
            "detail_status": getattr(d, 'detail_status', 'pending') or 'pending',
        })

    return {
        "id": str(header.id),
        "payroll_year": header.payroll_year,
        "payroll_month": header.payroll_month,
        "status": header.status,
        "total_employees": header.total_employees,
        "total_gross": float(header.total_gross),
        "total_deduction": float(header.total_deduction),
        "total_net": float(header.total_net),
        "payment_date": header.payment_date,
        "journal_id": str(header.journal_id) if header.journal_id else None,
        "approved_by": str(header.approved_by) if header.approved_by else None,
        "approved_at": header.approved_at,
        "created_at": header.created_at,
        "details": details,
    }


async def list_payrolls(db: AsyncSession, year: Optional[int] = None):
    """급여대장 목록 (헤더만)"""
    query = select(PayrollHeader).order_by(
        PayrollHeader.payroll_year.desc(),
        PayrollHeader.payroll_month.desc(),
    )
    if year:
        query = query.where(PayrollHeader.payroll_year == year)

    result = await db.execute(query)
    headers = result.scalars().all()

    return [
        {
            "id": str(h.id),
            "payroll_year": h.payroll_year,
            "payroll_month": h.payroll_month,
            "status": h.status,
            "total_employees": h.total_employees,
            "total_gross": float(h.total_gross),
            "total_deduction": float(h.total_deduction),
            "total_net": float(h.total_net),
            "payment_date": h.payment_date,
            "approved_at": h.approved_at,
            "created_at": h.created_at,
        }
        for h in headers
    ]


async def update_overtime(
    db: AsyncSession, year: int, month: int, items: list, current_user, ip_address: Optional[str] = None
):
    """
    추가근무 시간 일괄 입력 → 급여 재계산.
    overtime_hours 기준으로 overtime_pay를 계산하고 총 지급액/공제액을 재산출합니다.
    """
    result = await db.execute(
        select(PayrollHeader).where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = result.scalar_one_or_none()
    if not header:
        raise HTTPException(status_code=404, detail="급여대장을 찾을 수 없습니다")
    if header.status in ("approved", "paid"):
        raise HTTPException(status_code=400, detail="승인/지급 완료된 급여는 수정할 수 없습니다")

    import uuid as _uuid

    for item in items:
        detail_result = await db.execute(
            select(PayrollDetail)
            .options(selectinload(PayrollDetail.employee))
            .where(PayrollDetail.id == _uuid.UUID(item.detail_id))
        )
        detail = detail_result.scalar_one_or_none()
        if not detail:
            continue

        # 추가근무수당 = 시급(기본급/209h) × 1.5 × 추가근무시간
        base = float(detail.base_salary)
        hourly_rate = base / 209 if base > 0 else 0
        overtime_hours = float(item.overtime_hours)
        overtime_pay = round(hourly_rate * 1.5 * overtime_hours)

        detail.overtime_hours = overtime_hours
        detail.overtime_pay = overtime_pay

        # 총 지급액 재계산
        tax_free = (float(detail.meal_allowance) + float(detail.car_allowance) +
                    float(detail.research_allowance) + float(detail.childcare_allowance))
        detail.gross_salary = base + overtime_pay + float(detail.bonus) + tax_free - float(detail.leave_deduction)
        detail.taxable_salary = max(0, base + overtime_pay + float(detail.bonus) - float(detail.leave_deduction))

        # 4대보험 재계산 (직원 보험 가입여부 반영)
        emp = detail.employee
        taxable = float(detail.taxable_salary)
        detail.national_pension = round(taxable * RATES["national_pension"]) if getattr(emp, 'ins_national_pension', True) else 0
        detail.health_insurance = round(taxable * RATES["health_insurance"]) if getattr(emp, 'ins_health', True) else 0
        detail.long_term_care = round(float(detail.health_insurance) * RATES["long_term_care_ratio"]) if getattr(emp, 'ins_longterm_care', True) else 0
        detail.employment_insurance = round(taxable * RATES["employment_insurance"]) if getattr(emp, 'ins_employment', True) else 0

        # 소득세 재계산
        detail.income_tax = _calc_income_tax(taxable * 12)
        detail.local_tax = round(float(detail.income_tax) * 0.1)

        detail.total_deduction = (
            float(detail.income_tax) + float(detail.local_tax) +
            float(detail.national_pension) + float(detail.health_insurance) +
            float(detail.long_term_care) + float(detail.employment_insurance)
        )
        detail.net_salary = max(0, float(detail.gross_salary) - float(detail.total_deduction))

    # 헤더 합계 재계산
    all_details = await db.execute(
        select(PayrollDetail).where(PayrollDetail.payroll_id == header.id)
    )
    totals = all_details.scalars().all()
    header.total_gross = sum(float(d.gross_salary) for d in totals)
    header.total_deduction = sum(float(d.total_deduction) for d in totals)
    header.total_net = sum(float(d.net_salary) for d in totals)

    await db.commit()
    return await get_payroll(db, year, month)


async def approve_payroll(
    db: AsyncSession, year: int, month: int, payment_date, current_user, ip_address: Optional[str] = None
):
    """급여 전체 승인 (calculated → approved) — 모든 직원 일괄"""
    result = await db.execute(
        select(PayrollHeader).where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = result.scalar_one_or_none()
    if not header:
        raise HTTPException(status_code=404, detail="급여대장을 찾을 수 없습니다")
    if header.status not in ("calculated",):
        raise HTTPException(status_code=400, detail=f"현재 상태({header.status})에서는 승인할 수 없습니다. '계산완료' 상태여야 합니다.")

    # 모든 상세 내역을 approved로 변경
    details_result = await db.execute(
        select(PayrollDetail).where(PayrollDetail.payroll_id == header.id)
    )
    for detail in details_result.scalars().all():
        detail.detail_status = "approved"

    header.status = "approved"
    header.approved_by = current_user.id
    header.approved_at = func.now()
    if payment_date:
        header.payment_date = payment_date

    await log_action(
        db=db, table_name="payroll_headers", record_id=header.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"status": "approved"},
        ip_address=ip_address,
    )
    await db.commit()
    return await get_payroll(db, year, month)


async def approve_payroll_items(
    db: AsyncSession, year: int, month: int, detail_ids: list[str],
    current_user, ip_address: Optional[str] = None
):
    """급여 개별 승인 — 선택한 직원만 승인"""
    import uuid as _uuid

    result = await db.execute(
        select(PayrollHeader).where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = result.scalar_one_or_none()
    if not header:
        raise HTTPException(status_code=404, detail="급여대장을 찾을 수 없습니다")
    if header.status not in ("calculated",):
        raise HTTPException(status_code=400, detail=f"현재 상태({header.status})에서는 승인할 수 없습니다. '계산완료' 상태여야 합니다.")

    # 선택된 항목 승인
    approved_count = 0
    for did in detail_ids:
        detail_result = await db.execute(
            select(PayrollDetail).where(
                PayrollDetail.id == _uuid.UUID(did),
                PayrollDetail.payroll_id == header.id,
            )
        )
        detail = detail_result.scalar_one_or_none()
        if detail and getattr(detail, 'detail_status', 'pending') != 'approved':
            detail.detail_status = "approved"
            approved_count += 1

    # 전체 승인 여부 확인 — 모든 상세가 approved이면 헤더도 approved로 변경
    all_details = await db.execute(
        select(PayrollDetail).where(PayrollDetail.payroll_id == header.id)
    )
    all_items = all_details.scalars().all()
    all_approved = all(getattr(d, 'detail_status', 'pending') == 'approved' for d in all_items)

    if all_approved and len(all_items) > 0:
        header.status = "approved"
        header.approved_by = current_user.id
        header.approved_at = func.now()

    await log_action(
        db=db, table_name="payroll_details", record_id=header.id,
        action="UPDATE", changed_by=current_user.id,
        new_values={"approved_items": approved_count, "detail_ids": detail_ids},
        ip_address=ip_address,
    )
    await db.commit()
    return await get_payroll(db, year, month)
