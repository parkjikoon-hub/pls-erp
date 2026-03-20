"""
M4 재무/회계 — 은행 입금 내역 임포트 서비스
CSV 파싱 → 미리보기 → 전표 자동 생성
"""
import io
import json
import hashlib
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models import (
    BankImportHistory, BankAccountMapping,
    JournalEntry, JournalEntryLine, ChartOfAccounts,
)
from ..schemas.bank_import import (
    ParsedTransaction, ParseResult,
    ConfirmTransaction, ConfirmImportRequest,
    MappingResponse,
)
from .journal_service import generate_entry_no
from .fiscal_year_service import get_fiscal_year_by_date
from ....audit.service import log_action


# ── 은행별 CSV 컬럼 매핑 ──
# 각 은행의 인터넷뱅킹에서 다운로드한 CSV의 컬럼명을 통일된 키로 매핑
BANK_COLUMN_MAPS: dict[str, dict[str, list[str]]] = {
    "shinhan": {
        "date": ["거래일자", "거래일", "거래일시", "날짜"],
        "desc": ["적요", "거래내용", "내용", "적요내용"],
        "deposit": ["입금", "입금액", "입금금액"],
        "withdrawal": ["출금", "출금액", "출금금액"],
        "balance": ["잔액", "거래후잔액", "거래후 잔액"],
    },
    "ibk": {
        "date": ["거래일", "거래일자", "날짜"],
        "desc": ["적요", "거래내용", "내용"],
        "deposit": ["입금액", "입금", "입금금액"],
        "withdrawal": ["출금액", "출금", "출금금액"],
        "balance": ["거래후잔액", "잔액", "거래후 잔액"],
    },
    "kb": {
        "date": ["거래일자", "거래일", "날짜"],
        "desc": ["적요", "거래내용", "내용"],
        "deposit": ["입금액", "입금", "입금금액"],
        "withdrawal": ["출금액", "출금", "출금금액"],
        "balance": ["거래후잔액", "잔액", "거래후 잔액"],
    },
    "woori": {
        "date": ["거래일", "거래일자", "날짜"],
        "desc": ["적요", "거래내용", "내용"],
        "deposit": ["입금", "입금액", "입금금액"],
        "withdrawal": ["출금", "출금액", "출금금액"],
        "balance": ["잔액", "거래후잔액", "거래후 잔액"],
    },
    "hana": {
        "date": ["거래일시", "거래일", "거래일자", "날짜"],
        "desc": ["적요", "거래내용", "내용"],
        "deposit": ["입금액", "입금", "입금금액"],
        "withdrawal": ["출금액", "출금", "출금금액"],
        "balance": ["거래후잔액", "잔액", "거래후 잔액"],
    },
}

# 모든 은행에 대응하는 범용 매핑 (은행 코드 없이도 동작)
UNIVERSAL_COLUMN_MAP = {
    "date": ["거래일자", "거래일", "거래일시", "날짜", "일자"],
    "desc": ["적요", "거래내용", "내용", "적요내용", "비고"],
    "deposit": ["입금액", "입금", "입금금액", "들어온 금액"],
    "withdrawal": ["출금액", "출금", "출금금액", "나간 금액"],
    "balance": ["거래후잔액", "잔액", "거래후 잔액", "현재잔액"],
}


def _find_column(headers: list[str], candidates: list[str]) -> Optional[str]:
    """헤더 목록에서 후보 컬럼명과 일치하는 것을 찾기"""
    for candidate in candidates:
        for header in headers:
            # 공백/특수문자 제거 후 비교
            clean_header = header.strip().replace(" ", "")
            clean_candidate = candidate.strip().replace(" ", "")
            if clean_header == clean_candidate:
                return header
    return None


def _parse_amount(value) -> float:
    """금액 문자열 → float 변환 (쉼표, 공백 등 제거)"""
    if value is None or value == "" or value == "-":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    # 문자열 처리: 쉼표, 공백, 원 기호 제거
    cleaned = str(value).replace(",", "").replace(" ", "").replace("원", "").replace("₩", "").strip()
    if cleaned == "" or cleaned == "-":
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_date(value) -> Optional[str]:
    """다양한 날짜 형식을 YYYY-MM-DD로 통일"""
    if value is None or str(value).strip() == "":
        return None
    s = str(value).strip()

    # YYYYMMDD (숫자만 8자리)
    digits = s.replace("-", "").replace("/", "").replace(".", "")
    if len(digits) >= 8 and digits[:8].isdigit():
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"

    # YYYY-MM-DD 또는 YYYY/MM/DD 또는 YYYY.MM.DD
    for sep in ["-", "/", "."]:
        if sep in s:
            parts = s.split(sep)
            if len(parts) >= 3:
                try:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2].split()[0])
                    return f"{y:04d}-{m:02d}-{d:02d}"
                except ValueError:
                    continue

    return None


