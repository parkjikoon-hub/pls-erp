/**
 * AI 챗봇 위젯 — 화면 우하단 플로팅 채팅 버블
 * 자연어로 질문하면 관련 ERP 메뉴를 안내합니다.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { sendChatMessage, type ChatbotResponse } from '../api/chatbot';

/** 대화 메시지 타입 */
interface ChatMessage {
  id: number;
  role: 'user' | 'bot';
  text: string;
  menus?: ChatbotResponse['menus'];
  source?: string;
}

/** 빠른 질문 예시 */
const QUICK_QUESTIONS = [
  '거래처 등록은 어디서 해?',
  '품목 관리 방법 알려줘',
  '비밀번호 초기화',
  '재고 확인하고 싶어',
];

export default function ChatWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  // 채팅창 열 때 인사 메시지
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: ++idCounter.current,
        role: 'bot',
        text: '안녕하세요! PLS ERP 도우미입니다.\n궁금한 점을 자연어로 물어보세요.',
      }]);
    }
  }, [isOpen, messages.length]);

  // 새 메시지 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 채팅창 열 때 입력 포커스
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = async (question?: string) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    // 사용자 메시지 추가
    const userMsg: ChatMessage = { id: ++idCounter.current, role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await sendChatMessage(q);
      const botMsg: ChatMessage = {
        id: ++idCounter.current,
        role: 'bot',
        text: result.answer,
        menus: result.menus,
        source: result.source,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: ++idCounter.current,
        role: 'bot',
        text: '죄송합니다, 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 메뉴 바로가기 클릭
  const handleMenuClick = (path: string, upcoming: boolean) => {
    if (upcoming) return;
    setIsOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center justify-center z-50"
          title="AI 도우미"
        >
          <ChatBubbleLeftRightIcon className="w-6 h-6" />
        </button>
      )}

      {/* 채팅 패널 */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[520px] bg-(--bg-elevated) rounded-2xl shadow-2xl border border-(--border-main) flex flex-col z-50 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" />
              <span className="font-bold text-sm">PLS ERP 도우미</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                    : 'bg-white text-slate-700 border border-(--border-main) rounded-2xl rounded-bl-md'
                } px-3.5 py-2.5 text-sm`}>
                  {/* 메시지 텍스트 */}
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* 메뉴 바로가기 카드 */}
                  {msg.menus && msg.menus.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.menus.map((menu) => (
                        <button
                          key={menu.path}
                          onClick={() => handleMenuClick(menu.path, menu.upcoming)}
                          disabled={menu.upcoming}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                            menu.upcoming
                              ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">
                              <span className="inline-block px-1 py-0.5 rounded bg-slate-200 text-slate-500 text-[10px] mr-1">
                                {menu.module}
                              </span>
                              {menu.title}
                            </p>
                            <p className="text-[11px] opacity-70 truncate">{menu.description}</p>
                          </div>
                          {!menu.upcoming && (
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          {menu.upcoming && (
                            <span className="text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded bg-slate-200">
                              준비중
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* AI 출처 표시 */}
                  {msg.source === 'gemini' && (
                    <p className="text-[10px] opacity-50 mt-1 flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" />Gemini AI
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* 로딩 표시 */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-(--border-main) rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 빠른 질문 (메시지가 1개일 때만 = 초기 인사) */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-2.5 py-1 text-xs bg-white border border-(--border-main) rounded-full text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* 입력 영역 */}
          <div className="px-4 py-3 border-t border-(--border-main) bg-white rounded-b-2xl">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="질문을 입력하세요..."
                disabled={loading}
                className="flex-1 px-3 py-2 rounded-lg border border-(--border-main) bg-(--bg-hover) text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
