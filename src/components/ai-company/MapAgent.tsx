'use client';

/**
 * Top-down 2D character figure — ZEP / Gather Town style.
 * Each agent gets: hair (styled + colored) · skin-tone face · eyes · mouth
 *                  body/torso · accessory (crown, glasses, headset, tie…)
 *                  status dot · idle-bob animation · speech bubble
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Agent } from './mockData';

// ─── Per-agent character traits ────────────────────────────────────
type HairStyle   = 'short' | 'medium' | 'long' | 'spiky' | 'bun';
type Accessory   = 'none' | 'crown' | 'glasses' | 'roundGlasses' | 'headset' | 'tie';
interface Traits {
  hairStyle : HairStyle;
  accessory : Accessory;
  skin      : string;
}
const TRAITS: Record<string, Traits> = {
  ceo:       { hairStyle: 'short',  accessory: 'crown',        skin: '#FDDBB4' },
  strategy:  { hairStyle: 'medium', accessory: 'glasses',      skin: '#F0C8A0' },
  dev:       { hairStyle: 'spiky',  accessory: 'roundGlasses', skin: '#FDDBB4' },
  dev2:      { hairStyle: 'short',  accessory: 'none',         skin: '#C68642' },
  marketing: { hairStyle: 'long',   accessory: 'none',         skin: '#FDDBB4' },
  content:   { hairStyle: 'bun',    accessory: 'none',         skin: '#FDDBB4' },
  finance:   { hairStyle: 'short',  accessory: 'tie',          skin: '#F0C8A0' },
  support:   { hairStyle: 'medium', accessory: 'headset',      skin: '#FDDBB4' },
  hr:        { hairStyle: 'bun',    accessory: 'glasses',      skin: '#C68642' },
  research:  { hairStyle: 'medium', accessory: 'roundGlasses', skin: '#FDDBB4' },
};

const STATUS_CLR: Record<string, string> = {
  online: '#10b981',
  busy:   '#f59e0b',
  away:   '#9ca3af',
};

function bobDelay(id: string) {
  return ((id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 10) * 0.25;
}

// ─── Hair ─────────────────────────────────────────────────────────
function Hair({ style, color, hairStyle }: {
  style: HairStyle; color: string; hairStyle: HairStyle;
}) {
  const base: CSSProperties = {
    position: 'absolute',
    left: '50%', transform: 'translateX(-50%)',
    background: color,
    zIndex: 5,
  };

  if (hairStyle === 'short') return (
    <div style={{ ...base, top: -1, width: 30, height: 16, borderRadius: '50% 50% 0 0' }} />
  );

  if (hairStyle === 'medium') return (
    <>
      <div style={{ ...base, top: -2, width: 34, height: 18, borderRadius: '50% 50% 0 0' }} />
      {/* side wisps */}
      <div style={{ ...base, top: 8, left: '0%', transform: 'none', width: 5, height: 14, borderRadius: '3px 0 0 6px', background: color }} />
      <div style={{ ...base, top: 8, right: '0%', left: 'auto', transform: 'none', width: 5, height: 14, borderRadius: '0 3px 6px 0', background: color }} />
    </>
  );

  if (hairStyle === 'long') return (
    <>
      <div style={{ ...base, top: -2, width: 36, height: 20, borderRadius: '50% 50% 0 0' }} />
      {/* long side drapes */}
      <div style={{ position: 'absolute', top: 10, left: -2, width: 6, height: 24, background: color, borderRadius: '4px 0 4px 4px', zIndex: 4 }} />
      <div style={{ position: 'absolute', top: 10, right: -2, width: 6, height: 24, background: color, borderRadius: '0 4px 4px 4px', zIndex: 4 }} />
    </>
  );

  if (hairStyle === 'spiky') return (
    <>
      {/* spiky top using clip-path */}
      <div style={{
        ...base, top: -5, width: 32, height: 18,
        background: color,
        clipPath: 'polygon(0% 100%, 0% 55%, 15% 5%, 28% 55%, 42% 0%, 56% 55%, 70% 8%, 84% 55%, 100% 45%, 100% 100%)',
      }} />
      {/* base cap to fill gaps */}
      <div style={{ ...base, top: 8, width: 30, height: 10, borderRadius: '0 0 0 0' }} />
    </>
  );

  if (hairStyle === 'bun') return (
    <>
      <div style={{ ...base, top: 0, width: 30, height: 14, borderRadius: '50% 50% 0 0' }} />
      {/* bun on top */}
      <div style={{
        position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
        width: 12, height: 12, borderRadius: '50%',
        background: color,
        border: `1.5px solid ${color}cc`,
        zIndex: 6,
      }} />
    </>
  );

  return null;
}

