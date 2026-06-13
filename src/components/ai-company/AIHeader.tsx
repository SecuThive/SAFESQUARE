'use client';

import { Search, Bell, Calendar, HelpCircle, ChevronDown, Sparkles } from 'lucide-react';

export default function AIHeader() {
  return (
    <header className="h-13 bg-white border-b border-slate-100 flex items-center px-4 gap-3 shrink-0" style={{ height: 52 }}>

      {/* Brand chip */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0"
           style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #ddd6fe' }}>
        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-xs font-bold text-violet-700 whitespace-nowrap">AI Company</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-lg">
        <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-1.5
                        focus-within:bg-white focus-within:border-violet-300 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            placeholder="Search agents, rooms, tasks..."
            className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200 text-[10px] text-slate-500 font-mono shrink-0">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 bg-slate-200 shrink-0" />

      {/* Icon actions */}
      <div className="flex items-center gap-0.5">
        {[
          { icon: Bell,        badge: 4 },
          { icon: Calendar,    badge: 1 },
          { icon: HelpCircle,  badge: 0 },
        ].map(({ icon: Icon, badge }, i) => (
          <button
            key={i}
            className="relative w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <Icon className="w-[17px] h-[17px]" />
            {badge > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-white flex items-center justify-center">
                <span className="text-[6px] text-white font-black leading-none">{badge}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 shrink-0" />

      {/* Profile */}
      <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
             style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
          M
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-bold text-slate-700 leading-tight">Manager</div>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-emerald-600 font-medium">Online</span>
          </div>
        </div>
        <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
      </button>
    </header>
  );
}
