'use client';

import { useEffect, useState, useRef } from 'react';
import { logsApi } from '@/lib/api';
import type { Log, LogType } from '@/lib/types';
import { format } from 'date-fns';
import {
  RefreshCw, Trash2, Plus, X, Filter,
  ShieldAlert, AlertTriangle, Info, Terminal, CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

interface Props { projectId: number; }

const LOG_META: Record<LogType, { label: string; color: string; icon: React.ElementType }> = {
  auth:    { label: 'AUTH',    color: 'text-purple-400 bg-purple-400/10',  icon: ShieldAlert },
  error:   { label: 'ERROR',   color: 'text-accent-red bg-accent-red/10',  icon: AlertTriangle },
  warning: { label: 'WARN',    color: 'text-accent-yellow bg-yellow-400/10', icon: AlertTriangle },
  system:  { label: 'SYS',     color: 'text-blue-400 bg-blue-400/10',     icon: Terminal },
  info:    { label: 'INFO',    color: 'text-accent-green bg-accent-green/10', icon: Info },
};

interface AddLogForm {
  type: LogType;
  message: string;
  source: string;
}

export default function LogsViewer({ projectId }: Props) {
  const [logs,       setLogs]       = useState<Log[]>([]);
  const [filter,     setFilter]     = useState<LogType | 'all'>('all');
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [expanded,   setExpanded]   = useState<number | null>(null);
  const [form,       setForm]       = useState<AddLogForm>({ type: 'info', message: '', source: '' });
  const [adding,     setAdding]     = useState(false);

  const load = () => {
    setLoading(true);
    const type = filter === 'all' ? undefined : filter;
    logsApi.list(projectId, type, 200)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId, filter]);

  const handleDelete = async (log: Log) => {
    await logsApi.delete(log.id);
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
  };

  const handleClear = async () => {
    if (!await confirm('이 프로젝트의 모든 로그를 삭제하시겠습니까?', { title: '전체 로그 삭제' })) return;
    await logsApi.clear(projectId);
    setLogs([]);
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setAdding(true);
    const log = await logsApi.create({
      project_id: projectId,
      type: form.type,
      message: form.message.trim(),
      source: form.source.trim() || undefined,
    });
    setLogs((prev) => [log, ...prev]);
    setForm({ type: 'info', message: '', source: '' });
    setShowAdd(false);
    setAdding(false);
  };

  const typeCounts = logs.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-800 bg-surface-raised flex-shrink-0">
        {/* Type filters */}
        <div className="flex gap-1 flex-1 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              filter === 'all' ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
            )}
          >
            전체 {logs.length > 0 && `(${logs.length})`}
          </button>
          {(Object.keys(LOG_META) as LogType[]).map((t) => {
            const { label, color } = LOG_META[t];
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={clsx(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  filter === t ? color : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                )}
              >
                {label} {typeCounts[t] ? `(${typeCounts[t]})` : ''}
              </button>
            );
          })}
        </div>

        <button onClick={load} className="btn-ghost p-1.5 text-gray-500">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-1">
          <Plus className="w-3 h-3" /> 추가
        </button>
        <button onClick={handleClear} className="btn-danger text-xs py-1">
          <Trash2 className="w-3 h-3" /> 전체 삭제
        </button>
      </div>

      {/* Add log form */}
      {showAdd && (
        <div className="px-6 py-4 border-b border-gray-800 bg-surface-overlay flex-shrink-0">
          <form onSubmit={handleAddLog} className="flex gap-3 items-end">
            <div className="w-28">
              <label className="label">유형</label>
              <select className="select text-xs" value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LogType }))}>
                {(Object.keys(LOG_META) as LogType[]).map((t) => (
                  <option key={t} value={t}>{LOG_META[t].label}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="label">소스</label>
              <input className="input text-xs" value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="otp-auth-01" />
            </div>
            <div className="flex-1">
              <label className="label">메시지</label>
              <input className="input text-xs" value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="로그 메시지..." autoFocus />
            </div>
            <button type="submit" disabled={adding} className="btn-primary text-xs">저장</button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost p-2">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Logs table */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {loading ? (
          <div className="p-6 text-gray-500">로딩 중...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-600">로그 없음</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-surface-raised border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-gray-500 w-36">시각</th>
                <th className="text-left px-2 py-2 text-[10px] font-medium text-gray-500 w-20">유형</th>
                <th className="text-left px-2 py-2 text-[10px] font-medium text-gray-500 w-32">소스</th>
                <th className="text-left px-2 py-2 text-[10px] font-medium text-gray-500">메시지</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const meta = LOG_META[log.type as LogType] ?? LOG_META.info;
                const Icon = meta.icon;
                const isExpanded = expanded === log.id;
                return (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => setExpanded(isExpanded ? null : log.id)}
                      className={clsx(
                        'border-b border-gray-800/60 cursor-pointer transition-colors group',
                        'hover:bg-surface-overlay/50',
                        isExpanded && 'bg-surface-overlay',
                      )}
                    >
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                        {format(new Date(log.created_at), 'MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-2 py-2">
                        <span className={clsx('badge text-[10px]', meta.color)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-gray-500 truncate max-w-[8rem]">
                        {log.source ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-gray-300 truncate">
                        {log.message}
                      </td>
                      <td className="px-2 py-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(log); }}
                          className="hidden group-hover:block p-1 hover:text-accent-red text-gray-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && log.metadata && (
                      <tr key={`${log.id}-exp`} className="bg-surface-overlay">
                        <td colSpan={5} className="px-6 py-3">
                          <pre className="text-[10px] text-gray-400 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
