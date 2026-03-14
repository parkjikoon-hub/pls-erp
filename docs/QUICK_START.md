# 🚀 ERP 오케스트레이션 빠른 시작 가이드

## 1단계: 파일 배치

Antigravity IDX에서 새 프로젝트를 만들고 아래 구조로 파일을 배치하세요:

```
내 ERP 프로젝트 폴더/
├── CLAUDE.md                ← 필수! 이 파일이 핵심
├── agents/                  ← 8개 에이전트 파일 모두 복사
├── skills/                  ← Skill 폴더 복사
├── docs/
│   └── progress-tracker.md  ← 진행 현황 추적
└── requirements.txt
```

## 2단계: 환경 설정

터미널에서 실행:
```bash
# Python 패키지 설치
pip install -r requirements.txt

# .env 파일 생성 (CLAUDE.md 참조하여 API 키 입력)
cp .env.example .env
# 텍스트 에디터로 .env 열어서 실제 값 입력
```

## 3단계: Claude Code 시작

Antigravity IDX 터미널에서:
```bash
claude
```

## 4단계: 개발 시작

Claude Code에 입력:
```
Orion, M1 시스템 아키텍처 개발을 시작해줘.
```

---

## 자주 쓰는 명령어

| 목적 | Claude Code 입력 |
|------|----------------|
| 개발 시작 | `Orion, M1 개발 시작해줘` |
| 진행 상황 확인 | `Orion, 진행 상황 보고해줘` |
| DB 설계 | `Dante, M4 ERD 전체 설계해줘` |
| API 구현 | `Aria, M4-F04 세금계산서 API 구현해줘` |
| UI 구현 | `Nova, 수주 목록 화면 만들어줘` |
| 이관 작업 | `Mia, 이카운트 거래처 Excel 이관 실행해줘` |
| 테스트 실행 | `Rex, M4 테스트 코드 작성하고 실행해줘` |
| 보고서 생성 | `Iris, 영업 월간 보고서 양식 만들어줘` |
| 새 세션 재개 | `Orion, progress-tracker 읽고 재개해줘` |

---

## 주의사항

1. **항상 M1부터** — M1(아키텍처/MDM)은 모든 모듈의 기반입니다
2. **DB 먼저** — 각 모듈은 Dante의 ERD 설계 완료 후 진행
3. **새 세션 시작 시** — `progress-tracker.md` 먼저 읽기
4. **컨텍스트 부족 시** — Orion이 자동 핸드오버 문서 생성
