# 은행 입금 실시간 연동 설계 계획서
> **v1.0** | 최종 업데이트: **2026-03-20 23:30** | 작성자: Claude Code

## 변경 이력
| 버전 | 일시 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-03-20 23:30 | 초기 작성 — API 비교 + 연동 설계 |

---

## 1. 현재 상태

| 항목 | 현황 |
|------|------|
| 입금 내역 수집 방식 | **CSV 수동 업로드** (인터넷뱅킹에서 다운로드 → ERP 업로드) |
| 지원 은행 | 신한/기업/국민/우리/하나 (CSV 컬럼 매핑) |
| 전표 생성 | CSV 파싱 → 미리보기 → 전표 자동 생성 |
| 중복 방지 | SHA-256 해시 기반 |
| 관련 파일 | `bank_import_service.py`, `bank_import_router.py`, `BankImportPage.tsx` |

**한계점**:
- 수동 CSV 다운로드/업로드 필요 (하루 1~2회 수작업)
- 실시간 모니터링 불가
- 사용자 실수로 중복/누락 가능

---

## 2. API 서비스 비교

### 2-1. 후보 서비스

| 항목 | CODEF (코드에프) | 팝빌 (Popbill) | 금융결제원 오픈뱅킹 |
|------|-----------------|---------------|-------------------|
| **운영사** | 헥토데이터 | 링크허브 | 금융결제원 (KFTC) |
| **기술 방식** | 스크래핑 | 스크래핑 | 공식 API |
| **지원 은행** | 20개 + 저축은행 64개 | 19개 은행 | 16+ 은행 |
| **인증 방식** | OAuth2 + 공인인증서/ID | 비밀번호 4자리 | OAuth2 |
| **SDK** | Python/Java/Node | 14개 언어 | 직접 개발 |
| **도입 난이도** | 중 | **낮음** | 매우 높음 |
| **초기 비용** | 무료(3개월 데모) | 낮음 | 약 1,000만원+ |
| **월 비용** | 구독형(중) | 정액제(중) | 건당 3~10원 |
| **ERP 연동 실적** | 어퍼코리아 ERP 도입 사례 | ERP 전문 특화 | - |
| **추가 기능** | 카드/홈택스 연동 가능 | 세금계산서 API 포함 | 이체 기능 포함 |

### 2-2. 추천 순위

| 순위 | 서비스 | 추천 이유 |
|------|--------|---------|
| **1순위** | **CODEF** | ERP 도입 사례 존재, 3개월 무료 테스트, 은행+카드+홈택스 통합 |
| **2순위** | **팝빌** | ERP 연동 전문, 20분 내 API Key 발급, 가장 빠른 도입 |
| **비추천** | 오픈뱅킹 | 보안점검 비용 약 1,000만원+, 금융보안원 심사 필요 |

---

## 3. 연동 아키텍처 설계

### 3-1. 전체 흐름

```
[CODEF/팝빌 API]
      │
      ▼
[FastAPI 백엔드]
  ├─ /bank-realtime/sync       ← 사용자 수동 동기화 버튼
  ├─ /bank-realtime/auto-sync  ← 스케줄러(APScheduler) 자동 실행
  └─ /bank-realtime/settings   ← 연동 설정 관리
      │
      ▼
[기존 bank_import_service]  ← 파싱 로직 재사용
      │
      ▼
[JournalEntry 전표 생성]   ← 기존 전표 생성 로직 재사용
      │
      ▼
[프론트엔드 알림]          ← 새 입금 건 알림 (M7 연동)
```

### 3-2. 신규 DB 테이블

