'use client';

import { useState, useRef, useEffect } from 'react';
import { aiCompanyApi } from '@/lib/api';

interface Props {
  companyId?: number;
  onCommand: (cmd: string) => void;
  onQuickAction: (action: string) => void;
}

const COMMANDS = [
  { ico: '✦', label: 'Q3 OKR 전략 브리핑', shortcut: '⌘1' },
  { ico: '◆', label: 'CEO → 디렉터 동기화 스케줄', shortcut: '⌘2' },
  { ico: '↑', label: '주간 성과 보고서 생성', shortcut: '⌘3' },
  { ico: '⚡', label: '전체 에이전트 브로드캐스트', shortcut: '⌘B' },
  { ico: '＋', label: '마케팅 태스크 생성', shortcut: '⌘N' },
  { ico: '✉', label: 'HR AI 이메일 업데이트 초안', shortcut: '⌘E' },
];

const QUICK = [
  { label: 'Broadcast',       action: 'broadcast',      msg: '📡 전체 팀 현황 브로드캐스트' },
  { label: 'Create Task',     action: 'create_task',    msg: '✅ 수익화 태스크 즉시 생성' },
  { label: 'Schedule Meeting',action: 'standup',        msg: '📅 팀 스탠드업 진행' },
  { label: 'Generate Report', action: 'generate_report',msg: '📊 진행 상황 보고서 생성' },
];

export default function CommandBar({ companyId, onCommand, onQuickAction }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function send(message: string, action = 'message') {
    if (!message.trim()) return;
    if (companyId) {
      setLoading(action);
      try {
        await aiCompanyApi.sendMessage(companyId, message, action);
        onCommand(message);
      } catch { /* ignore */ } finally { setLoading(null); }
    } else { onCommand(message); }
    if (action === 'message') setText('');
    setOpen(false);
  }

  async function handleQuick(action: string, msg: string) {
    onQuickAction(msg);
    if (companyId) {
      setLoading(action);
      try { await aiCompanyApi.sendMessage(companyId, msg, action); }
      catch { /* ignore */ } finally { setLoading(null); }
    }
  }

  const S = {
    bar: {
      position: 'absolute' as const, left: 14, right: 14, bottom: 14,
      background: 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(16px)',
      borderRadius: 14,
      border: '1px solid #ecebef',
      boxShadow: '0 10px 30px -10px rgba(20,18,30,0.18)',
      zIndex: 5, overflow: 'hidden',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    },
    inputRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 14px' },
    spark: {
      width: 28, height: 28, borderRadius: 8,
      display: 'grid', placeItems: 'center',
      background: 'linear-gradient(135deg, #8a7bff, #5b46e8)',
      color: '#fff', flexShrink: 0,
      boxShadow: '0 4px 10px -3px rgba(109,91,255,0.45)',
    },
    input: {
      flex: 1, border: 0, outline: 0, background: 'transparent',
      font: '500 15px/1.2 "Plus Jakarta Sans", sans-serif',
      color: '#1b1a22',
    },
    send: {
      display: 'inline-flex', alignItems: 'center', gap: 8,
      height: 36, padding: '0 16px',
      background: '#6d5bff', color: '#fff',
      border: 0, borderRadius: 9,
      font: '600 13.5px/1 "Plus Jakarta Sans", sans-serif',
      cursor: 'pointer',
      boxShadow: '0 6px 14px -4px rgba(109,91,255,0.5)',
    },
    actionsRow: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px 12px',
    },
    chip: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      height: 36, padding: '0 13px',
      border: '1px solid #ecebef',
      background: '#fff', color: '#3a3845',
      borderRadius: 9,
      font: '600 13px/1 "Plus Jakarta Sans", sans-serif',
      cursor: 'pointer', whiteSpace: 'nowrap' as const,
      transition: 'all 0.12s',
    },
    pop: {
      borderTop: '1px solid #ecebef',
      padding: 6,
      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4,
    },
    popBtn: {
      display: 'flex', alignItems: 'center', gap: 10,
      textAlign: 'left' as const,
      padding: '8px 10px', borderRadius: 8,
      border: 0, background: 'transparent', cursor: 'pointer',
      font: '500 13px/1.2 "Plus Jakarta Sans", sans-serif',
      color: '#3a3845',
    },
  };

  return (
    <div style={S.bar} ref={ref}>
      <div style={S.inputRow}>
        <div style={S.spark}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5 13.5 9 19 10.5 13.5 12 12 17.5 10.5 12 5 10.5 10.5 9 12 3.5Z" />
            <path d="M19 16.5 19.7 18.5 21.7 19.2 19.7 19.9 19 21.9 18.3 19.9 16.3 19.2 18.3 18.5 19 16.5Z" />
          </svg>
        </div>
        <input
          style={{ ...S.input, caretColor: '#6d5bff' }}
          placeholder={companyId ? 'AI 팀에게 지시하세요… (Enter 전송)' : 'AI 회사를 먼저 선택하세요'}
          value={text}
          disabled={!companyId && !text}
          onFocus={() => setOpen(true)}
          onChange={e => { setText(e.target.value); setOpen(true); }}
          onKeyDown={e => e.key === 'Enter' && send(text)}
        />
        <button style={S.send} onClick={() => send(text)} disabled={!text.trim() || loading === 'message'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 12 16-8-6 18-2.5-7L4 12Z" />
          </svg>
          Send
        </button>
      </div>

      {open && (
        <div style={S.pop}>
          <div style={{ font: '600 11px/1 "Plus Jakarta Sans", sans-serif', color: '#a09ead', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '8px 8px 4px', gridColumn: '1 / -1' }}>Suggestions</div>
          {COMMANDS.map((c, i) => (
            <button key={i} style={S.popBtn}
              onClick={() => { setText(c.label); setOpen(false); }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#f3f2f6'; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#f3f2f6', color: '#3a3845', flexShrink: 0 }}>{c.ico}</span>
              <span style={{ flex: 1, fontSize: 12.5 }}>{c.label}</span>
              <kbd style={{ marginLeft: 'auto', font: '11px/1 "JetBrains Mono", monospace', color: '#a09ead' }}>{c.shortcut}</kbd>
            </button>
          ))}
        </div>
      )}

      <div style={S.actionsRow}>
        {QUICK.map(q => (
          <button
            key={q.action}
            style={{ ...S.chip, opacity: !companyId || loading ? 0.45 : 1 }}
            disabled={!companyId || !!loading}
            onClick={() => handleQuick(q.action, q.msg)}
            onMouseOver={e => { if (companyId && !loading) { (e.currentTarget as HTMLElement).style.borderColor = '#a09ead'; (e.currentTarget as HTMLElement).style.color = '#1b1a22'; } }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ecebef'; (e.currentTarget as HTMLElement).style.color = '#3a3845'; }}
          >
            {loading === q.action ? '···' : q.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
      </div>
    </div>
  );
}
