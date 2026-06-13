'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { notificationsApi, type NotificationSection, type NotificationSummary } from '@/lib/api';
import {
  Bell, Mail, AlertTriangle, Clock, RefreshCw,
  ChevronRight, Loader2, CheckCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const ICON_MAP = {
  mail:  {
    Icon: Mail,
    color: 'oklch(0.84 0.16 82)',
    bg:   'oklch(0.84 0.16 82 / 0.12)',
    border: 'oklch(0.62 0.12 82 / 0.30)',
    glow: 'oklch(0.84 0.16 82 / 0.20)',
  },
  alert: {
    Icon: AlertTriangle,
    color: 'oklch(0.70 0.20 22)',
    bg:   'oklch(0.70 0.20 22 / 0.12)',
    border: 'oklch(0.55 0.14 22 / 0.30)',
    glow: 'oklch(0.70 0.20 22 / 0.20)',
  },
  clock: {
    Icon: Clock,
    color: 'oklch(0.84 0.16 82)',
    bg:   'oklch(0.84 0.16 82 / 0.10)',
    border: 'oklch(0.62 0.12 82 / 0.25)',
    glow: 'oklch(0.84 0.16 82 / 0.18)',
  },
} as const;

function timeAgo(iso: string | null) {
  if (!iso) return '';
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ko }); }
  catch { return ''; }
}

interface Props {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  onCountChange: (n: number) => void;
}

export default function NotificationPanel({ anchorRef, open, onClose, onCountChange }: Props) {
  const router   = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [summary,  setSummary]  = useState<NotificationSummary | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open || !anchorRef.current || isMobile) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 8, left: r.left });
  }, [open, anchorRef, isMobile]);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await notificationsApi.summary();
      setSummary(data);
      onCountChange(data.total);
      if (!quiet) {
        const init: Record<string, boolean> = {};
        data.sections.forEach(s => { init[s.type] = true; });
        setExpanded(init);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line
  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line
  useEffect(() => { load(true); }, []); // eslint-disable-line

  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef, isMobile]);

  const navigate = (href: string) => { router.push(href); onClose(); };

  if (!open || typeof window === 'undefined') return null;

  /* ── 공통 내용 ── */
  const content = (
    <>
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{
              background: 'oklch(0.76 0.16 196 / 0.12)',
              border: '1px solid oklch(0.55 0.12 196 / 0.30)',
              color: 'var(--accent)',
            }}
          >
            <Bell className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>알림</span>
          {summary && summary.total > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-black"
              style={{
                background: 'oklch(0.76 0.16 196)',
                color: 'oklch(0.10 0.015 245)',
                boxShadow: '0 0 8px oklch(0.76 0.16 196 / 0.40)',
              }}
            >
              {summary.total}
            </span>
          )}
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="p-1.5 rounded-md transition-all"
          style={{ color: 'var(--text-faint)' }}
          title="새로고침"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text)';
            (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto">
        {loading && !summary ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : !summary || summary.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'oklch(0.76 0.16 152 / 0.10)',
                border: '1px solid oklch(0.58 0.12 152 / 0.25)',
                boxShadow: '0 0 16px oklch(0.76 0.16 152 / 0.10)',
              }}
            >
              <CheckCheck className="w-5 h-5" style={{ color: 'oklch(0.76 0.16 152)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>모두 처리됐습니다</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>미배정 메일, 마감 태스크가 없습니다</p>
            </div>
          </div>
        ) : (
          <div>
            {summary.sections.map(section => {
              const meta = ICON_MAP[section.icon];
              const { Icon } = meta;
              const isExpanded = expanded[section.type] ?? true;
              return (
                <div
                  key={section.type}
                  style={{ borderBottom: '1px solid oklch(0.18 0.010 242 / 0.70)' }}
                >
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [section.type]: !isExpanded }))}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all duration-150"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240 / 0.50)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                        boxShadow: `0 0 10px ${meta.glow}`,
                        color: meta.color,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
                      {section.label}
                    </span>
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                      style={{
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      {section.count}
                    </span>
                    <ChevronRight
                      className={clsx(
                        'w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200',
                        isExpanded && 'rotate-90',
                      )}
                      style={{ color: 'var(--text-faint)' }}
                    />
                  </button>

                  {isExpanded && (
                    <div style={{ background: 'oklch(0.14 0.010 245 / 0.50)' }}>
                      {section.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.href)}
                          className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all duration-150 relative"
                          style={{ borderTop: '1px solid oklch(0.18 0.010 242 / 0.60)' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0.010 241 / 0.60)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          {/* 읽지 않음 표시 */}
                          <div
                            className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                            style={{
                              background: meta.color,
                              boxShadow: `0 0 6px ${meta.glow}`,
                            }}
                          />
                          <div className="flex-1 min-w-0 pl-1">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-dim)' }}>
                              {item.title}
                            </p>
                            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>
                              {item.meta}
                            </p>
                          </div>
                          {item.time && (
                            <span
                              className="text-[10px] flex-shrink-0 pt-0.5 tabular-nums"
                              style={{ color: 'var(--text-faint)' }}
                            >
                              {timeAgo(item.time)}
                            </span>
                          )}
                        </button>
                      ))}
                      {section.href && (
                        <button
                          onClick={() => navigate(section.href!)}
                          className="w-full px-4 py-2 text-[11px] flex items-center justify-end gap-1 transition-all duration-150"
                          style={{
                            borderTop: '1px solid oklch(0.18 0.010 242 / 0.60)',
                            color: 'var(--accent)',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.06)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          모두 보기 <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const panelStyle: React.CSSProperties = {
    background: 'oklch(0.16 0.010 244)',
    backgroundImage: 'linear-gradient(180deg, oklch(0.18 0.010 242) 0%, oklch(0.15 0.010 245) 100%)',
    border: '1px solid oklch(0.26 0.010 236)',
    borderRadius: 16,
    boxShadow: [
      '0 24px 60px rgba(0,0,0,0.60)',
      '0 0 0 1px rgba(255,255,255,0.04)',
      'inset 0 1px 0 rgba(255,255,255,0.06)',
    ].join(', '),
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  /* ── 모바일: 바텀 시트 ── */
  if (isMobile) {
    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[9990]"
          style={{
            background: 'oklch(0.06 0.006 245 / 0.70)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col"
          style={{
            ...panelStyle,
            maxHeight: '85dvh',
            borderRadius: '20px 20px 0 0',
            borderBottom: 'none',
            animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'oklch(0.30 0.010 234)' }}
            />
          </div>
          {content}
        </div>
      </>,
      document.body,
    );
  }

  /* ── 데스크탑: 드롭다운 ── */
  return createPortal(
    <div
      ref={panelRef}
      style={{
        ...panelStyle,
        position: 'fixed',
        top: panelPos.top,
        left: panelPos.left,
        width: 320,
        maxHeight: '80vh',
        zIndex: 9999,
        animation: 'slideDown 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {content}
    </div>,
    document.body,
  );
}
