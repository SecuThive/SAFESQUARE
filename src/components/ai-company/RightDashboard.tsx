'use client';

import { useState } from 'react';
import type { AICompanyStats, AICompanyTask } from '@/lib/api';
import type { Agent } from './mockData';
import { aiCompanyApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── Props ──────────────────────────────────────────────────── */
interface FeedMsg { id: string; agent: string; agentColor: string; message: string; timestamp: string; }
interface WorkflowItem { id: string; title: string; owner: string; department: string; status: string; }

interface Props {
  feedMessages: FeedMsg[];
  workflowItems?: WorkflowItem[];
  stats?: AICompanyStats;
  onSendMessage: (msg: string) => void;
  selectedAgent?: Agent | null;
  companyId?: number;
  onCloseAgent?: () => void;
  tasks?: AICompanyTask[];
}

/* ── Design tokens (local) ──────────────────────────────────── */
const T = {
  ink:  '#1b1a22', ink2: '#3a3845', ink3: '#6c697a', ink4: '#a09ead',
  line: '#ecebef', line2: '#f3f2f6',
  panel: '#ffffff', panel2: '#fbfaf7',
  accent: '#6d5bff', accentSoft: '#efedff', accentInk: '#4a3bd4',
  ok: '#18b86b', okSoft: '#e3f7ec',
  warn: '#e0a30a', warnSoft: '#fbf2d8',
  danger: '#e8553a', dangerSoft: '#fbe7e2',
};

const font = (weight: number, size: number, lh = 1) =>
  `${weight} ${size}px/${lh} "Plus Jakarta Sans", sans-serif`;
const mono = (weight: number, size: number) =>
  `${weight} ${size}px/1 "JetBrains Mono", monospace`;

/* ── Section shell ──────────────────────────────────────────── */
function Section({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      padding: '16px 16px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.line}`,
    }}>
      {children}
    </div>
  );
}

function SHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ font: font(700, 14), letterSpacing: '-0.01em', color: T.ink }}>{title}</div>
      {right}
    </div>
  );
}

/* ── Sparkline SVG ──────────────────────────────────────────── */
function Sparkline({ pts, color = '#18b86b', area = 'rgba(24,184,107,0.14)' }: { pts: number[]; color?: string; area?: string }) {
  const W = 130, H = 26;
  const max = Math.max(...pts), min = Math.min(...pts);
  const range = max - min || 1;
  const step = W / (pts.length - 1);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(H - ((v - min) / range) * (H - 4) - 2).toFixed(1)}`).join(' ');
  const fill = `${path} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg style={{ height: 26, marginTop: 8, width: '100%' }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={fill} fill={area} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── KPI Card ────────────────────────────────────────────────── */
function KPI({ label, value, delta, deltaUp = true, children }: {
  label: string; value: string; delta?: string; deltaUp?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, background: T.panel2, overflow: 'hidden' }}>
      <div style={{ font: font(500, 11.5), color: T.ink3, marginBottom: 6 }}>{label}</div>
      <div style={{ font: `700 22px/1.1 "Plus Jakarta Sans", sans-serif`, letterSpacing: '-0.02em', color: T.ink }}>{value}</div>
      {delta && (
        <div style={{ font: font(600, 11.5), marginTop: 4, color: deltaUp ? T.ok : T.danger }}>{delta}</div>
      )}
      {children}
    </div>
  );
}

/* ── Dept Performance ────────────────────────────────────────── */
const DEPT_CFG = [
  { id: 'marketing',   name: 'Marketing',   color: '#e873b2' },
  { id: 'content',     name: 'Content',     color: '#6d5bff' },
  { id: 'development', name: 'Development', color: '#6d5bff' },
  { id: 'research',    name: 'Research',    color: '#e0a30a' },
  { id: 'finance',     name: 'Finance',     color: '#2ea36e' },
];

/* ── Status badge ────────────────────────────────────────────── */
const STATUS_TONE: Record<string, { bg: string; color: string; label: string }> = {
  'in-progress': { bg: T.accentSoft, color: T.accentInk, label: 'In Progress' },
  'in-review':   { bg: T.warnSoft,   color: '#8a6308',   label: 'In Review' },
  'pending':     { bg: T.line2,      color: T.ink3,      label: 'Pending' },
  'done':        { bg: T.okSoft,     color: '#1a8f55',   label: 'Done' },
  'running':     { bg: T.accentSoft, color: T.accentInk, label: 'In Progress' },
  'failed':      { bg: T.dangerSoft, color: '#b73e26',   label: 'Failed' },
};

