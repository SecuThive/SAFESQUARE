'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Agent } from './mockData';

/* ── Room config ─────────────────────────────────────────────── */
const ROOMS = [
  { id: 'ceo',     label: 'CEO Office',   sub: 'Strategy & vision',      color: '#c69757', cls: 'ceo',     col: 1, row: 1 },
  { id: 'meet',    label: 'Meeting Room', sub: 'Cross-functional sync',   color: '#a78a45', cls: 'meet',    col: 2, row: 1 },
  { id: 'dev',     label: 'Development',  sub: 'Engineering · 1 agent',   color: '#5b8a4a', cls: 'dev',     col: 3, row: 1 },
  { id: 'content', label: 'Content Team', sub: '기획 · 작성 · 검토',       color: '#6078b8', cls: 'content', col: 1, row: 2 },
  { id: 'ops',     label: 'Ops & Revenue',sub: 'SEO · 수익 · 2 agents',   color: '#4f8170', cls: 'ops',     col: 2, row: 2 },
  { id: 'lounge',  label: 'Lounge',       sub: 'Break time',              color: '#7e9c6a', cls: 'lounge',  col: 3, row: 2 },
];

/* ── Furniture per room ─────────────────────────────────────── */
const FURN: Record<string, Array<{ type: string; l: number; t: number; w: number; h: number; radius?: number }>> = {
  ceo: [
    { type: 'rug',    l: 15, t: 30, w: 70, h: 55 },
    { type: 'wood',   l: 28, t: 48, w: 44, h: 18 },
    { type: 'screen', l: 40, t: 36, w: 20, h: 10 },
    { type: 'gray',   l: 35, t: 70, w: 30, h: 8 },
    { type: 'plant',  l: 10, t: 12, w: 12, h: 12 },
    { type: 'plant',  l: 80, t: 12, w: 12, h: 12 },
    { type: 'plant',  l: 8,  t: 78, w: 10, h: 10 },
    { type: 'plant',  l: 84, t: 80, w: 10, h: 10 },
  ],
  meet: [
    { type: 'rug',    l: 12, t: 22, w: 76, h: 65 },
    { type: 'wood',   l: 28, t: 36, w: 44, h: 28, radius: 999 },
    { type: 'gray',   l: 42, t: 44, w: 16, h: 12, radius: 999 },
    { type: 'plant',  l: 8,  t: 12, w: 10, h: 10 },
    { type: 'plant',  l: 84, t: 12, w: 10, h: 10 },
    { type: 'plant',  l: 6,  t: 76, w: 12, h: 12 },
    { type: 'plant',  l: 84, t: 78, w: 12, h: 12 },
  ],
  dev: [
    { type: 'rug',    l: 8, t: 22, w: 84, h: 68 },
    { type: 'wood',   l: 10, t: 38, w: 18, h: 10 },
    { type: 'wood',   l: 34, t: 38, w: 18, h: 10 },
    { type: 'wood',   l: 58, t: 38, w: 18, h: 10 },
    { type: 'wood',   l: 10, t: 78, w: 18, h: 10 },
    { type: 'wood',   l: 60, t: 78, w: 18, h: 10 },
    { type: 'screen', l: 14, t: 30, w: 10, h: 6 },
    { type: 'screen', l: 38, t: 30, w: 10, h: 6 },
    { type: 'screen', l: 62, t: 30, w: 10, h: 6 },
    { type: 'screen', l: 14, t: 70, w: 10, h: 6 },
    { type: 'screen', l: 64, t: 70, w: 10, h: 6 },
    { type: 'plant',  l: 80, t: 26, w: 10, h: 10 },
    { type: 'plant',  l: 84, t: 60, w: 10, h: 10 },
  ],
  mkt: [
    { type: 'rug',    l: 10, t: 26, w: 80, h: 60 },
    { type: 'wood',   l: 20, t: 60, w: 22, h: 12 },
    { type: 'wood',   l: 60, t: 60, w: 22, h: 12 },
    { type: 'screen', l: 24, t: 52, w: 14, h: 7 },
    { type: 'screen', l: 64, t: 52, w: 14, h: 7 },
    { type: 'plant',  l: 8,  t: 14, w: 10, h: 10 },
    { type: 'plant',  l: 84, t: 14, w: 10, h: 10 },
    { type: 'plant',  l: 6,  t: 80, w: 10, h: 10 },
  ],
  fin: [
    { type: 'rug',    l: 12, t: 22, w: 76, h: 66 },
    { type: 'wood',   l: 24, t: 54, w: 22, h: 12 },
    { type: 'wood',   l: 54, t: 54, w: 22, h: 12 },
    { type: 'screen', l: 28, t: 46, w: 14, h: 7 },
    { type: 'screen', l: 58, t: 46, w: 14, h: 7 },
    { type: 'gray',   l: 44, t: 18, w: 12, h: 10, radius: 50 },
    { type: 'plant',  l: 8,  t: 78, w: 10, h: 10 },
    { type: 'plant',  l: 82, t: 14, w: 10, h: 10 },
  ],
  lounge: [
    { type: 'rug',    l: 14, t: 28, w: 72, h: 60 },
    { type: 'green',  l: 18, t: 52, w: 30, h: 14 },
    { type: 'wood',   l: 50, t: 56, w: 16, h: 10, radius: 999 },
    { type: 'gray',   l: 80, t: 48, w: 10, h: 22, radius: 6 },
    { type: 'plant',  l: 8,  t: 14, w: 12, h: 12 },
    { type: 'plant',  l: 84, t: 80, w: 10, h: 10 },
    { type: 'plant',  l: 14, t: 80, w: 8,  h: 8 },
  ],
};

