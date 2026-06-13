'use client';

import { X, Activity, Briefcase, Zap, Loader2, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Agent } from './mockData';
import { aiCompanyApi, type AICompanyTask } from '@/lib/api';

interface Props {
  agent: Agent | null;
  companyId?: number;
  onClose: () => void;
}

const statusLabel: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  online:  { label: 'Online',  cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  busy:    { label: 'Busy',    cls: 'bg-amber-100 text-amber-700',     icon: Loader2 },
  away:    { label: 'Away',    cls: 'bg-gray-100 text-gray-500',       icon: Clock },
};

const moodLabel: Record<string, string> = {
  happy:   '😊 Happy',
  focused: '🎯 Focused',
  excited: '🚀 Excited',
  neutral: '😐 Neutral',
};

const taskStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  done:    { label: '완료',   color: '#059669', icon: CheckCircle2 },
  running: { label: '진행 중', color: '#D97706', icon: Loader2 },
  pending: { label: '대기',   color: '#64748b', icon: Clock },
  failed:  { label: '실패',   color: '#DC2626', icon: AlertCircle },
};

export default function AgentDetailModal({ agent, companyId, onClose }: Props) {
  const [tasks,    setTasks]    = useState<AICompanyTask[]>([]);
  const [msg,      setMsg]      = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  useEffect(() => {
    if (!agent || !companyId) return;
    aiCompanyApi.tasks(companyId).then(all => {
      const mine = all.filter(t => t.agent_role === agent.id).slice(0, 6);
      setTasks(mine);
    }).catch(() => {});
  }, [agent?.id, companyId]);

  if (!agent) return null;

  const st = statusLabel[agent.status] ?? statusLabel.away;
  const StatusIcon = st.icon;

  async function handleSend() {
    if (!msg.trim() || !companyId || sending || !agent) return;
    setSending(true);
    try {
      await aiCompanyApi.sendMessage(
        companyId,
        `[${agent.name}에게] ${msg}`,
        'message',
      );
      setSent(true);
      setMsg('');
      setTimeout(() => setSent(false), 2000);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-96 border border-violet-100 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-5 pb-4" style={{ background: agent.color + '08' }}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md border-2 shrink-0"
              style={{ background: agent.color + '15', borderColor: agent.color + '40' }}
            >
              {agent.emoji}
            </div>
            <div>
              <div className="font-bold text-gray-800 text-base">{agent.name}</div>
              <div className="text-xs text-gray-500">{agent.role}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                  <StatusIcon className={`w-3 h-3 ${agent.status === 'busy' ? 'animate-spin' : ''}`} />
                  {st.label}
                </span>
                <span className="text-xs text-gray-400">{agent.department}</span>
              </div>
            </div>
          </div>

          {/* 현재 태스크 */}
          <div className="mt-3 bg-white/70 rounded-xl p-2.5 text-xs text-gray-600 border border-white">
            <span className="font-semibold text-gray-500">현재: </span>
            {agent.currentTask}
          </div>
        </div>

        <div className="p-5 pt-4 space-y-4">
          {/* 상태 정보 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
              <Activity className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-gray-500">무드:</span>
              <span className="font-medium text-gray-700">{moodLabel[agent.mood]}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
              <Briefcase className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-gray-500">부서:</span>
              <span className="font-medium text-gray-700 truncate">{agent.department}</span>
            </div>
          </div>

          {/* 태스크 이력 */}
          {tasks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">최근 태스크</p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {tasks.map(t => {
                  const cfg = taskStatusConfig[t.status] ?? taskStatusConfig.pending;
                  const Ic = cfg.icon;
                  return (
                    <div key={t.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100">
                      <Ic className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${t.status === 'running' ? 'animate-spin' : ''}`}
                          style={{ color: cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 truncate">{t.title}</div>
                        {t.result && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{t.result.slice(0, 80)}…</div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 메시지 전송 */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">에이전트에게 메시지</p>
            <div className="flex gap-2">
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={`${agent.name}에게 지시하세요...`}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-violet-300 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim() || !companyId || sending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40 transition-all"
                style={{ background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)` }}
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sent ? '✓' : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
