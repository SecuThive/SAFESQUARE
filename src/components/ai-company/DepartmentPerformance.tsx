'use client';

interface DeptStat {
  done: number;
  total: number;
  performance: number;
}

interface Props {
  deptStats?: Record<string, DeptStat>;
}

const DEPT_CONFIG = [
  { id: 'marketing',   name: 'Marketing',   color: '#059669' },
  { id: 'content',     name: 'Content',     color: '#2563EB' },
  { id: 'development', name: 'Development', color: '#DC2626' },
  { id: 'research',    name: 'Research',    color: '#9333EA' },
  { id: 'finance',     name: 'Finance',     color: '#D97706' },
];

export default function DepartmentPerformance({ deptStats }: Props) {
  return (
    <div className="space-y-3">
      {DEPT_CONFIG.map(dept => {
        const stat = deptStats?.[dept.id];
        const perf = stat?.performance ?? 0;
        const label = stat ? `${stat.done}/${stat.total} 완료` : '작업 없음';
        return (
          <div key={dept.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dept.color }} />
                <span className="text-xs font-semibold text-slate-600">{dept.name}</span>
                <span className="text-xs text-slate-400 font-medium">{label}</span>
              </div>
              <span className="text-xs font-extrabold tabular-nums" style={{ color: dept.color }}>
                {perf}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${perf}%`,
                  background: `linear-gradient(90deg, ${dept.color}cc, ${dept.color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
