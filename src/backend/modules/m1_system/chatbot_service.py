"""
M1-F03: AI 챗봇 내비게이션 서비스
자연어 질문 → ERP 메뉴 안내 + 핵심 요약

Gemini API 키가 있으면 AI 자연어 이해를 사용하고,
없으면 키워드 매칭으로 폴백합니다.
"""
import re
from typing import Optional

from ...config import settings


# ── ERP 메뉴 맵 (현재 구현된 기능 기준, 모듈 추가 시 확장) ──
ERP_MENU_MAP = [
    {
        "id": "customer",
        "title": "거래처 관리",
        "path": "/system/customers",
        "module": "M1",
        "description": "매출처/매입처 등록, 수정, 검색, Excel 일괄 업로드",
        "keywords": ["거래처", "매출처", "매입처", "사업자", "업체", "납품업체", "고객사", "공급사", "바이어", "벤더"],
    },
    {
        "id": "product",
        "title": "품목 관리",
        "path": "/system/products",
        "module": "M1",
        "description": "제품/자재/반제품 등록, 카테고리 관리, Excel 업로드",
        "keywords": ["품목", "제품", "자재", "반제품", "상품", "물품", "원자재", "부품", "카테고리", "품번"],
    },
    {
        "id": "user",
        "title": "사용자 관리",
        "path": "/system/users",
        "module": "M1",
        "description": "부서/직급/계정 등록, 역할 관리, 비밀번호 초기화",
        "keywords": ["사용자", "직원", "계정", "부서", "직급", "비밀번호", "역할", "권한", "아이디", "로그인"],
    },
    {
        "id": "form_builder",
        "title": "동적 폼 빌더",
        "path": "/system/form-builder",
        "module": "M1",
        "description": "모듈별 커스텀 입력 필드 구성, 폼 레이아웃 관리",
        "keywords": ["폼", "필드", "커스텀", "양식", "입력", "레이아웃", "폼빌더"],
    },
    {
        "id": "dashboard",
        "title": "대시보드",
        "path": "/",
        "module": "M1",
        "description": "전체 현황 요약, 주요 지표, 바로가기",
        "keywords": ["대시보드", "메인", "현황", "홈", "요약", "시작"],
    },
    # ── 아직 미구현이지만 안내는 가능한 메뉴 ──
    {
        "id": "expense",
        "title": "지출결의서",
        "path": "/finance/expenses",
        "module": "M4",
        "description": "영수증 첨부 후 지출 신청 (Phase 2에서 구현 예정)",
        "keywords": ["지출", "경비", "출장비", "주유비", "영수증", "비용", "교통비", "식대"],
        "upcoming": True,
    },
    {
        "id": "order",
        "title": "주문/수주 관리",
        "path": "/sales/orders",
        "module": "M2",
        "description": "수주 등록 및 관리 (Phase 4에서 구현 예정)",
        "keywords": ["주문", "수주", "발주", "오더", "주문서", "발주서", "견적"],
        "upcoming": True,
    },
    {
        "id": "payroll",
        "title": "급여 관리",
        "path": "/hr/payroll",
        "module": "M3",
        "description": "급여 조회 및 명세서 (Phase 3에서 구현 예정)",
        "keywords": ["급여", "월급", "명세서", "임금", "보수", "상여"],
        "upcoming": True,
    },
    {
        "id": "tax_invoice",
        "title": "세금계산서",
        "path": "/finance/tax-invoices",
        "module": "M4",
        "description": "세금계산서 발행/조회 (Phase 2에서 구현 예정)",
        "keywords": ["세금계산서", "세금", "부가세", "매출세액", "매입세액", "계산서"],
        "upcoming": True,
    },
    {
        "id": "inventory",
        "title": "재고 관리",
        "path": "/production/inventory",
        "module": "M5",
        "description": "재고 현황 조회 (Phase 5에서 구현 예정)",
        "keywords": ["재고", "입고", "출고", "창고", "재고량", "안전재고", "수불"],
        "upcoming": True,
    },
    {
        "id": "approval",
        "title": "전자결재",
        "path": "/groupware/approvals",
        "module": "M6",
        "description": "전자결재 목록 (Phase 6에서 구현 예정)",
        "keywords": ["결재", "기안", "승인", "반려", "품의", "결재선"],
        "upcoming": True,
    },
    {
        "id": "leave",
        "title": "휴가 관리",
        "path": "/hr/attendance/leave",
        "module": "M3",
        "description": "휴가 신청 및 잔여 조회 (Phase 3에서 구현 예정)",
        "keywords": ["휴가", "연차", "반차", "연가", "출결", "근태"],
        "upcoming": True,
    },
]

# ── 자주 묻는 질문 패턴 ──
FAQ_PATTERNS = [
    {
        "patterns": [r"어떻게.*(?:처리|등록|입력)", r"방법.*알려", r"하려면"],
        "response_type": "how_to",
    },
    {
        "patterns": [r"어디.*(?:있|찾|가)", r"메뉴.*(?:어디|위치)"],
        "response_type": "location",
    },
    {
        "patterns": [r"뭐.*할 수 있", r"기능.*(?:뭐|무엇)", r"할 수 있는.*(?:것|기능)"],
        "response_type": "capability",
    },
]


