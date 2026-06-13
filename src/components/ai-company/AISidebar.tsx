'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Monitor, Bot, FolderKanban, DollarSign, Users, Zap,
  Activity, GitBranch, UserSearch, BarChart2, ChevronRight,
} from 'lucide-react';

const MENU_ITEMS = [
  { id: 'home',       label: 'Dashboard',   icon: LayoutDashboard, badge: null },
  { id: 'workspace',  label: 'Workspace',   icon: Monitor,         badge: null },
  { id: 'agents',     label: 'Agents',      icon: Bot,             badge: '9'  },
  { id: 'projects',   label: 'Projects',    icon: FolderKanban,    badge: '3'  },
  { id: 'finance',    label: 'Finance',     icon: DollarSign,      badge: null },
  { id: 'hr',         label: 'HR & People', icon: Users,           badge: null },
  { id: 'automation', label: 'Automation',  icon: Zap,             badge: null },
];

const QUICK_ACCESS = [
  { icon: Activity,   label: 'Daily Standup',    color: '#7C3AED' },
  { icon: GitBranch,  label: 'Q2 Roadmap',        color: '#2563EB' },
  { icon: UserSearch, label: 'Hiring Pipeline',   color: '#059669' },
  { icon: BarChart2,  label: 'Budget Tracker',    color: '#D97706' },
];

const AGENT_STATUSES = [
  '#10b981','#10b981','#10b981','#10b981','#10b981',
  '#10b981','#10b981','#10b981','#10b981','#10b981',
  '#10b981','#10b981','#10b981','#10b981','#10b981',
  '#10b981','#10b981','#10b981','#d1d5db','#d1d5db',
];

function Waveform() {
  const bars = [3, 6, 9, 5, 11, 7, 4, 10, 6, 5, 9, 4, 8, 6];
  return (
    <div className="flex items-end gap-0.5 h-5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-emerald-400"
          style={{
            height: `${h}px`,
            animation: `pulse 1.5s ${i * 0.1}s ease-in-out infinite`,
            opacity: 0.7 + (i % 3) * 0.1,
          }}
        />
      ))}
    </div>
  );
}

export default function AISidebar() {
  const [active, setActive] = useState('home');

  return (
    <aside className="w-[214px] shrink-0 flex flex-col bg-white border-r border-slate-100/80 h-full overflow-hidden">

      {/* ── Logo ────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl shrink-0"
               style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9,#4c1d95)', boxShadow: '0 4px 12px rgba(109,40,217,0.35)' }}>
            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-base">M</span>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-slate-800 text-sm leading-tight truncate">AI Metaverse Company</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">AI Operations Hub</div>
          </div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="px-2.5 pt-4 flex-1 overflow-y-auto min-h-0">
        <p className="text-xs font-bold text-slate-400 px-2.5 mb-1.5 tracking-[0.1em] uppercase">Main</p>
        <div className="space-y-0.5">
          {MENU_ITEMS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={[
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all text-left group',
                active === id
                  ? 'bg-violet-50 text-violet-700 border border-violet-100/80 shadow-[0_1px_3px_rgba(109,40,217,0.08)]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent',
              ].join(' ')}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  active === id ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-500'
                }`}
              />
              <span className="flex-1 truncate">{label}</span>
              {badge ? (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                      style={{
                        background: active === id ? '#7c3aed' : '#f1f5f9',
                        color: active === id ? '#fff' : '#64748b',
                      }}>
                  {badge}
                </span>
              ) : (
                active === id && <ChevronRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Quick Access */}
        <p className="text-xs font-bold text-slate-400 px-2.5 mb-1.5 mt-5 tracking-[0.1em] uppercase">Quick Access</p>
        <div className="space-y-0.5">
          {QUICK_ACCESS.map(({ icon: Icon, label, color }) => (
            <button
              key={label}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all text-left border border-transparent hover:border-slate-100"
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: color + '15' }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Office Status ────────────────────────────── */}
      <div className="m-2.5 p-3.5 rounded-2xl shrink-0" style={{
        background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)',
        border: '1px solid #a7f3d0',
      }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-extrabold text-emerald-800">Office Live</span>
          </div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
            9 rooms
          </span>
        </div>

        <Waveform />

        <div className="flex items-center justify-between mt-2 mb-2">
          <span className="text-xs font-semibold text-emerald-700">18 / 20 agents</span>
          <span className="text-xs text-emerald-600">All systems ✓</span>
        </div>

        {/* Agent grid */}
        <div className="flex gap-0.5 flex-wrap">
          {AGENT_STATUSES.map((color, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-sm"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
