'use client';

import type { WorkflowItem } from './mockData';

interface Props {
  items: WorkflowItem[];
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  'in-progress': { label: 'In Progress', bg: '#dbeafe', color: '#1d4ed8' },
  'in-review':   { label: 'In Review',   bg: '#fef3c7', color: '#b45309' },
  'pending':     { label: 'Pending',     bg: '#f1f5f9', color: '#64748b' },
  'done':        { label: 'Done',        bg: '#d1fae5', color: '#059669' },
};

const deptColors: Record<string, string> = {
  Marketing:   '#059669',
  Development: '#2563EB',
  Finance:     '#D97706',
  HR:          '#7C3AED',
};

export default function WorkflowQueue({ items }: Props) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const st = statusConfig[item.status];
        const color = deptColors[item.department] ?? '#6B7280';
        return (
          <div
            key={item.id}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-transparent
                       hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all cursor-default"
          >
            <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-700 truncate">{item.title}</div>
              <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{item.owner}</div>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
              style={{ background: st.bg, color: st.color }}
            >
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
