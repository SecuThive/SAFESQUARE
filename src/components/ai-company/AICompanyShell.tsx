'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MetaverseMap from './MetaverseMap';
import CommandBar from './CommandBar';
import RightDashboard from './RightDashboard';
import type { Agent } from './mockData';
import {
  aiCompanyApi,
  type AICompany, type AICompanyLog, type AICompanyTask, type AICompanyStats, type AICompanyRevenue,
} from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── Design tokens ──────────────────────────────────────────── */
const T = {
  ink:  '#1b1a22', ink2: '#3a3845', ink3: '#6c697a', ink4: '#a09ead',
  line: '#ecebef', line2: '#f3f2f6',
  bg: '#f7f6f3', floor: '#efe9d6',
  panel: '#ffffff',
  accent: '#6d5bff', accentSoft: '#efedff', accentInk: '#4a3bd4',
  ok: '#18b86b', okSoft: '#e3f7ec',
  warn: '#e0a30a', warnSoft: '#fbf2d8', danger: '#e8553a',
};
const font = (w: number, s: number, lh = 1) => `${w} ${s}px/${lh} "Plus Jakarta Sans", sans-serif`;
const mono = (w: number, s: number) => `${w} ${s}px/1 "JetBrains Mono", monospace`;

/* ── WebSocket URL ──────────────────────────────────────────── */
function getWsUrl(path: string): string {
  if (typeof window === 'undefined') return '';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) return `ws://localhost:8000${path}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}

/* ── Agent definitions (7 real agents) ─────────────────────── */
const AGENT_DEFS: Omit<Agent, 'status' | 'mood' | 'currentTask' | 'message'>[] = [
  { id: 'ceo',              name: 'CEO AI',           role: 'Chief Executive Officer', department: 'Executive',   emoji: '👑', color: '#9b7bff', room: 'ceo'    },
  { id: 'content_planner',  name: 'Content Planner',  role: 'Content Strategist',      department: 'Content',     emoji: '🧠', color: '#9cb5ff', room: 'content' },
  { id: 'content_writer',   name: 'Content Writer',   role: 'Blog Writer',             department: 'Content',     emoji: '✍️', color: '#7ec8a0', room: 'content' },
  { id: 'content_reviewer', name: 'Content Reviewer', role: 'Editor & QA',             department: 'Content',     emoji: '🔍', color: '#b09fff', room: 'content' },
  { id: 'developer',        name: 'Developer AI',     role: 'Lead Engineer',           department: 'Development', emoji: '⚡', color: '#a4d5ff', room: 'dev'    },
  { id: 'site_operator',    name: 'Site Operator',    role: 'SEO & Ops',               department: 'Operations',  emoji: '🌐', color: '#ffd08a', room: 'ops'    },
  { id: 'revenue_manager',  name: 'Revenue Manager',  role: 'Revenue & Growth',        department: 'Revenue',     emoji: '💰', color: '#6ee0f0', room: 'ops'    },
];

function buildAgents(stats: AICompanyStats | null, runningTitles: Record<string, string>): Agent[] {
  return AGENT_DEFS.map(def => {
    const isBusy    = stats?.busy_roles.includes(def.id) ?? false;
    const isPending = stats?.pending_roles.includes(def.id) ?? false;
    const task      = runningTitles[def.id] ?? (isPending ? '다음 태스크 대기 중' : '대기 중');
    return {
      ...def,
      status:      isBusy ? 'busy' : isPending ? 'online' : 'away',
      mood:        isBusy ? 'focused' : 'neutral',
      currentTask: task,
      message:     isBusy ? task.slice(0, 40) : '대기 중',
    };
  });
}

/* ── Log → FeedMessage ──────────────────────────────────────── */
function logToFeed(log: AICompanyLog) {
  const ago = (() => { try { return formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ko }); } catch { return ''; } })();
  return {
    id: String(log.id),
    agent: log.agent_name,
    agentColor: log.agent_color ?? T.accent,
    message: log.content.slice(0, 300),
    timestamp: ago,
  };
}

/* ── Task → WorkflowItem ────────────────────────────────────── */
const STATUS_MAP: Record<string, string> = { running: 'in-progress', pending: 'pending', done: 'done', failed: 'in-review' };
function taskToWorkflow(t: AICompanyTask) {
  return { id: String(t.id), title: t.title, owner: t.agent_name, department: t.department, status: STATUS_MAP[t.status] ?? 'pending' };
}

/* ── Nav item data ──────────────────────────────────────────── */
const NAV_MAIN = [
  { id: 'home',       label: 'Dashboard',   iconPath: 'M3.5 11 12 4l8.5 7M5.5 9.7V20h13V9.7M10 20v-5h4v5' },
  { id: 'agents',     label: 'Agents',      iconPath: 'M12 8a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 8ZM6 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5', badge: String(AGENT_DEFS.length) },
  { id: 'projects',   label: 'Tasks',       iconPath: 'M3.5 7.5a2 2 0 0 1 2-2h3.3l2 2h7.7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10Z' },
  { id: 'finance',    label: 'Finance',     iconPath: 'M12 4v16M16 8.5c-.6-1.5-2.1-2.5-4-2.5-2.4 0-4 1.3-4 3 0 4 8 2 8 6 0 1.8-1.8 3.2-4.2 3.2-2.1 0-3.7-1.1-4.2-2.7' },
  { id: 'automation', label: 'Automation',  iconPath: 'M13 3 5 13.5h5L9.5 21 17 10.5h-5L13 3Z' },
  { id: 'settings',   label: 'Settings',    iconPath: 'M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z' },
];

/* ── Left Nav ───────────────────────────────────────────────── */
function LeftNav({ activeNav, onPick, agentsOnline }: { activeNav: string; onPick: (id: string) => void; agentsOnline: number }) {
  const WAVE_HEIGHTS = [0.4, 0.7, 0.55, 0.9, 1, 0.7, 0.45, 0.85, 0.6, 0.95, 0.7, 0.5, 0.8, 0.6, 0.4];
  return (
    <aside style={{
      gridColumn: 1, gridRow: 2,
      borderRight: `1px solid ${T.line}`,
      background: T.panel,
      display: 'flex', flexDirection: 'column',
      padding: '14px 10px',
      overflowY: 'auto',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_MAIN.map(it => {
          const active = activeNav === it.id;
          return (
            <button key={it.id} onClick={() => onPick(it.id)} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '9px 11px', borderRadius: 9,
              color: active ? T.accentInk : T.ink2,
              fontWeight: active ? 600 : 500, fontSize: 13.5,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              border: 0,
              background: active ? T.accentSoft : 'transparent',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseOver={e => { if (!active) (e.currentTarget as HTMLElement).style.background = T.line2; }}
            onMouseOut={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? T.accent : T.ink3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d={it.iconPath} />
              </svg>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  font: mono(600, 11), padding: '2px 6px', borderRadius: 5,
                  background: active ? T.accentInk : T.line,
                  color: active ? '#fff' : T.ink3,
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 12 }} />

      {/* Status widget */}
      <div style={{
        marginTop: 12, padding: 12, borderRadius: 12,
        background: 'linear-gradient(180deg, #fbfaf7, #fff)',
        border: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26, marginBottom: 8 }}>
          {WAVE_HEIGHTS.map((h, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 2, height: `${h * 100}%`,
              background: `linear-gradient(180deg, ${T.accent}, #b1a4ff)`,
              opacity: 0.7,
              animation: `wave 1.6s ease-in-out ${i * 0.08}s infinite`,
            }} />
          ))}
        </div>
        <div style={{ font: font(500, 12), color: T.ink3, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: agentsOnline > 0 ? T.ok : T.ink4, boxShadow: agentsOnline > 0 ? `0 0 0 3px ${T.okSoft}` : 'none', display: 'inline-block' }} />
          {agentsOnline > 0 ? `${agentsOnline} agents active` : 'Standby'}
        </div>
        <div style={{ font: font(600, 12.5), color: T.ink }}>All systems normal</div>
      </div>
    </aside>
  );
}

