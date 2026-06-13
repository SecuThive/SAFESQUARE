'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Mail, Sparkles, RotateCcw, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import { getAuthHeaders } from '@/lib/api';
import { toast } from '@/lib/toast';

// ── 인용/전달 파싱 ─────────────────────────────────────────────

const QUOTE_SEPARATORS = [
  /^-{3,}\s*Original Message\s*-{3,}/im,
  /^-{3,}\s*원본 메시지\s*-{3,}/im,
  /^_{5,}/m,
  /^From\s*:\s*.+@.+/m,
  /^보낸 사람\s*:/m,
];

function isQuotedLine(line: string) {
  return /^>+\s?/.test(line);
}

interface Segment {
  meta: string;
  body: string;
}

function splitIntoSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let splitIdx = -1;

    for (const sep of QUOTE_SEPARATORS) {
      const match = sep.exec(remaining);
      if (match && (splitIdx === -1 || match.index < splitIdx)) {
        splitIdx = match.index;
      }
    }

    if (splitIdx === -1) {
      const lines = remaining.split('\n');
      const firstQuotedLine = lines.findIndex(l => isQuotedLine(l));
      if (firstQuotedLine > 0) {
        segments.push({ meta: '', body: lines.slice(0, firstQuotedLine).join('\n').trim() });
        const quotedBody = lines.slice(firstQuotedLine).map(l => l.replace(/^>+\s?/, '')).join('\n');
        segments.push({ meta: '이전 메일', body: quotedBody.trim() });
      } else {
        segments.push({ meta: '', body: remaining.trim() });
      }
      break;
    }

    const current = remaining.slice(0, splitIdx).trim();
    if (current) segments.push({ meta: '', body: current });

    const rest = remaining.slice(splitIdx);
    const fromMatch    = /From\s*:?\s*(.+)/i.exec(rest);
    const sentMatch    = /(?:Sent|Date|보낸 날짜|날짜)\s*:?\s*(.+)/i.exec(rest);
    const subjectMatch = /(?:Subject|제목)\s*:?\s*(.+)/i.exec(rest);

    const metaParts: string[] = [];
    if (fromMatch)    metaParts.push(`보낸 사람: ${fromMatch[1].trim()}`);
    if (sentMatch)    metaParts.push(`날짜: ${sentMatch[1].trim()}`);
    if (subjectMatch) metaParts.push(`제목: ${subjectMatch[1].trim()}`);

    const restLines = rest.split('\n');
    let bodyStart = 0;
    let headerSeen = false;
    for (let i = 0; i < restLines.length; i++) {
      const l = restLines[i];
      if (/^(From|To|Cc|Sent|Date|Subject|보낸|받는|제목|날짜)\s*:/i.test(l) || /^-{3,}/.test(l) || /^_{5,}/.test(l)) {
        headerSeen = true;
      } else if (headerSeen && l.trim() === '') {
        bodyStart = i + 1;
        break;
      }
    }

    remaining = restLines.slice(bodyStart).join('\n');
    if (remaining.trim()) {
      segments.push({ meta: metaParts.join(' · ') || '이전 메일', body: '' });
    } else {
      break;
    }
  }

  const merged: Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.body === '' && i + 1 < segments.length) {
      merged.push({ meta: seg.meta, body: segments[i + 1].body });
      i++;
    } else if (seg.body) {
      merged.push(seg);
    }
  }

  return merged.length > 0 ? merged : [{ meta: '', body: text }];
}

function QuotedSegment({ segment, index }: { segment: Segment; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-overlay hover:bg-gray-800 transition-colors text-left"
      >
        {open
          ? <ChevronDown  className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        }
        <Mail className="w-3 h-3 text-gray-600 flex-shrink-0" />
        <span className="text-xs text-gray-500 truncate">
          {segment.meta || `이전 메일 #${index}`}
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-700 bg-surface text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
          {segment.body}
        </div>
      )}
    </div>
  );
}

// ── AI 가독성 개선 훅 ──────────────────────────────────────────

