# 세션 인수인계 노트
> **v10.0** | 최종 업데이트: **2026-03-19 18:00** | 작성자: Claude Code

## 변경 이력
| 버전 | 일시 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-03-15 16:50 | 초기 작성 (배포 + UI 개편) |
| v2.0 | 2026-03-16 15:30 | Render 통합 배포 + 더미 데이터 시뮬레이션 결과 |
| v3.0 | 2026-03-16 18:00 | Render master 브랜치 문제 해결 + 프론트엔드 dist/ 포함 |
| v4.0 | 2026-03-17 10:00 | 전체 API 500 에러 해결 (DB 마이그레이션 + M4 스키마 수정) |
| v5.0 | 2026-03-17 14:00 | 품목관리 카드 UI + 전체 글자크기 통일 + 저장 기능 수정 |
| v6.0 | 2026-03-17 23:00 | 근태+결재 연동 구현 + 자동발주 연동 계획 수립 |
| v7.0 | 2026-03-18 01:00 | 전체 프론트엔드 UI 리디자인 목업 확정 |
| v8.0 | 2026-03-19 00:30 | UI 리디자인 구현 완료 + 돌아가기 버튼 제거 + 배지/색상 통일 |
| v9.0 | 2026-03-19 15:00 | 대표 검토 요청 대응 Step 1~7 + PWA + DB 마이그레이션 + Render 수정 |
| v10.0 | 2026-03-19 18:00 | **v9.0 오류 수정 — 급여 개별승인 미구현 확인 + font-mono 제거 + dist 관리 변경** |

---

## ⚠️ v9.0 → v10.0 핵심 수정사항

### ❌ 급여 개별/전체 승인 — "완료"가 아닌 "미구현"
- **v9.0 오류**: "급여 개별/전체 승인: 체크박스 + 개별승인 버튼 ✅ 완료"로 잘못 표기됨
- **실제 확인 결과** (PayrollPage.tsx 코드 검증):
  - 전체 월 단위 "급여 승인" 버튼 1개만 존재 (상단)
  - **체크박스 없음** — 직원별 선택 불가
  - **개별 행 승인 버튼 없음** — 직원별 승인 불가
  - **전체선택/전체승인 없음** — 하단에 버튼 없음
  - 백엔드 `approve_payroll()` — 전체 월 단위만 지원 (PayrollHeader.status 변경)
  - PayrollDetail에 개별 status 필드 없음
- **결론**: 이 기능은 **1순위로 구현 필요**

### ✅ font-mono 제거 추가 (v9.0에 미기재)
- 커밋 `3781a93` — 16개 파일에서 `font-mono` 클래스 전체 제거
- 영업관리 테이블과 동일한 기본 글자체(sans-serif)로 통일됨

### ⚠️ dist/ 관리 방침 변경 (v9.0과 반대)
- v9.0: "dist/ 파일을 git에 수동 추가하면 안 됨"
- **v10.0 변경**: `src/frontend/.gitignore`에서 `dist` 항목을 주석 처리 → dist 파일이 git에 포함됨
- 이유: Render가 빌드한 fresh 파일이 서빙되지 않는 문제 해결을 위해 dist를 git에 포함하는 방식으로 전환

---

## 이번 세션에서 완료한 작업 (v10.0 — 2026-03-19)

대표님이 ERP 전체를 검토한 후 제출한 **모듈별 개선/확인 요청 문서** 기반으로
8단계 계획을 수립하고 **Step 1~7 + 추가 작업**을 완료했습니다.

### Step 1: 엑셀 다운로드 버그 수정 ✅
- **증상**: 견적서/거래명세서 등 Excel 다운로드 시 500 에러
- **원인**: 한국어 파일명이 HTTP Content-Disposition 헤더에서 인코딩 오류
- **수정**: `urllib.parse.quote()` (RFC 5987) 적용 — 4개 라우터 파일
  - `quotation_router.py`, `order_router.py`, `shipment_router.py`, `report_router.py`