def _keyword_search(question: str) -> list[dict]:
    """키워드 매칭으로 관련 메뉴를 찾습니다"""
    question_lower = question.lower().strip()
    scored = []

    for menu in ERP_MENU_MAP:
        score = 0
        for kw in menu["keywords"]:
            if kw in question_lower:
                score += 2  # 키워드 정확 매칭
            elif any(c in question_lower for c in kw if len(c) > 1):
                score += 0.5  # 부분 매칭

        # 제목 매칭
        if menu["title"] in question_lower:
            score += 3

        if score > 0:
            scored.append({**menu, "_score": score})

    # 점수 높은 순으로 정렬
    scored.sort(key=lambda x: x["_score"], reverse=True)
    return scored[:3]  # 최대 3개


def _build_keyword_response(question: str, matches: list[dict]) -> dict:
    """키워드 매칭 결과를 응답 형태로 구성"""
    if not matches:
        return {
            "answer": "죄송합니다, 관련 메뉴를 찾지 못했습니다.\n현재 이용 가능한 기능: 거래처 관리, 품목 관리, 사용자 관리, 동적 폼 빌더",
            "menus": [],
            "source": "keyword",
        }

    top = matches[0]
    is_upcoming = top.get("upcoming", False)

    # 응답 구성
    if is_upcoming:
        answer = f"'{top['title']}' 기능은 아직 개발 중입니다.\n{top['description']}\n현재는 시스템 관리(M1) 기능을 사용하실 수 있습니다."
    else:
        answer = f"'{top['title']}'에서 처리할 수 있습니다.\n{top['description']}\n아래 바로가기를 클릭하면 해당 페이지로 이동합니다."

    menus = [
        {
            "title": m["title"],
            "path": m["path"],
            "module": m["module"],
            "description": m["description"],
            "upcoming": m.get("upcoming", False),
        }
        for m in matches
    ]

    return {
        "answer": answer,
        "menus": menus,
        "source": "keyword",
    }


async def _gemini_answer(question: str) -> Optional[dict]:
    """Gemini API를 사용한 자연어 이해 (키가 설정된 경우만)"""
    if not settings.GEMINI_API_KEY:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        # 메뉴 목록을 프롬프트에 포함
        menu_list = "\n".join([
            f"- {m['title']} ({m['module']}): {m['description']} → 경로: {m['path']}"
            + (" [미구현]" if m.get("upcoming") else "")
            for m in ERP_MENU_MAP
        ])

        prompt = f"""당신은 PLS ERP 시스템의 AI 도우미입니다.
사용자가 ERP 사용법에 대해 질문하면, 해당 메뉴를 안내하고 핵심을 3줄로 요약합니다.

## 사용 가능한 ERP 메뉴:
{menu_list}

## 규칙:
1. 반드시 한국어로 답변
2. 3줄 이내로 간결하게 요약
3. 해당 메뉴 경로를 포함
4. [미구현] 표시된 메뉴는 "아직 개발 중"이라고 안내
5. 관련 메뉴가 없으면 "현재 이용 가능한 기능"을 안내

## 사용자 질문: {question}

## 응답 형식 (JSON):
{{"answer": "3줄 요약 답변", "menu_ids": ["관련 메뉴 id 목록"]}}
"""

        response = await model.generate_content_async(prompt)
        text = response.text.strip()

        # JSON 파싱 시도
        import json
        # Markdown 코드 블록 제거
        if "```" in text:
            text = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()

        data = json.loads(text)
        answer = data.get("answer", "")
        menu_ids = data.get("menu_ids", [])

        # menu_ids로 실제 메뉴 정보 조회
        menus = []
        for mid in menu_ids:
            for m in ERP_MENU_MAP:
                if m["id"] == mid:
                    menus.append({
                        "title": m["title"],
                        "path": m["path"],
                        "module": m["module"],
                        "description": m["description"],
                        "upcoming": m.get("upcoming", False),
                    })
                    break

        return {
            "answer": answer,
            "menus": menus,
            "source": "gemini",
        }

    except Exception:
        # Gemini 실패 시 None 반환 → 키워드 폴백
        return None


async def chatbot_answer(question: str) -> dict:
    """
    챗봇 메인 함수: 질문을 받아 답변을 반환
    1순위: Gemini AI (키 설정 시)
    2순위: 키워드 매칭 (폴백)
    """
    if not question or not question.strip():
        return {
            "answer": "안녕하세요! PLS ERP 도우미입니다.\n궁금한 점을 자연어로 물어보세요.\n예: '거래처 등록은 어디서 해?'",
            "menus": [],
            "source": "greeting",
        }

    # Gemini AI 시도
    gemini_result = await _gemini_answer(question)
    if gemini_result:
        return gemini_result

    # 키워드 매칭 폴백
    matches = _keyword_search(question)
    return _build_keyword_response(question, matches)
