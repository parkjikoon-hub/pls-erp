/**
 * AI 챗봇 내비게이션 API — 백엔드 /api/v1/system/chatbot 와 통신
 */
import api from './client';

/** 챗봇 메뉴 안내 항목 */
export interface ChatbotMenu {
  title: string;
  path: string;
  module: string;
  description: string;
  upcoming: boolean;
}

/** 챗봇 응답 */
export interface ChatbotResponse {
  answer: string;
  menus: ChatbotMenu[];
  source: 'gemini' | 'keyword' | 'greeting';
}

/** 챗봇 질문 전송 */
export async function sendChatMessage(question: string): Promise<ChatbotResponse> {
  const res = await api.post('/system/chatbot', { question });
  return res.data.data as ChatbotResponse;
}