/* ── Notification tone ───────────────────────────────────────── */
const NOTIF_TONE: Record<string, { bg: string; color: string }> = {
  info:    { bg: T.accentSoft, color: T.accentInk },
  success: { bg: T.okSoft,     color: '#1a8f55' },
  warning: { bg: T.warnSoft,   color: '#8a6308' },
  error:   { bg: T.dangerSoft, color: '#b73e26' },
};

/* ── Agent detail (inline, slides over rail) ────────────────── */
function AgentDetail({ agent, tasks, companyId, onClose }: {
  agent: Agent; tasks: AICompanyTask[]; companyId?: number; onClose: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const mine = tasks.filter(t => t.agent_role === agent.id).slice(0, 4);
  const statusColor = agent.status === 'busy' ? T.warn : agent.status === 'online' ? T.ok : T.ink4;

  async function handleSend() {
    if (!msg.trim() || !companyId || !agent) return;
    setSending(true);
    try {
      await aiCompanyApi.sendMessage(companyId, `[${agent.name}에게] ${msg}`, 'message');
      setSent(true); setMsg('');
      setTimeout(() => setSent(false), 2000);
    } catch { /* ignore */ } finally { setSending(false); }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: T.panel,
      zIndex: 8,
      display: 'flex', flexDirection: 'column',
      animation: 'detailIn 0.25s ease both',
    }}>
      <style>{`@keyframes detailIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ font: mono(600, 11), color: T.ink4, letterSpacing: '0.04em' }}>AGENT · {agent.id.toUpperCase()}</span>
          <button onClick={onClose} style={{
            width: 32, height: 32, border: 0, borderRadius: 8,
            background: T.line2, color: T.ink2, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(160deg, ${agent.color}cc, ${agent.color})`,
            boxShadow: 'inset 0 -10px 16px rgba(0,0,0,0.18), 0 8px 18px -6px rgba(20,18,30,0.25)',
            position: 'relative',
          }}>
            <span style={{
              position: 'absolute', right: 1, bottom: 4,
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${T.panel}`,
              background: statusColor,
            }} />
          </div>
          <div>
            <div style={{ font: `800 19px/1.1 "Plus Jakarta Sans", sans-serif`, letterSpacing: '-0.015em', color: T.ink }}>{agent.name}</div>
            <div style={{ font: font(600, 12.5, 1.2), color: T.ink3, marginTop: 3 }}>{agent.role}</div>
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, font: font(600, 11.5), color: T.ink2, background: T.line2, padding: '4px 8px', borderRadius: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: agent.color, display: 'inline-block' }} />
              {agent.department}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: `1px solid ${T.line}` }}>
        {[
          { val: mine.length, lbl: 'Active tasks' },
          { val: agent.status === 'busy' ? '활성' : '대기', lbl: 'Status' },
          { val: agent.department.slice(0, 4), lbl: 'Dept' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 12px', borderRight: i < 2 ? `1px solid ${T.line}` : 'none', textAlign: 'center' }}>
            <div style={{ font: `700 18px/1 "Plus Jakarta Sans", sans-serif`, color: T.ink, letterSpacing: '-0.015em' }}>{s.val}</div>
            <div style={{ font: font(600, 10.5), color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto' }}>
        <div style={{ font: font(700, 12), color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>현재 작업</div>
        {mine.length === 0 && (
          <div style={{ font: font(500, 12.5), color: T.ink3, padding: '10px 0' }}>작업 없음</div>
        )}
        {mine.map(t => {
          const pct = t.status === 'done' ? 100 : t.status === 'running' ? 65 : 30;
          const barColor = t.status === 'done' ? T.ok : t.status === 'running' ? T.accent : T.warn;
          return (
            <div key={t.id} style={{
              display: 'flex', gap: 10, padding: 10, borderRadius: 9,
              background: T.panel2, border: `1px solid ${T.line}`, marginBottom: 6,
            }}>
              <div style={{ width: 3, borderRadius: 2, background: barColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ font: font(600, 12.5, 1.2), color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.title}</div>
                  <div style={{ font: mono(700, 12), color: T.ink2, flexShrink: 0, marginLeft: 8 }}>{pct}%</div>
                </div>
                <div style={{ font: font(500, 11.5), color: T.ink3, marginTop: 3 }}>{t.department}</div>
                <div style={{ height: 4, background: T.line2, borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: barColor }} />
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ font: font(700, 12), color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>현재 상태</div>
        <div style={{ font: font(500, 12.5, 1.4), color: T.ink2 }}>
          {agent.currentTask || '대기 중'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`${agent.name}에게 지시...`}
            style={{
              flex: 1, border: `1px solid ${T.line}`, borderRadius: 9,
              padding: '0 12px', height: 38, outline: 'none',
              font: font(500, 12.5), color: T.ink,
              background: T.line2,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!msg.trim() || sending}
            style={{
              height: 38, width: 38, border: 0, borderRadius: 9,
              background: T.accent, color: '#fff', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              opacity: !msg.trim() || sending ? 0.4 : 1,
            }}
          >
            {sent ? '✓' : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4 12 16-8-6 18-2.5-7L4 12Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Right Dashboard ────────────────────────────────────── */
export default function RightDashboard({ feedMessages, workflowItems = [], stats, onSendMessage, selectedAgent, companyId, onCloseAgent, tasks = [] }: Props) {
  const [draft, setDraft] = useState('');

  const tc = stats?.task_counts ?? { pending: 0, running: 0, done: 0, failed: 0 };
  const revenueMtd = stats?.revenue_mtd ?? 0;
  const agentsOnline = (stats?.busy_roles.length ?? 0) + (stats?.pending_roles.length ?? 0);
  const successRate = stats?.success_rate ?? 100;
  const notifications = stats?.notifications ?? [];
  const deptStats = stats?.dept_stats ?? {};

  function fmtRev(n: number) {
    if (n >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₩${(n / 1_000).toFixed(0)}K`;
    return n > 0 ? `₩${n.toLocaleString()}` : '₩0';
  }

  const revPts = revenueMtd > 0
    ? [0, revenueMtd * 0.15, revenueMtd * 0.3, revenueMtd * 0.5, revenueMtd * 0.65, revenueMtd * 0.82, revenueMtd]
    : [0, 0, 0, 0, 0, 0, 0];

  const taskPts = tc.done > 0
    ? [0, tc.done * 0.1, tc.done * 0.3, tc.done * 0.5, tc.done * 0.7, tc.done * 0.9, tc.done]
    : [0, 0, 0, 0, 0, 0, 0];

  function submitFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft('');
  }

  const rail: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    overflowY: 'auto',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    scrollbarWidth: 'thin',
  };

  return (
    <div style={rail}>
      {/* Agent detail overlay */}
      {selectedAgent && (
        <AgentDetail
          agent={selectedAgent}
          tasks={tasks}
          companyId={companyId}
          onClose={onCloseAgent ?? (() => {})}
        />
      )}

      {/* ── Company Overview / KPIs ── */}
      <Section>
        <SHead title="Company Overview" right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: font(600, 11), color: T.ok }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ok, boxShadow: `0 0 0 3px ${T.okSoft}`, display: 'inline-block' }} />
          Live
        </span>} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KPI label="Revenue (MTD)" value={fmtRev(revenueMtd)} delta={revenueMtd > 0 ? '+기록 중' : '데이터 없음'} deltaUp={revenueMtd > 0}>
            <Sparkline pts={revPts} color="#18b86b" area="rgba(24,184,107,0.14)" />
          </KPI>
          <KPI label="Active Tasks" value={String(tc.running + tc.pending)} delta={`+${tc.done} 완료`} deltaUp>
            <Sparkline pts={taskPts} color="#6d5bff" area="rgba(109,91,255,0.12)" />
          </KPI>
          <KPI label="Agents Online" value={`${agentsOnline}`}>
            <div style={{ display: 'flex', marginTop: 8, gap: -6 }}>
              {[T.accent + 'cc', T.ok + 'cc', T.warn + 'cc', T.danger + 'cc', '#9ee0bd'].slice(0, agentsOnline).map((c, i) => (
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${T.panel2}`,
                  background: `linear-gradient(160deg, ${c}, ${c.replace('cc', '60')})`,
                  marginLeft: i === 0 ? 0 : -6,
                }} />
              ))}
              {agentsOnline > 5 && (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.panel2}`,
                  background: '#fff', display: 'grid', placeItems: 'center', marginLeft: -6,
                  font: font(700, 10), color: T.ink2,
                }}>+{agentsOnline - 5}</div>
              )}
            </div>
          </KPI>
          <KPI label="Success Rate" value={`${successRate}%`} delta={successRate >= 80 ? 'Excellent' : successRate >= 60 ? 'Good' : 'Low'} deltaUp={successRate >= 60}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 8 }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} style={{
                  flex: 1, height: 14, borderRadius: 2,
                  background: i < Math.round(successRate / 100 * 14) ? T.ok : T.line,
                  opacity: i < Math.round(successRate / 100 * 14) ? (0.5 + i / 14 * 0.5) : 1,
                }} />
              ))}
            </div>
          </KPI>
        </div>
      </Section>

      {/* ── Department Performance ── */}
      <Section>
        <SHead title="Department Performance" right={
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: font(600, 11), color: T.ink3, background: T.line2, padding: '4px 8px', borderRadius: 6, border: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            This Week
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        } />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {DEPT_CFG.map(d => {
            const stat = deptStats[d.id];
            const pct = stat?.performance ?? 0;
            const label = stat ? `${stat.done}/${stat.total} 완료` : '작업 없음';
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: d.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
                  </svg>
                </div>
                <div style={{ font: font(600, 13), color: T.ink, minWidth: 72 }}>{d.name}</div>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.line2, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 3, background: d.color, transition: 'width 1s ease' }} />
                </div>
                <div style={{ font: mono(700, 12), color: T.ink2, minWidth: 32, textAlign: 'right' }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Workflow Queue ── */}
      <Section>
        <SHead title="Workflow Queue" right={<span style={{ font: font(600, 11.5), color: T.ink3, background: T.line2, padding: '4px 8px', borderRadius: 999 }}>{workflowItems.length}</span>} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {workflowItems.slice(0, 5).map((q, i) => {
            const tone = STATUS_TONE[q.status] ?? STATUS_TONE.pending;
            return (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < Math.min(workflowItems.length, 5) - 1 ? `1px dashed ${T.line}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.accentSoft, color: T.accentInk, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3.5h8L19 8.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-15.5A1.5 1.5 0 0 1 6.5 3.5Z" /><path d="M14 3.5V8.5h5" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: font(600, 12.5, 1.3), color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                  <div style={{ font: font(500, 11.5, 1.3), color: T.ink3, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />
                    {q.owner}
                  </div>
                </div>
                <div style={{ font: font(600, 11), padding: '3px 7px', borderRadius: 5, background: tone.bg, color: tone.color, whiteSpace: 'nowrap' }}>
                  {tone.label}
                </div>
              </div>
            );
          })}
          {workflowItems.length === 0 && (
            <div style={{ font: font(500, 12), color: T.ink4, padding: '8px 0', textAlign: 'center' }}>작업 없음</div>
          )}
        </div>
        {workflowItems.length > 5 && (
          <button style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, font: font(600, 12), color: T.accentInk, border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>
            전체 보기
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        )}
      </Section>

      {/* ── Notifications ── */}
      <Section>
        <SHead title="Notifications" right={<span style={{ font: font(600, 11.5), color: T.ink3, background: T.line2, padding: '4px 8px', borderRadius: 999 }}>{notifications.length}</span>} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notifications.length === 0 && (
            <div style={{ font: font(500, 12), color: T.ink4, textAlign: 'center', padding: '8px 0' }}>알림 없음</div>
          )}
          {notifications.slice(0, 4).map((n, i) => {
            const tone = NOTIF_TONE[n.type] ?? NOTIF_TONE.info;
            const ago = (() => { try { return formatDistanceToNow(new Date(n.time), { addSuffix: true, locale: ko }); } catch { return ''; } })();
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < Math.min(notifications.length, 4) - 1 ? `1px dashed ${T.line}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: tone.bg, color: tone.color, flexShrink: 0, fontSize: 15 }}>
                  {n.icon || '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: font(600, 12.5, 1.3), color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                  <div style={{ font: font(500, 11.5, 1.3), color: T.ink3, marginTop: 2 }}>{ago}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── AI Collaboration Feed ── */}
      <Section last>
        <SHead title="AI Collaboration Feed" right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: font(600, 11), color: T.ok }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ok, boxShadow: `0 0 0 3px ${T.okSoft}`, display: 'inline-block' }} />
            Live
          </span>
        } />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {feedMessages.slice(-6).map((f, i) => (
            <div key={f.id ?? i} style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(160deg, ${f.agentColor}cc, ${f.agentColor})`,
                boxShadow: 'inset 0 -4px 6px rgba(0,0,0,0.15)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ font: font(700, 12.5, 1.2), color: T.ink }}>{f.agent}</div>
                  <div style={{ font: mono(500, 11), color: T.ink4 }}>{f.timestamp}</div>
                </div>
                <div style={{ font: font(500, 12.5, 1.4), color: T.ink2, marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
                  {f.message}
                </div>
              </div>
            </div>
          ))}
          {feedMessages.length === 0 && (
            <div style={{ font: font(500, 12), color: T.ink4, textAlign: 'center', padding: '8px 0' }}>메시지 없음</div>
          )}
        </div>
        <form onSubmit={submitFeed} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: T.line2, border: `1px solid ${T.line}`, borderRadius: 9, padding: '4px 4px 4px 12px' }}>
          <input
            placeholder="Message agents..."
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: font(500, 12.5), color: T.ink }}
          />
          <button type="submit" aria-label="Send" style={{
            width: 30, height: 30, border: 0, borderRadius: 7,
            background: T.accent, color: '#fff',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 12 16-8-6 18-2.5-7L4 12Z" />
            </svg>
          </button>
        </form>
      </Section>
    </div>
  );
}
