'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { searchApi, type SearchResult } from '@/lib/api';
import {
  Search, LayoutDashboard, Mail, BookMarked,
  ClipboardList, NotebookPen, CheckSquare, ContactRound,
  Building2, ClipboardCopy, ShieldCheck, KeyRound,
  AlertTriangle, PackageSearch, ArrowRight, Hash,
  FolderOpen, FileText, Layers, Tag, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

/* ── 정적 내비게이션 항목 ── */
const NAV_ITEMS = [
  { label: '대시보드',     href: '/dashboard',       icon: LayoutDashboard, group: '페이지' },
  { label: '메일함',       href: '/mails',           icon: Mail,            group: '커뮤니케이션' },
  { label: '담당자',       href: '/contacts',        icon: ContactRound,    group: '커뮤니케이션' },
  { label: '파트너사',     href: '/partners',        icon: Building2,       group: '커뮤니케이션' },
  { label: '작업일지',     href: '/worklogs',        icon: BookMarked,      group: '업무' },
  { label: 'WBS',          href: '/wbs',             icon: ClipboardList,   group: '업무' },
  { label: '회의록',       href: '/minutes',         icon: NotebookPen,     group: '업무' },
  { label: '할 일',        href: '/todos',           icon: CheckSquare,     group: '업무' },
  { label: 'OTP 라이센스', href: '/otp-licenses',   icon: KeyRound,        group: '업무' },
  { label: '장애조치',     href: '/troubleshooting', icon: AlertTriangle,   group: '업무' },
  { label: '벤더 가이드',  href: '/vendor-guides',  icon: PackageSearch,   group: '업무' },
  { label: '클립보드',     href: '/clips',           icon: ClipboardCopy,   group: '도구' },
  { label: '보안 도구',    href: '/tools',           icon: ShieldCheck,     group: '도구' },
] as const;

/* ── 타입별 메타 ── */
const TYPE_META: Record<SearchResult['type'], {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  glow: string;
}> = {
  project:  { label: '프로젝트', icon: FolderOpen,    color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', border: 'oklch(0.55 0.14 218 / 0.28)', glow: 'oklch(0.68 0.18 218 / 0.22)' },
  task:     { label: '태스크',   icon: ClipboardList, color: 'oklch(0.74 0.16 300)', bg: 'oklch(0.74 0.16 300 / 0.12)', border: 'oklch(0.55 0.12 300 / 0.28)', glow: 'oklch(0.74 0.16 300 / 0.22)' },
  todo:     { label: '할 일',    icon: CheckSquare,   color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.28)', glow: 'oklch(0.76 0.16 152 / 0.22)' },
  mail:     { label: '메일',     icon: Mail,          color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.84 0.16 82 / 0.12)',  border: 'oklch(0.62 0.12 82 / 0.28)',  glow: 'oklch(0.84 0.16 82 / 0.22)'  },
  guide:    { label: '가이드',   icon: FileText,      color: 'oklch(0.80 0.16 52)',  bg: 'oklch(0.80 0.16 52 / 0.12)',  border: 'oklch(0.60 0.12 52 / 0.28)',  glow: 'oklch(0.80 0.16 52 / 0.22)'  },
  contact:  { label: '담당자',   icon: ContactRound,  color: 'oklch(0.78 0.16 350)', bg: 'oklch(0.78 0.16 350 / 0.12)', border: 'oklch(0.58 0.12 350 / 0.28)', glow: 'oklch(0.78 0.16 350 / 0.22)' },
  file:     { label: '파일',     icon: Layers,        color: 'oklch(0.76 0.16 196)', bg: 'oklch(0.76 0.16 196 / 0.12)', border: 'oklch(0.55 0.12 196 / 0.28)', glow: 'oklch(0.76 0.16 196 / 0.22)' },
  worklog:  { label: '작업일지', icon: BookMarked,    color: 'oklch(0.78 0.16 28)',  bg: 'oklch(0.78 0.16 28 / 0.12)',  border: 'oklch(0.58 0.12 28 / 0.28)',  glow: 'oklch(0.78 0.16 28 / 0.22)'  },
};

type NavItem  = { kind: 'nav';  label: string; href: string; icon: React.ElementType; group: string };
type DataItem = { kind: 'data'; result: SearchResult };
type ResultItem = NavItem | DataItem;

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { setSelectedProject } = useAppStore();

  const [query,       setQuery]       = useState('');
  const [cursor,      setCursor]      = useState(0);
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [loading,     setLoading]     = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery(''); setDataResults([]); setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setDataResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setDataResults((await searchApi.search(q)).results); }
      catch { setDataResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const results: ResultItem[] = useCallback(() => {
    const q = query.trim().toLowerCase();
    const dataItems: ResultItem[] = dataResults.map(r => ({ kind: 'data', result: r }));
    const navItems: ResultItem[] = NAV_ITEMS
      .filter(n => !q || n.label.toLowerCase().includes(q) || n.group.toLowerCase().includes(q))
      .map(n => ({ kind: 'nav', ...n }));
    return [...dataItems, ...navItems];
  }, [query, dataResults])();

  useEffect(() => setCursor(0), [results.length]);

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { const item = results[cursor]; if (item) navigate(item); }
  }

  function navigate(item: ResultItem) {
    if (item.kind === 'data' && item.result.type === 'project') setSelectedProject(item.result.id);
    router.push(item.kind === 'nav' ? item.href : item.result.href);
    onClose();
  }

  if (!open) return null;

  const dataItems  = results.filter(r => r.kind === 'data') as DataItem[];
  const navResults = results.filter(r => r.kind === 'nav')  as NavItem[];

  const dataGroups: { group: string; items: DataItem[] }[] = [];
  const typeOrder: SearchResult['type'][] = ['project', 'mail', 'contact', 'task', 'todo', 'guide', 'worklog', 'file'];
  for (const type of typeOrder) {
    const items = dataItems.filter(d => d.result.type === type);
    if (items.length) dataGroups.push({ group: TYPE_META[type].label, items });
  }

  const navGroups: { group: string; items: NavItem[] }[] = [];
  if (navResults.length) {
    const byGroup = navResults.reduce<Record<string, NavItem[]>>((acc, item) => {
      (acc[item.group] ??= []).push(item); return acc;
    }, {});
    Object.entries(byGroup).forEach(([g, items]) => navGroups.push({ group: g, items }));
  }

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[14vh]"
      style={{
        background: 'oklch(0.06 0.006 245 / 0.80)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        animation: 'fadeIn 0.15s ease',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl mx-4 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, oklch(0.18 0.012 242) 0%, oklch(0.15 0.010 245) 100%)',
          border: '1px solid oklch(0.28 0.012 234)',
          borderRadius: 16,
          boxShadow: [
            '0 32px 80px rgba(0,0,0,0.70)',
            '0 0 0 1px rgba(255,255,255,0.05)',
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          ].join(', '),
          animation: 'modalIn 0.20s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* 검색 입력 */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: '1px solid oklch(0.22 0.010 238)' }}
        >
          <Search
            className={clsx('w-4 h-4 flex-shrink-0', loading && 'animate-pulse')}
            style={{ color: loading ? 'var(--accent)' : 'var(--text-faint)' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="검색 — 메일 · 담당자 · 프로젝트 · 파일..."
            className="flex-1 bg-transparent focus:outline-none"
            style={{
              fontSize: '14px',
              color: 'var(--text)',
              caretColor: 'var(--accent)',
            }}
          />
          <kbd
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
            style={{
              background: 'oklch(0.20 0.010 240)',
              color: 'var(--text-muted)',
              border: '1px solid oklch(0.28 0.010 234)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* 결과 목록 */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1.5">
          {results.length === 0 && !loading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'oklch(0.20 0.010 240)',
                  border: '1px solid oklch(0.26 0.010 234)',
                }}
              >
                {query.trim()
                  ? <Hash className="w-5 h-5" style={{ color: 'var(--text-faint)' }} />
                  : <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                }
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {query.trim() ? '검색 결과 없음' : '검색어를 입력하세요'}
              </p>
            </div>
          ) : (
            <>
              {/* 데이터 결과 */}
              {dataGroups.map(({ group, items }) => (
                <div key={group}>
                  <p
                    className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {group}
                  </p>
                  {items.map(item => {
                    const idx = globalIdx++;
                    const isActive = cursor === idx;
                    const { result } = item;
                    const tm = TYPE_META[result.type];
                    const Icon = tm.icon;
                    return (
                      <button
                        key={`data-${result.type}-${result.id}`}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setCursor(idx)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left relative transition-all duration-100"
                        style={{
                          background: isActive ? tm.bg : 'transparent',
                          borderLeft: isActive ? `2px solid ${tm.color}` : '2px solid transparent',
                        }}
                      >
                        {/* Active ambient glow */}
                        {isActive && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: `linear-gradient(90deg, ${tm.glow} 0%, transparent 50%)` }}
                          />
                        )}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                          style={{
                            background: tm.bg,
                            border: `1px solid ${tm.border}`,
                            color: tm.color,
                            boxShadow: isActive ? `0 0 12px ${tm.glow}` : 'none',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 relative">
                          <p className="text-sm truncate font-medium" style={{ color: isActive ? 'var(--text)' : 'var(--text-dim)' }}>
                            {result.title}
                          </p>
                          {result.meta && (
                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>
                              {result.meta}
                            </p>
                          )}
                        </div>
                        <span
                          className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}` }}
                        >
                          {result.match_field}
                        </span>
                        {isActive && <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 relative" style={{ color: tm.color }} />}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* 내비게이션 */}
              {navGroups.map(({ group, items }) => (
                <div key={group}>
                  <p
                    className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {group}
                  </p>
                  {items.map(item => {
                    const idx = globalIdx++;
                    const isActive = cursor === idx;
                    const Icon = item.icon;
                    return (
                      <button
                        key={`nav-${item.href}`}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setCursor(idx)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left relative transition-all duration-100"
                        style={{
                          background: isActive ? 'oklch(0.76 0.16 196 / 0.08)' : 'transparent',
                          borderLeft: isActive ? '2px solid oklch(0.76 0.16 196)' : '2px solid transparent',
                        }}
                      >
                        {isActive && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(90deg, oklch(0.76 0.16 196 / 0.08) 0%, transparent 50%)' }}
                          />
                        )}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                          style={{
                            background: isActive ? 'oklch(0.76 0.16 196 / 0.12)' : 'oklch(0.20 0.010 240)',
                            border: isActive ? '1px solid oklch(0.55 0.12 196 / 0.30)' : '1px solid oklch(0.26 0.010 234)',
                            color: isActive ? 'oklch(0.76 0.16 196)' : 'var(--text-muted)',
                            boxShadow: isActive ? '0 0 12px oklch(0.76 0.16 196 / 0.20)' : 'none',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <p
                          className="flex-1 text-sm truncate relative font-medium"
                          style={{ color: isActive ? 'var(--text)' : 'var(--text-dim)' }}
                        >
                          {item.label}
                        </p>
                        {isActive && (
                          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 relative" style={{ color: 'oklch(0.76 0.16 196)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* 하단 힌트 바 */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            borderTop: '1px solid oklch(0.20 0.010 240)',
            background: 'oklch(0.14 0.010 245)',
          }}
        >
          <div className="flex items-center gap-4">
            {[
              { key: '↑↓',  desc: '이동' },
              { key: '↵',   desc: '선택' },
              { key: 'ESC', desc: '닫기' },
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
          </div>
          {dataResults.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {dataResults.length}개 결과
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
