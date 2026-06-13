'use client';

import { useState } from 'react';
import { serversApi } from '@/lib/api';
import type { Server, ServerRole, ServerStatus } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  projectId: number;
  server: Server | null;
  onClose: () => void;
  onSave: (s: Server) => void;
}

const ROLES: ServerRole[] = ['auth', 'gateway', 'db', 'web', 'cache', 'worker', 'monitor', 'other'];
const STATUSES: ServerStatus[] = ['online', 'offline', 'degraded', 'unknown'];

export default function ServerModal({ projectId, server, onClose, onSave }: Props) {
  const [ip,       setIp]       = useState(server?.ip       ?? '');
  const [hostname, setHostname] = useState(server?.hostname ?? '');
  const [role,     setRole]     = useState<ServerRole>(server?.role ?? 'other');
  const [os,       setOs]       = useState(server?.os       ?? '');
  const [status,   setStatus]   = useState<ServerStatus>(server?.status ?? 'unknown');
  const [notes,    setNotes]    = useState(server?.notes    ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) { setError('IP 주소를 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      let saved: Server;
      if (server) {
        saved = await serversApi.update(server.id, {
          ip: ip.trim(), hostname: hostname || null,
          role, os: os || null, status, notes: notes || null,
        });
      } else {
        saved = await serversApi.create({
          project_id: projectId,
          ip: ip.trim(), hostname: hostname || null,
          role, os: os || null, status, notes: notes || null,
        });
      }
      onSave(saved);
    } catch (err: any) {
      setError(err.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-gray-100">{server ? '서버 수정' : '서버 추가'}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">IP 주소 *</label>
              <input className="input" value={ip} onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.10.1" autoFocus />
            </div>
            <div>
              <label className="label">호스트명</label>
              <input className="input" value={hostname} onChange={(e) => setHostname(e.target.value)}
                placeholder="otp-auth-01" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">역할</label>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as ServerRole)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">상태</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ServerStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">OS</label>
              <input className="input" value={os} onChange={(e) => setOs(e.target.value)}
                placeholder="Ubuntu 22.04" />
            </div>
          </div>

          <div>
            <label className="label">메모</label>
            <textarea className="textarea" rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder="서버 메모..." />
          </div>

          {error && <p className="text-accent-red text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">취소</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