def generate_transaction_hash(tx_date: str, amount: float, description: str) -> str:
    """거래 고유 해시 생성 (중복 방지용)"""
    raw = f"{tx_date}|{amount:.2f}|{description.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


async def parse_bank_csv(
    file_bytes: bytes,
    bank_code: str,
    file_name: str,
    db: AsyncSession,
) -> ParseResult:
    """은행 CSV 파일을 파싱하여 미리보기 데이터 반환"""
    import csv

    # 인코딩 자동 감지 (UTF-8-BOM → UTF-8 → EUC-KR)
    content = None
    for encoding in ["utf-8-sig", "utf-8", "euc-kr", "cp949"]:
        try:
            content = file_bytes.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if content is None:
        raise HTTPException(400, "파일 인코딩을 인식할 수 없습니다. UTF-8 또는 EUC-KR로 저장해주세요.")

    # CSV 파싱
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    if len(rows) < 2:
        raise HTTPException(400, "CSV 파일에 데이터가 없습니다 (헤더 + 최소 1행 필요)")

    # 헤더 행 찾기 (첫 몇 행 중 컬럼명이 포함된 행)
    header_idx = 0
    headers = rows[0]
    column_map = BANK_COLUMN_MAPS.get(bank_code, UNIVERSAL_COLUMN_MAP)

    # 첫 5행 내에서 실제 헤더 행 찾기 (은행 CSV에 상단 메타 정보가 있을 수 있음)
    for i in range(min(5, len(rows))):
        test_headers = rows[i]
        date_col = _find_column(test_headers, column_map["date"])
        if date_col:
            header_idx = i
            headers = test_headers
            break

    # 컬럼 매핑
    date_col = _find_column(headers, column_map["date"])
    desc_col = _find_column(headers, column_map["desc"])
    deposit_col = _find_column(headers, column_map["deposit"])
    withdrawal_col = _find_column(headers, column_map["withdrawal"])
    balance_col = _find_column(headers, column_map["balance"])

    if not date_col:
        raise HTTPException(400, f"날짜 컬럼을 찾을 수 없습니다. CSV 헤더를 확인해주세요. (감지된 헤더: {headers})")
    if not deposit_col:
        raise HTTPException(400, f"입금액 컬럼을 찾을 수 없습니다. CSV 헤더를 확인해주세요. (감지된 헤더: {headers})")

    # 컬럼 인덱스
    date_idx = headers.index(date_col)
    desc_idx = headers.index(desc_col) if desc_col else None
    deposit_idx = headers.index(deposit_col)
    withdrawal_idx = headers.index(withdrawal_col) if withdrawal_col else None
    balance_idx = headers.index(balance_col) if balance_col else None

    # 기존 임포트 해시 조회 (중복 감지용)
    existing_hashes = set()
    history_rows = await db.execute(
        select(BankImportHistory.transaction_hashes).where(
            BankImportHistory.transaction_hashes.isnot(None)
        )
    )
    for row in history_rows.scalars().all():
        try:
            existing_hashes.update(json.loads(row))
        except (json.JSONDecodeError, TypeError):
            pass

    # 매핑 규칙 로드
    mappings = await _load_mappings(db)

    # 데이터 행 파싱
    transactions: list[ParsedTransaction] = []
    data_rows = rows[header_idx + 1:]
    total_rows = 0

    for row_idx, row in enumerate(data_rows):
        if len(row) <= date_idx:
            continue

        tx_date = _parse_date(row[date_idx])
        if not tx_date:
            continue

        total_rows += 1
        desc = row[desc_idx].strip() if desc_idx is not None and len(row) > desc_idx else ""
        deposit = _parse_amount(row[deposit_idx]) if len(row) > deposit_idx else 0.0
        withdrawal = _parse_amount(row[withdrawal_idx]) if withdrawal_idx and len(row) > withdrawal_idx else 0.0
        balance = _parse_amount(row[balance_idx]) if balance_idx and len(row) > balance_idx else 0.0

        tx_hash = generate_transaction_hash(tx_date, deposit if deposit > 0 else -withdrawal, desc)

        # 자동 계정 매핑
        mapped_id, mapped_name = _match_account(desc, mappings)

        transactions.append(ParsedTransaction(
            row_index=row_idx + header_idx + 1,
            transaction_date=tx_date,
            description=desc,
            deposit_amount=deposit,
            withdrawal_amount=withdrawal,
            balance=balance,
            hash=tx_hash,
            is_duplicate=tx_hash in existing_hashes,
            mapped_account_id=mapped_id,
            mapped_account_name=mapped_name,
        ))

    deposit_rows = sum(1 for t in transactions if t.deposit_amount > 0)

    return ParseResult(
        bank_code=bank_code,
        file_name=file_name,
        total_rows=total_rows,
        deposit_rows=deposit_rows,
        transactions=transactions,
    )


