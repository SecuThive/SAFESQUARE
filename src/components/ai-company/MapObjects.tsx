'use client';
import type { CSSProperties } from 'react';

// ─── Desk ────────────────────────────────────────────────────────
export function Desk({ w = 60, h = 28, dark = false, style }: {
  w?: number; h?: number; dark?: boolean; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', width: w, height: h,
      background: dark
        ? 'linear-gradient(135deg,#4a3728,#6b4f3a)'
        : 'linear-gradient(160deg,#eedcb8,#d4b896)',
      borderRadius: 4,
      border: `1.5px solid ${dark ? '#3a2a1e' : '#c49a66'}`,
      boxShadow: '1px 2px 5px rgba(0,0,0,0.18)',
      ...style,
    }} />
  );
}

// ─── Executive Desk ──────────────────────────────────────────────
export function ExecutiveDesk({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 100, height: 38,
      background: 'linear-gradient(160deg,#7c4a1e,#5c3311)',
      borderRadius: 5,
      border: '2px solid #4a2810',
      boxShadow: '2px 3px 8px rgba(0,0,0,0.25)',
      ...style,
    }}>
      {/* surface sheen */}
      <div style={{
        position: 'absolute', top: 4, left: 10, width: 30, height: 8,
        background: 'rgba(255,255,255,0.12)', borderRadius: 4,
      }} />
    </div>
  );
}

// ─── Chair ───────────────────────────────────────────────────────
export function Chair({ style, color = '#6b7280' }: {
  style?: CSSProperties; color?: string;
}) {
  return (
    <div style={{
      position: 'absolute', width: 14, height: 14,
      background: color,
      borderRadius: 3,
      border: '1px solid rgba(0,0,0,0.2)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      ...style,
    }} />
  );
}

// ─── Monitor ─────────────────────────────────────────────────────
export function Monitor({ style, theme = 'code' }: {
  style?: CSSProperties; theme?: 'code' | 'chart' | 'spreadsheet' | 'chat';
}) {
  const lines: [string, string][] =
    theme === 'code'
      ? [['#22c55e', '75%'], ['#3b82f6', '50%'], ['#a78bfa', '85%'], ['#22c55e', '60%']]
      : theme === 'chart'
      ? [['#f59e0b', '90%'], ['#ec4899', '55%'], ['#3b82f6', '75%'], ['#10b981', '45%']]
      : theme === 'spreadsheet'
      ? [['#6b7280', '95%'], ['#9ca3af', '80%'], ['#6b7280', '90%'], ['#9ca3af', '70%']]
      : [['#3b82f6', '70%'], ['#6b7280', '50%'], ['#3b82f6', '80%'], ['#6b7280', '55%']];
  return (
    <div style={{ position: 'absolute', width: 32, height: 22, ...style }}>
      <div style={{
        width: '100%', height: '85%',
        background: '#111827', borderRadius: 2,
        border: '1.5px solid #374151',
        padding: '3px 3px',
        display: 'flex', flexDirection: 'column', gap: 2.5,
        overflow: 'hidden',
      }}>
        {lines.map(([c, w], i) => (
          <div key={i} style={{ height: 2, width: w as string, background: c as string, borderRadius: 1 }} />
        ))}
      </div>
      {/* monitor stand */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 10, height: 4, background: '#374151', borderRadius: '0 0 2px 2px',
      }} />
    </div>
  );
}

// ─── Laptop ──────────────────────────────────────────────────────
export function Laptop({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', width: 22, height: 15, ...style }}>
      <div style={{
        width: '100%', height: '90%',
        background: '#e5e7eb', borderRadius: 2,
        border: '1px solid #9ca3af',
        padding: '2px 2px',
        display: 'flex', flexDirection: 'column', gap: 2,
        overflow: 'hidden',
      }}>
        <div style={{ height: 2, width: '80%', background: '#6b7280', borderRadius: 1 }} />
        <div style={{ height: 2, width: '55%', background: '#9ca3af', borderRadius: 1 }} />
        <div style={{ height: 2, width: '70%', background: '#6b7280', borderRadius: 1 }} />
      </div>
      {/* base */}
      <div style={{
        height: '10%', width: '110%', left: '-5%',
        background: '#d1d5db', borderRadius: '0 0 2px 2px',
        position: 'absolute', bottom: 0,
      }} />
    </div>
  );
}

