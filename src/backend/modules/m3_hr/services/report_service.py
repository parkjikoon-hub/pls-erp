"""
M3 인사/급여 — 보고서 + 국세청 신고파일 서비스
급여명세서 조회, 인사 통계, 원천세 신고용 CSV 생성
"""
import uuid
import csv
import io
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from ..models import Employee, PayrollHeader, PayrollDetail, AttendanceRecord


async def get_payslip(db: AsyncSession, employee_id: str, year: int, month: int):
    """개인 급여명세서 조회"""
    # 급여대장 헤더 조회
    header_result = await db.execute(
        select(PayrollHeader).where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = header_result.scalar_one_or_none()
    if not header:
        raise HTTPException(status_code=404, detail=f"{year}년 {month}월 급여대장이 없습니다")

    # 개인 상세 조회
    detail_result = await db.execute(
        select(PayrollDetail)
        .options(
            selectinload(PayrollDetail.employee).selectinload(Employee.department),
            selectinload(PayrollDetail.employee).selectinload(Employee.position),
        )
        .where(
            PayrollDetail.payroll_id == header.id,
            PayrollDetail.employee_id == uuid.UUID(employee_id),
        )
    )
    detail = detail_result.scalar_one_or_none()
    if not detail:
        raise HTTPException(status_code=404, detail="해당 직원의 급여 내역이 없습니다")

    emp = detail.employee
    tax_free = (
        float(detail.meal_allowance) + float(detail.car_allowance) +
        float(detail.research_allowance) + float(detail.childcare_allowance)
    )

    return {
        "year": year,
        "month": month,
        "status": header.status,
        "payment_date": header.payment_date,
        "employee": {
            "employee_no": emp.employee_no,
            "name": emp.name,
            "department": emp.department.name if emp.department else None,
            "position": emp.position.name if emp.position else None,
        },
        "earnings": {
            "base_salary": float(detail.base_salary),
            "overtime_pay": float(detail.overtime_pay),
            "bonus": float(detail.bonus),
            "meal_allowance": float(detail.meal_allowance),
            "car_allowance": float(detail.car_allowance),
            "research_allowance": float(detail.research_allowance),
            "childcare_allowance": float(detail.childcare_allowance),
            "other_allowance": float(detail.other_allowance),
            "total_tax_free": tax_free,
            "gross_salary": float(detail.gross_salary),
            "taxable_salary": float(detail.taxable_salary),
        },
        "deductions": {
            "income_tax": float(detail.income_tax),
            "local_tax": float(detail.local_tax),
            "national_pension": float(detail.national_pension),
            "health_insurance": float(detail.health_insurance),
            "long_term_care": float(detail.long_term_care),
            "employment_insurance": float(detail.employment_insurance),
            "total_deduction": float(detail.total_deduction),
        },
        "net_salary": float(detail.net_salary),
        "attendance": {
            "work_days": detail.work_days,
            "leave_days": float(detail.leave_days),
            "absent_days": float(detail.absent_days),
            "leave_deduction": float(detail.leave_deduction),
        },
        "ai_optimized": detail.ai_optimized,
    }


async def get_hr_summary(db: AsyncSession, year: int):
    """인사 통계 보고서 (연간)"""
    # 전체 직원 수
    total_active = (await db.execute(
        select(func.count()).select_from(Employee).where(Employee.is_active == True)
    )).scalar() or 0

    total_inactive = (await db.execute(
        select(func.count()).select_from(Employee).where(Employee.is_active == False)
    )).scalar() or 0

    # 고용유형별 인원
    type_counts = {}
    for etype in ["regular", "contract", "part"]:
        count = (await db.execute(
            select(func.count()).select_from(Employee)
            .where(Employee.is_active == True, Employee.employee_type == etype)
        )).scalar() or 0
        type_counts[etype] = count

    # 연간 급여 합계
    payroll_result = await db.execute(
        select(
            func.sum(PayrollHeader.total_gross),
            func.sum(PayrollHeader.total_deduction),
            func.sum(PayrollHeader.total_net),
            func.count(),
        ).where(PayrollHeader.payroll_year == year)
    )
    row = payroll_result.one()
    annual_gross = float(row[0] or 0)
    annual_deduction = float(row[1] or 0)
    annual_net = float(row[2] or 0)
    payroll_count = row[3]

    # 연간 근태 통계
    att_result = await db.execute(
        select(
            AttendanceRecord.attendance_type,
            func.count(),
        )
        .where(func.extract("year", AttendanceRecord.work_date) == year)
        .group_by(AttendanceRecord.attendance_type)
    )
    att_stats = {row[0]: row[1] for row in att_result.all()}

    return {
        "year": year,
        "headcount": {
            "active": total_active,
            "inactive": total_inactive,
            "by_type": type_counts,
        },
        "payroll_annual": {
            "months_calculated": payroll_count,
            "total_gross": annual_gross,
            "total_deduction": annual_deduction,
            "total_net": annual_net,
        },
        "attendance_annual": att_stats,
    }


async def generate_tax_filing_csv(db: AsyncSession, year: int, month: int) -> str:
    """
    국세청 원천세 신고용 CSV 파일 생성.
    담당자가 다운로드해서 홈택스에 수동 업로드합니다.

    CSV 컬럼:
    사번, 이름, 주민등록번호(마스킹), 과세소득, 비과세소득, 총급여,
    소득세, 지방소득세, 국민연금, 건강보험, 장기요양, 고용보험, 총공제, 실수령액
    """
    header_result = await db.execute(
        select(PayrollHeader).where(
            PayrollHeader.payroll_year == year,
            PayrollHeader.payroll_month == month,
        )
    )
    header = header_result.scalar_one_or_none()
    if not header:
        raise HTTPException(status_code=404, detail=f"{year}년 {month}월 급여대장이 없습니다")

    if header.status not in ("calculated", "approved", "paid"):
        raise HTTPException(status_code=400, detail="급여 계산이 완료된 후에 신고파일을 생성할 수 있습니다")

    # 상세 내역 조회
    details_result = await db.execute(
        select(PayrollDetail)
        .options(selectinload(PayrollDetail.employee))
        .where(PayrollDetail.payroll_id == header.id)
        .order_by(PayrollDetail.employee_id)
    )
    details = details_result.scalars().all()

    if not details:
        raise HTTPException(status_code=404, detail="급여 상세 내역이 없습니다")

    # CSV 생성
    output = io.StringIO()
    writer = csv.writer(output)

    # 헤더 행
    writer.writerow([
        "사번", "이름", "주민등록번호",
        "과세소득", "비과세소득", "총급여",
        "소득세", "지방소득세",
        "국민연금", "건강보험", "장기요양보험", "고용보험",
        "총공제액", "실수령액",
    ])

    # 데이터 행
    for d in details:
        emp = d.employee
        # 주민번호 마스킹 (앞 6자리만 표시)
        resident_no = "******-*******"
        if emp and emp.resident_no_enc:
            # 실제로는 복호화 후 마스킹해야 하지만, 간이 처리
            resident_no = "******-*******"

        tax_free = (
            float(d.meal_allowance) + float(d.car_allowance) +
            float(d.research_allowance) + float(d.childcare_allowance)
        )

        writer.writerow([
            emp.employee_no if emp else "",
            emp.name if emp else "",
            resident_no,
            int(float(d.taxable_salary)),
            int(tax_free),
            int(float(d.gross_salary)),
            int(float(d.income_tax)),
            int(float(d.local_tax)),
            int(float(d.national_pension)),
            int(float(d.health_insurance)),
            int(float(d.long_term_care)),
            int(float(d.employment_insurance)),
            int(float(d.total_deduction)),
            int(float(d.net_salary)),
        ])

    # 합계 행
    writer.writerow([
        "", "합계", "",
        int(sum(float(d.taxable_salary) for d in details)),
        int(sum(
            float(d.meal_allowance) + float(d.car_allowance) +
            float(d.research_allowance) + float(d.childcare_allowance)
            for d in details
        )),
        int(float(header.total_gross)),
        int(sum(float(d.income_tax) for d in details)),
        int(sum(float(d.local_tax) for d in details)),
        int(sum(float(d.national_pension) for d in details)),
        int(sum(float(d.health_insurance) for d in details)),
        int(sum(float(d.long_term_care) for d in details)),
        int(sum(float(d.employment_insurance) for d in details)),
        int(float(header.total_deduction)),
        int(float(header.total_net)),
    ])

    return output.getvalue()