- 커밋: `fec8ce3`

### Step 2: M4/M6/M7 글자 크기 통일 ✅
- **내용**: `text-xs` → `text-sm` 통일 (13개 파일, 85개 변경)
- **대상**: AccountsPage, JournalListPage, JournalFormPage, InvoicesPage, ClosingPage, FinancePage, ApprovalsPage, ApprovalFormPage, ApprovalDetailPage, ApprovalTemplatesPage, NoticesPage, NotificationsPage, PayrollPage
- 커밋: `126d6b7`

### Step 3: 인사급여(M3) 개선 — ⚠️ 일부만 완료
- ✅ **4대보험 선택적 적용**: Employee 모델에 `ins_national_pension`, `ins_health`, `ins_longterm_care`, `ins_employment` 4개 boolean 필드 추가. 사원 등록/수정 모달에 체크박스 4개. 급여 계산 시 선택된 보험만 공제
- ✅ **추가근무수당 입력**: PayrollDetail 모델에 `overtime_hours` 필드 추가. 급여 페이지에서 시간 입력 → `hourly_rate = base_salary / 209h, overtime_pay = hourly_rate × 1.5 × hours` 자동 계산
- ❌ **개별/전체 급여 승인**: **미구현** — 체크박스, 개별 승인 버튼, 전체선택/전체승인 모두 없음. 전체 월 단위 승인 버튼 1개만 존재
- 수정 파일: `models.py`, `payroll_service.py`, `payroll_router.py`, `PayrollPage.tsx`, `EmployeesPage.tsx`, `employees.ts`, `payroll.ts`
- 커밋: `1292951`

### Step 4: 재무회계(M4) 개선 ✅
- **매입 세금계산서 "발행" → "등록"**: InvoicesPage 매입 탭 버튼 텍스트 변경
- 커밋: `45d9e58`

### Step 5: 생산관리(M5) 개선 — ⚠️ 일부만 완료
- ✅ **작업지시서에 수주번호 표시**: WorkOrdersPage 리스트뷰 테이블에 `수주번호` 칼럼 추가
- ✅ **출하 테이블 인라인 상태변경 버튼**: ShipmentsPage 테이블 행에 직접 `피킹완료`/`출하처리`/`배송완료` 버튼 추가
- ❌ **작업지시서 → 거래처 발주서 내역 팝업**: 미구현 — 수주번호 칼럼은 추가됐으나, 클릭 시 발주서 내역(거래처명, 납기, 규격) 팝업 표시 기능은 없음
- 커밋: `271ffe3`

### Step 6: 영업관리(M2) — 견적 RFQ 업로드 ✅
- **거래처 견적요청서(RFQ) 업로드 + AI 품목 자동 추출**: QuotationsPage 견적서 작성 모달에 파일 업로드 영역 추가. PDF/이미지 업로드 → Gemini Vision OCR로 품목+수량 추출 → 견적서 라인 자동 채우기 + 거래처 자동 매칭
- 백엔드: `ocr_service.py`에 `extract_quotation_request()` 함수, `quotation_router.py`에 `/rfq-upload` 엔드포인트
- 커밋: `fd0d90e`

### Step 7: 대시보드 + 알림센터(M6/M7) ✅
- **대시보드 공지사항 위젯**: DashboardPage 하단에 최근 5건 공지사항 표시 (중요/고정 배지, 작성자, 날짜)
- **공지사항 등록 시 알림 자동 생성**: notice_service.py에서 공지사항 생성 시 전 직원에게 알림센터 알림 발송 (중요 공지는 `[중요]` 프리픽스)
- 커밋: `0dfb8bb`

### 추가 작업: PWA 앱 아이콘 ✅
- **PWA 설치 지원**: manifest.json (8개 아이콘 사이즈), sw.js (서비스워커, 네트워크 우선), index.html 메타태그 추가
- **앱 아이콘 생성**: Pillow로 보라색 번개 로고 PNG 8종 + apple-touch-icon 생성
- 커밋: `1fd40b8`