// ─── Plant (small / medium / large) ──────────────────────────────
export function Plant({ style, size = 'sm' }: {
  style?: CSSProperties; size?: 'sm' | 'md' | 'lg';
}) {
  const s = size === 'sm' ? 18 : size === 'md' ? 26 : 34;
  const ph = Math.round(s * 0.38); // pot height
  const pw = Math.round(s * 0.55); // pot width
  const lh = Math.round(s * 0.65); // leaf height
  const lw = Math.round(s * 0.85); // leaf width
  return (
    <div style={{ position: 'absolute', width: s, height: s + 4, ...style }}>
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: pw, height: ph, background: '#92400e',
        borderRadius: '0 0 3px 3px', border: '1px solid #78350f',
      }} />
      <div style={{
        position: 'absolute', bottom: ph - 1, left: '50%', transform: 'translateX(-50%)',
        width: Math.round(s * 0.7), height: 3, background: '#7c3300',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: lw, height: lh,
        background: 'radial-gradient(ellipse at 40% 35%, #22c55e, #16a34a)',
        borderRadius: '50% 50% 35% 35%', border: '1px solid #15803d',
      }} />
    </div>
  );
}

// ─── Long Plant Box ───────────────────────────────────────────────
export function PlantBox({ w = 64, style }: { w?: number; style?: CSSProperties }) {
  const cnt = Math.max(2, Math.floor(w / 14));
  return (
    <div style={{ position: 'absolute', width: w, height: 16, ...style }}>
      <div style={{
        position: 'absolute', bottom: 0, width: '100%', height: 8,
        background: '#92400e', borderRadius: 2, border: '1px solid #78350f',
      }} />
      {Array.from({ length: cnt }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 7,
          left: 3 + i * Math.floor((w - 6) / cnt),
          width: 9, height: 12,
          background: 'radial-gradient(ellipse at 40% 30%, #22c55e, #16a34a)',
          borderRadius: '50% 50% 30% 30%',
          border: '1px solid #15803d',
        }} />
      ))}
    </div>
  );
}

// ─── Bookshelf ───────────────────────────────────────────────────
export function Bookshelf({ w = 18, h = 70, style }: {
  w?: number; h?: number; style?: CSSProperties;
}) {
  const colors = ['#ef4444','#3b82f6','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16'];
  const slotH = Math.floor((h - 6) / colors.length);
  return (
    <div style={{
      position: 'absolute', width: w, height: h,
      background: '#78350f', borderRadius: 2,
      border: '1.5px solid #5c2d0e', padding: '3px 2px',
      display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden',
      ...style,
    }}>
      {colors.map((c, i) => (
        <div key={i} style={{
          width: '100%', height: slotH, background: c,
          borderRadius: 1, opacity: 0.85, flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

// ─── Whiteboard ──────────────────────────────────────────────────
export function Whiteboard({ w = 52, h = 34, style }: {
  w?: number; h?: number; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', width: w, height: h,
      background: '#f8fff8', border: '2px solid #d1d5db',
      borderRadius: 3, padding: '4px 4px 2px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '62%', marginBottom: 3 }}>
        {[45, 70, 55, 88, 62].map((pct, i) => (
          <div key={i} style={{
            flex: 1, height: `${pct}%`,
            background: ['#3b82f6','#10b981','#f59e0b','#6366f1','#ec4899'][i],
            borderRadius: '1px 1px 0 0', minWidth: 0,
          }} />
        ))}
      </div>
      <div style={{ height: 1, background: '#d1d5db', width: '100%' }} />
      <div style={{ height: 2, width: '60%', background: '#9ca3af', marginTop: 3, borderRadius: 1 }} />
    </div>
  );
}

// ─── Meeting Table (oval) ─────────────────────────────────────────
export function MeetingTable({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 130, height: 56,
      background: 'linear-gradient(160deg,#deb887,#c8a06e)',
      borderRadius: 28,
      border: '2.5px solid #a87840',
      boxShadow: '2px 4px 10px rgba(0,0,0,0.2)',
      ...style,
    }}>
      <div style={{
        position: 'absolute', top: 8, left: '18%', width: '32%', height: '28%',
        background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
      }} />
    </div>
  );
}

// ─── Round Table ─────────────────────────────────────────────────
export function RoundTable({ size = 38, style }: {
  size?: number; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', width: size, height: size,
      background: 'radial-gradient(circle at 35% 35%, #fef3c7, #fde68a)',
      borderRadius: '50%',
      border: '2px solid #d97706',
      boxShadow: '1px 2px 6px rgba(0,0,0,0.15)',
      ...style,
    }} />
  );
}

// ─── Sofa ────────────────────────────────────────────────────────
export function Sofa({ w = 70, vertical = false, color = '#6ee7b7', style }: {
  w?: number; vertical?: boolean; color?: string; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute',
      width: vertical ? 22 : w,
      height: vertical ? w : 22,
      background: color,
      borderRadius: vertical ? '6px 6px 4px 4px' : '6px 6px 4px 4px',
      border: '1.5px solid rgba(0,0,0,0.12)',
      boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)',
      ...style,
    }}>
      {/* cushion divider */}
      {!vertical && (
        <div style={{
          position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)',
          height: '65%', width: 1.5, background: 'rgba(0,0,0,0.12)',
        }} />
      )}
    </div>
  );
}

