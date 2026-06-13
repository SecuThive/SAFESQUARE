'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { worklogsApi, projectsApi } from '@/lib/api';
import type { WorkLog, WorkLogType, Project } from '@/lib/types';
import {
  Plus, X, Edit2, Trash2, ChevronDown, Clock,
  AlertTriangle, Wrench, GraduationCap, ClipboardList, MoreHorizontal,
  FileText, Filter,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';
import TableSkeleton from '@/components/ui/TableSkeleton';
import UserBadge from '@/components/ui/UserBadge';
import CommentSection from '@/components/ui/CommentSection';

/* ── 메타 ── */
const TYPE_META: Record<WorkLogType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  regular:     { label: '정기점검', color: 'text-brand',          bg: 'bg-brand/10',          icon: ClipboardList   },
  emergency:   { label: '긴급조치', color: 'text-red-400',        bg: 'bg-red-900/20',        icon: AlertTriangle   },
  maintenance: { label: '유지보수', color: 'text-yellow-400',     bg: 'bg-yellow-900/20',     icon: Wrench          },
  training:    { label: '교육',     color: 'text-purple-400',     bg: 'bg-purple-900/20',     icon: GraduationCap   },
  other:       { label: '기타',     color: 'text-gray-400',       bg: 'bg-gray-700/40',       icon: MoreHorizontal  },
};

const today = () => new Date().toISOString().slice(0, 10);

