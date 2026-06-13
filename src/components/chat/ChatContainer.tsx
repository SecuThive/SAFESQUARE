'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { chatApi, getAuthMeta } from '@/lib/api';
import { useAppStore } from '@/store';
import type { ChatMessage, ChatSession } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send, Plus, Trash2, Bot, User, MessageSquare,
  BookOpen, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { confirm } from '@/lib/confirm';

interface Props { projectId: number; }

interface StreamingMessage {
  role: 'assistant';
  content: string;
  streaming: boolean;
  contextGuides?: { id: number; title: string; type: string }[];
}

export default function ChatContainer({ projectId }: Props) {
  const { activeChatSession, setActiveChatSession } = useAppStore();

  const [sessions,   setSessions]  = useState<ChatSession[]>([]);
  const [messages,   setMessages]  = useState<ChatMessage[]>([]);
  const [streaming,  setStreaming] = useState<StreamingMessage | null>(null);
  const [input,      setInput]     = useState('');
  const [sending,    setSending]   = useState(false);
  const [error,      setError]     = useState('');

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  // Load sessions
  useEffect(() => {
    chatApi.listSessions(projectId)
      .then((list) => {
        setSessions(list);
        if (!activeChatSession && list.length > 0) {
          loadSession(list[0]);
        }
      })
      .catch(console.error);
  }, [projectId]);

  const loadSession = useCallback(async (session: ChatSession) => {
    setActiveChatSession(session);
    const msgs = await chatApi.getMessages(session.id).catch(() => []);
    setMessages(msgs);
    setStreaming(null);
  }, []);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming?.content]);

  const handleNewSession = async () => {
    const session = await chatApi.createSession(projectId);
    setSessions((prev) => [session, ...prev]);
    setActiveChatSession(session);
    setMessages([]);
    setStreaming(null);
  };

  const handleDeleteSession = async (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    if (!await confirm('이 채팅을 삭제하시겠습니까?')) return;
    await chatApi.deleteSession(session.id);
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    if (activeChatSession?.id === session.id) {
      setActiveChatSession(null);
      setMessages([]);
    }
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || sending) return;
    setInput('');
    setSending(true);
    setError('');

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: activeChatSession?.id ?? 0,
      project_id: projectId,
      role: 'user',
      content: message,
      context_guides: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setStreaming({ role: 'assistant', content: '', streaming: true });

    abortRef.current = new AbortController();
    let sessionId = activeChatSession?.id;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch('/api/chat/stream', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body:    JSON.stringify({
          project_id: projectId,
          session_id: sessionId ?? null,
          message,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let buffer = '';
      let fullContent = '';
      let contextGuides: { id: number; title: string; type: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'meta') {
              contextGuides = parsed.guides ?? [];
              if (!sessionId) {
                sessionId = parsed.session_id;
                // Update session list
                const newSession = await chatApi.listSessions(projectId).catch(() => sessions);
                setSessions(newSession);
                const found = newSession.find((s) => s.id === sessionId);
                if (found) setActiveChatSession(found);
              }
            } else if (parsed.type === 'token') {
              fullContent += parsed.content;
              setStreaming({ role: 'assistant', content: fullContent, streaming: true, contextGuides });
            } else if (parsed.type === 'done') {
              // Reload messages from server
              if (sessionId) {
                const freshMsgs = await chatApi.getMessages(sessionId).catch(() => messages);
                setMessages(freshMsgs);
              }
              setStreaming(null);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Chat error');
        setStreaming(null);
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-gray-800 bg-sidebar-bg">
        <div className="px-3 py-3 border-b border-gray-800">
          <button onClick={handleNewSession} className="w-full btn-ghost text-xs justify-center border border-dashed border-gray-700">
            <Plus className="w-3 h-3" /> 새 채팅
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-600">채팅 없음</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s)}
                className={clsx(
                  'group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors',
                  activeChatSession?.id === s.id
                    ? 'bg-sidebar-active text-gray-100'
                    : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300',
                )}
              >
                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                <span className="flex-1 text-xs truncate">{s.title}</span>
                <button
                  onClick={(e) => handleDeleteSession(e, s)}
                  className="hidden group-hover:block p-0.5 hover:text-accent-red"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeChatSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Bot className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">AI 어시스턴트와 대화를 시작하세요</p>
              <button onClick={handleNewSession} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> 새 채팅 시작
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !streaming && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Bot className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">
                    프로젝트 관련 질문을 해보세요.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 text-xs text-gray-600">
                    {['OTP 인증 실패 원인은?', '27600 포트 역할이 뭔가요?', 'Tomcat 안 뜨는 이유'].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        className="px-3 py-2 rounded-lg border border-gray-800 hover:border-gray-700 hover:text-gray-400 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {streaming && (
                <MessageBubble
                  message={{
                    id: -1,
                    session_id: activeChatSession.id,
                    project_id: projectId,
                    role: 'assistant',
                    content: streaming.content,
                    context_guides: streaming.contextGuides ?? null,
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming={streaming.streaming && streaming.content === ''}
                />
              )}

              {error && (
                <div className="flex items-center gap-2 text-accent-red text-xs bg-accent-red/10 px-4 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-gray-800 p-4">
              <div className="flex items-end gap-3 bg-surface-overlay border border-gray-700 rounded-xl px-4 py-3
                              focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/20 transition-colors">
                <textarea
                  ref={inputRef}
                  className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none
                             focus:outline-none max-h-40 min-h-[1.5rem]"
                  placeholder="메시지 입력... (Shift+Enter: 줄바꿈)"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className={clsx(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    sending || !input.trim()
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-brand text-white hover:bg-brand-hover',
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-700 mt-2 text-center">
                RAG 기반 컨텍스트 검색 · Ollama gemma
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-brand/20' : 'bg-surface-overlay border border-gray-700',
      )}>
        {isUser
          ? <User className="w-4 h-4 text-brand" />
          : <Bot className="w-4 h-4 text-gray-400" />
        }
      </div>

      {/* Content */}
      <div className={clsx('flex flex-col gap-1 max-w-[78%]', isUser && 'items-end')}>
        {/* Context guides badge */}
        {!isUser && message.context_guides && message.context_guides.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.context_guides.map((g) => (
              <span key={g.id} className="flex items-center gap-1 badge bg-brand/10 text-brand text-[10px]">
                <BookOpen className="w-2.5 h-2.5" />
                {g.title.length > 20 ? g.title.slice(0, 20) + '…' : g.title}
              </span>
            ))}
          </div>
        )}

        <div className={clsx(
          'rounded-xl px-4 py-3 text-sm',
          isUser
            ? 'bg-brand text-white rounded-tr-sm'
            : 'bg-surface-overlay border border-gray-800 text-gray-200 rounded-tl-sm',
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <div className="flex gap-1 items-center py-1">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <div className={clsx('prose-dark', isStreaming && 'typing-cursor')}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: '0.5rem 0', borderRadius: '0.5rem', fontSize: '0.7rem' }}
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <span className="text-[10px] text-gray-700 px-1">
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}