/* ── Top Bar ────────────────────────────────────────────────── */
function TopBar({ company, companies, onOpenSelector, onCreateCompany, onStart, onPause }: {
  company: AICompany | null;
  companies: AICompany[];
  onOpenSelector: () => void;
  onCreateCompany: () => void;
  onStart: () => void;
  onPause: () => void;
}) {
  return (
    <header style={{
      gridColumn: '1 / -1', gridRow: 1,
      display: 'grid',
      gridTemplateColumns: '232px auto 1fr 360px',
      alignItems: 'center',
      borderBottom: `1px solid ${T.line}`,
      background: T.panel,
      position: 'relative', zIndex: 5,
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', height: '100%',
        borderRight: `1px solid ${T.line}`,
        minWidth: 0,
      }}>
        {/* Logo */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'radial-gradient(120% 120% at 0% 0%, #8a7bff 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, #4f3dd0 0%, transparent 55%), linear-gradient(135deg, #6d5bff, #3b2bb5)',
          boxShadow: '0 4px 14px -4px rgba(109,91,255,0.6), inset 0 0 0 1px rgba(255,255,255,0.18)',
          position: 'relative', cursor: 'pointer',
        }} onClick={companies.length > 0 ? onOpenSelector : onCreateCompany}>
          <div style={{ position: 'absolute', inset: 7, background: 'radial-gradient(circle at 35% 35%, #fff 0 4px, transparent 5px), radial-gradient(circle at 70% 65%, rgba(255,255,255,0.7) 0 3px, transparent 4px)' }} />
        </div>
        <button onClick={companies.length > 0 ? onOpenSelector : onCreateCompany} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontWeight: 700, fontSize: 14, letterSpacing: '-0.012em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          border: 0, background: 'transparent', cursor: 'pointer', color: T.ink,
          flex: 1, minWidth: 0,
        }}>
          {company ? company.name : 'AI Company'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Company controls */}
      {company && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', flexShrink: 0 }}>
          {company.status !== 'running' ? (
            <button onClick={onStart} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 14px', borderRadius: 8, border: 0,
              background: T.ok, color: '#fff',
              font: font(700, 12.5), cursor: 'pointer',
              boxShadow: `0 3px 8px -2px ${T.ok}88`,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
              가동
            </button>
          ) : (
            <button onClick={onPause} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 14px', borderRadius: 8, border: 0,
              background: T.warn, color: '#fff',
              font: font(700, 12.5), cursor: 'pointer',
              boxShadow: `0 3px 8px -2px ${T.warn}88`,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              정지
            </button>
          )}
          <span style={{
            font: font(600, 11), padding: '3px 8px', borderRadius: 6,
            background: company.status === 'running' ? T.okSoft : company.status === 'paused' ? T.warnSoft : T.line2,
            color: company.status === 'running' ? T.ok : company.status === 'paused' ? T.warn : T.ink4,
          }}>
            {company.status === 'running' ? '운영 중' : company.status === 'paused' ? '정지됨' : '대기'}
          </span>
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{
          width: '100%', maxWidth: 560, height: 40, borderRadius: 10,
          background: T.bg, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px', color: T.ink3, transition: 'all 0.15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input placeholder="Search people, departments, tasks…" style={{
            flex: 1, border: 0, background: 'transparent', outline: 'none',
            font: font(400, 14), color: T.ink,
          }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, font: mono(400, 11), padding: '3px 6px', borderRadius: 5, background: '#fff', border: `1px solid ${T.line}`, color: T.ink3 }}>⌘K</span>
        </div>
      </div>

      {/* Right icons */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
        padding: '0 14px', height: '100%',
        borderLeft: `1px solid ${T.line}`,
      }}>
        {[
          { icon: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5h1.5l-1 2H6l-1-2h1.5ZM10 20a2 2 0 0 0 4 0', dot: true },
          { icon: 'M4 5.5h16v14H9l-5 4v-18Z', dot: false },
          { icon: 'M12 4.5v15M4.5 12h15', dot: false },
        ].map((btn, i) => (
          <button key={i} style={{
            width: 36, height: 36, borderRadius: 9,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0, color: T.ink2, cursor: 'pointer',
            position: 'relative',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = T.line2; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={btn.icon} />
            </svg>
            {btn.dot && (
              <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: '50%', background: T.danger, border: '2px solid #fff' }} />
            )}
          </button>
        ))}

        {/* User avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 4px 6px', marginLeft: 6, borderRadius: 10, cursor: 'pointer' }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = T.line2; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(140deg, #ffd9a1, #b97c47)',
            boxShadow: 'inset 0 -8px 14px rgba(0,0,0,0.12)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: '6px 6px 0 6px', background: 'radial-gradient(circle at 50% 90%, #2a2433 0 38%, transparent 39%)' }} />
          </div>
          <div>
            <div style={{ font: font(600, 13.5, 1.15), color: T.ink }}>Manager</div>
            <div style={{ color: T.ok, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ok, display: 'inline-block' }} />
              Online
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>
    </header>
  );
}

/* ── Office Toolbar ─────────────────────────────────────────── */
function OfficeToolbar({ view, setView, showBubbles, setShowBubbles }: {
  view: string; setView: (v: string) => void;
  showBubbles: boolean; setShowBubbles: (v: boolean) => void;
}) {
  const pills = ['Floor', 'Org chart', 'Map'];
  return (
    <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6, zIndex: 4 }}>
      {pills.map((v, i) => {
        const on = view === v;
        return (
          <button key={v} onClick={() => setView(v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 11px', whiteSpace: 'nowrap',
            background: on ? T.ink : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            border: on ? `1px solid ${T.ink}` : '1px solid rgba(20,18,30,0.06)',
            borderRadius: 8,
            font: font(600, 12), color: on ? '#fff' : T.ink2,
            cursor: 'pointer',
          }}>
            {v}
          </button>
        );
      })}
      <button onClick={() => setShowBubbles(!showBubbles)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 30, padding: '0 11px', whiteSpace: 'nowrap',
        background: showBubbles ? T.ink : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(8px)',
        border: showBubbles ? `1px solid ${T.ink}` : '1px solid rgba(20,18,30,0.06)',
        borderRadius: 8,
        font: font(600, 12), color: showBubbles ? '#fff' : T.ink2,
        cursor: 'pointer',
      }}>
        💬 Bubbles
      </button>
    </div>
  );
}

