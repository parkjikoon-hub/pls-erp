---
name: db-schema-designer
description: |
  PostgreSQL 스키마 설계 및 마이그레이션 Skill.
  테이블 생성, 인덱스 설계, Audit 트리거, 외래 키 제약을 표준 패턴으로 생성합니다.
  사용 시점: 새 모듈 ERD 설계 시작 또는 기존 스키마 변경이 필요할 때
---

## 기능 설명
ERP 모듈별 PostgreSQL 스키마를 표준 패턴으로 설계하고 SQL 파일을 생성합니다.

## 공통 패턴

### 테이블 기본 구조
```sql
CREATE TABLE {table_name} (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 업무 컬럼들 --
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by  UUID REFERENCES users(id),
    updated_by  UUID REFERENCES users(id)
);
```

### Audit 트리거 자동 생성
```sql
-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_{table}_updated_at
    BEFORE UPDATE ON {table_name}
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit Log 트리거
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
            row_to_json(OLD), row_to_json(NEW),
            COALESCE(NEW.updated_by, OLD.created_by));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

## 출력 형식
- `src/db/{번호}_{모듈명}_{테이블명}.sql` 파일로 저장
- 각 파일 상단에 모듈 ID, 기능 ID, 설명 주석 포함
- 마이그레이션 실행 순서 README 함께 생성

## 사용 예제

예제 1: 새 모듈 ERD 설계
- 입력: "M2 영업 모듈 ERD 설계해줘"
- 출력: quotations, sales_orders, sales_order_lines 테이블 SQL

예제 2: 기존 테이블 컬럼 추가
- 입력: "customers 테이블에 credit_limit 컬럼 추가해줘"
- 출력: ALTER TABLE 마이그레이션 SQL + 인덱스

예제 3: 인덱스 최적화
- 입력: "조회가 느린 쿼리 최적화해줘"
- 출력: EXPLAIN ANALYZE 결과 기반 복합 인덱스 SQL
