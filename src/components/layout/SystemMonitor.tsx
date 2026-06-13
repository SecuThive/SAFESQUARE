'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { systemStatsApi, type SystemStats } from '@/lib/api';
import { Cpu, MemoryStick, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import clsx from 'clsx';

/* ── 컬러 계산 ── */
function colorOklch(pct: number): string {
  if (pct >= 85) return 'oklch(0.70 0.20 22)';
  if (pct >= 60) return 'oklch(0.84 0.16 82)';
  return 'oklch(0.76 0.16 152)';
}
function glowOklch(pct: number): string {
  if (pct >= 85) return 'oklch(0.70 0.20 22 / 0.30)';
  if (pct >= 60) return 'oklch(0.84 0.16 82 / 0.25)';
  return 'oklch(0.76 0.16 152 / 0.20)';
}

/* ── 게이지 바 ── */
function GaugeBar({ value }: { value: number }) {
  const color = colorOklch(value);
  const glow  = glowOklch(value);
  const pct   = Math.min(100, value);
  return (
    <div
      className="h-1 rounded-full overflow-hidden"
      style={{ background: 'oklch(0.20 0.010 240)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: pct > 0 ? `0 0 6px ${glow}` : 'none',
        }}
      />
    </div>
  );
}

/* ── 미니 링 게이지 (접힌 상태용) ── */
function MiniRing({ cpu, mem }: { cpu: number; mem: number }) {
  const val   = Math.max(cpu, mem);
  const color = colorOklch(val);
  const glow  = glowOklch(val);
  const r = 9, cx = 12, cy = 12;
  const circ = 2 * Math.PI * r;
  const dash  = (val / 100) * circ;

  return (
    <div className="relative w-6 h-6" title={`CPU ${cpu}%  MEM ${mem}%`}>
      <svg width={24} height={24} className="-rotate-90" viewBox="0 0 24 24">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2.5} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${glow})`, transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[7px] font-bold tabular-nums"
        style={{ color }}
      >
        {val}
      </span>
    </div>
  );
}

/* ── CPU 코어 도트 ── */
function CoreDots({ cores }: { cores: number[] }) {
  return (
    <div className="flex flex-wrap gap-0.5 mt-1.5">
      {cores.map((c, i) => (
        <div
          key={i}
          title={`Core ${i + 1}: ${c}%`}
          className="w-2 h-2 rounded-sm transition-all duration-500"
          style={{
            background: colorOklch(c),
            opacity: 0.25 + (c / 100) * 0.75,
            boxShadow: c > 60 ? `0 0 4px ${glowOklch(c)}` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/* ── 메인 ── */
export default function SystemMonitor({ collapsed }: { collapsed: boolean }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [open,  setOpen]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try { setStats(await systemStatsApi.get()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(fetchStats, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchStats]);

  if (!stats) return null;

  const memPct = stats.mem_percent;
  const cpuPct = stats.cpu_total;
  const maxPct = Math.max(cpuPct, memPct);
  const color  = colorOklch(maxPct);

  /* 접힌 사이드바: 미니 링 게이지 */
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2">
        <div
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--text-faint)' }}
          title={`CPU ${cpuPct}%  MEM ${memPct}%`}
        >
          <MiniRing cpu={cpuPct} mem={memPct} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-2 py-1.5"
      style={{ borderTop: '1px solid oklch(0.20 0.010 240)' }}
    >
      {/* 헤더 토글 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150"
        style={{ color: 'var(--text-faint)' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0.010 241)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
        }}
      >
        <Activity className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-xs font-medium">시스템 리소스</span>
        <span
          className="text-[10px] font-mono font-bold tabular-nums"
          style={{ color }}
        >
          {cpuPct}%
        </span>
        {open
          ? <ChevronUp   className="w-3 h-3 flex-shrink-0" />
          : <ChevronDown className="w-3 h-3 flex-shrink-0" />
        }
      </button>

      {open && (
        <div
          className="mt-1 mx-1 rounded-lg px-3 py-2.5 space-y-3"
          style={{
            background: 'oklch(0.14 0.010 245)',
            border: '1px solid oklch(0.20 0.010 240)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          {/* CPU */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3" style={{ color: 'oklch(0.72 0.18 218)' }} />
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>CPU</span>
              </div>
              <span
                className="text-[10px] font-mono font-bold tabular-nums"
                style={{ color: colorOklch(cpuPct) }}
              >
                {cpuPct}%
              </span>
            </div>
            <GaugeBar value={cpuPct} />
            {stats.cpu_cores.length > 0 && <CoreDots cores={stats.cpu_cores} />}
          </div>

          {/* 메모리 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <MemoryStick className="w-3 h-3" style={{ color: 'oklch(0.74 0.16 300)' }} />
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>메모리</span>
              </div>
              <span
                className="text-[10px] font-mono font-bold tabular-nums"
                style={{ color: colorOklch(memPct) }}
              >
                {stats.mem_used_gb} / {stats.mem_total_gb} GB
              </span>
            </div>
            <GaugeBar value={memPct} />
          </div>

          {/* 상위 프로세스 */}
          {stats.processes.length > 0 && (
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.06em] mb-2"
                style={{ color: 'var(--text-faint)' }}
              >
                상위 프로세스
              </p>
              <div className="space-y-1.5">
                {stats.processes.slice(0, 5).map(proc => (
                  <div key={proc.pid} className="flex items-center gap-2">
                    <span
                      className="text-[10px] truncate flex-1"
                      style={{ color: 'var(--text-muted)' }}
                      title={proc.name}
                    >
                      {proc.name}
                    </span>
                    <span
                      className="text-[10px] font-mono w-9 text-right flex-shrink-0 tabular-nums"
                      style={{ color: proc.cpu > 0 ? colorOklch(proc.cpu) : 'var(--text-faint)' }}
                    >
                      {proc.cpu > 0 ? `${proc.cpu}%` : '—'}
                    </span>
                    <div className="w-10 flex-shrink-0">
                      <div
                        className="h-0.5 rounded-full overflow-hidden"
                        style={{ background: 'oklch(0.20 0.010 240)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, proc.mem * 3)}%`,
                            background: 'oklch(0.74 0.16 300)',
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
