# M6 그룹웨어 및 협업 — 설계서

**목표**: 범용 전자결재 엔진 + 공지사항 게시판

## 범위

| PRD ID | 기능 | 포함 여부 |
|--------|------|----------|
| M6-F01 | ERP 전표 통합 전자결재 | O (범용 결재 엔진) |
| M6-F02 | AI 게시판 회의록 3줄 요약 | X (별도 Step) |
| M6-F03 | 게시글-ERP 전표 하이퍼링크 연결 | O (reference_type/id) |

## 핵심 설계 결정

1. **범용 결재 엔진** — document_type + reference_type/id로 ERP 문서 연결
2. **결재선 직접 설정** — 사용자가 결재자/참조자를 자유롭게 지정
3. **결재선 vs 참조선 분리** — step_type으로 구분, 참조자는 열람만
4. **결재선 템플릿** — 자주 쓰는 결재선을 저장/불러오기
5. **공지사항만** — 관리자 작성, 전 직원 조회

## DB 테이블 (5개)

### ApprovalTemplate (결재선 템플릿)
- id, name, document_type, description
- created_by (FK→users), is_active, created_at

### ApprovalTemplateLine (템플릿 단계)
- id, template_id (FK→approval_templates CASCADE)
- step_order (순서), approver_id (FK→users)
- role_label (역할명: "팀장", "대표이사" 등)
- line_type ("approval" / "reference")

### ApprovalRequest (결재 요청)
- id, request_no (AP-YYYYMM-NNNN, unique)
- title, document_type (general/journal/quotation/sales_order/expense)
- content (JSONB — 품의 내용, 금액 등 자유 형식)
- amount (금액, nullable)
- reference_type, reference_id (ERP 문서 연결)
- status (draft/pending/approved/rejected)
- requester_id (FK→users), created_at, updated_at
- is_deleted

### ApprovalStep (결재/참조 단계)
- id, request_id (FK→approval_requests CASCADE)
- step_type ("approval" / "reference")
- step_order (순서)
- approver_id (FK→users)
- role_label
- status (pending/approved/rejected/viewed)
- comment (의견)
- acted_at (처리일시)

### Notice (공지사항)
- id, title, content (Text)
- is_pinned (고정), is_important (중요)
- view_count, author_id (FK→users)
- is_deleted, created_at, updated_at

## 결재 흐름

```
기안자 작성 (draft)
  → 상신 (pending)
    → 1차 결재자(approval) 승인 → 2차 결재자 승인 → ... → 최종 승인 (approved)
    → 어느 단계든 반려 → 즉시 전체 rejected

참조자(reference): 상신 시점에 열람 가능, 결재 흐름에 관여 안 함
  → viewed 상태로 표시 가능
```

## API 엔드포인트

### 결재선 템플릿 (/groupware/templates)
- GET / — 목록
- POST / — 생성
- PUT /{id} — 수정
- DELETE /{id} — 삭제

### 결재 요청 (/groupware/approvals)
- GET / — 목록 (필터: status, document_type)
- GET /my-requests — 내가 올린 결재
- GET /my-approvals — 내가 결재할 건
- GET /my-references — 참조 문서
- GET /{id} — 상세
- POST / — 기안 (결재선/참조선 포함)
- PATCH /{id}/submit — 상신
- PATCH /{id}/approve — 승인
- PATCH /{id}/reject — 반려

### 공지사항 (/groupware/notices)
- GET / — 목록 (고정글 우선)
- GET /{id} — 상세 (조회수 증가)
- POST / — 작성 (admin/manager)
- PUT /{id} — 수정
- DELETE /{id} — 삭제

## 프론트엔드 페이지

| 페이지 | 경로 | 설명 |
|-------|------|------|
| GroupwarePage | /groupware | 메인 (하위메뉴 + 결재 대기 건수) |
| ApprovalsPage | /groupware/approvals | 결재함 (내기안/내결재/참조 3탭) |
| ApprovalFormPage | /groupware/approvals/new | 기안 작성 |
| ApprovalDetailPage | /groupware/approvals/:id | 상세 + 승인/반려 |
| ApprovalTemplatesPage | /groupware/templates | 템플릿 관리 |
| NoticesPage | /groupware/notices | 공지사항 |

## 기술 스택

- 백엔드: FastAPI + SQLAlchemy 2.x (기존 패턴)
- 프론트엔드: React + TypeScript + Tailwind (시안 C)
- 모듈 경로: src/backend/modules/m6_groupware/