### 추가 작업: DB 컬럼 자동 마이그레이션 수정 ✅
- **증상**: PayrollPage에서 `overtime_hours` 컬럼 없음 SQL 에러
- **원인**: `Base.metadata.create_all()`은 새 테이블만 생성, 기존 테이블에 새 컬럼은 추가 안 됨
- **수정**: `main.py` lifespan에 `ALTER TABLE ADD COLUMN IF NOT EXISTS` 5개 추가
  - `employees`: ins_national_pension, ins_health, ins_longterm_care, ins_employment (BOOLEAN DEFAULT TRUE)
  - `payroll_details`: overtime_hours (NUMERIC(5,1) DEFAULT 0)
- 커밋: `c2a05fe`

### 추가 작업: Render 배포 문제 해결 ✅
- **증상**: 코드 수정 후에도 배포 사이트에서 이전 버전이 서빙됨
- **원인**: `src/frontend/.gitignore`에 `dist` 항목이 있어 dist 파일이 git에서 제외됨
- **수정 1**: 옛 JS/CSS 파일(`index-9eleqjjG.js`)을 git에서 삭제 (커밋 `8a3c202`)
- **수정 2**: `.gitignore`에서 `dist` 주석 처리 → dist 파일 git 추적 가능 (커밋 `3781a93` 에 포함)

### 추가 작업: 전체 테이블 글자체 통일 (font-mono 제거) ✅
- **증상**: 영업관리 테이블은 기본 글자체인데, 재무/인사/생산 등 테이블은 `font-mono`(monospace) 사용
- **수정**: 16개 파일에서 `font-mono` 클래스 전체 제거
- **대상 파일**: PayrollPage, ClosingPage, InvoicesPage, JournalListPage, JournalFormPage, AccountsPage, HRReportsPage, AttendancePage, ApprovalsPage, ApprovalDetailPage, DashboardPage, WorkOrdersPage, ShipmentsPage, QcPage, UsersPage, ExcelImportModal
- 커밋: `3781a93`

---

## 전체 커밋 이력 (이번 세션, 시간순)

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `496375c` | debug: 글로벌 예외 핸들러 추가 (Excel 에러 추적용) |
| 2 | `fec8ce3` | fix: Excel 다운로드 500 에러 수정 — 한국어 파일명 URL 인코딩 |
| 3 | `126d6b7` | fix: M4/M6/M7 글자 크기 통일 (13개 파일, 85개 변경) |
| 4 | `1292951` | feat: 인사급여 개선 — 4대보험 선택적 적용 + 추가근무수당 |
| 5 | `45d9e58` | fix: 매입 세금계산서 "발행" → "등록" 용어 변경 |
| 6 | `271ffe3` | feat: 생산관리 개선 — 수주번호 표시 + 출하 상태 버튼 |
| 7 | `fd0d90e` | feat: 견적서 RFQ 업로드 + AI 품목 자동 추출 |
| 8 | `0dfb8bb` | feat: 대시보드 공지사항 위젯 + 공지 등록 시 알림 |
| 9 | `1fd40b8` | feat: PWA 앱 아이콘 + 설치 지원 |
| 10 | `c2a05fe` | fix: DB 컬럼 자동 마이그레이션 |
| 11 | `8a3c202` | chore: Render 빌드 재트리거 (old dist 삭제) |
| 12 | `3781a93` | fix: 전체 테이블 글자체 통일 — font-mono 제거 (16개 파일) + dist .gitignore 수정 |

---

## 현재 배포 상태 (v10.0 기준 — 2026-03-19 18:00)