/* ── Furniture type → styles ─────────────────────────────────── */
function furnStyle(type: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    borderRadius: 4,
    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.25)',
  };
  switch (type) {
    case 'wood':   return { ...base, background: '#c8a878' };
    case 'green':  return { ...base, background: '#7e9c6a', borderRadius: '8px 8px 4px 4px' };
    case 'gray':   return { ...base, background: '#b6b1a7' };
    case 'screen': return { ...base, background: '#2a2740', borderRadius: 2, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.1)' };
    case 'plant':  return { ...base, background: 'radial-gradient(circle at 35% 35%, #6e8c4a 0 35%, #4f6b32 36%)', borderRadius: '50%', boxShadow: 'inset 0 -3px 4px rgba(0,0,0,0.18)' };
    case 'rug':    return { position: 'absolute', background: 'rgba(255,255,255,0.18)', borderRadius: 10, border: '1px dashed rgba(0,0,0,0.07)', boxShadow: 'none' };
    default:       return { ...base, background: 'rgba(60,50,40,0.18)' };
  }
}

/* ── Room tint colors ─────────────────────────────────────────── */
const ROOM_BG: Record<string, string> = {
  ceo: '#f1ebda', meet: '#ebe7d4', dev: '#dfe8d8',
  content: '#dde3f0', ops: '#dee5da', lounge: '#dbe6d1',
};

/* ── Agent position within each room ─────────────────────────── */
const AGENT_POS: Record<string, { rx: number; ry: number }> = {
  ceo:              { rx: 50, ry: 58 },
  content_planner:  { rx: 28, ry: 48 },
  content_writer:   { rx: 50, ry: 62 },
  content_reviewer: { rx: 72, ry: 48 },
  developer:        { rx: 50, ry: 52 },
  site_operator:    { rx: 35, ry: 55 },
  revenue_manager:  { rx: 65, ry: 55 },
};

/* ── Room map for agent room IDs ─────────────────────────────── */
const ROOM_MAP: Record<string, string> = {
  ceo: 'ceo', meet: 'meet', dev: 'dev',
  content: 'content',
  ops: 'ops', operations: 'ops', revenue: 'ops',
  lounge: 'lounge',
};

/* ── Ambient bubble messages ─────────────────────────────────── */
const AMBIENT_BUBBLES = [
  { id: 'ceo',              tag: 'thinking',  text: '다음 사이클 전략 수립 중 ✨' },
  { id: 'content_planner',  tag: 'planning',  text: '블로그 주제 기획 중 🧠' },
  { id: 'content_writer',   tag: 'writing',   text: '초안 작성 중... ✍️' },
  { id: 'content_reviewer', tag: 'review',    text: '콘텐츠 검토 & 품질 확인 🔍' },
  { id: 'developer',        tag: 'shipped',   text: '자동화 스크립트 배포 ✅' },
  { id: 'revenue_manager',  tag: 'insight',   text: 'AdSense CTR +14% 상승 📈' },
];

/* ── Status dot colors ───────────────────────────────────────── */
const STATUS_DOT: Record<string, string> = {
  online: '#18b86b', busy: '#e0a30a', away: '#a09ead', meeting: '#6d5bff',
};