// ─── Vending Machine ─────────────────────────────────────────────
export function VendingMachine({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 20, height: 30,
      background: 'linear-gradient(180deg,#374151,#1f2937)',
      borderRadius: 3, border: '1.5px solid #1f2937',
      boxShadow: '1px 2px 4px rgba(0,0,0,0.25)',
      ...style,
    }}>
      {[['#ef4444','#3b82f6'],['#f59e0b','#10b981'],['#a78bfa','#f97316']].map((row, ri) =>
        row.map((c, ci) => (
          <div key={`${ri}-${ci}`} style={{
            position: 'absolute', width: 7, height: 7,
            background: c, borderRadius: 1,
            top: 4 + ri * 8, left: 2 + ci * 9,
          }} />
        ))
      )}
      <div style={{
        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
        width: 10, height: 3, background: '#6b7280', borderRadius: 1,
      }} />
    </div>
  );
}

// ─── Server Rack ─────────────────────────────────────────────────
export function ServerRack({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 22, height: 36,
      background: 'linear-gradient(180deg,#1f2937,#111827)',
      border: '1.5px solid #374151', borderRadius: 2,
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      ...style,
    }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: 'absolute', top: 3 + i * 6, left: 2, right: 2, height: 4,
          background: '#374151', borderRadius: 1,
          display: 'flex', alignItems: 'center', paddingLeft: 2, gap: 1.5,
        }}>
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: i % 2 === 0 ? '#22c55e' : '#3b82f6' }} />
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#22c55e' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Filing Cabinet ──────────────────────────────────────────────
export function FilingCabinet({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 22, height: 28,
      background: '#9ca3af', border: '1.5px solid #6b7280',
      borderRadius: 2, boxShadow: '1px 1px 3px rgba(0,0,0,0.15)',
      ...style,
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', top: 4 + i * 8, left: 3, right: 3, height: 6,
          background: '#e5e7eb', borderRadius: 1,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{ width: 8, height: 2, background: '#9ca3af', borderRadius: 1 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Rug ─────────────────────────────────────────────────────────
export function Rug({ w = 90, h = 55, color = '#fde68a', style }: {
  w?: number; h?: number; color?: string; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', width: w, height: h,
      background: color + '30',
      border: `2px solid ${color}60`,
      borderRadius: 8,
      ...style,
    }}>
      <div style={{
        position: 'absolute', inset: 4,
        border: `1px solid ${color}40`,
        borderRadius: 5,
      }} />
    </div>
  );
}

// ─── Papers ──────────────────────────────────────────────────────
export function Papers({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', width: 20, height: 14, ...style }}>
      <div style={{ position: 'absolute', width: 15, height: 11, background: '#fff', border: '1px solid #d1d5db', borderRadius: 1, transform: 'rotate(-4deg)', top: 3, left: 3 }} />
      <div style={{ position: 'absolute', width: 15, height: 11, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 1, top: 0, left: 0 }}>
        <div style={{ height: 1.5, width: '80%', background: '#9ca3af', margin: '2px auto 0' }} />
        <div style={{ height: 1.5, width: '65%', background: '#9ca3af', margin: '2px auto 0' }} />
        <div style={{ height: 1.5, width: '75%', background: '#9ca3af', margin: '2px auto 0' }} />
      </div>
    </div>
  );
}

// ─── Coffee Cup ──────────────────────────────────────────────────
export function CoffeeCup({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', width: 10, height: 10, ...style }}>
      <div style={{
        width: 8, height: 8, background: '#fafaf9',
        border: '1.5px solid #92400e',
        borderRadius: '2px 2px 4px 4px',
      }}>
        <div style={{ width: '100%', height: 3, background: '#4a2006', borderRadius: '0 0 0 0', opacity: 0.85 }} />
      </div>
      {/* handle */}
      <div style={{
        position: 'absolute', top: 2, right: -3,
        width: 3, height: 5,
        border: '1.5px solid #92400e',
        borderLeft: 'none',
        borderRadius: '0 2px 2px 0',
      }} />
    </div>
  );
}

// ─── Small Lamp ──────────────────────────────────────────────────
export function Lamp({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', width: 12, height: 16, ...style }}>
      {/* shade */}
      <div style={{
        width: 12, height: 7,
        background: '#fde68a', border: '1px solid #d97706',
        borderRadius: '50% 50% 30% 30%',
      }} />
      {/* pole */}
      <div style={{
        width: 2, height: 6, background: '#6b7280',
        margin: '0 auto',
      }} />
      {/* base */}
      <div style={{
        width: 10, height: 3, background: '#4b5563',
        margin: '0 auto', borderRadius: 1,
      }} />
    </div>
  );
}

// ─── Glass Partition ─────────────────────────────────────────────
export function GlassPartition({ w = 80, h = 20, style }: {
  w?: number; h?: number; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute', width: w, height: h,
      background: 'rgba(186,230,253,0.35)',
      border: '2px solid rgba(125,211,252,0.7)',
      borderRadius: 2,
      ...style,
    }}>
      {[0.33, 0.67].map((x, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${x * 100}%`, width: 1,
          background: 'rgba(125,211,252,0.5)',
        }} />
      ))}
    </div>
  );
}

// ─── Campaign Board ──────────────────────────────────────────────
export function CampaignBoard({ style }: { style?: CSSProperties }) {
  const stickers = ['#ef4444','#f59e0b','#3b82f6','#10b981','#8b5cf6','#ec4899'];
  return (
    <div style={{
      position: 'absolute', width: 48, height: 38,
      background: '#fef9f0', border: '1.5px solid #d1d5db',
      borderRadius: 3, padding: 3,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      ...style,
    }}>
      {stickers.map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 10, height: 10,
          background: c, borderRadius: 1, opacity: 0.8,
          top: 4 + Math.floor(i / 3) * 13,
          left: 4 + (i % 3) * 14,
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }} />
      ))}
    </div>
  );
}

// ─── Safe / Lock Box ─────────────────────────────────────────────
export function SafeBox({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 22, height: 22,
      background: '#374151', border: '2px solid #1f2937',
      borderRadius: 3, boxShadow: '1px 2px 4px rgba(0,0,0,0.2)',
      ...style,
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 10, height: 10, borderRadius: '50%',
        border: '1.5px solid #9ca3af',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#9ca3af' }} />
      </div>
    </div>
  );
}

// ─── Map Speech Bubble ────────────────────────────────────────────
export function MapSpeechBubble({ text, style }: {
  text: string; style?: CSSProperties;
}) {
  return (
    <div style={{
      position: 'absolute',
      background: '#ffffff',
      border: '1.5px solid #e5e7eb',
      borderRadius: 8,
      padding: '3px 8px',
      fontSize: 10,
      fontWeight: 600,
      color: '#374151',
      whiteSpace: 'nowrap',
      boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
      zIndex: 30,
      lineHeight: 1.4,
      ...style,
    }}>
      {text}
      <div style={{
        position: 'absolute', bottom: -5, left: 12,
        width: 8, height: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          width: 8, height: 8, background: '#fff',
          border: '1.5px solid #e5e7eb',
          transform: 'rotate(45deg)',
          position: 'absolute', top: -4, left: 0,
        }} />
      </div>
    </div>
  );
}

// ─── Room Label Badge ─────────────────────────────────────────────
export function RoomLabel({ text, icon, color }: {
  text: string; icon: string; color: string;
}) {
  return (
    <div style={{
      position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(255,255,255,0.92)',
      border: `1.5px solid ${color}50`,
      borderRadius: 20,
      padding: '2px 10px 2px 7px',
      display: 'flex', alignItems: 'center', gap: 4,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      zIndex: 10, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.02em' }}>{text}</span>
    </div>
  );
}