| 항목 | 상태 |
|------|------|
| Render 서비스 | `pls-erp-api` (free tier) |
| 감시 브랜치 | **master** (main 아님!) |
| 최신 커밋 | `3781a93` — font-mono 제거 + dist 수정 |
| 전체 API | M1~M7 + 인증 + 대시보드 정상 동작 |
| 프론트엔드 | dist 파일 git 포함 → Render에서 직접 서빙 |
| DB | Neon PostgreSQL (싱가포르), 자동 테이블 생성 + ALTER TABLE 컬럼 추가 활성화 |
| URL | https://pls-erp-api.onrender.com |
| PWA | manifest.json + sw.js + 앱 아이콘 8종 |

### Render 배포 확인 방법 (새 세션에서 반드시 확인)

```bash
# 1. 배포된 JS 파일명 확인 — index-CU9Mz1eH.js여야 정상
curl -s https://pls-erp-api.onrender.com/ | grep -o 'index-[^"]*\.js'

# 2. 만약 다른 JS 파일명이면 재배포 필요:
git commit --allow-empty -m "chore: trigger Render rebuild" && git push origin main && git push origin main:master
```

---

## 대표 검토 요청 대응 현황 (정확한 상태)

### ✅ 완료된 요청

| 모듈 | 요청 | 설명 |
|------|------|------|
| 공통 | 엑셀 다운로드 안 됨 | URL 인코딩 수정 (`fec8ce3`) |
| 공통 | 글자 크기 통일 | 13개 파일 text-sm 통일 (`126d6b7`) |
| 공통 | 글자체(font) 통일 | 16개 파일 font-mono 제거 (`3781a93`) |
| M2 | 견적서 자동 작성 (요청서 업로드) | RFQ 업로드 + OCR 추출 (`fd0d90e`) |
| M2 | 수주관리 OCR | 기존 완료 — Gemini Vision OCR |
| M2 | 판매가관리 | 기존 완료 — 엑셀 업로드 + 등록 |
| M3 | 4대보험 선택적 적용 | 4개 체크박스 + 급여계산 반영 (`1292951`) |
| M3 | 추가근무/야근 입력 | 시간 입력 → 1.5배 자동 계산 (`1292951`) |
| M4 | 매입 세금계산서 "등록"으로 변경 | 용어 변경 (`45d9e58`) |
| M5 | BOM 등록 | 기존 완료 — 다단계 BOM 트리 |
| M5 | 재고관리 | 기존 완료 — 4개 창고 기반 |
| M5 | 작업지시서에서 수주 확인 | 수주번호 칼럼 추가 (`271ffe3`) |
| M5 | QC 작업지시서 연동 | 기존 완료 — qc_wait 자동 필터 |
| M5 | 출하 버튼 안 보임 | 인라인 상태 버튼 추가 (`271ffe3`) |
| M6 | 대시보드 공지사항 | 최근 5건 위젯 (`0dfb8bb`) |
| M7 | 공지사항 알림센터 연동 | 등록 시 자동 알림 (`0dfb8bb`) |

### ❌ 미완료 요청 (구현 필요)

| # | 모듈 | 요청 | 상태 | 상세 | 수정 대상 파일 |
|---|------|------|------|------|--------------|
| **1** | **M3** | **급여 개별/전체 승인** | **❌ 미구현** | 체크박스+개별승인 버튼+전체선택/전체승인 없음. 전체 월 승인만 존재. 백엔드에도 개별승인 API 없음 | `PayrollPage.tsx`, `payroll_service.py`, `payroll_router.py`, `payroll.ts`, `models.py` |
| **2** | **M5** | **작업지시서 → 거래처 발주서 내역 팝업** | **❌ 미구현** | 수주번호 칼럼만 추가됨. 클릭 시 발주서 내역(거래처명, 납기, 규격) 팝업 표시 기능 없음 | `WorkOrdersPage.tsx` |
| **3** | **M6** | **직원 등록 시 그룹웨어 자동 권한** | **❌ 미구현** | 직원 등록 시 그룹웨어 모듈 접근 권한 자동 부여 없음 | `employee_service.py` |
| **4** | **M6** | **공지사항 작성 권한 세밀화** | **⚠️ 기본만** | admin/manager 2단계만. 대표/인사총무 등 역할별 세밀 권한 없음 | `NoticesPage.tsx`, `notice_service.py` |
| **5** | **M3** | **세무신고 안내문 상세화** | **⚠️ 기본만** | 어떤 서류가 생성되는지, 홈택스 업로드 방법 상세 설명 필요 | `TaxFilingPage.tsx` |
| **6** | **M4** | **매입 세금계산서 파일 업로드** | **❌ 미구현** | 외부 세금계산서 파일(PDF/이미지) 업로드 영역 없음 | `InvoicesPage.tsx`, `invoice_service.py` |