/* ═══════════════════════════════════════════════════════ */
export default function WorkLogsPage() {
  const [logs, setLogs]               = useState<WorkLog[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [filterProject, setFilter]    = useState<number | ''>('');
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<WorkLog | null>(null);
  const [expanded, setExpanded]       = useState<number | null>(null);

  useEffect(() => {
    Promise.all([worklogsApi.list(), projectsApi.list()])
      .then(([wls, ps]) => { setLogs(wls); setProjects(ps); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterProject
    ? logs.filter((l) => l.project_id === filterProject)
    : logs;

  const projectName = (id: number) =>
    projects.find((p) => p.id === id)?.name ?? `프로젝트 #${id}`;

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(log: WorkLog) { setEditing(log); setShowModal(true); }

  async function handleSave(data: Omit<WorkLog, 'id' | 'created_at' | 'updated_at'>) {
    if (editing) {
      const updated = await worklogsApi.update(editing.id, data);
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } else {
      const created = await worklogsApi.create(data);
      setLogs((prev) => [created, ...prev]);
    }
    setShowModal(false);
  }

  async function handleDelete(id: number) {
    if (!await confirm('이 작업일지를 삭제하시겠습니까?')) return;
    await worklogsApi.delete(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (expanded === id) setExpanded(null);
  }

  const totalHours = filtered.reduce((sum, l) => sum + (l.hours ?? 0), 0);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-100">작업일지</h1>
              <p className="text-xs text-gray-500 mt-0.5">현장 작업 기록 및 이력 관리</p>
            </div>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 flex-shrink-0">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">작업일지</span> 작성
            </button>
          </div>

          {/* 필터 + 요약 */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-600" />
              <select
                value={filterProject}
                onChange={(e) => setFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="select text-sm py-1.5"
              >
                <option value="">전체 프로젝트</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
              <span>{filtered.length}건</span>
              {totalHours > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  총 {totalHours}시간
                </span>
              )}
            </div>
          </div>

          {/* 목록 */}
          {loading ? (
            <TableSkeleton rows={4} rowHeight="h-16" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">작업일지가 없습니다</p>
              <button onClick={openCreate} className="btn-primary mt-4 text-sm">
                <Plus className="w-4 h-4" /> 첫 작업일지 작성
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((log) => {
                const meta = TYPE_META[log.work_type as WorkLogType] ?? TYPE_META.other;
                const Icon = meta.icon;
                const isOpen = expanded === log.id;

                return (
                  <div
                    key={log.id}
                    className="bg-surface-raised border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
                  >
                    {/* 행 헤더 */}
                    <div
                      className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                    >
                      {/* 날짜 */}
                      <div className="text-center flex-shrink-0 w-14">
                        <p className="text-xs font-bold text-gray-300">
                          {format(new Date(log.work_date), 'MM/dd', { locale: ko })}
                        </p>
                        <p className="text-[10px] text-gray-600">
                          {format(new Date(log.work_date), 'EEE', { locale: ko })}
                        </p>
                      </div>

                      {/* 유형 뱃지 */}
                      <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', meta.bg, meta.color)}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>

                      {/* 제목 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{log.title}</p>
                        <p className="text-xs text-gray-600 truncate">{projectName(log.project_id)}</p>
                      </div>

                      {/* 메타 */}
                      <div className="flex items-center gap-3 text-xs text-gray-600 flex-shrink-0">
                        {log.engineer && <span>{log.engineer}</span>}
                        {log.hours != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{log.hours}h
                          </span>
                        )}
                        {log.created_by && (
                          <UserBadge username={log.created_by} size="xs" />
                        )}
                      </div>

                      {/* 액션 */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(log)} className="p-1.5 rounded text-gray-600 hover:text-brand hover:bg-brand/10 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(log.id)} className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown className={clsx('w-4 h-4 text-gray-600 transition-transform', isOpen && 'rotate-180')} />
                      </div>
                    </div>

                    {/* 상세 내용 */}
                    {isOpen && (
                      <div className="border-t border-gray-800/60 px-5 py-4 space-y-4 bg-surface/40">
                        <Section label="작업 내용" content={log.content} />
                        {log.issues     && <Section label="특이사항"   content={log.issues} color="text-yellow-400" />}
                        {log.next_actions && <Section label="후속 조치" content={log.next_actions} color="text-blue-400" />}
                        <div className="border-t border-gray-800/60 pt-3">
                          <CommentSection entityType="worklog" entityId={log.id} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <WorkLogModal
          editing={editing}
          projects={projects}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

/* ── 섹션 ── */
function Section({ label, content, color }: { label: string; content: string; color?: string }) {
  return (
    <div>
      <p className={clsx('text-xs font-semibold mb-1', color ?? 'text-gray-500')}>{label}</p>
      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

/* ── 작업일지 작성/수정 모달 ── */
function WorkLogModal({
  editing, projects, onSave, onClose,
}: {
  editing: WorkLog | null;
  projects: Project[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    project_id:   editing?.project_id   ?? (projects[0]?.id ?? 0),
    title:        editing?.title        ?? '',
    work_date:    editing?.work_date    ?? today(),
    work_type:    editing?.work_type    ?? 'regular',
    engineer:     editing?.engineer     ?? '',
    hours:        editing?.hours != null ? String(editing.hours) : '',
    content:      editing?.content      ?? '',
    issues:       editing?.issues       ?? '',
    next_actions: editing?.next_actions ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        project_id:   Number(form.project_id),
        title:        form.title,
        work_date:    form.work_date,
        work_type:    form.work_type,
        engineer:     form.engineer || null,
        hours:        form.hours ? Number(form.hours) : null,
        content:      form.content,
        issues:       form.issues || null,
        next_actions: form.next_actions || null,
      });
    } catch (err: any) {
      setError(err.message ?? '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">
            {editing ? '작업일지 수정' : '작업일지 작성'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* 프로젝트 + 날짜 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">프로젝트 *</label>
                <select
                  value={form.project_id}
                  onChange={(e) => set('project_id', e.target.value)}
                  className="select w-full"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">작업 날짜 *</label>
                <input
                  type="date"
                  value={form.work_date}
                  onChange={(e) => set('work_date', e.target.value)}
                  required
                  className="input w-full"
                />
              </div>
            </div>

            {/* 유형 + 담당자 + 시간 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">작업 유형</label>
                <select value={form.work_type} onChange={(e) => set('work_type', e.target.value)} className="select w-full">
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">담당자</label>
                <input type="text" value={form.engineer} onChange={(e) => set('engineer', e.target.value)} placeholder="홍길동" className="input w-full" />
              </div>
              <div>
                <label className="label">소요 시간 (h)</label>
                <input type="number" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="3.5" step="0.5" min="0" className="input w-full" />
              </div>
            </div>

            {/* 제목 */}
            <div>
              <label className="label">작업 제목 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="예: OTP 서버 정기 점검"
                required
                className="input w-full"
              />
            </div>

            {/* 작업 내용 */}
            <div>
              <label className="label">작업 내용 *</label>
              <textarea
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                placeholder="수행한 작업을 상세히 기록하세요"
                required
                rows={4}
                className="textarea w-full"
              />
            </div>

            {/* 특이사항 */}
            <div>
              <label className="label">특이사항 <span className="text-gray-600 font-normal">(선택)</span></label>
              <textarea
                value={form.issues}
                onChange={(e) => set('issues', e.target.value)}
                placeholder="발생한 문제, 이상 징후 등"
                rows={2}
                className="textarea w-full"
              />
            </div>

            {/* 후속 조치 */}
            <div>
              <label className="label">후속 조치 <span className="text-gray-600 font-normal">(선택)</span></label>
              <textarea
                value={form.next_actions}
                onChange={(e) => set('next_actions', e.target.value)}
                placeholder="다음 방문 시 확인 사항, 예정 작업 등"
                rows={2}
                className="textarea w-full"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex gap-2 px-6 pb-6">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