/* ── Room tooltip ────────────────────────────────────────────── */
function RoomTooltip({ tip }: { tip: { room: typeof ROOMS[0]; x: number; y: number } | null }) {
  if (!tip) return null;
  return (
    <div style={{
      position: 'fixed', left: tip.x, top: tip.y,
      transform: 'translate(-50%, calc(-100% - 8px))',
      background: '#1b1a22', color: '#fff',
      padding: '10px 12px', borderRadius: 10,
      font: '500 12px/1.4 "Plus Jakarta Sans", sans-serif',
      zIndex: 50, minWidth: 180,
      boxShadow: '0 8px 20px -6px rgba(20,18,30,0.35)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{tip.room.label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: 11.5, marginBottom: 2 }}>
        <span>목적</span><span style={{ color: '#fff', fontWeight: 600 }}>{tip.room.sub.split(' · ')[0]}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: 11.5 }}>
        <span>상태</span><span style={{ color: '#7cffae', fontWeight: 600 }}>Active</span>
      </div>
    </div>
  );
}

/* ── Agent node ──────────────────────────────────────────────── */
function AgentNode({ agent, selected, onClick, showBubble }: {
  agent: Agent; selected: boolean;
  onClick: (a: Agent) => void;
  showBubble: { text: string; tag: string } | null;
}) {
  const pos = AGENT_POS[agent.id] ?? { rx: 50, ry: 50 };
  const dotColor = STATUS_DOT[agent.status] ?? STATUS_DOT.away;

  // Parse color gradient from agent.color
  const c1 = agent.color + 'cc';
  const c2 = agent.color;

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(agent); }}
      style={{
        position: 'absolute',
        left: `${pos.rx}%`, top: `${pos.ry}%`,
        transform: 'translate(-50%, -50%)',
        width: 36, height: 36,
        zIndex: 4, cursor: 'pointer',
      }}
      className="agent-node"
    >
      {/* Speech bubble */}
      {showBubble && (
        <div style={{
          position: 'absolute',
          left: '50%', top: -10,
          transform: 'translate(-50%, -100%)',
          background: '#fff',
          border: '1px solid #ecebef',
          borderRadius: 12,
          padding: '8px 11px',
          fontSize: 12,
          color: '#1b1a22',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px -6px rgba(20,18,30,0.18)',
          zIndex: 6,
          animation: 'bubPop 0.35s ease both',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}>
          {showBubble.tag && (
            <span style={{ display: 'block', font: '600 10px/1 "JetBrains Mono", monospace', color: '#6c697a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
              {showBubble.tag}
            </span>
          )}
          {showBubble.text}
          <span style={{
            position: 'absolute', left: 14, bottom: -6,
            width: 10, height: 10,
            background: '#fff',
            borderRight: '1px solid #ecebef',
            borderBottom: '1px solid #ecebef',
            transform: 'rotate(45deg)',
          }} />
        </div>
      )}

      {/* Body circle */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        background: `linear-gradient(160deg, ${c1}, ${c2})`,
        boxShadow: selected
          ? `0 0 0 3px #fff, 0 0 0 5px #6d5bff, inset 0 -6px 10px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.2)`
          : 'inset 0 -6px 10px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.2), 0 6px 12px -4px rgba(20,18,30,0.25)',
        transition: 'transform 0.2s ease',
      }} className="agent-body" />

      {/* Eyes */}
      <div style={{ position: 'absolute', inset: '22% 18% 30% 18%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1b1a22', boxShadow: '0 1px 0 rgba(255,255,255,0.3)' }} />
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1b1a22', boxShadow: '0 1px 0 rgba(255,255,255,0.3)' }} />
      </div>

      {/* Status dot */}
      <div style={{
        position: 'absolute', right: -2, top: -2,
        width: 11, height: 11, borderRadius: '50%',
        background: dotColor,
        border: '2px solid #fff',
      }} />

      {/* Name label */}
      <div className="agent-name" style={{
        position: 'absolute',
        top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)',
        font: '600 10.5px/1 "Plus Jakarta Sans", sans-serif',
        color: '#1b1a22',
        background: 'rgba(255,255,255,0.85)',
        padding: '3px 7px', borderRadius: 5,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(20,18,30,0.05)',
        opacity: selected ? 1 : 0,
        transition: 'opacity 0.15s',
        pointerEvents: 'none',
      }}>
        {agent.name}
      </div>
    </div>
  );
}