async def confirm_import(
    db: AsyncSession,
    data: ConfirmImportRequest,
    current_user,
    ip_address: Optional[str] = None,
) -> dict:
    """선택된 거래들을 전표로 변환하여 저장"""
    if not data.transactions:
        raise HTTPException(400, "임포트할 거래가 없습니다")

    # 보통예금 계정과목 결정
    bank_account_id = data.bank_account_id
    if not bank_account_id:
        # 기본: '보통예금' 계정 자동 검색
        result = await db.execute(
            select(ChartOfAccounts).where(
                ChartOfAccounts.name.ilike("%보통예금%"),
                ChartOfAccounts.is_active == True,
            ).limit(1)
        )
        acc = result.scalar_one_or_none()
        if acc:
            bank_account_id = str(acc.id)
        else:
            raise HTTPException(400, "'보통예금' 계정과목을 찾을 수 없습니다. bank_account_id를 직접 지정해주세요.")

    created_count = 0
    skipped_count = 0
    total_amount = 0.0
    tx_hashes: list[str] = []

    for tx in data.transactions:
        # 계정과목 유효성 확인
        credit_acc = await db.execute(
            select(ChartOfAccounts).where(
                ChartOfAccounts.id == uuid.UUID(tx.account_id),
                ChartOfAccounts.is_active == True,
            )
        )
        if not credit_acc.scalar_one_or_none():
            skipped_count += 1
            continue

        try:
            tx_date = date.fromisoformat(tx.transaction_date)
        except ValueError:
            skipped_count += 1
            continue

        # 회계연도 확인
        try:
            fiscal_year = await get_fiscal_year_by_date(db, tx_date)
            if fiscal_year.is_closed:
                skipped_count += 1
                continue
        except HTTPException:
            skipped_count += 1
            continue

        # 전표 번호 생성
        entry_no = await generate_entry_no(db, tx_date)

        # 전표 생성 (차변: 보통예금, 대변: 매핑 계정)
        journal = JournalEntry(
            entry_no=entry_no,
            entry_date=tx_date,
            entry_type="general",
            description=f"[은행입금] {tx.description}",
            total_debit=tx.amount,
            total_credit=tx.amount,
            status="draft",
            source_module="M4",
            fiscal_year_id=fiscal_year.id,
            created_by=current_user.id,
        )
        db.add(journal)
        await db.flush()

        # 분개 라인: 차변 (보통예금)
        debit_line = JournalEntryLine(
            journal_id=journal.id,
            line_no=1,
            account_id=uuid.UUID(bank_account_id),
            debit_amount=tx.amount,
            credit_amount=0,
            description=tx.description,
        )
        db.add(debit_line)

        # 분개 라인: 대변 (매핑 계정)
        credit_line = JournalEntryLine(
            journal_id=journal.id,
            line_no=2,
            account_id=uuid.UUID(tx.account_id),
            debit_amount=0,
            credit_amount=tx.amount,
            description=tx.description,
        )
        db.add(credit_line)

        created_count += 1
        total_amount += tx.amount
        tx_hashes.append(tx.hash)

    # 임포트 이력 저장
    history = BankImportHistory(
        bank_code=data.bank_code,
        file_name=data.file_name,
        total_rows=len(data.transactions),
        imported_count=created_count,
        skipped_count=skipped_count,
        total_deposit=total_amount,
        source="csv",
        transaction_hashes=json.dumps(tx_hashes),
        imported_by=current_user.id,
    )
    db.add(history)

    # 감사 로그
    await log_action(
        db=db,
        table_name="bank_import_history",
        record_id=history.id,
        action="INSERT",
        changed_by=current_user.id,
        new_values={
            "bank_code": data.bank_code,
            "imported_count": created_count,
            "total_deposit": float(total_amount),
        },
        ip_address=ip_address,
    )

    await db.commit()

    return {
        "message": f"{created_count}건의 전표가 생성되었습니다 (건너뜀: {skipped_count}건)",
        "created_count": created_count,
        "skipped_count": skipped_count,
        "total_amount": total_amount,
    }