/* ── Create Company Modal ───────────────────────────────────── */
const FOCUS_OPTIONS = [
  { value: 'content',   label: '콘텐츠 자동화', desc: '유튜브, 블로그, SNS 자동 생성' },
  { value: 'affiliate', label: '제휴 마케팅',   desc: '쿠팡, AdSense 등 제휴 수익' },
  { value: 'saas',      label: 'SaaS / 도구',  desc: '소프트웨어·도구 기획·판매' },
  { value: 'mixed',     label: 'AI가 자율 판단', desc: '상황에 따라 최적 전략 선택' },
];

function CreateCompanyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: AICompany) => void }) {
  const [name, setName]         = useState('');
  const [goal, setGoal]         = useState('');
  const [focus, setFocus]       = useState('mixed');
  const [interval, setInterval] = useState(30);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleCreate() {
    if (!name.trim() || !goal.trim()) { setError('회사명과 목표를 입력하세요.'); return; }
    setLoading(true); setError('');
    try {
      const co = await aiCompanyApi.create({ name: name.trim(), goal: goal.trim(), focus, cycle_interval_min: interval });
      onCreate(co);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : '생성 실패'); }
    finally { setLoading(false); }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', width: '100%', maxWidth: 500, border: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #3b2bb5)`, display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5 13.5 9 19 10.5 13.5 12 12 17.5 10.5 12 5 10.5 10.5 9 12 3.5Z" />
              </svg>
            </div>
            <div>
              <div style={{ font: font(700, 15), color: T.ink }}>AI 회사 설립</div>
              <div style={{ font: font(500, 12), color: T.ink3 }}>목표를 설정하면 AI가 24/7 자동 운영합니다</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: 0, borderRadius: 8, background: T.line2, color: T.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { label: '회사명', value: name, onChange: setName, placeholder: '예: TechVenture AI', multiline: false },
            { label: '최종 목표', value: goal, onChange: setGoal, placeholder: '예: 월 100만원 수익 달성', multiline: true },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</label>
              {f.multiline ? (
                <textarea value={f.value} onChange={e => f.onChange(e.target.value)} rows={3} placeholder={f.placeholder}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.line}`, font: font(400, 14, 1.5), color: T.ink, outline: 'none', resize: 'none', fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
              ) : (
                <input value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.line}`, font: font(400, 14, 1.5), color: T.ink, outline: 'none', fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>수익화 집중</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {FOCUS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setFocus(opt.value)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `1px solid ${focus === opt.value ? T.accent : T.line}`, cursor: 'pointer', textAlign: 'left', background: focus === opt.value ? T.accentSoft : '#fff',
                }}>
                  <span style={{ font: font(700, 12), color: focus === opt.value ? T.accentInk : T.ink }}>{opt.label}</span>
                  <span style={{ font: font(500, 11), color: T.ink4, marginTop: 2 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>사이클 주기 — {interval}분마다</label>
            <input type="range" min={5} max={120} step={5} value={interval} onChange={e => setInterval(Number(e.target.value))}
              style={{ accentColor: T.accent }} />
          </div>
          {error && <div style={{ font: font(500, 12), color: T.danger }}>{error}</div>}
          <button onClick={handleCreate} disabled={loading} style={{
            padding: '12px 0', borderRadius: 10, border: 0,
            background: `linear-gradient(135deg, ${T.accent}, #3b2bb5)`,
            color: '#fff', font: font(700, 14), cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? '설립 중...' : '✦ AI 회사 설립하기'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Company Selector Modal ─────────────────────────────────── */
function CompanySelectorModal({ companies, selected, onSelect, onCreate, onClose }: {
  companies: AICompany[]; selected: AICompany | null;
  onSelect: (c: AICompany) => void; onCreate: () => void; onClose: () => void;
}) {
  const STATUS_COLOR: Record<string, string> = { idle: T.ink4, running: T.ok, paused: T.warn };
  const STATUS_LABEL: Record<string, string> = { idle: '대기', running: '운영 중', paused: '일시정지' };
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: '100%', maxWidth: 440, border: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ font: font(700, 14), color: T.ink }}>AI 회사 선택</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, font: font(600, 12), color: T.accentInk, background: T.accentSoft, border: `1px solid ${T.accent}40`, cursor: 'pointer' }}>
              + 새 회사
            </button>
            <button onClick={onClose} style={{ width: 28, height: 28, border: 0, borderRadius: 7, background: T.line2, color: T.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {companies.map(co => (
            <button key={co.id} onClick={() => { onSelect(co); onClose(); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: `1px solid ${selected?.id === co.id ? T.accent : T.line}`, background: selected?.id === co.id ? T.accentSoft : '#fff', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${T.accent}, #3b2bb5)`, color: '#fff', font: font(800, 14), flexShrink: 0 }}>
                {co.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: font(700, 13), color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</div>
                <div style={{ font: font(500, 11.5), color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{co.goal.slice(0, 50)}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <span style={{ font: font(600, 10), padding: '2px 8px', borderRadius: 999, background: (STATUS_COLOR[co.status] ?? T.ink4) + '20', color: STATUS_COLOR[co.status] ?? T.ink4 }}>{STATUS_LABEL[co.status]}</span>
                <div style={{ font: mono(500, 10), color: T.ink4, marginTop: 3 }}>사이클 {co.cycle_count}회</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Agents Panel ───────────────────────────────────────────── */
function AgentsPanel({ agents, stats, onSelect }: { agents: Agent[]; stats: AICompanyStats | null; onSelect: (a: Agent) => void }) {
  const STATUS_DOT: Record<string, string> = { online: T.ok, busy: T.warn, away: T.ink4 };
  const STATUS_LABEL_MAP: Record<string, string> = { online: '대기', busy: '작업 중', away: '오프라인' };
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ font: font(700, 18), color: T.ink, marginBottom: 4 }}>AI 에이전트</div>
      <div style={{ font: font(500, 13), color: T.ink3, marginBottom: 20 }}>총 {agents.length}명 · 현재 {agents.filter(a => a.status === 'busy').length}명 작업 중</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {agents.map(agent => (
          <button key={agent.id} onClick={() => onSelect(agent)} style={{
            background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14,
            padding: 18, textAlign: 'left', cursor: 'pointer', transition: 'box-shadow 0.15s',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(109,91,255,0.12)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
                background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
                fontSize: 22,
              }}>{agent.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: font(700, 14), color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</div>
                <div style={{ font: font(500, 12), color: T.ink3, marginTop: 1 }}>{agent.role}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[agent.status] ?? T.ink4, display: 'inline-block' }} />
                <span style={{ font: font(500, 11), color: T.ink3 }}>{STATUS_LABEL_MAP[agent.status]}</span>
              </div>
            </div>
            <div style={{
              font: font(500, 12), color: T.ink3,
              padding: '8px 10px', borderRadius: 8, background: T.line2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {agent.status === 'busy' ? `⚡ ${agent.currentTask}` : '대기 중'}
            </div>
            {stats && (
              <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                {[
                  { label: '완료', val: stats.dept_stats[agent.department.toLowerCase()]?.done ?? 0, color: T.ok },
                  { label: '수행률', val: `${stats.dept_stats[agent.department.toLowerCase()]?.performance ?? 0}%`, color: T.accent },
                ].map(kpi => (
                  <div key={kpi.label} style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: T.line2 }}>
                    <div style={{ font: mono(600, 14), color: kpi.color }}>{kpi.val}</div>
                    <div style={{ font: font(500, 11), color: T.ink4 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Tasks Panel ────────────────────────────────────────────── */
function TasksPanel({ tasks, companyId }: { tasks: AICompanyTask[]; companyId?: number }) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const STATUS_COLOR: Record<string, string> = { pending: T.warn, running: T.accent, done: T.ok, failed: T.danger };
  const STATUS_KR: Record<string, string> = { pending: '대기', running: '실행 중', done: '완료', failed: '실패' };
  const filters = [
    { id: 'all', label: '전체' },
    { id: 'running', label: '실행 중' },
    { id: 'pending', label: '대기' },
    { id: 'done', label: '완료' },
    { id: 'failed', label: '실패' },
  ];
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const toggleExpand = (id: number, hasResult: boolean) => {
    if (!hasResult) return;
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ font: font(700, 18), color: T.ink, marginBottom: 4 }}>태스크 목록</div>
      <div style={{ font: font(500, 13), color: T.ink3, marginBottom: 16 }}>
        총 {tasks.length}개 · 실행 중 {tasks.filter(t => t.status === 'running').length}개
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '5px 13px', borderRadius: 20, border: 0, cursor: 'pointer',
            font: font(600, 12), transition: 'all 0.12s',
            background: filter === f.id ? T.accent : T.line2,
            color: filter === f.id ? '#fff' : T.ink3,
          }}>{f.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.ink4, font: font(500, 13) }}>태스크가 없습니다.</div>
        ) : filtered.map(t => {
          const isExpanded = expandedId === t.id;
          const hasResult = !!t.result;
          const completedAt = t.completed_at ? new Date(t.completed_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

          return (
            <div key={t.id} style={{
              background: T.panel, border: `1px solid ${isExpanded ? T.accent + '60' : T.line}`,
              borderRadius: 12, overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}>
              {/* 헤더 행 */}
              <div
                onClick={() => toggleExpand(t.id, hasResult)}
                style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
                  cursor: hasResult ? 'pointer' : 'default',
                  background: isExpanded ? T.accent + '08' : 'transparent',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[t.status] ?? T.ink4,
                  marginTop: 5, flexShrink: 0,
                  boxShadow: t.status === 'running' ? `0 0 0 4px ${STATUS_COLOR[t.status]}30` : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: font(600, 13.5), color: T.ink, marginBottom: 3 }}>{t.title}</div>
                  <div style={{ font: font(500, 12), color: T.ink3, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{t.agent_role.replace('_director', ' Dir.')}</span>
                    <span>·</span>
                    <span>{t.department}</span>
                    {completedAt && <><span>·</span><span>{completedAt}</span></>}
                    {hasResult && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: T.ok, font: font(600, 11),
                        background: T.ok + '18', padding: '2px 7px', borderRadius: 10,
                      }}>
                        결과 있음 {isExpanded ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{
                  font: font(600, 11), padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                  background: (STATUS_COLOR[t.status] ?? T.ink4) + '20',
                  color: STATUS_COLOR[t.status] ?? T.ink4,
                }}>{STATUS_KR[t.status]}</span>
              </div>

              {/* 결과 드롭다운 */}
              {isExpanded && t.result && (
                <div style={{
                  borderTop: `1px solid ${T.line}`,
                  padding: '14px 16px 16px',
                  background: T.bg,
                }}>
                  <div style={{ font: font(600, 11), color: T.ok, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    ✓ 실행 결과
                  </div>
                  <pre style={{
                    margin: 0,
                    font: font(400, 12.5),
                    color: T.ink2,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: T.panel,
                    border: `1px solid ${T.line}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}>
                    {t.result}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Finance Panel ──────────────────────────────────────────── */
function FinancePanel({ stats, companyId }: { stats: AICompanyStats | null; companyId?: number }) {
  const [revenues, setRevenues] = useState<AICompanyRevenue[]>([]);
  useEffect(() => {
    if (companyId) aiCompanyApi.revenue(companyId).then(setRevenues).catch(() => {});
  }, [companyId]);
  const mtd = stats?.revenue_mtd ?? 0;
  const DEPT_COLORS = ['#6d5bff', '#18b86b', '#e0a30a', '#2563EB', '#e873b2'];
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ font: font(700, 18), color: T.ink, marginBottom: 16 }}>Finance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: '이번달 수익', value: `₩${mtd.toLocaleString()}`, color: T.ok },
          { label: '완료 태스크', value: String(stats?.task_counts.done ?? 0), color: T.accent },
          { label: '성공률', value: `${stats?.success_rate ?? 0}%`, color: T.warn },
          { label: '총 사이클', value: String(stats?.cycle_count ?? 0), color: T.ink2 },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ font: mono(700, 22), color: kpi.color, marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ font: font(500, 12), color: T.ink3 }}>{kpi.label}</div>
          </div>
        ))}
      </div>
      <div style={{ font: font(700, 14), color: T.ink, marginBottom: 12 }}>부서별 성과</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {Object.entries(stats?.dept_stats ?? {}).map(([dept, s], i) => (
          <div key={dept} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: DEPT_COLORS[i % DEPT_COLORS.length], flexShrink: 0 }} />
            <div style={{ flex: 1, font: font(600, 13), color: T.ink }}>{dept}</div>
            <div style={{ font: mono(600, 12), color: T.ink2 }}>{s.done}/{s.total}</div>
            <div style={{ width: 70, height: 6, borderRadius: 3, background: T.line2, overflow: 'hidden' }}>
              <div style={{ width: `${(s.performance ?? 0) * 100}%`, height: '100%', background: DEPT_COLORS[i % DEPT_COLORS.length], borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
      {revenues.length > 0 && <>
        <div style={{ font: font(700, 14), color: T.ink, marginBottom: 12 }}>수익 기록</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {revenues.slice(0, 10).map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8 }}>
              <div style={{ flex: 1, font: font(500, 12.5), color: T.ink }}>{r.channel}</div>
              <div style={{ font: mono(600, 13), color: T.ok }}>+₩{r.amount.toLocaleString()}</div>
              <div style={{ font: font(500, 11), color: T.ink4 }}>{r.date?.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

/* ── Automation / Blog Settings Panel ───────────────────────── */
type BlogSettings = {
  blog_api_url: string; supabase_url: string; site_url: string;
  blog_api_key_set: boolean; blog_api_key_preview: string;
  supabase_anon_key_set: boolean; supabase_anon_key_preview: string;
  supabase_service_role_key_set: boolean; supabase_service_role_key_preview: string;
};

function SecretField({ label, hint, placeholder, preview, isSet, value, onChange }: {
  label: string; hint: string; placeholder: string;
  preview: string; isSet: boolean; value: string; onChange: (v: string) => void;
}) {
  const inputStyle: React.CSSProperties = {
    padding: '9px 13px', borderRadius: 9, border: `1px solid ${T.line}`,
    font: font(400, 13.5, 1.5), color: T.ink, outline: 'none', width: '100%',
    background: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif',
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
        {isSet && <span style={{ font: font(500, 11), color: T.ok, textTransform: 'none' }}>✓ 설정됨 ({preview})</span>}
      </div>
      <input type="password" value={value} onChange={e => onChange(e.target.value)}
        placeholder={isSet ? '새 값을 입력하면 교체됩니다' : placeholder}
        style={inputStyle} />
      <div style={{ marginTop: 4, font: font(500, 11), color: T.ink4 }}>{hint}</div>
    </div>
  );
}

function AutomationPanel({ companyId }: { companyId?: number }) {
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);

  // plain text fields
  const [blogUrl, setBlogUrl]   = useState('');
  const [siteUrl, setSiteUrl]   = useState('');
  const [sbUrl, setSbUrl]       = useState('');
  // secret fields (empty = don't update)
  const [blogKey, setBlogKey]                 = useState('');
  const [sbAnonKey, setSbAnonKey]             = useState('');
  const [sbServiceKey, setSbServiceKey]       = useState('');
  // current state from server
  const [cfg, setCfg] = useState<BlogSettings | null>(null);
  type BlogPostRecord = { id: number; title: string; slug: string; category: string; tags: string[]; excerpt: string; published_at: string; url: string };
  const [blogPosts, setBlogPosts] = useState<BlogPostRecord[]>([]);

  useEffect(() => {
    aiCompanyApi.getBlogSettings().then(s => {
      setCfg(s);
      setBlogUrl(s.blog_api_url);
      setSiteUrl(s.site_url);
      setSbUrl(s.supabase_url);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyId) return;
    aiCompanyApi.getBlogPosts(companyId).then(setBlogPosts).catch(() => {});
  }, [companyId]);

  const isConnected = cfg?.blog_api_key_set && !!blogUrl;

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const payload: Parameters<typeof aiCompanyApi.updateBlogSettings>[0] = {
        blog_api_url: blogUrl, site_url: siteUrl, supabase_url: sbUrl,
      };
      if (blogKey.trim())     payload.blog_api_key = blogKey.trim();
      if (sbAnonKey.trim())   payload.supabase_anon_key = sbAnonKey.trim();
      if (sbServiceKey.trim()) payload.supabase_service_role_key = sbServiceKey.trim();
      await aiCompanyApi.updateBlogSettings(payload);
      // refresh
      const fresh = await aiCompanyApi.getBlogSettings();
      setCfg(fresh);
      setBlogKey(''); setSbAnonKey(''); setSbServiceKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const r = await aiCompanyApi.testBlogConnection();
      setTestResult(r);
    } catch {
      setTestResult({ ok: false, message: '요청 실패 — 백엔드 연결을 확인하세요' });
    }
    setTesting(false);
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 13px', borderRadius: 9, border: `1px solid ${T.line}`,
    font: font(400, 13.5, 1.5), color: T.ink, outline: 'none', width: '100%',
    background: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif',
  };

  const sectionStyle: React.CSSProperties = {
    background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22, marginBottom: 16,
  };

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ font: font(700, 18), color: T.ink, marginBottom: 3 }}>Automation & Integration</div>
          <div style={{ font: font(500, 13), color: T.ink3 }}>AI 블로그 자동 발행 설정 — 아래 값을 입력하고 저장하세요</div>
        </div>
        <span style={{
          font: font(600, 12), padding: '5px 14px', borderRadius: 20,
          background: isConnected ? T.okSoft : T.line2,
          color: isConnected ? T.ok : T.ink4,
        }}>{isConnected ? '● 연결됨' : '● 미연결'}</span>
      </div>

      {/* ① Vercel 배포 정보 */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <div style={{ font: font(700, 14), color: T.ink }}>Vercel 배포 정보</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              블로그 URL <span style={{ color: T.danger }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={blogUrl} onChange={e => setBlogUrl(e.target.value)}
                placeholder="https://your-blog.vercel.app"
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleTest} disabled={!blogUrl || testing} style={{
                padding: '0 16px', borderRadius: 9, border: 0, whiteSpace: 'nowrap', flexShrink: 0,
                cursor: blogUrl && !testing ? 'pointer' : 'not-allowed',
                background: testResult?.ok ? T.okSoft : testResult ? '#ffeae6' : T.accentSoft,
                color: testResult?.ok ? T.ok : testResult ? T.danger : T.accentInk,
                font: font(600, 12.5),
              }}>
                {testing ? '테스트 중...' : testResult?.ok ? '✓ 연결 성공' : testResult ? '✕ 실패' : '연결 테스트'}
              </button>
            </div>
            {testResult && (
              <div style={{ marginTop: 6, font: font(500, 12), color: testResult.ok ? T.ok : T.danger }}>
                {testResult.message}
              </div>
            )}
            <div style={{ marginTop: 4, font: font(500, 11), color: T.ink4 }}>Vercel 대시보드에서 확인. 예: https://ai-blog-xyz.vercel.app</div>
          </div>
          <div>
            <label style={{ display: 'block', font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>사이트 공개 URL (도메인 연결 시)</label>
            <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://autoblog.kr  (없으면 Vercel URL과 동일하게)"
              style={inputStyle} />
            <div style={{ marginTop: 4, font: font(500, 11), color: T.ink4 }}>NEXT_PUBLIC_SITE_URL 값. 도메인이 없으면 블로그 URL과 동일하게 입력</div>
          </div>
        </div>
      </div>

      {/* ② Blog API Key */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 20 }}>🔑</span>
          <div style={{ font: font(700, 14), color: T.ink }}>Blog API Key</div>
        </div>
        <SecretField
          label="BLOG_API_KEY" hint="블로그 .env.local의 BLOG_API_KEY 값. AI 에이전트가 포스트 발행 시 인증에 사용합니다."
          placeholder="BLOG_API_KEY 값을 입력하세요 (32자 이상 권장)"
          preview={cfg?.blog_api_key_preview ?? ''} isSet={cfg?.blog_api_key_set ?? false}
          value={blogKey} onChange={setBlogKey}
        />
      </div>

      {/* ③ Supabase 연결 정보 */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 20 }}>🗄️</span>
          <div>
            <div style={{ font: font(700, 14), color: T.ink }}>Supabase 연결 정보</div>
            <div style={{ font: font(500, 12), color: T.ink3 }}>Supabase 프로젝트 → Settings → API에서 복사</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Project URL <span style={{ color: T.danger }}>*</span></label>
            <input value={sbUrl} onChange={e => setSbUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              style={inputStyle} />
            <div style={{ marginTop: 4, font: font(500, 11), color: T.ink4 }}>NEXT_PUBLIC_SUPABASE_URL</div>
          </div>
          <SecretField
            label="Anon / Public Key" hint="NEXT_PUBLIC_SUPABASE_ANON_KEY — 블로그 공개 읽기에 사용"
            placeholder="eyJ..."
            preview={cfg?.supabase_anon_key_preview ?? ''} isSet={cfg?.supabase_anon_key_set ?? false}
            value={sbAnonKey} onChange={setSbAnonKey}
          />
          <SecretField
            label="Service Role Key" hint="SUPABASE_SERVICE_ROLE_KEY — AI 에이전트 포스팅 쓰기 권한. 외부에 노출 금지."
            placeholder="eyJ..."
            preview={cfg?.supabase_service_role_key_preview ?? ''} isSet={cfg?.supabase_service_role_key_set ?? false}
            value={sbServiceKey} onChange={setSbServiceKey}
          />
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '12px 28px', borderRadius: 10, border: 0, cursor: saving ? 'wait' : 'pointer',
          background: saved ? T.ok : `linear-gradient(135deg, ${T.accent}, #3b2bb5)`,
          color: '#fff', font: font(700, 14), transition: 'background 0.3s',
        }}>
          {saving ? '저장 중...' : saved ? '✓ 저장 완료' : '설정 저장'}
        </button>
        {saved && <span style={{ font: font(500, 12), color: T.ok }}>Vercel 환경변수는 별도로 대시보드에서도 설정하세요.</span>}
      </div>

      {/* How it works */}
      <div style={{ marginTop: 20, background: T.accentSoft, border: `1px solid ${T.accent}30`, borderRadius: 14, padding: 18 }}>
        <div style={{ font: font(700, 13), color: T.accentInk, marginBottom: 10 }}>📋 Vercel 환경변수 설정 가이드</div>
        <div style={{ font: font(500, 12, 1.8), color: T.accentInk }}>
          Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 아래 값들을 추가하세요:<br />
          <code style={{ fontFamily: 'monospace', background: `${T.accent}15`, padding: '1px 5px', borderRadius: 4 }}>NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          <code style={{ fontFamily: 'monospace', background: `${T.accent}15`, padding: '1px 5px', borderRadius: 4 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
          <code style={{ fontFamily: 'monospace', background: `${T.accent}15`, padding: '1px 5px', borderRadius: 4 }}>SUPABASE_SERVICE_ROLE_KEY</code>{' '}
          <code style={{ fontFamily: 'monospace', background: `${T.accent}15`, padding: '1px 5px', borderRadius: 4 }}>BLOG_API_KEY</code>{' '}
          <code style={{ fontFamily: 'monospace', background: `${T.accent}15`, padding: '1px 5px', borderRadius: 4 }}>NEXT_PUBLIC_SITE_URL</code>
        </div>
        <div style={{ marginTop: 10, font: font(500, 12, 1.7), color: T.accentInk }}>
          ① CEO → Content Director 태스크 지시 → ② Ollama로 포스트 생성 → ③ 위 URL/Key로 자동 POST → ④ 60초 이내 블로그 반영
        </div>
      </div>

      {/* ─ Published Posts List ─ */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ font: font(700, 16), color: T.ink }}>발행된 포스트</div>
          <span style={{ font: font(600, 12), color: T.ink4, background: T.line2, borderRadius: 20, padding: '3px 12px' }}>
            총 {blogPosts.length}개
          </span>
        </div>
        {blogPosts.length === 0 ? (
          <div style={{ background: T.line2, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✍️</div>
            <div style={{ font: font(600, 14), color: T.ink3 }}>아직 발행된 포스트가 없습니다</div>
            <div style={{ font: font(400, 12), color: T.ink4, marginTop: 4 }}>Content Director가 포스트를 작성하면 여기에 표시됩니다</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blogPosts.map(p => {
              const dateStr = (() => {
                try {
                  const d = new Date(p.published_at);
                  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch { return ''; }
              })();
              const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
                'AI & 자동화': { bg: '#efedff', fg: '#4a3bd4' },
                '개발':        { bg: '#e3f7ec', fg: '#18b86b' },
                '툴 리뷰':     { bg: '#fbf2d8', fg: '#e0a30a' },
                'IT 트렌드':   { bg: '#ffeae6', fg: '#e8553a' },
              };
              const cc = CATEGORY_COLORS[p.category] ?? { bg: T.line2, fg: T.ink3 };
              return (
                <div key={p.id} style={{
                  background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ font: font(600, 14, 1.4), color: T.ink, flex: 1 }}>{p.title}</div>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{
                        flexShrink: 0, padding: '4px 12px', borderRadius: 8,
                        background: T.accentSoft, color: T.accentInk,
                        font: font(600, 11), textDecoration: 'none',
                      }}>↗ 보기</a>
                    ) : (
                      <span style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 8, background: T.line2, color: T.ink4, font: font(500, 11) }}>
                        {p.slug ? `/${p.slug}` : '링크 없음'}
                      </span>
                    )}
                  </div>
                  {p.excerpt && (
                    <div style={{ font: font(400, 12, 1.6), color: T.ink3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.excerpt}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ font: font(600, 11), padding: '2px 9px', borderRadius: 20, background: cc.bg, color: cc.fg }}>
                      {p.category}
                    </span>
                    {p.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ font: font(400, 11), padding: '2px 8px', borderRadius: 20, background: T.line2, color: T.ink3 }}>
                        #{tag}
                      </span>
                    ))}
                    <span style={{ marginLeft: 'auto', font: mono(400, 11), color: T.ink4 }}>{dateStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Company Settings Panel ─────────────────────────────────── */
function SettingsPanel({ company, onUpdate }: { company: AICompany | null; onUpdate: (co: AICompany) => void }) {
  const [name, setName]       = useState(company?.name ?? '');
  const [goal, setGoal]       = useState(company?.goal ?? '');
  const [interval, setInterval] = useState(company?.cycle_interval_min ?? 30);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    if (company) { setName(company.name); setGoal(company.goal); setInterval(company.cycle_interval_min); }
  }, [company?.id]);

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    try {
      const updated = await aiCompanyApi.update(company.id, { name: name.trim(), goal: goal.trim(), cycle_interval_min: interval });
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.line}`,
    font: font(400, 14, 1.5), color: T.ink, outline: 'none', width: '100%',
    background: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif',
  };

  if (!company) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.ink4, font: font(500, 14) }}>
      먼저 AI 회사를 선택하세요.
    </div>
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 580 }}>
      <div style={{ font: font(700, 18), color: T.ink, marginBottom: 4 }}>회사 설정</div>
      <div style={{ font: font(500, 13), color: T.ink3, marginBottom: 28 }}>회사 정보와 AI 사이클 주기를 설정합니다.</div>

      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          { label: '회사명', value: name, onChange: setName, multiline: false, placeholder: '예: TechVenture AI' },
          { label: '회사 목표', value: goal, onChange: setGoal, multiline: true, placeholder: '예: AI 콘텐츠로 월 100만원 수익 달성' },
        ].map(f => (
          <div key={f.label}>
            <label style={{ display: 'block', font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{f.label}</label>
            {f.multiline ? (
              <textarea value={f.value} onChange={e => f.onChange(e.target.value)} rows={3} placeholder={f.placeholder}
                style={{ ...inputStyle, resize: 'vertical' }} />
            ) : (
              <input value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} style={inputStyle} />
            )}
          </div>
        ))}

        <div>
          <label style={{ display: 'block', font: font(600, 11), color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            사이클 주기 ({interval}분마다)
          </label>
          <input type="range" min={10} max={120} step={5} value={interval} onChange={e => setInterval(Number(e.target.value))}
            style={{ width: '100%', accentColor: T.accent }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: font(500, 11), color: T.ink4, marginTop: 4 }}>
            <span>10분</span><span>120분</span>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 20px', borderRadius: 10, border: 0, cursor: 'pointer',
          background: saved ? T.ok : `linear-gradient(135deg, ${T.accent}, #3b2bb5)`, color: '#fff',
          font: font(700, 13.5), alignSelf: 'flex-start', transition: 'background 0.3s',
        }}>
          {saving ? '저장 중...' : saved ? '✓ 저장 완료' : '저장하기'}
        </button>
      </div>

      <div style={{ marginTop: 20, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
        <div style={{ font: font(700, 14), color: T.ink, marginBottom: 14 }}>회사 정보</div>
        {[
          { label: '상태', value: company.status },
          { label: '총 사이클', value: `${company.cycle_count}회` },
          { label: '수익화 집중', value: company.focus },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.line2}` }}>
            <span style={{ font: font(500, 13), color: T.ink3 }}>{row.label}</span>
            <span style={{ font: font(600, 13), color: T.ink }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Shell ─────────────────────────────────────────────── */
export default function AICompanyShell() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [showSelector, setShowSelector]   = useState(false);
  const [activeNav, setActiveNav]         = useState('home');
  const [view, setView]                   = useState('Floor');
  const [showBubbles, setShowBubbles]     = useState(true);
  const [clock, setClock]                 = useState('');

  const [companies, setCompanies]         = useState<AICompany[]>([]);
  const [company, setCompany]             = useState<AICompany | null>(null);
  const [tasks, setTasks]                 = useState<AICompanyTask[]>([]);
  const [feedMessages, setFeedMessages]   = useState<ReturnType<typeof logToFeed>[]>([]);
  const [stats, setStats]                 = useState<AICompanyStats | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Live clock
  useEffect(() => {
    function tick() {
      const n = new Date();
      setClock(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Load companies
  useEffect(() => {
    aiCompanyApi.list().then(list => {
      setCompanies(list);
      if (list.length > 0) setCompany(list[0]);
    }).catch(() => {});
  }, []);

  // On company change: load data + WebSocket
  useEffect(() => {
    if (!company) return;
    aiCompanyApi.tasks(company.id).then(setTasks).catch(() => {});
    aiCompanyApi.logs(company.id, 40).then(logs => setFeedMessages(logs.reverse().map(logToFeed))).catch(() => {});
    aiCompanyApi.stats(company.id).then(setStats).catch(() => {});

    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(getWsUrl(`/api/ai-company/${company.id}/ws`));
    wsRef.current = ws;
    ws.onopen = () => {
      const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping'); }, 20000);
      ws.addEventListener('close', () => clearInterval(ping));
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'log') {
          const msg = { id: String(data.id ?? Date.now()), agent: data.agent_name ?? data.agent_role, agentColor: data.agent_color ?? T.accent, message: (data.content ?? '').slice(0, 300), timestamp: format(new Date(), 'HH:mm') };
          setFeedMessages(prev => [...prev, msg].slice(-80));
          if (['result', 'action'].includes(data.log_type)) {
            aiCompanyApi.tasks(company.id).then(setTasks).catch(() => {});
            aiCompanyApi.stats(company.id).then(setStats).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    };
    return () => { ws.close(); };
  }, [company?.id]);

  // 30s polling
  useEffect(() => {
    if (!company) return;
    const timer = setInterval(() => {
      aiCompanyApi.get(company.id).then(u => { setCompany(u); setCompanies(prev => prev.map(c => c.id === u.id ? u : c)); }).catch(() => {});
      aiCompanyApi.stats(company.id).then(setStats).catch(() => {});
      aiCompanyApi.tasks(company.id).then(setTasks).catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [company?.id]);

  const handleSelectAgent = useCallback((agent: Agent) => { setSelectedAgent(agent); }, []);

  async function handleStart() {
    if (!company) return;
    try {
      await aiCompanyApi.start(company.id);
      const updated = { ...company, status: 'running' as const };
      setCompany(updated);
      setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch { /* ignore */ }
  }

  async function handlePause() {
    if (!company) return;
    try {
      await aiCompanyApi.pause(company.id);
      const updated = { ...company, status: 'paused' as const };
      setCompany(updated);
      setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch { /* ignore */ }
  }

  function handleCompanyCreated(co: AICompany) {
    setCompanies(prev => [co, ...prev]);
    setCompany(co); setShowCreate(false);
  }

  const runningTitles = stats?.running_task_titles ?? {};
  const realAgents = buildAgents(stats, runningTitles);
  const workflowItems = tasks.slice(0, 8).map(taskToWorkflow);
  const agentsOnline = (stats?.busy_roles.length ?? 0) + (stats?.pending_roles.length ?? 0);
  const activeAgentCount = realAgents.filter(a => a.status !== 'away').length;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '232px 1fr 360px',
      gridTemplateRows: '64px 1fr',
      height: '100vh',
      background: T.bg,
      color: T.ink,
      fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
      lineHeight: 1.45,
      WebkitFontSmoothing: 'antialiased',
      minWidth: 1100,
    }}>
      <style>{`
        @keyframes wave {
          0%, 100% { height: 30%; opacity: 0.55; }
          50% { height: 100%; opacity: 1; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <TopBar
        company={company}
        companies={companies}
        onOpenSelector={() => setShowSelector(true)}
        onCreateCompany={() => setShowCreate(true)}
        onStart={handleStart}
        onPause={handlePause}
      />

      <LeftNav activeNav={activeNav} onPick={id => { setActiveNav(id); if (id === 'home') setSelectedAgent(null); }} agentsOnline={agentsOnline} />

      {/* ── Center: view-switched ── */}
      <main style={{
        gridColumn: 2, gridRow: 2,
        display: 'flex', flexDirection: 'column',
        minWidth: 0, overflow: 'hidden',
        background: activeNav === 'home' ? 'transparent' : T.bg,
        padding: activeNav === 'home' ? '14px 14px 0' : 0,
        gap: 12,
      }}>
        {/* ─ Home: Office floor plan ─ */}
        {activeNav === 'home' && (
          <div style={{
            flex: 1, position: 'relative', borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${T.line}`,
            background: `radial-gradient(60% 60% at 50% 0%, rgba(109,91,255,0.04), transparent 70%), ${T.floor}`,
            boxShadow: '0 1px 0 rgba(20,18,30,0.04), 0 6px 24px -10px rgba(20,18,30,0.12)',
            minHeight: 0,
          }}>
            <OfficeToolbar view={view} setView={setView} showBubbles={showBubbles} setShowBubbles={setShowBubbles} />
            <div style={{
              position: 'absolute', top: 14, right: 14,
              display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 12px',
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(20,18,30,0.06)', borderRadius: 8,
              font: mono(600, 12), color: T.ink2, zIndex: 4,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.danger, animation: 'pulse 1.6s ease-in-out infinite', display: 'inline-block' }} />
              {clock} · {activeAgentCount} active
            </div>
            {company ? (
              <MetaverseMap
                selectedAgentId={selectedAgent?.id ?? null}
                onSelectAgent={handleSelectAgent}
                agents={realAgents}
                showBubbles={showBubbles}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: T.accentSoft, display: 'grid', placeItems: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3.5 13.5 9 19 10.5 13.5 12 12 17.5 10.5 12 5 10.5 10.5 9 12 3.5Z" />
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ font: font(700, 16), color: T.ink }}>AI 회사를 설립하세요</div>
                  <div style={{ font: font(500, 13.5, 1.5), color: T.ink3, marginTop: 6, maxWidth: 340 }}>목표를 입력하면 AI 에이전트들이 24/7 자동으로 수익화 작업을 실행합니다.</div>
                </div>
                <button onClick={() => setShowCreate(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, border: 0,
                  background: `linear-gradient(135deg, ${T.accent}, #3b2bb5)`, color: '#fff', font: font(700, 14), cursor: 'pointer',
                }}>✦ AI 회사 설립하기</button>
              </div>
            )}
            <CommandBar
              companyId={company?.id}
              onCommand={msg => {
                setFeedMessages(prev => [...prev, { id: String(Date.now()), agent: 'You', agentColor: '#b97c47', message: msg, timestamp: format(new Date(), 'HH:mm') }]);
              }}
              onQuickAction={preview => {
                setFeedMessages(prev => [...prev, { id: String(Date.now()), agent: 'System', agentColor: T.ok, message: preview, timestamp: format(new Date(), 'HH:mm') }]);
              }}
            />
          </div>
        )}

        {/* ─ Agents ─ */}
        {activeNav === 'agents' && (
          <div style={{ flex: 1, overflowY: 'auto', borderRadius: 14, border: `1px solid ${T.line}`, background: T.panel, margin: '14px 14px 0' }}>
            <AgentsPanel agents={realAgents} stats={stats} onSelect={agent => { setSelectedAgent(agent); setActiveNav('home'); }} />
          </div>
        )}

        {/* ─ Tasks ─ */}
        {activeNav === 'projects' && (
          <div style={{ flex: 1, overflowY: 'auto', borderRadius: 14, border: `1px solid ${T.line}`, background: T.panel, margin: '14px 14px 0' }}>
            <TasksPanel tasks={tasks} companyId={company?.id} />
          </div>
        )}

        {/* ─ Finance ─ */}
        {activeNav === 'finance' && (
          <div style={{ flex: 1, overflowY: 'auto', borderRadius: 14, border: `1px solid ${T.line}`, background: T.panel, margin: '14px 14px 0' }}>
            <FinancePanel stats={stats} companyId={company?.id} />
          </div>
        )}

        {/* ─ Automation / Blog settings ─ */}
        {activeNav === 'automation' && (
          <div style={{ flex: 1, overflowY: 'auto', borderRadius: 14, border: `1px solid ${T.line}`, background: T.panel, margin: '14px 14px 0' }}>
            <AutomationPanel companyId={company?.id} />
          </div>
        )}

        {/* ─ Company Settings ─ */}
        {activeNav === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto', borderRadius: 14, border: `1px solid ${T.line}`, background: T.panel, margin: '14px 14px 0' }}>
            <SettingsPanel company={company} onUpdate={co => { setCompany(co); setCompanies(prev => prev.map(c => c.id === co.id ? co : c)); }} />
          </div>
        )}
      </main>

      {/* ── Right Rail ── */}
      <aside style={{
        gridColumn: 3, gridRow: 2,
        borderLeft: `1px solid ${T.line}`,
        background: T.panel,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <RightDashboard
          feedMessages={feedMessages}
          workflowItems={workflowItems}
          stats={stats ?? undefined}
          onSendMessage={msg => {
            if (company) aiCompanyApi.sendMessage(company.id, msg, 'message').catch(() => {});
            setFeedMessages(prev => [...prev, { id: String(Date.now()), agent: 'You', agentColor: '#b97c47', message: msg, timestamp: format(new Date(), 'HH:mm') }]);
          }}
          selectedAgent={selectedAgent ?? undefined}
          companyId={company?.id}
          onCloseAgent={() => setSelectedAgent(null)}
          tasks={tasks}
        />
      </aside>

      {/* Modals */}
      {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} onCreate={handleCompanyCreated} />}
      {showSelector && (
        <CompanySelectorModal
          companies={companies} selected={company}
          onSelect={c => setCompany(c)}
          onCreate={() => { setShowSelector(false); setShowCreate(true); }}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  );
}