// ─── Face features ─────────────────────────────────────────────────
function Eyes({ facing = 'down' }: { facing?: string }) {
  return (
    <>
      <div style={{
        position: 'absolute', top: '52%', left: '22%',
        width: 5, height: 5, borderRadius: '50%', background: '#1f2937', zIndex: 10,
      }} />
      <div style={{
        position: 'absolute', top: '52%', right: '22%',
        width: 5, height: 5, borderRadius: '50%', background: '#1f2937', zIndex: 10,
      }} />
      {/* eye shine */}
      <div style={{ position: 'absolute', top: '50%', left: '23%', width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', zIndex: 11 }} />
      <div style={{ position: 'absolute', top: '50%', right: '23%', width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', zIndex: 11 }} />
    </>
  );
}

function Mouth({ mood }: { mood: string }) {
  if (mood === 'happy' || mood === 'excited') return (
    <div style={{
      position: 'absolute', bottom: '18%', left: '50%', transform: 'translateX(-50%)',
      width: 10, height: 5, zIndex: 10,
      borderBottom: '2px solid #92400e',
      borderLeft: '1px solid #92400e',
      borderRight: '1px solid #92400e',
      borderRadius: '0 0 6px 6px',
    }} />
  );
  if (mood === 'focused') return (
    <div style={{
      position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
      width: 8, height: 2, background: '#92400e', borderRadius: 2, zIndex: 10,
    }} />
  );
  return (
    <div style={{
      position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
      width: 8, height: 2, background: '#c8966a', borderRadius: 2, zIndex: 10,
    }} />
  );
}

// ─── Accessories ───────────────────────────────────────────────────
function Crown({ color }: { color: string }) {
  return (
    <div style={{
      position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
      width: 22, height: 10, zIndex: 20,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2,
    }}>
      {/* three crown points */}
      {[6, 9, 6].map((h, i) => (
        <div key={i} style={{
          width: 0, height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderBottom: `${h}px solid #fbbf24`,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
        }} />
      ))}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: '#fbbf24', borderRadius: '0 0 2px 2px',
      }} />
    </div>
  );
}

function Glasses({ round = false }: { round?: boolean }) {
  const frameColor = '#4b5563';
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      width: 24, height: 8, display: 'flex', alignItems: 'center', gap: 1.5, zIndex: 12,
    }}>
      {/* left lens */}
      <div style={{
        width: 9, height: round ? 9 : 7,
        border: `1.5px solid ${frameColor}`,
        borderRadius: round ? '50%' : 2,
        background: 'rgba(186,230,253,0.25)',
        flexShrink: 0,
      }} />
      {/* bridge */}
      <div style={{ width: 3, height: 1.5, background: frameColor, flexShrink: 0 }} />
      {/* right lens */}
      <div style={{
        width: 9, height: round ? 9 : 7,
        border: `1.5px solid ${frameColor}`,
        borderRadius: round ? '50%' : 2,
        background: 'rgba(186,230,253,0.25)',
        flexShrink: 0,
      }} />
    </div>
  );
}

function Headset({ color }: { color: string }) {
  return (
    <>
      {/* headband arc */}
      <div style={{
        position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 28, height: 14,
        border: `2px solid ${color}`,
        borderBottom: 'none',
        borderRadius: '14px 14px 0 0',
        zIndex: 12,
      }} />
      {/* earpiece */}
      <div style={{
        position: 'absolute', top: 8, right: -3,
        width: 7, height: 9,
        background: color,
        borderRadius: 3,
        zIndex: 12,
      }} />
      {/* mic arm */}
      <div style={{
        position: 'absolute', top: 14, right: 2,
        width: 2, height: 10,
        background: color,
        borderRadius: 1,
        transform: 'rotate(20deg)',
        zIndex: 12,
      }} />
      <div style={{
        position: 'absolute', top: 22, right: -1,
        width: 5, height: 5,
        background: color,
        borderRadius: '50%',
        zIndex: 12,
      }} />
    </>
  );
}

function Tie({ color }: { color: string }) {
  return (
    <div style={{
      position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
      width: 5, height: 10, zIndex: 8,
      background: '#dc2626',
      clipPath: 'polygon(20% 0%, 80% 0%, 100% 35%, 50% 100%, 0% 35%)',
    }} />
  );
}