async def get_import_history(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
) -> dict:
    """임포트 이력 조회"""
    count_q = select(func.count()).select_from(BankImportHistory)
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(BankImportHistory)
        .order_by(BankImportHistory.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": str(h.id),
                "import_date": h.import_date.isoformat() if h.import_date else None,
                "bank_code": h.bank_code,
                "file_name": h.file_name,
                "total_rows": h.total_rows,
                "imported_count": h.imported_count,
                "skipped_count": h.skipped_count,
                "total_deposit": float(h.total_deposit) if h.total_deposit else 0,
                "source": h.source,
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "size": size,
    }


# ── 매핑 규칙 관리 ──

async def _load_mappings(db: AsyncSession) -> list[dict]:
    """활성 매핑 규칙 로드 (우선순위 내림차순)"""
    result = await db.execute(
        select(BankAccountMapping, ChartOfAccounts.name)
        .join(ChartOfAccounts, BankAccountMapping.account_id == ChartOfAccounts.id)
        .where(BankAccountMapping.is_active == True)
        .order_by(BankAccountMapping.priority.desc())
    )
    return [
        {
            "keyword": row[0].keyword,
            "account_id": str(row[0].account_id),
            "account_name": row[1],
        }
        for row in result.all()
    ]


def _match_account(description: str, mappings: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """적요 → 계정과목 자동 매핑 (키워드 매칭)"""
    desc_lower = description.strip()
    for m in mappings:
        if m["keyword"] in desc_lower:
            return m["account_id"], m["account_name"]
    return None, None


async def list_mappings(db: AsyncSession) -> list[MappingResponse]:
    """매핑 규칙 목록 조회"""
    result = await db.execute(
        select(BankAccountMapping, ChartOfAccounts.name)
        .join(ChartOfAccounts, BankAccountMapping.account_id == ChartOfAccounts.id)
        .where(BankAccountMapping.is_active == True)
        .order_by(BankAccountMapping.priority.desc())
    )
    return [
        MappingResponse(
            id=str(row[0].id),
            keyword=row[0].keyword,
            account_id=str(row[0].account_id),
            account_name=row[1],
            priority=row[0].priority,
            is_active=row[0].is_active,
        )
        for row in result.all()
    ]


async def create_mapping(
    db: AsyncSession,
    keyword: str,
    account_id: str,
    priority: int,
    current_user,
) -> MappingResponse:
    """매핑 규칙 추가"""
    # 계정과목 유효성 확인
    acc_result = await db.execute(
        select(ChartOfAccounts).where(
            ChartOfAccounts.id == uuid.UUID(account_id),
            ChartOfAccounts.is_active == True,
        )
    )
    acc = acc_result.scalar_one_or_none()
    if not acc:
        raise HTTPException(400, "유효하지 않은 계정과목입니다")

    mapping = BankAccountMapping(
        keyword=keyword,
        account_id=uuid.UUID(account_id),
        priority=priority,
        created_by=current_user.id,
    )
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)

    return MappingResponse(
        id=str(mapping.id),
        keyword=mapping.keyword,
        account_id=str(mapping.account_id),
        account_name=acc.name,
        priority=mapping.priority,
        is_active=mapping.is_active,
    )


async def delete_mapping(db: AsyncSession, mapping_id: str) -> dict:
    """매핑 규칙 삭제 (소프트 삭제)"""
    result = await db.execute(
        select(BankAccountMapping).where(
            BankAccountMapping.id == uuid.UUID(mapping_id)
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(404, "매핑 규칙을 찾을 수 없습니다")

    mapping.is_active = False
    await db.commit()
    return {"message": "매핑 규칙이 삭제되었습니다"}
