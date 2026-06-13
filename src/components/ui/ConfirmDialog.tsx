'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { registerConfirm, unregisterConfirm, type ConfirmOptions } from '@/lib/confirm';

interface PendingConfirm {
  message: string;
  options?: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export default function ConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerConfirm((message, options) =>
      new Promise<boolean>((resolve) => { setPending({ message, options, resolve }); })
    );
    return () => unregisterConfirm();
  }, []);

  useEffect(() => {
    if (!pending) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
      if (e.key === 'Enter')  handleConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  useEffect(() => {
    if (pending) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [pending]);

  const handleConfirm = () => { pending?.resolve(true);  setPending(null); };
  const handleCancel  = () => { pending?.resolve(false); setPending(null); };

  if (!pending) return null;

  const isDanger     = pending.options?.danger !== false;
  const title        = pending.options?.title        ?? (isDanger ? '삭제 확인' : '확인');
  const confirmLabel = pending.options?.confirmLabel ?? (isDanger ? '삭제' : '확인');
  const cancelLabel  = pending.options?.cancelLabel  ?? '취소';

  const accentColor = isDanger ? 'oklch(0.70 0.20 22)'  : 'oklch(0.76 0.16 196)';
  const accentBg    = isDanger ? 'oklch(0.40 0.11 22 / 0.14)' : 'oklch(0.42 0.09 196 / 0.14)';
  const accentBorder= isDanger ? 'oklch(0.55 0.14 22 / 0.35)' : 'oklch(0.55 0.12 196 / 0.35)';
  const accentGlow  = isDanger ? 'oklch(0.70 0.20 22 / 0.20)'  : 'oklch(0.76 0.16 196 / 0.20)';

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{
        background: 'oklch(0.06 0.006 245 / 0.80)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, oklch(0.20 0.010 240) 0%, oklch(0.18 0.010 242) 100%)',
          border: `1px solid ${accentBorder}`,
          borderRadius: 16,
          boxShadow: [
            '0 32px 80px rgba(0,0,0,0.65)',
            `0 0 0 1px rgba(255,255,255,0.05)`,
            `0 0 40px ${accentGlow}`,
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          ].join(', '),
          animation: 'modalIn 0.20s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* 상단 accent 라인 */}
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
            opacity: 0.7,
          }}
        />

        <div className="p-6">
          {/* 아이콘 + 제목 */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: accentBg,
                border: `1px solid ${accentBorder}`,
                boxShadow: `0 0 20px ${accentGlow}`,
                color: accentColor,
              }}
            >
              {isDanger
                ? <Trash2       className="w-4 h-4" />
                : <ShieldAlert  className="w-4 h-4" />
              }
            </div>
            <div className="flex-1 pt-0.5">
              <h2
                id="confirm-title"
                className="text-sm font-bold"
                style={{ color: 'var(--text)' }}
              >
                {title}
              </h2>
              <p
                id="confirm-message"
                className="text-sm leading-relaxed mt-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {pending.message}
              </p>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              ref={cancelRef}
              onClick={handleCancel}
              className="btn btn-ghost"
              style={{ height: 34, paddingLeft: 14, paddingRight: 14 }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
              style={{ height: 34, paddingLeft: 14, paddingRight: 14 }}
            >
              {isDanger && <Trash2 className="w-3.5 h-3.5" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