function useEnhance(body: string, subject?: string) {
  const [state,     setState]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [enhanced,  setEnhanced]  = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (state === 'loading') return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState('loading');
    setEnhanced('');

    try {
      const res = await fetch('/api/mails/enhance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body:    JSON.stringify({ body, subject }),
        signal:  ctrl.signal,
      });
      if (!res.ok) throw new Error('요청 실패');
      if (!res.body) throw new Error('스트림 없음');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token') setEnhanced(prev => prev + data.content);
            if (data.type === 'done') { setState('done'); return; }
          } catch { /* ignore */ }
        }
      }
      setState('done');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setState('error');
      toast.error('AI 정리에 실패했습니다. Ollama가 실행 중인지 확인하세요.');
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setState('idle');
    setEnhanced('');
  };

  return { state, enhanced, run, reset };
}

// ── 복사 버튼 ──────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:text-gray-300 hover:bg-surface-overlay transition-colors"
      title="복사"
    >
      {copied
        ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">복사됨</span></>
        : <><Copy className="w-3 h-3" />복사</>
      }
    </button>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

interface Props {
  body:     string;
  subject?: string;
}

export default function MailBody({ body, subject }: Props) {
  const [showEnhanced, setShowEnhanced] = useState(false);
  const { state, enhanced, run, reset } = useEnhance(body, subject);

  if (!body) {
    return <p className="text-sm text-gray-600 italic">본문이 없습니다.</p>;
  }

  const segments = splitIntoSegments(body);
  const [current, ...quoted] = segments;

  const handleEnhance = () => {
    if (state === 'idle' || state === 'error') {
      run();
      setShowEnhanced(true);
    } else if (state === 'done') {
      setShowEnhanced(v => !v);
    }
  };

  const handleReset = () => {
    reset();
    setShowEnhanced(false);
  };

  const isActive  = state === 'loading' || state === 'done';
  const hasResult = state === 'done' || (state === 'loading' && enhanced.length > 0);

  return (
    <div className="space-y-3">

      {/* AI 버튼 행 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleEnhance}
          disabled={state === 'loading'}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
            isActive
              ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
              : 'bg-surface-overlay text-gray-400 hover:text-gray-200 hover:bg-gray-700/60',
            state === 'loading' && 'cursor-wait',
          )}
        >
          <Sparkles className={clsx('w-3.5 h-3.5', state === 'loading' && 'animate-pulse')} />
          {state === 'loading' ? 'AI 정리 중…'
            : state === 'done'   ? (showEnhanced ? '원본 보기' : 'AI 정리본 보기')
            : 'AI 가독성 정리'}
        </button>

        {(state === 'done' || state === 'error') && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-600 hover:text-gray-400 hover:bg-surface-overlay transition-colors"
            title="다시 정리"
          >
            <RotateCcw className="w-3 h-3" /> 다시
          </button>
        )}

        {showEnhanced && hasResult && (
          <CopyButton text={enhanced} />
        )}
      </div>

      {/* AI 정리본 */}
      {showEnhanced && hasResult && (
        <div className={clsx(
          'rounded-xl border p-4 space-y-1 transition-all',
          state === 'loading'
            ? 'border-purple-500/20 bg-purple-500/5'
            : 'border-purple-500/30 bg-purple-500/5',
        )}>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[11px] font-medium text-purple-400">AI 정리본</span>
            {state === 'loading' && (
              <span className="text-[10px] text-purple-500 ml-1 animate-pulse">생성 중…</span>
            )}
          </div>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
            {enhanced}
            {state === 'loading' && (
              <span className="inline-block w-0.5 h-4 bg-purple-400 animate-pulse align-text-bottom ml-0.5" />
            )}
          </pre>
        </div>
      )}

      {/* 원본 본문 */}
      {(!showEnhanced || !hasResult) && (
        <div className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed bg-surface-overlay rounded-xl p-4 border border-gray-800">
          {current.body || body}
        </div>
      )}

      {/* 인용/전달 체인 */}
      {quoted.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide px-1">
            이전 메일 {quoted.length}건
          </p>
          {quoted.map((seg, i) => (
            <QuotedSegment key={i} segment={seg} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
