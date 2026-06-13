'use client';

import { useState } from 'react';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/types';
import { X, FolderOpen, CheckCircle2, Archive, Activity } from 'lucide-react';

interface Props {
  project: Project | null;
  onClose: () => void;
  onSave: (p: Project) => void;
}

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active',    icon: Activity,     color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.30)', glow: 'oklch(0.76 0.16 152 / 0.20)' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', border: 'oklch(0.55 0.14 218 / 0.30)', glow: 'oklch(0.68 0.18 218 / 0.20)' },
  { value: 'archived',  label: 'Archived',  icon: Archive,      color: 'oklch(0.60 0.01 245)', bg: 'oklch(0.20 0.010 240 / 0.60)', border: 'oklch(0.28 0.010 238)',       glow: 'oklch(0.60 0.01 245 / 0.12)' },
] as const;

export default function ProjectModal({ project, onClose, onSave }: Props) {
  const [name,   setName]   = useState(project?.name        ?? '');
  const [desc,   setDesc]   = useState(project?.description ?? '');
  const [client, setClient] = useState(project?.client_name ?? '');
  const [status, setStatus] = useState<'active' | 'completed' | 'archived'>(
    (project?.status as 'active' | 'completed' | 'archived') ?? 'active'
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('프로젝트 이름을 입력하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      let saved: Project;
      if (project) {
        saved = await projectsApi.update(project.id, {
          name: name.trim(),
          description: desc.trim() || undefined,
          client_name: client.trim() || undefined,
          status,
        });
      } else {
        saved = await projectsApi.create({
          name: name.trim(),
          description: desc.trim() || undefined,
          client_name: client.trim() || undefined,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'oklch(0.06 0.006 245 / 0.80)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, oklch(0.20 0.010 240) 0%, oklch(0.18 0.010 242) 100%)',
          border: '1px solid oklch(0.28 0.010 238)',
          borderRadius: 16,
          boxShadow: [
            '0 32px 80px rgba(0,0,0,0.65)',
            '0 0 0 1px rgba(255,255,255,0.05)',
            '0 0 40px oklch(0.76 0.16 196 / 0.12)',
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          ].join(', '),
          animation: 'modalIn 0.20s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 accent 라인 */}
        <div
          className="h-px w-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, oklch(0.76 0.16 196) 50%, transparent 100%)',
            opacity: 0.6,
          }}
        />

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid oklch(0.22 0.010 240)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'oklch(0.76 0.16 196 / 0.12)',
                border: '1px solid oklch(0.55 0.12 196 / 0.30)',
                boxShadow: '0 0 12px oklch(0.76 0.16 196 / 0.15)',
                color: 'var(--accent)',
              }}
            >
              <FolderOpen className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {project ? '프로젝트 수정' : '새 프로젝트'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.24 0.010 236)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">프로젝트 이름 *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: OTP 인증 시스템"
              autoFocus
            />
          </div>

          <div>
            <label className="label">클라이언트</label>
            <input
              className="input"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="예: 내부 보안팀"
            />
          </div>

          <div>
            <label className="label">설명</label>
            <textarea
              className="textarea"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="프로젝트 설명..."
            />
          </div>

          {/* 상태 선택 (수정 시) */}
          {project && (
            <div>
              <label className="label">상태</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: active ? opt.bg : 'transparent',
                        color: active ? opt.color : 'var(--text-faint)',
                        border: `1px solid ${active ? opt.border : 'oklch(0.24 0.010 238)'}`,
                        boxShadow: active ? `0 0 10px ${opt.glow}` : 'none',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: 'oklch(0.70 0.20 22 / 0.10)',
                border: '1px solid oklch(0.55 0.14 22 / 0.30)',
                color: 'oklch(0.70 0.20 22)',
              }}
            >
              {error}
            </div>
          )}

          {/* 섹션 구분선 */}
          <div
            className="h-px"
            style={{ background: 'oklch(0.22 0.010 240)' }}
          />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">취소</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
