'use client';

interface Sparkline {
  values: number[];
  color: string;
}

interface Props {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  icon: string;
  color: string;
  sparkline?: Sparkline;
}

function MiniSparkline({ values, color }: Sparkline) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56;
  const h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Last dot */}
      <circle
        cx={w}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

export default function StatCard({ label, value, change, positive = true, icon, color, sparkline }: Props) {
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-100 hover:border-slate-200 transition-all hover:shadow-sm">
      {/* top row */}
      <div className="flex items-start justify-between mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{ background: color + '15' }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{
            color: positive ? '#059669' : '#dc2626',
            background: positive ? '#ecfdf5' : '#fef2f2',
          }}
        >
          {positive ? '↑' : '↓'} {change}
        </span>
      </div>

      {/* value */}
      <div className="text-lg font-extrabold text-slate-800 leading-none">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5 font-medium">{label}</div>

      {/* sparkline */}
      {sparkline && (
        <div className="mt-2 -mb-1">
          <MiniSparkline values={sparkline.values} color={sparkline.color} />
        </div>
      )}
    </div>
  );
}