// ─── Status dot + ping ─────────────────────────────────────────────
function StatusDot({ status, delay }: { status: string; delay: number }) {
  const color = STATUS_CLR[status] ?? '#9ca3af';
  return (
    <div style={{
      position: 'absolute', top: 3, right: -1,
      width: 10, height: 10, borderRadius: '50%',
      background: color, border: '2px solid #fff',
      boxShadow: `0 0 0 1px ${color}55`,
      zIndex: 15,
    }}>
      {status === 'online' && (
        <span style={{
          position: 'absolute', inset: -2, borderRadius: '50%',
          background: color, opacity: 0.5,
          animation: `statusPing 2s ${delay}s cubic-bezier(0,0,0.2,1) infinite`,
        }} />
      )}
    </div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────
function Bubble({ text }: { text: string }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      left: '50%', transform: 'translateX(-50%)',
      background: '#fff',
      border: '1.5px solid #e5e7eb',
      borderRadius: 9,
      padding: '4px 10px',
      fontSize: 10, fontWeight: 600, color: '#374151',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 14px rgba(0,0,0,0.13)',
      animation: 'bubblePop 0.22s ease forwards',
      zIndex: 50, pointerEvents: 'none', lineHeight: 1.5,
    }}>
      {text}
      {/* tail border */}
      <div style={{
        position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid #e5e7eb',
      }} />
      {/* tail fill */}
      <div style={{
        position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: '4px solid #fff',
      }} />
    </div>
  );
}

// ─── Full character ────────────────────────────────────────────────
interface Props {
  agent: Agent;
  onSelect: (agent: Agent) => void;
  selected: boolean;
  x: number;
  y: number;
  autoBubble?: boolean;
}

export default function MapAgent({ agent, onSelect, selected, x, y, autoBubble = false }: Props) {
  const [hovered, setHovered] = useState(false);
  const showBubble = autoBubble || hovered || selected;
  const traits = TRAITS[agent.id] ?? { hairStyle: 'short' as HairStyle, accessory: 'none' as Accessory, skin: '#FDDBB4' };
  const delay = bobDelay(agent.id);

  return (
    <div
      style={{
        position: 'absolute', left: x, top: y,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', zIndex: 20, userSelect: 'none',
        animation: selected || hovered ? 'none' : `agentBob 2.4s ease-in-out ${delay}s infinite`,
        transform: selected || hovered ? 'translateY(-5px)' : undefined,
        transition: 'transform 0.18s ease',
      }}
      onClick={() => onSelect(agent)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* speech bubble */}
      {showBubble && <Bubble text={agent.message} />}

      {/* ── character figure: w=38, h=52 ── */}
      <div style={{ position: 'relative', width: 38, height: 52 }}>

        {/* ground shadow */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 28, height: 7, background: 'rgba(0,0,0,0.15)',
          borderRadius: '50%', filter: 'blur(3px)',
        }} />

        {/* hair (behind head so hair-overflow shows, z adjusted per style) */}
        <Hair style={traits.hairStyle} color={agent.color} hairStyle={traits.hairStyle} />

        {/* head / face */}
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 30, height: 30, borderRadius: '50%',
          background: traits.skin,
          border: selected
            ? '2.5px solid #7c3aed'
            : `1.5px solid ${darken(traits.skin)}`,
          boxShadow: selected
            ? `0 0 0 3px #7c3aed33, 0 4px 12px rgba(0,0,0,0.25)`
            : '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 7,
          animation: selected ? 'glowPulse 1.8s ease-in-out infinite' : 'none',
          transition: 'box-shadow 0.18s ease, border-color 0.18s ease',
        }}>
          <Eyes />
          <Mouth mood={agent.mood} />
        </div>

        {/* accessories (rendered over face at z=12+) */}
        {traits.accessory === 'crown'        && <Crown color={agent.color} />}
        {traits.accessory === 'glasses'      && <Glasses round={false} />}
        {traits.accessory === 'roundGlasses' && <Glasses round={true} />}
        {traits.accessory === 'headset'      && <Headset color={agent.color} />}

        {/* status dot (top-right of head) */}
        <StatusDot status={agent.status} delay={delay} />

        {/* body / torso */}
        <div style={{
          position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)',
          width: 22, height: 16,
          background: agent.color + 'dd',
          borderRadius: '3px 3px 6px 6px',
          border: `1.5px solid ${agent.color}`,
          zIndex: 6,
          boxShadow: `0 2px 6px ${agent.color}44`,
        }}>
          {traits.accessory === 'tie' && <Tie color={agent.color} />}
        </div>

      </div>

      {/* name badge */}
      <div style={{
        marginTop: 3,
        background: selected ? '#4c1d95' : '#1f2937',
        color: '#f9fafb', fontSize: 8, fontWeight: 700,
        padding: '2px 7px', borderRadius: 4,
        whiteSpace: 'nowrap', letterSpacing: '0.04em',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        transition: 'background 0.15s ease',
        zIndex: 3,
      }}>
        {agent.name}
      </div>
    </div>
  );
}

/** Darken a hex color slightly for border use */
function darken(hex: string): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - 30);
    const g = Math.max(0, ((n >> 8) & 0xff) - 30);
    const b = Math.max(0, (n & 0xff) - 30);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}
