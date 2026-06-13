'use client';

import { useEffect, useState } from 'react';
import { workMethodsApi, WorkMethod, WorkMethodStep } from '@/lib/api';
import {
  ListChecks, Terminal, Copy, Check, ChevronRight,
  Tag, BookOpen, AlertCircle, Loader2, ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── 복사 유틸 ── */
function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCopy(text));
  } else {
    execCopy(text);
  }
}
function execCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand('copy'); } catch { /* ignore */ }
  document.body.removeChild(el);
}

/* ── 코드블록 ── */
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { copyToClipboard(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="rounded-lg overflow-hidden text-xs mt-2"
      style={{ background: 'oklch(0.09 0.010 250)', border: '1px solid oklch(0.20 0.010 240)' }}>
      <div className="flex items-center justify-between px-3 py-1.5"
        style={{ background: 'oklch(0.12 0.010 248)', borderBottom: '1px solid oklch(0.18 0.010 242)' }}>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Terminal className="w-3 h-3" />
          <span className="text-[10px] font-medium">스크립트</span>
        </div>
        <button onClick={copy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all"
          style={{ color: copied ? 'oklch(0.76 0.16 142)' : 'var(--text-muted)' }}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="px-3 py-2.5 overflow-x-auto leading-relaxed"
        style={{ color: 'oklch(0.78 0.040 215)', fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {code}
      </pre>
    </div>
  );
}

/* ── 단계 아이템 ── */
function StepItem({ step, index }: { step: WorkMethodStep; index: number }) {
  const [open, setOpen] = useState(false);
  const hasScript = Boolean(step.script?.trim());

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: open ? 'oklch(0.12 0.010 248)' : 'oklch(0.10 0.010 250)', border: `1px solid ${open ? 'oklch(0.22 0.010 238)' : 'oklch(0.16 0.010 244)'}`, transition: 'all 0.15s' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: open ? 'oklch(0.15 0.010 245)' : 'transparent' }}
      >
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: 'oklch(0.20 0.014 232)', color: 'var(--accent)' }}>
          {step.order}
        </span>
        <span className="flex-1 text-sm text-gray-300 leading-relaxed text-left">{step.content}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasScript && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: 'oklch(0.84 0.16 82 / 0.12)', color: 'oklch(0.84 0.16 82)', border: '1px solid oklch(0.62 0.12 82 / 0.20)' }}>
              <Terminal className="w-2.5 h-2.5" /> 스크립트
            </span>
          )}
          <ChevronRight className={clsx('w-4 h-4 text-gray-600 transition-transform', open && 'rotate-90')} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {hasScript
            ? <CodeBlock code={step.script!} />
            : <p className="text-[11px] text-gray-600 italic pt-1">이 단계에 등록된 스크립트가 없습니다.</p>
          }
        </div>
      )}
    </div>
  );
}

/* ── 공유 페이지 ── */
export default function SharedWorkMethodPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [method,  setMethod]  = useState<WorkMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    workMethodsApi.getShared(token)
      .then(setMethod)
      .catch(() => setError('유효하지 않은 공유 링크입니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="h-screen overflow-y-auto py-12 px-4" style={{ background: 'oklch(0.10 0.010 250)' }}>
      <div className="max-w-2xl mx-auto">

        {/* 상단 브랜드 */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, oklch(0.76 0.16 196 / 0.20) 0%, oklch(0.68 0.18 220 / 0.12) 100%)', border: '1px solid oklch(0.55 0.12 196 / 0.35)' }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          </div>
          <span className="text-xs font-black tracking-[0.16em]" style={{ background: 'linear-gradient(90deg, oklch(0.76 0.16 196), oklch(0.68 0.18 220))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SAFESQUARE
          </span>
          <span className="text-[10px] text-gray-600 ml-1">작업 방법 공유</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-gray-600" />
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        )}

        {method && (
          <div className="space-y-6">
            {/* 타이틀 카드 */}
            <div className="rounded-2xl p-6"
              style={{ background: 'oklch(0.13 0.010 246)', border: '1px solid oklch(0.20 0.010 240)' }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.25)' }}>
                  <BookOpen className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-lg font-bold text-gray-100">{method.title}</h1>
                    {method.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'oklch(0.22 0.014 232)', color: 'var(--accent)', border: '1px solid oklch(0.32 0.012 228 / 0.40)' }}>
                        {method.category}
                      </span>
                    )}
                  </div>
                  {method.description && (
                    <p className="text-sm text-gray-400 leading-relaxed">{method.description}</p>
                  )}
                  {method.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <Tag className="w-3 h-3 text-gray-600" />
                      {method.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[11px]"
                          style={{ background: 'oklch(0.17 0.010 244)', color: 'oklch(0.55 0.010 230)' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-600 mt-3">
                    마지막 수정: {format(new Date(method.updated_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                  </p>
                </div>
              </div>
            </div>

            {/* 단계 목록 */}
            {method.steps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-400">작업 단계 ({method.steps.length})</h2>
                  <span className="text-[11px] text-gray-600 ml-1">— 각 단계를 클릭하면 스크립트를 확인할 수 있습니다</span>
                </div>
                <div className="space-y-2">
                  {method.steps.map((step, idx) => (
                    <StepItem key={idx} step={step} index={idx} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