/* ── Room ────────────────────────────────────────────────────── */
function RoomBox({ room, agents, selectedId, onPick, onTooltip }: {
  room: typeof ROOMS[0];
  agents: Agent[];
  selectedId: string | null;
  onPick: (a: Agent) => void;
  onTooltip: (t: { room: typeof ROOMS[0]; x: number; y: number } | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [bubbleIdx, setBubbleIdx] = useState<Record<string, { text: string; tag: string } | null>>({});

  const onEnter = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) onTooltip({ room, x: r.left + r.width / 2, y: r.top });
  };

  const furniture = FURN[room.id] ?? [];

  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={() => onTooltip(null)}
      style={{
        gridColumn: `${room.col} / span 1`,
        gridRow: `${room.row} / span 1`,
        position: 'relative',
        borderRadius: 14,
        background: ROOM_BG[room.id],
        border: '1px solid rgba(20,18,30,0.05)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 1px 0 rgba(255,255,255,0.6)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
      className="room-box"
    >
      {/* Texture overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 14px), radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.35), transparent 60%)',
      }} />

      {/* Room label */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 9px 5px 7px',
        background: 'rgba(27,26,34,0.86)',
        color: '#fff', borderRadius: 7,
        font: '600 11px/1 "Plus Jakarta Sans", sans-serif',
        zIndex: 3, backdropFilter: 'blur(8px)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: room.color, display: 'inline-block', boxShadow: '0 0 0 2px rgba(255,255,255,0.18)' }} />
        {room.label}
      </div>

      {/* Agent count */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        font: '500 10.5px/1 "JetBrains Mono", monospace',
        color: 'rgba(27,26,34,0.55)',
        zIndex: 3,
      }}>
        {agents.length > 0 ? `${agents.length} agents` : ''}
      </div>

      {/* Furniture */}
      {furniture.map((d, i) => (
        <div key={i} style={{
          ...furnStyle(d.type),
          left: `${d.l}%`, top: `${d.t}%`,
          width: `${d.w}%`, height: `${d.h}%`,
          ...(d.radius != null ? { borderRadius: d.radius } : {}),
        }} />
      ))}

      {/* Agents */}
      {agents.map(a => (
        <AgentNode
          key={a.id}
          agent={a}
          selected={selectedId === a.id}
          onClick={onPick}
          showBubble={bubbleIdx[a.id] ?? null}
        />
      ))}
    </div>
  );
}

/* ── Main Map ────────────────────────────────────────────────── */
interface MapProps {
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  agents?: Agent[];
  showBubbles?: boolean;
}

export default function MetaverseMap({ selectedAgentId, onSelectAgent, agents = [], showBubbles = true }: MapProps) {
  const [tip, setTip] = useState<{ room: typeof ROOMS[0]; x: number; y: number } | null>(null);
  const [pulse, setPulse] = useState<Record<string, { text: string; tag: string } | null>>({});

  // Group agents by room
  const byRoom = useMemo(() => {
    const g: Record<string, Agent[]> = {};
    agents.forEach(a => {
      const roomId = ROOM_MAP[a.room] ?? a.room;
      if (!g[roomId]) g[roomId] = [];
      g[roomId].push(a);
    });
    return g;
  }, [agents]);

  // Ambient bubble loop
  useEffect(() => {
    if (!showBubbles) { setPulse({}); return; }
    let i = 0;
    const tick = setInterval(() => {
      const src = agents.length > 0
        ? agents.map(a => {
            const pos = AMBIENT_BUBBLES.find(b => b.id === a.id);
            return pos ? { ...pos, text: a.currentTask ? a.currentTask.slice(0, 35) : pos.text } : null;
          }).filter(Boolean)
        : AMBIENT_BUBBLES;
      if (src.length === 0) return;
      const next = src[i % src.length];
      if (next) setPulse({ [next.id]: { text: next.text, tag: next.tag } });
      i++;
    }, 4200);
    return () => clearInterval(tick);
  }, [showBubbles, agents]);

  return (
    <>
      <style>{`
        .agent-node:hover .agent-body { transform: scale(1.1); }
        .agent-node:hover .agent-name { opacity: 1 !important; }
        .room-box:hover { transform: translateY(-1px); box-shadow: 0 6px 24px -8px rgba(20,18,30,0.15), inset 0 0 0 1px rgba(255,255,255,0.6); }
        @keyframes bubPop {
          from { opacity: 0; transform: translate(-50%, -90%); }
          to   { opacity: 1; transform: translate(-50%, -100%); }
        }
      `}</style>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1.4fr 1.4fr',
        gridTemplateRows: '1fr 1fr',
        gap: 10,
        padding: '56px 14px 86px',
      }}>
        {ROOMS.map(room => (
          <RoomBox
            key={room.id}
            room={room}
            agents={byRoom[room.id] ?? []}
            selectedId={selectedAgentId}
            onPick={onSelectAgent}
            onTooltip={setTip}
          />
        ))}
      </div>

      <RoomTooltip tip={tip} />
    </>
  );
}
