'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getAuthHeaders, getAuthMeta } from '@/lib/api';
import UserBadge from './UserBadge';
import clsx from 'clsx';

interface Comment {
  id: number;
  entity_type: string;
  entity_id: number;
  content: string;
  created_by: string | null;
  created_at: string;
}

interface CommentSectionProps {
  entityType: 'todo' | 'minutes' | 'worklog';
  entityId: number;
  /** 컴팩트 모드: 칸반 카드 내부처럼 공간이 좁을 때 */
  compact?: boolean;
}

export default function CommentSection({ entityType, entityId, compact = false }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [posting,  setPosting]  = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const me = getAuthMeta()?.username ?? null;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/comments?entity_type=${entityType}&entity_id=${entityId}`, {
      headers: getAuthHeaders(),
    })
      .then(r => r.json())
      .then(d => setComments(Array.isArray(d) ? d : []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  const post = async () => {
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, content }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments(prev => [...prev, created]);
        setText('');
        inputRef.current?.focus();
      }
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) setComments(prev => prev.filter(c => c.id !== id));
  };

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ko });
    } catch {
      return iso;
    }
  };

  return (
    <div className={clsx('space-y-2', compact ? 'pt-2' : 'pt-3')}>
      {/* 헤더 */}
      <div className="flex items-center gap-1.5">
        <MessageSquare className={clsx('text-gray-500', compact ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
        <span className={clsx('font-medium text-gray-500', compact ? 'text-[10px]' : 'text-xs')}>
          댓글 {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {/* 댓글 목록 */}
      {loading ? (
        <p className="text-[11px] text-gray-600">불러오는 중…</p>
      ) : comments.length === 0 ? (
        <p className="text-[11px] text-gray-600 italic">아직 댓글이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="group flex gap-2">
              {/* 아바타 */}
              <div className="flex-shrink-0 pt-0.5">
                {c.created_by
                  ? <UserBadge username={c.created_by} size="xs" showName={false} />
                  : <div className="w-4 h-4 rounded-full bg-gray-700" />
                }
              </div>

              {/* 본문 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-300">
                    {c.created_by ?? '알 수 없음'}
                  </span>
                  <span className="text-[10px] text-gray-600">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap mt-0.5">
                  {c.content}
                </p>
              </div>

              {/* 삭제 (본인 or 관리자) */}
              {c.created_by === me && (
                <button
                  onClick={() => remove(c.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all self-start">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
          }}
          placeholder="댓글 입력… (Enter로 전송, Shift+Enter로 줄바꿈)"
          rows={1}
          className={clsx(
            'flex-1 bg-gray-800/60 border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600',
            'focus:outline-none focus:border-brand/60 resize-none transition-all',
          )}
        />
        <button
          onClick={post}
          disabled={!text.trim() || posting}
          className="flex-shrink-0 p-1.5 rounded-lg bg-brand/80 text-white hover:bg-brand disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
