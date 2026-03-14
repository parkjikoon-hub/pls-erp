---
name: api-architect
description: |
  FastAPI REST API 설계 및 구현 Skill.
  라우터, 서비스, 스키마 파일을 표준 패턴으로 생성합니다.
  사용 시점: 새 모듈 API 개발 시작 또는 기존 엔드포인트 추가가 필요할 때
---

## 기능 설명
ERP 모듈별 FastAPI 라우터·서비스·Pydantic 스키마를 표준 패턴으로 생성합니다.

## 표준 파일 구조

```
src/backend/modules/{module}/
├── router.py      # 엔드포인트 정의 (HTTP 메서드, 경로, 권한)
├── service.py     # 비즈니스 로직 (DB 호출, 계산, 외부 API)
├── schemas.py     # Pydantic 입출력 모델 (Request/Response)
└── models.py      # SQLAlchemy ORM 모델 (Dante DB와 매핑)
```

## 공통 응답 형식

```python
# 성공
{"status": "success", "data": {...}, "message": "처리 완료"}

# Human-in-the-Loop (AI 처리 결과)
{"status": "review", "data": {...}, "message": "확인 후 승인해주세요"}

# 에러
{"status": "error", "detail": "에러 메시지"}
```

## 사용 예제

예제 1: 새 모듈 CRUD API 생성
- 입력: "M2 수주 CRUD API 만들어줘"
- 출력: router.py + service.py + schemas.py (GET/POST/PUT/DELETE 포함)

예제 2: 외부 API 연동 엔드포인트
- 입력: "국세청 전자신고 API 연동해줘"
- 출력: 국세청 API 호출 서비스 + 에러 핸들링 + 재시도 로직

예제 3: 페이지네이션 목록 API
- 입력: "거래처 목록 검색/페이지네이션 API 만들어줘"
- 출력: 검색 파라미터 + 페이지네이션 + 정렬 지원 GET 엔드포인트
