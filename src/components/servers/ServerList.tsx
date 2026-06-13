'use client';

import { useEffect, useState } from 'react';
import { serversApi } from '@/lib/api';
import type { Server } from '@/lib/types';
import ServerModal from './ServerModal';
import {
  Plus, Edit2, Trash2, Server as ServerIcon,
  Wifi, WifiOff, AlertTriangle, HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

interface Props { projectId: number; }

const ROLE_COLORS: Record<string, string> = {
  auth:    'bg-purple-500/10 text-purple-400',
  gateway: 'bg-blue-500/10 text-blue-400',
  db:      'bg-amber-500/10 text-amber-400',
  web:     'bg-green-500/10 text-green-400',
  cache:   'bg-rose-500/10 text-rose-400',
  worker:  'bg-cyan-500/10 text-cyan-400',
  monitor: 'bg-indigo-500/10 text-indigo-400',
  other:   'bg-gray-500/10 text-gray-400',
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'online')   return <Wifi className="w-4 h-4 text-accent-green" />;
  if (status === 'offline')  return <WifiOff className="w-4 h-4 text-accent-red" />;
  if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-accent-yellow" />;
  return <HelpCircle className="w-4 h-4 text-gray-600" />;
};

export default function ServerList({ projectId }: Props) {
  const [servers,    setServers]    = useState<Server[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editServer, setEditServer] = useState<Server | null>(null);

  const load = () => {
    setLoading(true);
    serversApi.list(projectId)
      .then(setServers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleDelete = async (server: Server) => {
    if (!await confirm(`"${server.hostname || server.ip}" 서버를 삭제하시겠습니까?`)) return;
    await serversApi.delete(server.id);
    setServers((prev) => prev.filter((s) => s.id !== server.id));
  };

  const statusCounts = servers.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-100">서버 인프라</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            총 {servers.length}대
            {statusCounts.online   && ` · 온라인 ${statusCounts.online}`}
            {statusCounts.offline  && ` · 오프라인 ${statusCounts.offline}`}
            {statusCounts.degraded && ` · 저하 ${statusCounts.degraded}`}
          </p>
        </div>
        <button
          onClick={() => { setEditServer(null); setShowModal(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> 서버 추가
        </button>
      </div>

      {/* Server grid */}
      {loading ? (
        <div className="text-xs text-gray-500">로딩 중...</div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <ServerIcon className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500 mb-4">등록된 서버 없음</p>
          <button onClick={() => { setEditServer(null); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> 서버 추가
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map((server) => (
            <div key={server.id} className="card group relative">
              {/* Status indicator */}
              <div className="absolute top-4 right-4">
                <StatusIcon status={server.status} />
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-surface-overlay border border-gray-700 rounded-lg
                                flex items-center justify-center flex-shrink-0">
                  <ServerIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="font-medium text-gray-100 text-sm truncate">
                    {server.hostname ?? server.ip}
                  </div>
                  <div className="font-mono text-xs text-gray-500 mt-0.5">{server.ip}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {server.role && (
                  <span className={clsx('badge text-xs', ROLE_COLORS[server.role] ?? 'bg-gray-700 text-gray-400')}>
                    {server.role}
                  </span>
                )}
                {server.os && (
                  <span className="badge bg-gray-800 text-gray-400 text-xs">{server.os}</span>
                )}
                <span className={clsx(
                  'badge text-xs',
                  server.status === 'online'   && 'bg-accent-green/10 text-accent-green',
                  server.status === 'offline'  && 'bg-accent-red/10 text-accent-red',
                  server.status === 'degraded' && 'bg-accent-yellow/10 text-accent-yellow',
                  server.status === 'unknown'  && 'bg-gray-700 text-gray-400',
                )}>
                  {server.status}
                </span>
              </div>

              {server.notes && (
                <p className="text-xs text-gray-500 mt-3 line-clamp-2">{server.notes}</p>
              )}

              {/* Actions */}
              <div className="absolute bottom-4 right-4 hidden group-hover:flex gap-1">
                <button
                  onClick={() => { setEditServer(server); setShowModal(true); }}
                  className="p-1.5 rounded-lg bg-surface-overlay hover:bg-white/10 text-gray-500 hover:text-gray-300"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(server)}
                  className="p-1.5 rounded-lg bg-surface-overlay hover:bg-accent-red/10 text-gray-500 hover:text-accent-red"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ServerModal
          projectId={projectId}
          server={editServer}
          onClose={() => setShowModal(false)}
          onSave={(s) => {
            setServers((prev) => {
              const idx = prev.findIndex((x) => x.id === s.id);
              if (idx >= 0) { const n = [...prev]; n[idx] = s; return n; }
              return [s, ...prev];
            });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
