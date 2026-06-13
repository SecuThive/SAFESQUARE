'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthHeaders } from '@/lib/api';
import { ClipboardCopy, Trash2, RefreshCw, Check, ClipboardList, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';

interface ClipEntry {
  id: number;
  label: string | null;
  content: string;
  created_at: string;
}

export default function ClipsPage() {
  const [entries,    setEntries]    = useState<ClipEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId,   setCopiedId]   = useState<number | null>(null);
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set());

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/clip', { headers: getAuthHeaders() });
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 새 항목 폴링 (30초마다)
  useEffect(() => {
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleDelete(id: number) {
    await fetch(`/api/clip/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  async function handleCopy(entry: ClipEntry) {
    await navigator.clipboard.writeText(entry.content);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const [clipUrl, setClipUrl] = useState('/clip');
  useEffect(() => {
    setClipUrl(`${window.location.origin}/clip`);
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-100">클립보드 수신함</h1>
              <p className="text-xs text-gray-500 mt-0.5">고객사에서 전달한 텍스트</p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              새로고침
            </button>
          </div>

          {/* 전달 URL 안내 */}
          <div className="rounded-lg px-4 py-3 mb-6 flex items-center gap-3" style={{ background: 'var(--info-bg)', border: '1px solid var(--accent-border)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-0.5">고객사에서 아래 주소로 접속해 붙여넣기</p>
              <a
                href={clipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono truncate block" style={{ color: 'var(--accent)' }}
              >
                {clipUrl}
              </a>
            </div>
            <a
              href={clipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-600 transition-colors flex-shrink-0"
              style={{ ['--hover-color' as string]: 'var(--accent)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* 목록 */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 bg-surface-raised border border-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-600">수신된 항목이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => {
                const isExpanded = expanded.has(entry.id);
                const isLong = entry.content.length > 300 || entry.content.split('\n').length > 8;

                return (
                  <div
                    key={entry.id}
                    className="bg-surface-raised border border-gray-800 rounded-xl overflow-hidden"
                  >
                    {/* 상단 메타 */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/60">
                      <span className="flex-1 text-xs font-medium text-gray-300 truncate">
                        {entry.label || <span className="text-gray-600 italic">제목 없음</span>}
                      </span>
                      <span className="text-[10px] text-gray-600 flex-shrink-0">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ko })}
                      </span>

                      {/* 복사 버튼 */}
                      <button
                        onClick={() => handleCopy(entry)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-brand hover:bg-brand/10 transition-colors flex-shrink-0"
                        title="복사"
                      >
                        {copiedId === entry.id
                          ? <Check className="w-3.5 h-3.5 text-green-400" />
                          : <ClipboardCopy className="w-3.5 h-3.5" />
                        }
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors flex-shrink-0"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 내용 */}
                    <div className="px-4 py-3">
                      <pre className={clsx(
                        'text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed',
                        !isExpanded && isLong && 'line-clamp-8'
                      )}>
                        {entry.content}
                      </pre>
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="mt-2 text-[11px] transition-colors" style={{ color: 'var(--accent)' }}
                        >
                          {isExpanded ? '접기' : '더 보기'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