```sql
-- 은행 API 연동 설정
CREATE TABLE bank_api_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL,        -- 'codef' / 'popbill'
    api_key VARCHAR(500),                 -- API 키 (암호화 저장)
    api_secret VARCHAR(500),              -- API 시크릿 (암호화 저장)
    connected_id VARCHAR(200),            -- CODEF Connected ID
    sync_interval_minutes INT DEFAULT 60, -- 자동 동기화 주기 (분)
    auto_sync_enabled BOOLEAN DEFAULT FALSE,
    auto_create_journal BOOLEAN DEFAULT FALSE, -- 자동 전표 생성 여부
    last_sync_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 은행 계좌별 연동 상태
CREATE TABLE bank_api_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_id UUID REFERENCES bank_api_settings(id),
    bank_code VARCHAR(20) NOT NULL,       -- 은행 코드
    account_no VARCHAR(50) NOT NULL,      -- 계좌번호
    account_holder VARCHAR(50),           -- 예금주
    company_account_id UUID REFERENCES company_bank_accounts(id), -- 기존 계좌 연결
    last_transaction_date DATE,           -- 마지막 조회 거래일
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 동기화 로그
CREATE TABLE bank_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_id UUID REFERENCES bank_api_settings(id),
    sync_type VARCHAR(20) NOT NULL,       -- 'manual' / 'auto'
    status VARCHAR(20) NOT NULL,          -- 'success' / 'failed' / 'partial'
    total_transactions INT DEFAULT 0,
    new_transactions INT DEFAULT 0,
    duplicate_transactions INT DEFAULT 0,
    journals_created INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

### 3-3. 신규 백엔드 파일 구조

```
src/backend/modules/m4_finance/
├── models.py                          ← BankApiSetting, BankApiAccount, BankSyncLog 추가
├── schemas/
│   └── bank_realtime.py               ← 신규 Pydantic 스키마
├── services/
│   ├── bank_import_service.py         ← 기존 (CSV 파싱 로직 재사용)
│   └── bank_realtime_service.py       ← 신규 (API 호출 + 동기화 로직)
└── routers/
    └── bank_realtime_router.py        ← 신규 API 엔드포인트
```

### 3-4. API 엔드포인트 설계

```
POST /api/v1/finance/bank-realtime/settings
  → 연동 설정 생성 (API 키, 동기화 주기 등)

GET  /api/v1/finance/bank-realtime/settings
  → 현재 설정 조회

PUT  /api/v1/finance/bank-realtime/settings
  → 설정 수정

POST /api/v1/finance/bank-realtime/accounts
  → 연동 계좌 등록 (CODEF Connected ID 기반 자동 조회)

POST /api/v1/finance/bank-realtime/sync
  → 수동 동기화 실행 (전 계좌 또는 특정 계좌)

GET  /api/v1/finance/bank-realtime/sync-logs
  → 동기화 이력 조회

POST /api/v1/finance/bank-realtime/auto-sync/start
  → 자동 동기화 시작

POST /api/v1/finance/bank-realtime/auto-sync/stop
  → 자동 동기화 중지
```

### 3-5. CODEF API 연동 핵심 코드 (예시)

```python
# bank_realtime_service.py

import httpx
from datetime import date, timedelta

CODEF_BASE_URL = "https://api.codef.io"
CODEF_TOKEN_URL = "https://oauth.codef.io/oauth/token"

async def get_codef_token(client_id: str, client_secret: str) -> str:
    """CODEF OAuth 토큰 발급"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            CODEF_TOKEN_URL,
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
        )
        return resp.json()["access_token"]


async def fetch_transactions(
    token: str,
    connected_id: str,
    organization: str,   # 은행 코드 (예: '0004' = KB국민)
    account_no: str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """CODEF API로 거래내역 조회"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{CODEF_BASE_URL}/v1/kr/bank/b/account/transaction-list",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "connectedId": connected_id,
                "organization": organization,
                "account": account_no,
                "startDate": start_date.strftime("%Y%m%d"),
                "endDate": end_date.strftime("%Y%m%d"),
                "orderBy": "0",  # 최신순
            },
        )
        data = resp.json()
        if data.get("result", {}).get("code") != "CF-00000":
            raise Exception(f"CODEF 오류: {data}")
        return data.get("data", [])