### ⏸️ 보류된 요청 (추후 진행)

| 모듈 | 요청 | 비고 |
|------|------|------|
| M5 | 재고-창고-품목 연동 보완 | Product 기본 창고, reserved 반영 |
| M6 | 결재양식 파일 업로드/미리보기 | 복잡한 기능 — 추후 과제 |
| 공통 | 자동발주 시스템 연동 | Firebase Firestore Pull 방식 — `docs/auto-order-integration-plan.md` 참조 |
| 공통 | AI 기능 (영수증 OCR, 계정 추천) | Gemini API 활용 |
| 공통 | 회사 양식 PDF 적용 | 견적서/거래명세서 등 |

---

## 다음 세션에서 이어할 작업 (우선순위 순)

### 🔴 1순위: 급여 개별/전체 승인 구현 (대표 직접 요청, 미구현)
**요구사항:**
- 급여 테이블 각 행 끝에 **개별 승인 버튼** 추가
- 테이블 아래에 **전체선택 체크박스 + 전체승인 버튼** 추가
- 급여 계산 후 직원별로 수정/승인할 수 있어야 함

**구현 필요사항:**
- **프론트엔드** (`PayrollPage.tsx`):
  - 체크박스 칼럼 추가 (각 행 맨 앞)
  - 개별 승인 버튼 (각 행 맨 끝)
  - 하단 전체선택 체크박스 + "선택 승인" 버튼
- **백엔드** (`payroll_service.py`, `payroll_router.py`):
  - PayrollDetail 모델에 `status` 필드 추가 (draft/approved)
  - 개별 직원 승인 API: `POST /hr/payroll/{year}/{month}/approve-items`
  - 전체 승인은 기존 유지하되, 개별 승인도 가능하도록
- **API** (`payroll.ts`):
  - `approvePayrollItems(year, month, detailIds[])` 함수 추가
- **DB 마이그레이션** (`main.py`):
  - `ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'`

### 🟡 2순위: 작업지시서 발주서 상세 팝업
- 수주번호 클릭 시 거래처 발주서 내역(거래처명, 품목, 수량, 납기, 규격, 특이사항) 팝업 표시
- `WorkOrdersPage.tsx` 수정

### 🟡 3순위: 직원 등록 시 그룹웨어 자동 권한
- `employee_service.py` — 직원 생성 시 해당 User의 `allowed_modules`에 그룹웨어(M6) 자동 추가

### 🟡 4순위: 공지사항 작성 권한 세밀화
- `NoticesPage.tsx`, `notice_service.py` — 역할 기반 세밀 권한 설정

### ⚪ 5순위: 세무신고 안내문 상세화
- `TaxFilingPage.tsx` — 생성 서류 설명, 홈택스 업로드 가이드

### ⚪ 6순위: 매입 세금계산서 파일 업로드
- `InvoicesPage.tsx`, `invoice_service.py` — 파일 업로드 영역

### ⏸️ 보류 작업
- 자동발주 시스템 연동 (Firebase Firestore Pull)
- AI 기능 추가 (영수증 OCR, 계정 추천)
- 회사 양식 PDF 적용
- 결재양식 파일 업로드/미리보기
- 재고-창고-품목 연동 보완

---

## 주의사항 / 이슈

