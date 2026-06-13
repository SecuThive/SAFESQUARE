'use client';

import { useEffect, useState } from 'react';
import { subscribeToasts, dismissToast, getToasts, type ToastItem } from '@/lib/toast';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const META = {
  success: {
    icon: CheckCircle2,
    color: 'oklch(0.76 0.16 152)',
    bg:    'oklch(0.42 0.09 152 / 0.12)',
    border:'oklch(0.58 0.12 152 / 0.30)',
    glow:  'oklch(0.76 0.16 152 / 0.18)',
    sideGlow: 'oklch(0.76 0.16 152 / 0.30)',
    bar:   'linear-gradient(90deg, oklch(0.76 0.16 152) 0%, oklch(0.68 0.18 162) 100%)',
  },
  error: {
    icon: XCircle,
    color: 'oklch(0.70 0.20 22)',
    bg:    'oklch(0.40 0.11 22 / 0.12)',
    border:'oklch(0.55 0.14 22 / 0.30)',
    glow:  'oklch(0.70 0.20 22 / 0.18)',
    sideGlow: 'oklch(0.70 0.20 22 / 0.30)',
    bar:   'linear-gradient(90deg, oklch(0.70 0.20 22) 0%, oklch(0.62 0.22 15) 100%)',
  },
  warning: {
    icon: AlertTriangle,
    color: 'oklch(0.84 0.16 82)',
    bg:    'oklch(0.46 0.10 82 / 0.12)',
    border:'oklch(0.62 0.12 82 / 0.30)',
    glow:  'oklch(0.84 0.16 82 / 0.18)',
    sideGlow: 'oklch(0.84 0.16 82 / 0.30)',
    bar:   'linear-gradient(90deg, oklch(0.84 0.16 82) 0%, oklch(0.76 0.18 72) 100%)',
  },
  info: {
    icon: Info,
    color: 'oklch(0.76 0.16 196)',
    bg:    'oklch(0.42 0.09 196 / 0.12)',
    border:'oklch(0.58 0.12 196 / 0.30)',
    glow:  'oklch(0.76 0.16 196 / 0.18)',
    sideGlow: 'oklch(0.76 0.16 196 / 0.30)',
    bar:   'linear-gradient(90deg, oklch(0.76 0.16 196) 0%, oklch(0.68 0.18 210) 100%)',
  },
} as const;

function ToastCard({ toast }: { toast: ToastItem }) {
  const [visible, setVisible] = useState(false);
  const meta = META[toast.type];
  const Icon = meta.icon;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(() => dismissToast(toast.id), 250);
  }

  return (
    <div
      className="relative flex items-start gap-3 px-4 py-3.5 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${meta.bg} 0%, oklch(0.18 0.010 242 / 0.95) 100%)`,
        border: `1px solid ${meta.border}`,
        borderRadius: 14,
        backdropFilter: 'blur(16px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
        boxShadow: [
          `0 8px 32px rgba(0,0,0,0.50)`,
          `0 0 0 1px rgba(255,255,255,0.04)`,
          `-4px 0 24px ${meta.sideGlow}`,
          `inset 0 1px 0 rgba(255,255,255,0.07)`,
        ].join(', '),
        minWidth: 280,
        maxWidth: 420,
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(24px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.20s ease',
      }}
    >
      {/* 왼쪽 accent bar */}
      <span
        className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full"
        style={{
          background: meta.color,
          boxShadow: `0 0 8px ${meta.sideGlow}`,
        }}
      />

      {/* 아이콘 glow ring */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
        style={{
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          boxShadow: `0 0 12px ${meta.glow}`,
          color: meta.color,
        }}
      >
        <Icon className="w-4 h-4" />
      </div>

      <p className="flex-1 text-sm leading-snug" style={{ color: 'var(--text-dim)' }}>
        {toast.message}
      </p>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-all"
        style={{ color: 'var(--text-faint)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.24 0.010 236)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <X className="w-3 h-3" />
      </button>

      {/* 하단 진행 바 */}
      <span
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl origin-left"
        style={{
          background: meta.bar,
          animation: `toast-shrink ${toast.duration}ms linear forwards`,
        }}
      />
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>(() => getToasts());

  useEffect(() => {
    const unsub = subscribeToasts(setToasts);
    return () => { unsub(); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes toast-shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} />
          </div>
        ))}
      </div>
    </>
  );
}