async def sync_bank_transactions(db, setting, account):
    """
    은행 거래내역 동기화 메인 로직
    1. CODEF API로 거래내역 조회
    2. 중복 체크 (기존 bank_import_service의 해시 로직 재사용)
    3. 신규 건만 전표 생성
    """
    token = await get_codef_token(setting.api_key, setting.api_secret)

    # 마지막 조회일부터 오늘까지
    start = account.last_transaction_date or (date.today() - timedelta(days=30))
    end = date.today()

    transactions = await fetch_transactions(
        token=token,
        connected_id=setting.connected_id,
        organization=account.bank_code,
        account_no=account.account_no,
        start_date=start,
        end_date=end,
    )

    # 기존 CSV 파싱 → 전표 생성 로직 재사용
    # (bank_import_service의 해시 기반 중복 체크 + 계정 자동 매핑)
    ...
```

---

## 4. 프론트엔드 UI 설계

### 4-1. 기존 "입금가져오기" 페이지에 탭 추가

```
입금가져오기 페이지
├── [CSV 업로드] 탭    ← 기존 기능
└── [실시간 연동] 탭    ← 신규
    ├── 연동 설정 (API 키, 동기화 주기)
    ├── 계좌 목록 (연동된 계좌 + 상태)
    ├── [지금 동기화] 버튼
    ├── 자동 동기화 ON/OFF 토글
    └── 동기화 이력 테이블
```

### 4-2. 알림 연동

- 새 입금 건 감지 시 → M7 알림센터에 알림 생성
- 대시보드에 "최근 입금" 위젯 표시

---

## 5. 구현 로드맵

### Phase 1: CODEF 데모 테스트 (1~2주)
1. CODEF 회원가입 + 데모 버전 신청
2. Connected ID 발급 + 테스트 계좌 연결
3. Python SDK로 거래내역 조회 POC

### Phase 2: 백엔드 연동 (1~2주)
1. DB 테이블 생성 (bank_api_settings, bank_api_accounts, bank_sync_logs)
2. bank_realtime_service.py 구현
3. bank_realtime_router.py 구현
4. 기존 bank_import_service의 전표 생성 로직 재사용

### Phase 3: 프론트엔드 + 스케줄러 (1주)
1. BankImportPage에 "실시간 연동" 탭 추가
2. APScheduler 기반 자동 동기화 스케줄러
3. M7 알림 연동

### Phase 4: 운영 전환 (1주)
1. CODEF 정식 구독 전환
2. 운영 모니터링 + 에러 핸들링 보강
3. 사용자 가이드 작성

---

## 6. 비용 추정

| 항목 | 비용 |
|------|------|
| CODEF 데모 (3개월) | 무료 |
| CODEF 정식 구독 | 월 5~20만원 (예상, 문의 필요) |
| 개발 비용 | 2~4주 (내부 개발) |
| 인증서 비용 | 법인 공인인증서 (연 약 5~10만원) |

---

## 7. 보안 고려사항

| 항목 | 대응 방안 |
|------|---------|
| API 키 저장 | .env + DB 암호화 저장 (Fernet 대칭키 암호화) |
| 인증서 관리 | 서버 파일시스템에 제한된 권한으로 저장 |
| 통신 보안 | TLS 1.2+ 필수 |
| 접근 권한 | admin 역할만 연동 설정 가능 |
| 감사 로그 | 모든 동기화 이력 + 전표 생성 이력 기록 |
| 데이터 보존 | 원본 거래 데이터는 sync_logs에 보존 |

---

## 8. 선행 조건 (사용자 행동 필요)

1. **CODEF 회원가입**: [codef.io](https://codef.io) 에서 가입 → 데모 신청
2. **법인 공인인증서 준비**: 연동할 은행 계좌의 인증서
3. **API 키 발급**: CODEF 관리자 화면에서 Client ID/Secret 확인
4. **테스트 계좌 선정**: 연동 테스트할 은행 계좌 1~2개 선정