### 배포 관련
- **⚠️ Render 브랜치**: `master` 브랜치 감시 중 → push 시 `git push origin main:master` 필수
- **⚠️ dist/ 파일 관리 (v10.0 변경)**: `src/frontend/.gitignore`에서 `dist` 주석 처리됨 → dist 파일은 git에 포함됨. Vite 빌드 후 dist 파일도 함께 커밋해야 함
- **Render 무료 플랜**: 15분 미사용 시 슬립, 첫 접속 ~50초 대기
- **Render 빌드 명령**: `cd src/frontend && npm install && npm run build && cd ../.. && pip install -r requirements.txt`
- **Render 시작 명령**: `alembic upgrade head && uvicorn src.backend.main:app --host 0.0.0.0 --port $PORT`

### DB 관련
- **⚠️ DB 자동 마이그레이션**: `create_all()`은 새 테이블만 생성. 기존 테이블에 새 컬럼 추가 시 반드시 `main.py`의 `alter_columns` 리스트에 추가해야 함
- **현재 등록된 ALTER TABLE 컬럼** (main.py lifespan):
  - `employees.ins_national_pension` (BOOLEAN DEFAULT TRUE)
  - `employees.ins_health` (BOOLEAN DEFAULT TRUE)
  - `employees.ins_longterm_care` (BOOLEAN DEFAULT TRUE)
  - `employees.ins_employment` (BOOLEAN DEFAULT TRUE)
  - `payroll_details.overtime_hours` (NUMERIC(5,1) DEFAULT 0)
- **급여 개별승인 구현 시 추가 필요**: `payroll_details.status` (VARCHAR(20) DEFAULT 'draft')
- **trailing slash 주의**: API 호출 시 trailing slash 없이
- **Axios 타임아웃**: 30초 설정 완료
- **Employee ↔ User 관계**: `Employee.user_id` FK로 1:1 연결

### 인증 정보
- 로그인: `admin@pls-erp.com` / `admin1234`
- GitHub: `parkjikoon-hub/pls-erp` (main, Render는 master 감시)
- Neon DB: `frosty-flower-83629581`

### 기술 스택
- **프론트엔드**: React 18 + TypeScript + Tailwind CSS + Vite
- **백엔드**: FastAPI + SQLAlchemy (asyncpg) + Pydantic
- **DB**: Neon PostgreSQL (싱가포르)
- **AI/OCR**: Gemini Vision API (수주 OCR, 견적요청서 RFQ OCR)
- **배포**: Render (free tier)

---

## 모듈별 색상 매핑 (참고)

| 모듈 | 색상명 | hex | Tailwind |
|------|--------|-----|----------|
| 대시보드 | Emerald | #10b981 | emerald-500 |
| 시스템관리 | Blue | #3b82f6 | blue-500 |
| 영업관리 | Emerald | #10b981 | emerald-500 |
| 생산관리 | Red | #ef4444 | red-500 |
| 재무회계 | Amber | #f59e0b | amber-500 |
| 인사급여 | Violet | #8b5cf6 | violet-500 |
| 그룹웨어 | Cyan | #06b6d4 | cyan-500 |
| 알림센터 | Orange | #f97316 | orange-500 |

색상 정의 파일: `src/frontend/src/config/moduleConfig.ts`

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| `docs/progress-tracker.md` | 전체 진행 현황 |
| `docs/auto-order-integration-plan.md` | 자동발주 연동 계획 (보류 중) |
| `docs/auto-order-integration-review.md` | 자동발주 시스템 분석 보고서 |
| `docs/ui-mockups/redesign-A2-v2.html` | 확정된 UI 목업 |
| `src/frontend/src/config/moduleConfig.ts` | 모듈별 색상 정의 |

---

## 새 세션 시작 프롬프트
```
docs/progress-tracker.md와 docs/handover-note.md를 읽고
이전 세션에서 중단된 작업을 이어서 진행해줘.
```
