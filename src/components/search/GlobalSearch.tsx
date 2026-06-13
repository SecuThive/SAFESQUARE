'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { searchApi, type SearchResult } from '@/lib/api';
import {
  Search, X, FolderOpen, CheckSquare, ListTodo,
  Mail, BookOpen, ContactRound, File, BookMarked,
  ArrowRight, Loader2, Clock, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

/* ── 결과 타입별 메타 ── */
const TYPE_META: Record<SearchResult['type'], {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  glow: string;
  border: string;
}> = {
  project: { label: '프로젝트', icon: FolderOpen,   color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', glow: 'oklch(0.68 0.18 218 / 0.20)', border: 'oklch(0.55 0.14 218 / 0.30)' },
  task:    { label: '태스크',   icon: CheckSquare,  color: 'oklch(0.74 0.16 300)', bg: 'oklch(0.74 0.16 300 / 0.12)', glow: 'oklch(0.74 0.16 300 / 0.20)', border: 'oklch(0.55 0.12 300 / 0.30)' },
  todo:    { label: '할 일',   icon: ListTodo,     color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', glow: 'oklch(0.76 0.16 152 / 0.20)', border: 'oklch(0.58 0.12 152 / 0.30)' },
  mail:    { label: '메일',    icon: Mail,         color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.84 0.16 82 / 0.12)',  glow: 'oklch(0.84 0.16 82 / 0.20)',  border: 'oklch(0.62 0.12 82 / 0.30)'  },
  guide:   { label: '가이드',  icon: BookOpen,     color: 'oklch(0.80 0.16 52)',  bg: 'oklch(0.80 0.16 52 / 0.12)',  glow: 'oklch(0.80 0.16 52 / 0.20)',  border: 'oklch(0.60 0.12 52 / 0.30)'  },
  contact: { label: '담당자',  icon: ContactRound, color: 'oklch(0.78 0.16 350)', bg: 'oklch(0.78 0.16 350 / 0.12)', glow: 'oklch(0.78 0.16 350 / 0.20)', border: 'oklch(0.58 0.12 350 / 0.30)' },
  file:    { label: '파일',   icon: File,         color: 'oklch(0.76 0.16 196)', bg: 'oklch(0.76 0.16 196 / 0.12)', glow: 'oklch(0.76 0.16 196 / 0.20)', border: 'oklch(0.55 0.12 196 / 0.30)' },
  worklog: { label: '작업일지',icon: BookMarked,   color: 'oklch(0.78 0.16 28)',  bg: 'oklch(0.78 0.16 28 / 0.12)',  glow: 'oklch(0.78 0.16 28 / 0.20)',  border: 'oklch(0.58 0.12 28 / 0.30)'  },
};

const RECENT_KEY = 'safesquare_recent_searches';
function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function saveRecent(q: string) {
  const list = [q, ...getRecent().filter(s => s !== q)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

interface Props { open: boolean; onClose: () => void; }

export default function GlobalSearch({ open, onClose }: Props) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor,  setCursor]  = useState(-1);
  const [recent,  setRecent]  = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setCursor(-1);
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await searchApi.search(q.trim());
      setResults(res.results); setCursor(-1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const navigate = (result: SearchResult) => {
    saveRecent(query.trim()); setRecent(getRecent());
    router.push(result.href); onClose();
  };
  const navigateRecent = (q: string) => { setQuery(q); inputRef.current?.focus(); };

  const allItems = results;
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    if (e.key === 'Enter' && cursor >= 0 && allItems[cursor]) navigate(allItems[cursor]);
  };

  useEffect(() => {
    if (cursor < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r); return acc;
  }, {});
  const groupKeys = Object.keys(grouped) as SearchResult['type'][];
  let itemIdx = 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[6vh] sm:pt-[12vh]"
      style={{
        background: 'oklch(0.06 0.006 245 / 0.82)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        animation: 'fadeIn 0.15s ease',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl mx-3 sm:mx-auto overflow-hidden flex flex-col"
        style={{
          maxHeight: '82dvh',
          background: 'linear-gradient(180deg, oklch(0.18 0.012 242) 0%, oklch(0.16 0.010 244) 100%)',
          border: '1px solid oklch(0.30 0.012 234)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)',
          animation: 'modalIn 0.20s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* 입력창 */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(0.22 0.010 238)' }}
        >
          {loading
            ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />
            : <Search  className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="프로젝트, 메일, 파일, 담당자 검색..."
            className="flex-1 bg-transparent focus:outline-none"
            style={{
              fontSize: '15px',
              color: 'var(--text)',
              caretColor: 'var(--accent)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="flex-shrink-0 transition-all rounded-md p-0.5"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd
            className="text-[10px] font-mono flex-shrink-0 px-1.5 py-0.5 rounded-md"
            style={{
              background: 'oklch(0.20 0.010 240)',
              color: 'var(--text-muted)',
              border: '1px solid oklch(0.28 0.010 234)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* 결과 영역 */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {!query.trim() ? (
            recent.length > 0 ? (
              <div className="py-2">
                <div
                  className="px-4 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  <Clock className="w-3 h-3" /> 최근 검색
                </div>
                {recent.map(r => (
                  <button
                    key={r}
                    onClick={() => navigateRecent(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = 'oklch(0.22 0.010 238)';
                      el.style.color = 'var(--text)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = 'transparent';
                      el.style.color = 'var(--text-muted)';
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: 'oklch(0.22 0.010 238)', border: '1px solid oklch(0.28 0.010 234)' }}
                    >
                      <Clock className="w-3 h-3" style={{ color: 'var(--text-faint)' }} />
                    </div>
                    <span className="text-sm">{r}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'oklch(0.76 0.16 196 / 0.10)',
                    border: '1px solid oklch(0.55 0.12 196 / 0.25)',
                    boxShadow: '0 0 20px oklch(0.76 0.16 196 / 0.10)',
                  }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>무엇을 찾고 계신가요?</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>프로젝트 · 태스크 · 메일 · 담당자 · 파일</p>
                </div>
              </div>
            )
          ) : results.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'oklch(0.22 0.010 238)',
                  border: '1px solid oklch(0.28 0.010 234)',
                }}
              >
                <Search className="w-5 h-5" style={{ color: 'var(--text-faint)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-dim)' }}>"{query}"</span>에 대한 결과가 없습니다
              </p>
            </div>
          ) : (
            <div className="py-2">
              {groupKeys.map(type => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    {/* 그룹 헤더 */}
                    <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
                      >
                        <Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.08em]"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto"
                        style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                        }}
                      >
                        {grouped[type].length}
                      </span>
                    </div>

                    {/* 그룹 아이템 */}
                    {grouped[type].map(r => {
                      const idx = itemIdx++;
                      const active = cursor === idx;
                      return (
                        <button
                          key={r.id}
                          data-idx={idx}
                          onClick={() => navigate(r)}
                          onMouseEnter={() => setCursor(idx)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left relative transition-all duration-100"
                          style={{
                            background: active ? meta.bg : 'transparent',
                            borderLeft: active ? `2px solid ${meta.color}` : '2px solid transparent',
                          }}
                          onMouseLeave={() => {}}
                        >
                          {/* Active glow */}
                          {active && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{
                                background: `linear-gradient(90deg, ${meta.glow} 0%, transparent 60%)`,
                              }}
                            />
                          )}

                          <div
                            className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: meta.bg,
                              border: `1px solid ${meta.border}`,
                              boxShadow: active ? `0 0 12px ${meta.glow}` : 'none',
                            }}
                          >
                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                          </div>

                          <div className="flex-1 min-w-0 relative">
                            <p
                              className="text-sm truncate font-medium"
                              style={{ color: active ? 'var(--text)' : 'var(--text-dim)' }}
                            >
                              {r.title}
                            </p>
                            {r.meta && (
                              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>
                                {r.meta}
                              </p>
                            )}
                          </div>

                          {active && (
                            <ArrowRight
                              className="w-3.5 h-3.5 flex-shrink-0 relative"
                              style={{ color: meta.color }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              <div
                className="px-4 py-2 text-[10px] text-right"
                style={{
                  borderTop: '1px solid oklch(0.20 0.010 240)',
                  color: 'var(--text-faint)',
                }}
              >
                {results.length}개 결과
              </div>
            </div>
          )}
        </div>

        {/* 단축키 힌트 바 */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 flex-shrink-0"
          style={{
            borderTop: '1px solid oklch(0.20 0.010 240)',
            background: 'oklch(0.15 0.010 244)',
          }}
        >
          {[
            { key: '↑↓', desc: '이동' },
            { key: '↵',  desc: '열기' },
            { key: 'Esc', desc: '닫기' },
          ].map(({ key, desc }) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>
              <kbd
                className="px-1.5 py-0.5 rounded font-mono text-[10px]"
                style={{
                  background: 'oklch(0.20 0.010 240)',
                  color: 'var(--text-muted)',
                  border: '1px solid oklch(0.28 0.010 234)',
                  boxShadow: 'inset 0 -1px 0 oklch(0.18 0.010 242)',
                }}
              >
                {key}
              </kbd>
              {desc}
            </span>
          ))}
          {results.length > 0 && (
            <span className="ml-auto text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {results.length}개 결과
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
