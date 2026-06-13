'use client';

import { useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthHeaders, designQueueApi, blogQueueApi, type TrendStatus, type BlogJob, type BlogStageStatus } from '@/lib/api';
import clsx from 'clsx';
import { format, parseISO, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Plus, Pencil, Trash2, X, Loader2, Circle, Clock,
  CheckCircle2, FolderKanban, AlertCircle, Calendar,
  StickyNote, AlignLeft, ArrowUp, ArrowRight, ArrowDown,
  ExternalLink, FolderOpen, Eye, EyeOff, Copy, Check,
  Upload, Download, Shield, Settings, ListChecks, Terminal,
  ChevronDown, RefreshCw, Activity, GitBranch, Zap, Play,
  XCircle, Globe, Cpu, Wifi, WifiOff, RotateCcw, Timer,
  GitCommit, GitPullRequest, Package, Hammer, Server,
  TrendingUp, ChevronRight, BookOpen, FileText, Sparkles, BarChart2,
  DollarSign, MousePointerClick, ShoppingCart, Ban,
  Image as ImageIcon, ThumbsUp, MessageCircle, Trophy,
  Lightbulb, Camera,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────

type ProjectStatus   = 'idea' | 'in_progress' | 'launched' | 'paused' | 'cancelled';
type ProjectCategory = 'app' | 'web' | 'content' | 'consulting' | 'saas' | 'other';
type TaskStatus      = 'pending' | 'in_progress' | 'done';
type TaskPriority    = 'high' | 'medium' | 'low';
type WorkspaceTab    = 'board' | 'env' | 'log' | 'ops' | 'cron' | 'revenue' | 'uploads';

interface Task {
  id: number; project_id: number; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority; due_date: string | null; sort_order: number;
}
interface Note {
  id: number; project_id: number; content: string; created_at: string;
}
interface EnvVar {
  id: number; project_id: number; key: string; value: string;
  is_secret: boolean; description: string | null; group_name: string | null; sort_order: number;
}
interface ProjectLink { label: string; url: string; }
interface PersonalProject {
  id: number; title: string; description: string | null; status: ProjectStatus;
  category: ProjectCategory; target_revenue: number | null; current_revenue: number | null;
  start_date: string | null; target_date: string | null; memo: string | null;
  links: string | null; local_path: string | null; sort_order: number;
  milestones: Task[]; notes: Note[]; envs: EnvVar[];
}
interface HealthResult {
  url: string; label: string; status: number | null;
  ok: boolean; latency_ms: number | null; error: string | null;
}
interface GitStatus {
  available: boolean; reason?: string;
  branch: string | null; dirty: string | null; log: string | null;
  remote: string | null; ahead_behind: string | null;
}
interface RecentDesign {
  id: string; title: string; slug: string; category: string;
  image_url: string; created_at: string; quality_score?: number | null;
}
interface DesignItem {
  id: string; title: string; slug: string; category: string;
  image_url: string; created_at: string;
  quality_score?: number | null; status?: string; colors?: string[];
}
interface DesignRequest {
  id: string; title: string; category: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  vote_count: number | null; created_at: string;
}

// ── 상수 ──────────────────────────────────────────────────────

const STATUS_META: Record<ProjectStatus, { label: string; dot: string; color: string }> = {
  idea:        { label: '아이디어', dot: 'bg-purple-400',  color: 'text-purple-400'  },
  in_progress: { label: '진행 중',  dot: 'bg-brand',       color: 'text-brand'       },
  launched:    { label: '런칭',     dot: 'bg-emerald-400', color: 'text-emerald-400' },
  paused:      { label: '일시중단', dot: 'bg-yellow-400',  color: 'text-yellow-400'  },
  cancelled:   { label: '취소',     dot: 'bg-gray-600',    color: 'text-gray-500'    },
};
const CATEGORY_META: Record<ProjectCategory, { label: string; emoji: string }> = {
  app: {label:'앱',emoji:'📱'}, web: {label:'웹',emoji:'🌐'},
  content: {label:'콘텐츠',emoji:'✍️'}, consulting: {label:'컨설팅',emoji:'💼'},
  saas: {label:'SaaS',emoji:'☁️'}, other: {label:'기타',emoji:'📦'},
};
const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  high:   { label:'높음', color:'text-red-400',    bg:'bg-red-400/10',    Icon: ArrowUp    },
  medium: { label:'보통', color:'text-yellow-400', bg:'bg-yellow-400/10', Icon: ArrowRight },
  low:    { label:'낮음', color:'text-gray-500',   bg:'bg-gray-500/10',   Icon: ArrowDown  },
};
const COLUMNS: { status: TaskStatus; label: string; color: string; headerBg: string }[] = [
  { status:'pending',     label:'할 일',   color:'text-gray-400',    headerBg:'bg-gray-500/10'   },
  { status:'in_progress', label:'진행 중', color:'text-brand',       headerBg:'bg-brand/10'      },
  { status:'done',        label:'완료',    color:'text-emerald-400', headerBg:'bg-emerald-500/10'},
];

const BASE = '/api/personal-projects';

function fmt(iso: string) { return format(parseISO(iso), 'M/d', { locale: ko }); }
function fmtFull(iso: string) { return format(parseISO(iso), 'yyyy.MM.dd', { locale: ko }); }
function parseLinks(raw: string | null): ProjectLink[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

// ── 클립보드 복사 훅 ─────────────────────────────────────────
// HTTPS가 아닌 환경(plain http)에서는 navigator.clipboard가 undefined이므로
// execCommand 폴백을 포함한 공용 헬퍼를 사용한다.

const VIDEO_PROMPT_TEMPLATE = `Create exactly a 10-second video, no shorter no longer.
The character delivers the following English dialogue out loud
with clear and audible voice throughout the entire video duration.

Voice style: firm, irritated, scolding, slightly robotic mechanical tone.
The voice must be clearly heard from start to finish with no silence gaps.
Sync the mouth movement of the character precisely to the English speech.

Dialogue: __SCRIPT__

Requirements:
- Total duration: exactly 10 seconds
- Voice must be fully audible, not muffled or faded
- No background music louder than the voice
- Character must be speaking for the majority of the 10 seconds
- No subtitles, no captions, no text overlay of any kind on the video`;

function buildVideoPrompt(_imagePrompt: string, dialogue: string): string {
  const line = (dialogue ?? '').trim() || '[여기에 대사 입력]';
  return VIDEO_PROMPT_TEMPLATE.replace('__SCRIPT__', line);
}

async function safeCopy(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.contentEditable = 'true';
    ta.style.position = 'fixed';
    ta.style.left = '0';
    ta.style.top = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.boxShadow = 'none';
    ta.style.background = 'transparent';
    ta.style.fontSize = '16px';
    document.body.appendChild(ta);
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.setSelectionRange(0, text.length);
    ta.focus();
    const ok = document.execCommand('copy');
    sel?.removeAllRanges();
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    safeCopy(text).then(ok => {
      if (ok) {
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      }
    });
  }
  return { copied, copy };
}

// ── 프로젝트 폼 ───────────────────────────────────────────────

function ProjectFormModal({ initial, onClose, onSave }: {
  initial?: PersonalProject | null; onClose: () => void; onSave: (p: PersonalProject) => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title:       initial?.title ?? '',
    description: initial?.description ?? '',
    status:      (initial?.status ?? 'idea') as ProjectStatus,
    category:    (initial?.category ?? 'other') as ProjectCategory,
    start_date:  initial?.start_date ?? '',
    target_date: initial?.target_date ?? '',
    local_path:  initial?.local_path ?? '',
    memo:        initial?.memo ?? '',
  });
  const [links, setLinks] = useState<{label:string;url:string}[]>(() => {
    try { return initial?.links ? JSON.parse(initial.links) : []; } catch { return []; }
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        description: form.description || null,
        start_date:  form.start_date  || null,
        target_date: form.target_date || null,
        local_path:  form.local_path  || null,
        memo:        form.memo        || null,
        links: links.filter(l => l.url).length > 0 ? JSON.stringify(links.filter(l => l.url)) : null,
      };
      const res = await fetch(isEdit ? `${BASE}/${initial!.id}` : BASE, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      onSave(await res.json());
    } catch { alert('저장 실패'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-100">{isEdit ? '프로젝트 수정' : '새 프로젝트'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <input required className="input w-full" placeholder="프로젝트 이름 *" value={form.title} autoFocus onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          <textarea className="input w-full text-sm resize-none" rows={2} placeholder="간략한 설명" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label text-[10px]">카테고리</label>
              <select className="select w-full text-sm" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value as ProjectCategory}))}>
                {(Object.entries(CATEGORY_META) as [ProjectCategory,{label:string;emoji:string}][]).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select></div>
            <div><label className="label text-[10px]">상태</label>
              <select className="select w-full text-sm" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as ProjectStatus}))}>
                {(Object.entries(STATUS_META) as [ProjectStatus,{label:string}][]).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label text-[10px]">시작일</label><input type="date" className="input w-full text-sm" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} /></div>
            <div><label className="label text-[10px]">목표 완료일</label><input type="date" className="input w-full text-sm" value={form.target_date} onChange={e => setForm(f => ({...f, target_date: e.target.value}))} /></div>
          </div>
          {/* 로컬 경로 */}
          <div>
            <label className="label text-[10px]">로컬 경로 (자동화용)</label>
            <input className="input w-full text-sm font-mono" placeholder="/Users/me/project/my-app" value={form.local_path}
              onChange={e => setForm(f => ({...f, local_path: e.target.value}))} />
          </div>
          {/* 링크 편집기 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label text-[10px]">서비스 URL (상태 모니터링)</label>
              <button type="button" onClick={() => setLinks(l => [...l, {label:'',url:''}])}
                className="text-[10px] text-brand hover:text-brand/80">+ 추가</button>
            </div>
            {links.map((lk, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input className="input text-xs w-24 flex-shrink-0" placeholder="라벨" value={lk.label}
                  onChange={e => setLinks(l => l.map((x,j) => j===i ? {...x,label:e.target.value} : x))} />
                <input className="input text-xs flex-1" placeholder="https://..." value={lk.url}
                  onChange={e => setLinks(l => l.map((x,j) => j===i ? {...x,url:e.target.value} : x))} />
                <button type="button" onClick={() => setLinks(l => l.filter((_,j) => j!==i))}
                  className="text-gray-600 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">취소</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? '저장' : '생성'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 작업 상세 패널 ────────────────────────────────────────────

function TaskDetailPanel({ task, projectId, onClose, onChange, onDelete }: {
  task: Task; projectId: number; onClose: () => void;
  onChange: (t: Task) => void; onDelete: (id: number) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [desc,  setDesc]  = useState(task.description ?? '');
  const [due,   setDue]   = useState(task.due_date ?? '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function patch(body: object) {
    const res = await fetch(`${BASE}/${projectId}/milestones/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    if (res.ok) onChange(await res.json());
  }
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await patch({ title: title.trim(), description: desc || null, due_date: due || null });
    setDirty(false); setSaving(false);
  }
  async function handleDelete() {
    if (!confirm('작업을 삭제할까요?')) return;
    const res = await fetch(`${BASE}/${projectId}/milestones/${task.id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (res.ok) { onDelete(task.id); onClose(); }
  }
  const isOverdue = task.due_date && task.status !== 'done' && isAfter(new Date(), parseISO(task.due_date));

  return (
    <div className="flex flex-col h-full border-l border-gray-800 bg-surface-raised w-80 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400">작업 상세</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <textarea className="w-full bg-transparent text-sm font-medium text-gray-100 resize-none outline-none border-b border-transparent hover:border-gray-700 focus:border-brand transition-colors pb-1" rows={2}
          value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }} onBlur={save} />
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600 w-14 flex-shrink-0">상태</span>
            <div className="flex gap-1">
              {COLUMNS.map(col => (
                <button key={col.status} onClick={() => patch({ status: col.status })}
                  className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors', task.status === col.status ? `${col.color} bg-white/10` : 'text-gray-600 hover:text-gray-400')}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600 w-14 flex-shrink-0">우선순위</span>
            <div className="flex gap-1">
              {(['high','medium','low'] as TaskPriority[]).map(p => {
                const m = PRIORITY_META[p];
                return <button key={p} onClick={() => patch({ priority: p })}
                  className={clsx('flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors', task.priority === p ? `${m.color} ${m.bg}` : 'text-gray-600 hover:text-gray-400')}>
                  <m.Icon className="w-2.5 h-2.5" />{m.label}
                </button>;
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600 w-14 flex-shrink-0">마감일</span>
            <div className="flex items-center gap-1.5">
              <input type="date" className="bg-transparent text-xs text-gray-300 outline-none border-b border-gray-700 focus:border-brand transition-colors pb-0.5"
                value={due} onChange={e => { setDue(e.target.value); setDirty(true); }} onBlur={save} />
              {isOverdue && <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1.5"><AlignLeft className="w-3 h-3 text-gray-600" /><span className="text-[10px] text-gray-600">설명</span></div>
          <textarea className="w-full bg-gray-800/30 border border-gray-800 hover:border-gray-700 focus:border-brand rounded-lg px-3 py-2 text-xs text-gray-300 outline-none resize-none transition-colors" rows={6}
            placeholder="작업 내용, 참고사항, 링크 등..." value={desc}
            onChange={e => { setDesc(e.target.value); setDirty(true); }} onBlur={save} />
        </div>
        {dirty && (
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="text-[10px] text-brand hover:text-brand/80 transition-colors flex items-center gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '저장'}
            </button>
          </div>
        )}
      </div>
      <div className="border-t border-gray-800 p-3">
        <button onClick={handleDelete} className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors py-1.5">
          <Trash2 className="w-3.5 h-3.5" /> 작업 삭제
        </button>
      </div>
    </div>
  );
}

// ── 칸반 컬럼 ─────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const pm = PRIORITY_META[task.priority];
  const isOverdue = task.due_date && task.status !== 'done' && isAfter(new Date(), parseISO(task.due_date));
  return (
    <div onClick={onClick} className={clsx('group p-3 rounded-xl border cursor-pointer transition-all hover:border-gray-600 hover:shadow-md',
      task.status === 'done' ? 'bg-white/[0.01] border-white/[0.04] opacity-60' : 'bg-surface border-gray-800 hover:bg-white/[0.03]')}>
      <div className="flex items-start gap-1.5">
        <pm.Icon className={clsx('w-3 h-3 flex-shrink-0 mt-0.5', pm.color)} />
        <p className={clsx('text-xs font-medium leading-snug flex-1', task.status === 'done' ? 'line-through text-gray-600' : 'text-gray-200 group-hover:text-white')}>
          {task.title}
        </p>
      </div>
      {task.description && <p className="mt-1.5 text-[10px] text-gray-600 line-clamp-2 pl-[18px]">{task.description}</p>}
      {task.due_date && (
        <div className={clsx('mt-2 flex items-center gap-1 text-[10px] pl-[18px]', isOverdue ? 'text-red-400' : 'text-gray-600')}>
          {isOverdue && <AlertCircle className="w-2.5 h-2.5" />}<Calendar className="w-2.5 h-2.5" />{fmt(task.due_date)}{isOverdue && ' 기한 초과'}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, tasks, projectId, onTaskAdd, onTaskSelect }: {
  column: typeof COLUMNS[number]; tasks: Task[]; projectId: number;
  onTaskAdd: (t: Task) => void; onTaskSelect: (t: Task) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle]   = useState('');
  const [saving, setSaving] = useState(false);

  async function addTask() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch(`${BASE}/${projectId}/milestones`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ title: title.trim(), status: column.status }),
    });
    if (res.ok) { onTaskAdd(await res.json()); setTitle(''); setAdding(false); }
    setSaving(false);
  }

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] flex-shrink-0">
      <div className={clsx('flex items-center justify-between px-3 py-2 rounded-xl mb-3', column.headerBg)}>
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-semibold', column.color)}>{column.label}</span>
          <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <button onClick={() => setAdding(true)} className="text-gray-600 hover:text-gray-300 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onTaskSelect(t)} />)}
        {adding ? (
          <div className="p-3 rounded-xl border border-brand/30 bg-brand/5 space-y-2">
            <input autoFocus className="w-full bg-transparent text-xs text-gray-200 outline-none border-b border-gray-700 focus:border-brand pb-1 transition-colors"
              placeholder="작업 제목..." value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') { setAdding(false); setTitle(''); }}} />
            <div className="flex gap-1.5">
              <button onClick={addTask} disabled={saving || !title.trim()} className="text-[10px] px-2.5 py-1 rounded bg-brand text-white disabled:opacity-40">{saving ? '...' : '추가'}</button>
              <button onClick={() => { setAdding(false); setTitle(''); }} className="text-[10px] px-2 py-1 rounded text-gray-500 hover:text-gray-300">취소</button>
            </div>
          </div>
        ) : tasks.length === 0 && (
          <button onClick={() => setAdding(true)} className="w-full text-[10px] text-gray-700 hover:text-gray-500 border border-dashed border-gray-800 hover:border-gray-700 rounded-xl py-3 transition-colors">
            + 작업 추가
          </button>
        )}
      </div>
    </div>
  );
}

// ── 자동화 & 운영 탭 ──────────────────────────────────────────

// 고품질 큐 액션 — 디자인 프로젝트 전용 (백그라운드 잡으로 실행)
const DESIGN_QUEUE_ACTIONS = [
  { id:'gen_design_hq',      label:'고품질 생성 (90점+)', Icon: Cpu,      desc:'90점 미달 시 새 디자인 처음부터 재생성, 최대 10회 시도', variant: 'indigo' as const },
  { id:'gen_design_hq_fast', label:'고품질 생성 (80점+)', Icon: Zap,      desc:'80점 미달 시 재생성, 최대 5회 시도 (빠른)',               variant: 'indigo' as const },
  { id:'gen_design_claude',  label:'Claude CLI 생성 (80+)', Icon: Sparkles, desc:'claude-cli로 고품질 디자인 생성, 80점+ 목표, 최대 5회 시도', variant: 'amber'  as const },
  { id:'gen_design_gemini',  label:'Gemini CLI 생성 (90+)', Icon: Sparkles, desc:'gemini-cli로 최고 품질 디자인 생성, 90점+ 목표, 최대 5회 시도', variant: 'cyan'   as const },
];

const OPS_ACTIONS = [
  // ── 디자인 생성 (photopolio_maindesign 전용) ──
  { id:'gen_design_1',       label:'디자인 1개 생성',   Icon: Zap,           cat:'ai_design', desc:'Ollama 4-pass 로컬 생성 (gemma4:e4b)' },
  { id:'gen_design_3',       label:'디자인 3개 생성',   Icon: Cpu,           cat:'ai_design', desc:'연속 3개 로컬 생성' },
  { id:'gen_design_gemini',  label:'Gemini 생성',       Icon: Zap,           cat:'ai_design', desc:'Gemini API 사용 (할당량 여유 시)' },
  { id:'gen_design_request', label:'신청 기반 생성',    Icon: GitPullRequest,cat:'ai_design', desc:'pending 신청 우선 처리 (Gemini)' },
  // ── 블로그 생성 (thive-lab 전용) ──
  { id:'gen_blog_post',      label:'고정 토픽 1개 생성',   Icon: Zap,           cat:'ai_blog',   desc:'TOPICS 목록에서 랜덤 선택 후 생성' },
  { id:'gen_blog_post_3',    label:'고정 토픽 3개 생성',   Icon: Cpu,           cat:'ai_blog',   desc:'TOPICS 목록 랜덤 3개 연속 생성' },
  { id:'gen_blog_trend',     label:'트렌드 기반 1개 생성', Icon: TrendingUp,    cat:'ai_blog',   desc:'Google Trends 관심도 상위 토픽으로 1개 생성' },
  { id:'gen_blog_trend_3',   label:'트렌드 기반 3개 생성', Icon: TrendingUp,    cat:'ai_blog',   desc:'Google Trends 관심도 상위 토픽 3개 연속 생성' },
  { id:'check_trends',       label:'트렌드 확인',          Icon: BarChart2,     cat:'ai_blog',   desc:'Google Trends 현재 급상승 쇼핑 키워드 확인' },
  // ── 정보성 글 생성 (thive-lab 전용, 애드센스 최적화) ──
  { id:'gen_info_post',      label:'정보성 글 1개 생성',   Icon: Zap,           cat:'ai_info',   desc:'하우투·가이드·꿀팁 등 애드센스 친화 콘텐츠 1개 생성' },
  { id:'gen_info_post_3',    label:'정보성 글 3개 생성',   Icon: Cpu,           cat:'ai_info',   desc:'정보성 콘텐츠 3개 연속 생성' },
  { id:'gen_info_howto',     label:'하우투 가이드 생성',   Icon: BookOpen,      cat:'ai_info',   desc:'단계별 방법 안내 (How-to) 유형만 생성' },
  { id:'gen_info_guide',     label:'선택 가이드 생성',     Icon: BookOpen,      cat:'ai_info',   desc:'구매 기준·체크리스트 가이드 유형만 생성' },
  { id:'gen_info_tips',      label:'꿀팁 모음 생성',       Icon: Zap,           cat:'ai_info',   desc:'실생활 꿀팁 목록형 콘텐츠 유형만 생성' },
  // ── 공통 ──
  { id:'venv_setup',         label:'venv 초기화',       Icon: Package,       cat:'python', desc:'python3 -m venv venv' },
  { id:'venv_pip_install',   label:'venv pip 설치',     Icon: Package,       cat:'python', desc:'venv/bin/pip install -r requirements.txt' },
  { id:'git_status',    label:'Git 상태',      Icon: GitBranch,     cat:'git',    desc:'변경 파일 목록' },
  { id:'git_log',       label:'커밋 로그',     Icon: GitCommit,     cat:'git',    desc:'최근 15개 커밋' },
  { id:'git_pull',      label:'Git Pull',      Icon: GitPullRequest,cat:'git',    desc:'원격 변경사항 가져오기' },
  { id:'git_fetch',     label:'Git Fetch',     Icon: RefreshCw,     cat:'git',    desc:'원격 정보 갱신' },
  { id:'npm_install',   label:'npm install',   Icon: Package,       cat:'npm',    desc:'패키지 설치' },
  { id:'npm_build',     label:'npm build',     Icon: Hammer,        cat:'npm',    desc:'프로덕션 빌드' },
  { id:'pip_install',   label:'pip install',   Icon: Package,       cat:'python', desc:'Python 패키지 설치' },
  { id:'vercel_deploy', label:'Vercel 배포',   Icon: Zap,           cat:'deploy', desc:'프로덕션 배포 실행' },
  { id:'pm2_list',      label:'PM2 프로세스',  Icon: Server,        cat:'system', desc:'실행 중인 프로세스' },
  { id:'ls',            label:'파일 목록',      Icon: FolderOpen,    cat:'system', desc:'디렉터리 내용' },
] as const;

const ACTION_CATS: Record<string, string> = {
  ai_design: 'AI 디자인 생성', ai_blog: 'AI 블로그 생성 (쿠팡)', ai_info: '정보성 글 생성 (애드센스)',
  git: 'Git', npm: 'NPM', python: 'Python', deploy: '배포', system: '시스템',
};

// 프로젝트 디렉토리명으로 타입 판별
function getProjectDir(localPath: string | null | undefined): string {
  if (!localPath) return '';
  return localPath.split('/').pop() ?? '';
}

// 프로젝트에서 보여줄 액션 카테고리 필터
function getAllowedCats(projectDir: string): string[] {
  if (projectDir === 'photopolio_maindesign')
    return ['ai_design', 'git', 'npm', 'python', 'deploy', 'system'];
  if (projectDir === 'thive-lab')
    return ['ai_blog', 'git', 'npm', 'python', 'deploy', 'system'];
  return ['git', 'npm', 'python', 'deploy', 'system'];
}

// ── Blog Pipeline Panel ───────────────────────────────────────

const STAGE_META: Record<string, { label: string; Icon: React.ElementType }> = {
  topic:   { label: '토픽 분석',  Icon: Sparkles   },
  outline: { label: '아웃라인',   Icon: ListChecks  },
  write:   { label: '본문 작성',  Icon: FileText    },
  quality: { label: '품질 검토',  Icon: BarChart2   },
  seo:     { label: 'SEO 최적화', Icon: TrendingUp  },
};
const STAGE_ORDER = ['topic', 'outline', 'write', 'quality', 'seo'] as const;

const BLOG_CATEGORIES = ['전체', '가전/IT', '생활용품', '주방', '뷰티/헬스', '스포츠', '아이디어', '유아/교육', '식품'];

const INFO_ACTIONS = [
  { id: 'gen_info_post',   label: '정보성 글 1편', Icon: FileText },
  { id: 'gen_info_post_3', label: '정보성 글 3편', Icon: FileText },
  { id: 'gen_info_howto',  label: 'How-to 가이드', Icon: BookOpen },
  { id: 'gen_info_guide',  label: '종합 가이드',   Icon: BookOpen },
  { id: 'gen_info_tips',   label: '팁 모음',       Icon: Zap     },
];

function BlogPipelinePanel({ project }: { project: PersonalProject }) {
  const [jobs,        setJobs]        = useState<BlogJob[]>([]);
  const [activeJob,   setActiveJob]   = useState<BlogJob | null>(null);
  const [enqueueing,  setEnqueueing]  = useState(false);
  const [cancelling,  setCancelling]  = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  // 트렌드 모드
  const [useTrend,    setUseTrend]    = useState(false);
  const [category,    setCategory]    = useState('전체');
  const [trendOutput, setTrendOutput] = useState('');
  const [trendLoading,setTrendLoading]= useState(false);
  const [trendExpanded,setTrendExpanded] = useState(false);
  const [infoRunning,  setInfoRunning]  = useState<string | null>(null);
  const [infoOutput,   setInfoOutput]   = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchJobs() {
    try {
      const data = await blogQueueApi.list(project.id, 10);
      setJobs(data);
      // 실행 중인 잡이 있으면 activeJob 동기화
      const running = data.find(j => j.status === 'running' || j.status === 'pending');
      if (running) setActiveJob(running);
      else if (activeJob && (activeJob.status === 'running' || activeJob.status === 'pending')) {
        // 방금 완료된 경우 최신 상태 반영
        const updated = data.find(j => j.id === activeJob.id);
        if (updated) setActiveJob(updated);
      }
    } catch { /* 무시 */ }
  }

  async function fetchActiveJob() {
    if (!activeJob) return;
    try {
      const updated = await blogQueueApi.get(activeJob.id);
      setActiveJob(updated);
      setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    } catch { /* 무시 */ }
  }

  async function enqueue() {
    setEnqueueing(true);
    try {
      const opts = {
        use_trend: useTrend,
        category:  category !== '전체' ? category : undefined,
      };
      const job = await blogQueueApi.enqueue(project.id, opts);
      setJobs(prev => [job, ...prev]);
      setActiveJob(job);
      setShowLog(true);
    } catch (e: any) {
      alert(e.message ?? '잡 등록 실패');
    } finally {
      setEnqueueing(false);
    }
  }

  async function fetchTrends() {
    if (!project.local_path || trendLoading) return;
    setTrendLoading(true);
    setTrendOutput('');
    setTrendExpanded(true);
    try {
      const res = await fetch(`/api/personal-projects/${project.id}/ops/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'check_trends', params: {} }),
      });
      const data = await res.json();
      setTrendOutput((data.output as string) ?? '결과 없음');
    } catch {
      setTrendOutput('트렌드 조회 실패');
    } finally {
      setTrendLoading(false);
    }
  }

  async function runInfoAction(actionId: string) {
    if (!project.local_path || infoRunning) return;
    setInfoRunning(actionId);
    setInfoOutput('⏳ 실행 중... (1~3분 소요될 수 있습니다)');
    try {
      const res = await fetch(`/api/personal-projects/${project.id}/ops/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: actionId, params: {} }),
      });
      const data = await res.json();
      setInfoOutput((data.output as string) ?? '완료');
    } catch {
      setInfoOutput('실행 실패');
    } finally {
      setInfoRunning(null);
    }
  }

  async function cancelJob() {
    if (!activeJob) return;
    setCancelling(true);
    try {
      await blogQueueApi.cancel(activeJob.id);
      await fetchJobs();
      setActiveJob(null);
    } catch (e: any) {
      alert(e.message ?? '취소 실패');
    } finally {
      setCancelling(false);
    }
  }

  // 초기 로드
  useEffect(() => { fetchJobs(); }, [project.id]); // eslint-disable-line

  // 실행 중일 때 3초 폴링
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const isActive = activeJob?.status === 'running' || activeJob?.status === 'pending';
    if (isActive) {
      pollRef.current = setInterval(fetchActiveJob, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJob?.id, activeJob?.status]); // eslint-disable-line

  const displayJob = activeJob ?? jobs[0] ?? null;
  const isActive   = displayJob?.status === 'running' || displayJob?.status === 'pending';

  function stageIcon(stageName: typeof STAGE_ORDER[number], status: BlogStageStatus) {
    const { Icon } = STAGE_META[stageName];
    if (status.status === 'done')    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (status.status === 'running') return <Loader2     className="w-3.5 h-3.5 text-brand animate-spin" />;
    if (status.status === 'failed')  return <XCircle     className="w-3.5 h-3.5 text-red-400" />;
    return <Icon className="w-3.5 h-3.5 text-gray-600" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── 헤더 ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-gray-300">블로그 생성 파이프라인</span>
      </div>

      {/* ── Google Trends 모드 패널 ────────────────────────── */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
        {/* 헤더 행 */}
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <TrendingUp className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-300 font-medium flex-1">Google Trends 모드</span>

          {/* 트렌드 확인 버튼 */}
          <button
            onClick={fetchTrends}
            disabled={trendLoading || !project.local_path}
            title="Google Trends 급상승 키워드 확인"
            className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            {trendLoading
              ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
              : <RefreshCw className="w-2.5 h-2.5" />}
            트렌드 확인
          </button>

          {/* 펼치기 버튼 (결과 있을 때만) */}
          {trendOutput && (
            <button onClick={() => setTrendExpanded(v => !v)} className="text-gray-600 hover:text-gray-300">
              <ChevronRight className={clsx('w-3 h-3 transition-transform', trendExpanded && 'rotate-90')} />
            </button>
          )}

          {/* ON/OFF 토글 */}
          <button
            onClick={() => setUseTrend(v => !v)}
            title={useTrend ? '트렌드 모드 ON' : '트렌드 모드 OFF'}
            className={clsx(
              'relative w-7 h-4 rounded-full transition-colors flex-shrink-0',
              useTrend ? 'bg-amber-500' : 'bg-gray-700',
            )}
          >
            <span className={clsx(
              'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
              useTrend ? 'translate-x-3.5' : 'translate-x-0.5',
            )} />
          </button>
        </div>

        {/* 트렌드 키워드 결과 (펼쳐진 상태) */}
        {trendExpanded && trendOutput && (
          <div className="px-2.5 pb-2 border-t border-amber-500/10">
            <pre className="text-[9px] text-gray-400 leading-relaxed whitespace-pre-wrap mt-1.5 max-h-32 overflow-y-auto">
              {trendOutput}
            </pre>
          </div>
        )}
      </div>

      {/* ── 카테고리 선택 ──────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-gray-500 flex-shrink-0">카테고리</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-300 focus:outline-none focus:border-gray-500"
        >
          {BLOG_CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* ── 생성 시작 버튼 ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {isActive && (
          <button onClick={cancelJob} disabled={cancelling}
            className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors flex-shrink-0">
            {cancelling ? '취소 중...' : '중단'}
          </button>
        )}
        <button onClick={enqueue} disabled={enqueueing || isActive || !project.local_path}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            useTrend
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              : 'bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25',
          )}>
          {enqueueing
            ? <><Loader2 className="w-3 h-3 animate-spin" /> 등록 중...</>
            : useTrend
              ? <><TrendingUp className="w-3 h-3" /> 트렌드 기반 생성</>
              : <><Zap className="w-3 h-3" /> 고정 토픽 생성</>}
        </button>
      </div>

      {!project.local_path && (
        <p className="text-[10px] text-gray-600">로컬 경로가 설정되어야 실행할 수 있습니다.</p>
      )}

      {/* ── 현재/최근 잡 상태 카드 ─────────────────────── */}
      {displayJob && (
        <div className={clsx(
          'rounded-xl border overflow-hidden',
          displayJob.status === 'completed' ? 'border-emerald-500/20'
          : displayJob.status === 'failed'  ? 'border-red-500/20'
          : displayJob.status === 'cancelled' ? 'border-gray-700'
          : 'border-violet-500/20',
        )}>
          {/* 상단: 제목 + 점수 + 모델 */}
          <div className={clsx(
            'px-3 py-2.5 flex items-start justify-between gap-2',
            displayJob.status === 'completed' ? 'bg-emerald-500/5'
            : displayJob.status === 'failed'  ? 'bg-red-500/5'
            : displayJob.status === 'cancelled' ? 'bg-gray-800/30'
            : 'bg-violet-500/5',
          )}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {displayJob.status === 'running'   && <Loader2      className="w-3.5 h-3.5 animate-spin text-brand flex-shrink-0" />}
              {displayJob.status === 'pending'   && <Clock        className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
              {displayJob.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
              {displayJob.status === 'failed'    && <XCircle      className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
              {displayJob.status === 'cancelled' && <XCircle      className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
              <span className="text-[11px] font-medium text-gray-200 truncate">
                {displayJob.topic_title ?? `잡 #${displayJob.id}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {displayJob.quality_score != null && (
                <span className={clsx(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  displayJob.quality_score >= 80 ? 'bg-emerald-500/20 text-emerald-300'
                  : displayJob.quality_score >= 60 ? 'bg-yellow-500/20 text-yellow-300'
                  : 'bg-red-500/20 text-red-300',
                )}>
                  {displayJob.quality_score}점
                </span>
              )}
              {displayJob.model_used && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">
                  {displayJob.model_used.split(':')[0]}
                </span>
              )}
            </div>
          </div>

          {/* 스테이지 진행 바 */}
          <div className="px-3 py-2 border-t border-gray-800/50 bg-gray-900/30">
            <div className="flex items-center gap-0.5">
              {STAGE_ORDER.map((stageName, idx) => {
                const stageStatus = displayJob.stage_statuses?.[stageName]
                  ?? { status: 'pending' as const, elapsed: null };
                const { label } = STAGE_META[stageName];
                const isCurrent = displayJob.current_stage === stageName && displayJob.status === 'running';
                return (
                  <div key={stageName} className="flex items-center gap-0.5 flex-1 min-w-0">
                    <div className={clsx(
                      'flex flex-col items-center gap-0.5 flex-1 rounded-md px-0.5 py-1.5 transition-colors',
                      stageStatus.status === 'done'    ? 'bg-emerald-500/10'
                      : stageStatus.status === 'running' ? 'bg-brand/10'
                      : stageStatus.status === 'failed'  ? 'bg-red-500/10'
                      : '',
                      isCurrent && 'ring-1 ring-brand/30',
                    )}>
                      {stageIcon(stageName, stageStatus)}
                      <span className={clsx(
                        'text-[7px] font-medium leading-tight',
                        stageStatus.status === 'done'    ? 'text-emerald-400'
                        : stageStatus.status === 'running' ? 'text-brand'
                        : stageStatus.status === 'failed'  ? 'text-red-400'
                        : 'text-gray-700',
                      )}>
                        {label}
                      </span>
                      {stageStatus.elapsed != null && (
                        <span className="text-[6px] text-gray-600">{stageStatus.elapsed}s</span>
                      )}
                    </div>
                    {idx < STAGE_ORDER.length - 1 && (
                      <ChevronRight className="w-2 h-2 text-gray-800 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단: 결과 링크 + 에러 + 로그 토글 */}
          <div className="px-3 py-2 border-t border-gray-800/50 space-y-1.5">
            {displayJob.result_slug && (
              <a href={`https://thivelab.com/blog/${displayJob.result_slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">
                <Globe className="w-3 h-3" />
                <span className="underline underline-offset-2">thivelab.com/blog/{displayJob.result_slug}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {displayJob.error_message && (
              <p className="text-[10px] text-red-400 bg-red-500/5 rounded px-2 py-1">{displayJob.error_message}</p>
            )}
            <button onClick={() => setShowLog(v => !v)}
              className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-400 transition-colors">
              <Terminal className="w-3 h-3" />
              {showLog ? '로그 숨기기' : '로그 보기'}
              <ChevronDown className={clsx('w-2.5 h-2.5 transition-transform', showLog && 'rotate-180')} />
            </button>
            {showLog && displayJob.log_tail && (
              <pre className="text-[8px] font-mono text-gray-500 bg-black/40 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-all border border-gray-800/50">
                {displayJob.log_tail}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ── 정보성 글 생성 (애드센스) ────────────────────── */}
      <div className="border-t border-gray-800/60 pt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-gray-300">정보성 글 생성 <span className="text-[9px] text-gray-600 font-normal">(애드센스)</span></span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {INFO_ACTIONS.map(action => {
            const isRunning = infoRunning === action.id;
            const isDisabled = !project.local_path || infoRunning !== null;
            return (
              <button key={action.id}
                disabled={isDisabled}
                onClick={() => runInfoAction(action.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] border transition-all text-left',
                  isRunning
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : isDisabled
                      ? 'text-gray-700 border-gray-800 cursor-not-allowed'
                      : 'text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10',
                )}>
                {isRunning
                  ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                  : <action.Icon className="w-3 h-3 flex-shrink-0" />}
                <span className="flex-1 font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
        {infoOutput && (
          <pre className="mt-2 text-[8px] font-mono text-gray-500 bg-black/40 rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-all border border-gray-800/50">
            {infoOutput}
          </pre>
        )}
      </div>

      {/* ── 실행 히스토리 ────────────────────────────────── */}
      {jobs.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">최근 실행</p>
          <div className="space-y-1">
            {jobs.slice(0, 6).map(job => {
              const isSelected = displayJob?.id === job.id;
              return (
                <button key={job.id}
                  onClick={() => { setActiveJob(job); setShowLog(false); }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all',
                    isSelected ? 'border-violet-500/30 bg-violet-500/10' : 'border-gray-800/60 hover:border-gray-700 bg-transparent',
                  )}>
                  {/* 상태 점 */}
                  <span className={clsx(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    job.status === 'completed' ? 'bg-emerald-400'
                    : job.status === 'running' || job.status === 'pending' ? 'bg-brand animate-pulse'
                    : job.status === 'failed'  ? 'bg-red-400'
                    : 'bg-gray-600',
                  )} />
                  {/* 제목 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-300 truncate font-medium">
                      {job.topic_title ?? `잡 #${job.id}`}
                    </p>
                    <p className="text-[8px] text-gray-600 mt-0.5">
                      {format(parseISO(job.queued_at), 'MM/dd HH:mm')}
                      {job.status === 'failed' && <span className="text-red-400 ml-1">실패</span>}
                      {job.status === 'cancelled' && <span className="text-gray-500 ml-1">취소</span>}
                    </p>
                  </div>
                  {/* 점수 */}
                  {job.quality_score != null && (
                    <span className={clsx(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                      job.quality_score >= 80 ? 'bg-emerald-500/15 text-emerald-400'
                      : job.quality_score >= 60 ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-red-500/15 text-red-400',
                    )}>
                      {job.quality_score}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 크론 설정 탭 ─────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { label: '매시간',       value: '0 * * * *' },
  { label: '매일 06시',    value: '0 6 * * *' },
  { label: '매일 09시',    value: '0 9 * * *' },
  { label: '매일 18시',    value: '0 18 * * *' },
  { label: '매주 월 09시', value: '0 9 * * 1' },
  { label: '매주 수·금 09시', value: '0 9 * * 3,5' },
  { label: '6시간마다',    value: '0 */6 * * *' },
];

interface CronJob {
  id: string; name: string; script: string; schedule: string;
  description: string; enabled: boolean;
}

function getDefaultCronJobs(projectDir: string): CronJob[] {
  if (projectDir === 'photopolio_maindesign') {
    return [
      { id: 'gen-design-1',   name: '디자인 생성 (1개)',      script: 'python3 scripts/generator5_ollama.py --count 1 --min-score 75', schedule: '0 9 * * *',   description: '매일 오전 9시', enabled: false },
      { id: 'gen-design-3',   name: '디자인 배치 (3개)',      script: 'python3 scripts/generator5_ollama.py --count 3 --min-score 75', schedule: '0 6 * * 1',   description: '매주 월 오전 6시', enabled: false },
      { id: 'trend-refresh',  name: '트렌드 데이터 갱신',     script: 'python3 scripts/trend_researcher.py --force', schedule: '0 */12 * * *', description: '12시간마다', enabled: false },
    ];
  }
  if (projectDir === 'thive-lab') {
    return [
      { id: 'blog-gen-1',       name: '고정 토픽 생성 (1개)',     script: 'python3 scripts/blog_generator.py --count 1',          schedule: '0 9 * * *',    description: '매일 오전 9시',      enabled: false },
      { id: 'blog-gen-3',       name: '고정 토픽 배치 (3개)',     script: 'python3 scripts/blog_generator.py --count 3',          schedule: '0 6 * * 1',    description: '매주 월 오전 6시',   enabled: false },
      { id: 'blog-trend-1',     name: '트렌드 기반 생성 (1개)',   script: 'python3 scripts/blog_generator.py --trend --count 1',  schedule: '0 10 * * *',   description: '매일 오전 10시',     enabled: false },
      { id: 'blog-trend-3',     name: '트렌드 기반 배치 (3개)',   script: 'python3 scripts/blog_generator.py --trend --count 3',  schedule: '0 7 * * 1',    description: '매주 월 오전 7시',   enabled: false },
      { id: 'blog-trend-check', name: 'Google Trends 미리보기',   script: 'python3 scripts/trend_fetcher.py --limit 5',           schedule: '0 8 * * *',    description: '매일 오전 8시',      enabled: false },
      { id: 'info-gen-1',       name: '정보성 글 생성 (1개)',     script: 'python3 scripts/info_generator.py --count 1',          schedule: '0 11 * * *',   description: '매일 오전 11시',     enabled: false },
      { id: 'info-gen-3',       name: '정보성 글 배치 (3개)',     script: 'python3 scripts/info_generator.py --count 3',          schedule: '0 8 * * 3',    description: '매주 수 오전 8시',   enabled: false },
    ];
  }
  return [];
}

function CronTab({ project }: { project: PersonalProject }) {
  const projectDir = getProjectDir(project.local_path);
  const [jobs, setJobs] = useState<CronJob[]>(getDefaultCronJobs(projectDir));
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', script: '', schedule: '0 9 * * *', description: '' });

  const toggle = (id: string) => setJobs(p => p.map(j => j.id === id ? { ...j, enabled: !j.enabled } : j));

  const updateSched = (id: string, schedule: string) => {
    setJobs(p => p.map(j => j.id === id ? { ...j, schedule, description: SCHEDULE_PRESETS.find(s => s.value === schedule)?.label ?? schedule } : j));
    setEditId(null);
  };

  const addJob = () => {
    if (!newJob.name || !newJob.script) return;
    setJobs(p => [...p, { ...newJob, id: `custom-${Date.now()}`, enabled: false }]);
    setNewJob({ name: '', script: '', schedule: '0 9 * * *', description: '' });
    setShowAdd(false);
  };

  const removeJob = (id: string) => setJobs(p => p.filter(j => j.id !== id));

  const exportCrontab = () => {
    const active = jobs.filter(j => j.enabled);
    if (!active.length) { alert('활성화된 크론 작업이 없습니다.'); return; }
    const basePath = project.local_path || '/path/to/project';
    const lines = active.map(j => `${j.schedule} cd ${basePath} && ${j.script} >> logs/${j.id}.log 2>&1`);
    const content = `# ${project.title} Cron Jobs — ${new Date().toISOString()}\n${lines.join('\n')}\n`;
    safeCopy(content).then(ok => {
      alert(ok ? '크론탭 설정이 클립보드에 복사되었습니다.\ncrontab -e 에서 붙여넣으세요.' : '클립보드 복사에 실패했습니다.');
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Timer className="w-4 h-4 text-brand" />
            크론 작업 관리
          </h3>
          <p className="text-[10px] text-gray-600 mt-0.5">자동화 스크립트의 실행 스케줄을 설정합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-[10px] font-medium text-gray-400 hover:text-gray-200 hover:border-gray-500 transition">
            <Plus className="w-3 h-3" /> 작업 추가
          </button>
          <button onClick={exportCrontab}
            className="flex items-center gap-1.5 rounded-lg bg-brand/90 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-brand transition">
            <Terminal className="w-3 h-3" /> 크론탭 복사
          </button>
        </div>
      </div>

      {/* 새 작업 추가 */}
      {showAdd && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-brand">새 크론 작업</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input placeholder="작업명" value={newJob.name} onChange={e => setNewJob({ ...newJob, name: e.target.value })}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none" />
            <input placeholder="실행 명령어" value={newJob.script} onChange={e => setNewJob({ ...newJob, script: e.target.value })}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none" />
            <select value={newJob.schedule} onChange={e => setNewJob({ ...newJob, schedule: e.target.value, description: SCHEDULE_PRESETS.find(s => s.value === e.target.value)?.label ?? '' })}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 focus:border-brand/50 focus:outline-none">
              {SCHEDULE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label} ({p.value})</option>)}
            </select>
            <input placeholder="설명 (선택)" value={newJob.description} onChange={e => setNewJob({ ...newJob, description: e.target.value })}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={addJob} className="rounded-lg bg-brand px-3 py-1.5 text-[10px] font-bold text-white hover:bg-brand/80">추가</button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300">취소</button>
          </div>
        </div>
      )}

      {/* 작업 목록 */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-xs text-gray-600">
          이 프로젝트에 설정된 크론 작업이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} className={clsx('rounded-xl border p-4 transition',
              job.enabled ? 'border-brand/30 bg-brand/5' : 'border-gray-800 bg-gray-900/30')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(job.id)} title={job.enabled ? '비활성화' : '활성화'}
                      className={clsx('rounded-full p-1 transition', job.enabled ? 'bg-brand/20 text-brand' : 'bg-gray-800 text-gray-600')}>
                      {job.enabled ? <Play className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    </button>
                    <span className="text-xs font-semibold text-gray-200">{job.name}</span>
                    {job.description && <span className="text-[9px] text-gray-600">— {job.description}</span>}
                  </div>

                  <div className="flex items-center gap-2 pl-7">
                    <Clock className="w-3 h-3 text-gray-700" />
                    {editId === job.id ? (
                      <div className="flex items-center gap-2">
                        <select defaultValue={job.schedule} onChange={e => updateSched(job.id, e.target.value)}
                          className="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] text-gray-300">
                          {SCHEDULE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <button onClick={() => setEditId(null)} className="text-[9px] text-gray-600 hover:text-gray-400">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditId(job.id)} className="group flex items-center gap-1.5">
                        <code className="text-[10px] text-gray-500 group-hover:text-brand transition">{job.schedule}</code>
                        <Pencil className="w-2.5 h-2.5 text-gray-700 group-hover:text-gray-400 transition" />
                      </button>
                    )}
                  </div>

                  <div className="pl-7">
                    <code className="text-[9px] text-gray-600 font-mono">{job.script}</code>
                  </div>
                </div>

                {job.id.startsWith('custom-') && (
                  <button onClick={() => removeJob(job.id)} className="text-[9px] text-gray-700 hover:text-red-400 transition">삭제</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/20 p-3">
        <p className="text-[9px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">사용 방법:</strong> 원하는 작업을 활성화(▶)하고 스케줄을 설정한 뒤
          &ldquo;크론탭 복사&rdquo; 버튼을 눌러 터미널에서 <code className="text-brand/60">crontab -e</code>로 붙여넣으세요.
          GitHub Actions에서도 동일한 cron 표현식을 사용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// ── 완성본 등록 탭 (유튜브 쇼츠 자동화 전용) ───────────────────

interface ShortsUpload {
  id: number;
  title: string;
  content: string;
  tags: string[];
  youtube_url: string | null;
  video_filename: string | null;
  video_size: number | null;
  has_video: boolean;
  upload_status: 'pending' | 'uploading' | 'uploaded' | 'failed' | null;
  upload_error: string | null;
  youtube_video_id: string | null;
  youtube_uploaded_at: string | null;
  scheduled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface YoutubeAuthStatus {
  configured: boolean;
  authorized: boolean;
  has_readonly?: boolean;
  has_analytics?: boolean;
  has_write?: boolean;
  redirect_uri: string;
}

interface GeographyRow {
  country: string;
  views: number;
  share: number;
  watch_minutes: number;
  avg_view_seconds: number;
  subscribers_gained: number;
}

interface PerformanceRow {
  video_id: string;
  views: number;
  watch_minutes: number;
  avg_view_seconds: number;
  avg_view_percentage: number;
  subscribers_gained: number;
  subscribers_lost: number;
  subscribers_net: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  impressions_ctr: number;
}

interface PerformanceSummary {
  total_impressions: number;
  total_views: number;
  avg_ctr: number;
  avg_view_percentage: number;
  net_subscribers: number;
}

interface RetentionPoint { elapsed: number; watch: number; relative: number; }

interface AnalyticsVideo {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  published_at?: string | null;
  thumbnail?: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_seconds: number;
  is_short: boolean;
  url: string;
}

interface AnalyticsChannel {
  id?: string;
  title?: string | null;
  thumbnail?: string | null;
  subscriber_count?: number | null;
  video_count?: number;
  view_count?: number;
}

interface AnalyticsSummary {
  total: number;
  shorts_count: number;
  longs_count: number;
  total_views: number;
  total_likes: number;
  avg_views: number;
}

interface InsightRec { device: string; reason: string; category?: string; }

function formatBytes(b: number | null | undefined): string {
  if (!b) return '-';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parseTags(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  raw.split(/[,\n]/).forEach(p => {
    const t = p.trim().replace(/^#+/, '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t.slice(0, 50));
  });
  return out.slice(0, 30);
}

function ShortsUploadsTab({ project }: { project: PersonalProject }) {
  const [uploads, setUploads] = useState<ShortsUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [ytAuth, setYtAuth] = useState<YoutubeAuthStatus | null>(null);
  const [attachingId, setAttachingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [privacyChoice, setPrivacyChoice] = useState<Record<number, 'public' | 'unlisted' | 'private'>>({});
  const [scheduleOn, setScheduleOn] = useState<Record<number, boolean>>({});
  const [scheduleAt, setScheduleAt] = useState<Record<number, string>>({});  // datetime-local 값

  async function loadAuth() {
    try {
      const res = await fetch(`${BASE}/youtube/auth-status`, { headers: getAuthHeaders() });
      if (res.ok) setYtAuth(await res.json());
    } catch (e) { console.error(e); }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-uploads?limit=200`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('목록 조회 실패');
      const data = await res.json();
      setUploads(data.uploads ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); loadAuth(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.id]);

  // 이어붙이기 등 외부에서 목록 갱신을 요청하는 이벤트 수신
  useEffect(() => {
    function onReload() { load(); }
    window.addEventListener('safesquare:switch-workspace-tab', onReload);
    return () => window.removeEventListener('safesquare:switch-workspace-tab', onReload);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [project.id]);

  function resetForm() {
    setTitle(''); setContent(''); setTagsText(''); setYoutubeUrl(''); setPendingVideo(null);
    setEditId(null); setShowForm(false);
  }

  async function attachVideoFile(uploadId: number, file: File): Promise<ShortsUpload | null> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/${project.id}/ops/shorts-uploads/${uploadId}/video`, {
      method: 'POST', headers: getAuthHeaders(), body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '영상 첨부 실패');
    }
    return await res.json();
  }

  async function handleAttachExisting(uploadId: number, file: File) {
    setAttachingId(uploadId);
    try {
      const updated = await attachVideoFile(uploadId, file);
      if (updated) setUploads(p => p.map(u => u.id === uploadId ? updated : u));
    } catch (e: any) {
      alert(e?.message || '영상 첨부 실패');
    } finally {
      setAttachingId(null);
    }
  }

  async function handleDetachVideo(uploadId: number) {
    if (!confirm('첨부된 영상 파일을 제거할까요?')) return;
    const res = await fetch(`${BASE}/${project.id}/ops/shorts-uploads/${uploadId}/video`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    if (!res.ok) { alert('영상 제거 실패'); return; }
    const updated: ShortsUpload = await res.json();
    setUploads(p => p.map(u => u.id === uploadId ? updated : u));
  }

  async function startYoutubeLogin() {
    try {
      const res = await fetch(`${BASE}/youtube/auth-url`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '인증 URL 발급 실패');
      }
      const { auth_url } = await res.json();
      window.open(auth_url, '_blank', 'noopener,noreferrer');
      alert('새 탭에서 Google 로그인을 완료한 뒤, 이 페이지로 돌아와 "상태 새로고침" 버튼을 누르세요.');
    } catch (e: any) {
      alert(e?.message || 'YouTube 인증 시작 실패');
    }
  }

  async function youtubeLogout() {
    if (!confirm('저장된 YouTube 인증을 제거할까요?')) return;
    await fetch(`${BASE}/youtube/logout`, { method: 'POST', headers: getAuthHeaders() });
    await loadAuth();
  }

  async function publishToYoutube(u: ShortsUpload) {
    if (!u.has_video) { alert('먼저 영상을 첨부하세요.'); return; }
    if (!ytAuth?.authorized) { alert('먼저 YouTube 로그인을 완료하세요.'); return; }
    const privacy = privacyChoice[u.id] ?? 'private';
    const useSchedule = !!scheduleOn[u.id];
    const scheduleVal = scheduleAt[u.id] ?? '';

    let scheduledIso: string | null = null;
    let scheduleDisplay = '';
    if (useSchedule) {
      if (!scheduleVal) { alert('예약 날짜/시간을 입력하세요.'); return; }
      const d = new Date(scheduleVal);
      if (isNaN(d.getTime())) { alert('예약 날짜/시간 형식이 올바르지 않습니다.'); return; }
      if (d.getTime() <= Date.now() + 60_000) { alert('예약 시각은 현재보다 최소 1분 이상 미래여야 합니다.'); return; }
      scheduledIso = d.toISOString();
      scheduleDisplay = format(d, 'yyyy-MM-dd HH:mm', { locale: ko });
    }

    const privacyLabel = privacy === 'public' ? '전체공개' : privacy === 'unlisted' ? '미등록' : '비공개';
    const confirmMsg = useSchedule
      ? `"${u.title}"\n\n예약 공개: ${scheduleDisplay}\n(업로드는 지금 실행되고, 예약 시각에 자동 공개됩니다. 공개 설정은 '비공개'로 세팅됩니다.)\n\n진행할까요?`
      : `"${u.title}"\n\n공개 설정: ${privacyLabel}\n\n지금 YouTube Shorts로 업로드할까요?`;
    if (!confirm(confirmMsg)) return;

    setPublishingId(u.id);
    try {
      const body: any = { privacy };
      if (scheduledIso) body.scheduled_at = scheduledIso;
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-uploads/${u.id}/publish-youtube`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '업로드 실패');
      setUploads(p => p.map(x => x.id === u.id ? data : x));
      alert(useSchedule
        ? `업로드 완료!\n${scheduleDisplay}에 자동 공개됩니다.\n${data.youtube_url}`
        : `업로드 완료!\n${data.youtube_url}`);
    } catch (e: any) {
      alert(e?.message || '업로드 실패');
      await load();
    } finally {
      setPublishingId(null);
    }
  }

  // datetime-local 의 기본값 — 현재 시각 + 30분 (자기 타임존 기준)
  function defaultScheduleValue(): string {
    const d = new Date(Date.now() + 30 * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startEdit(u: ShortsUpload) {
    setEditId(u.id);
    setTitle(u.title);
    setContent(u.content ?? '');
    setTagsText((u.tags ?? []).join(', '));
    setYoutubeUrl(u.youtube_url ?? '');
    setShowForm(true);
  }

  async function submit() {
    if (!title.trim()) { alert('제목을 입력하세요.'); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        tags: parseTags(tagsText),
        youtube_url: youtubeUrl.trim(),
      });
      const url = editId
        ? `${BASE}/${project.id}/ops/shorts-uploads/${editId}`
        : `${BASE}/${project.id}/ops/shorts-uploads`;
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || '저장 실패'); }
      const saved: ShortsUpload = await res.json();
      if (pendingVideo) {
        try { await attachVideoFile(saved.id, pendingVideo); }
        catch (e: any) { alert('저장은 됐지만 영상 첨부에 실패했습니다: ' + (e?.message || '')); }
      }
      resetForm();
      await load();
    } catch (e: any) {
      alert(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('이 완성본을 삭제할까요?')) return;
    const res = await fetch(`${BASE}/${project.id}/ops/shorts-uploads/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    if (res.ok || res.status === 204) {
      setUploads(p => p.filter(u => u.id !== id));
      if (editId === id) resetForm();
    } else {
      alert('삭제 실패');
    }
  }

  async function copyTags(tags: string[]) {
    const text = tags.map(t => `#${t}`).join(' ');
    const ok = await safeCopy(text);
    if (!ok) alert('복사 실패');
  }

  const filtered = query.trim()
    ? uploads.filter(u => {
        const q = query.trim().toLowerCase();
        return u.title.toLowerCase().includes(q)
          || (u.content ?? '').toLowerCase().includes(q)
          || (u.tags ?? []).some(t => t.toLowerCase().includes(q));
      })
    : uploads;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Upload className="w-4 h-4 text-brand" />
            완성본 등록
          </h3>
          <p className="text-[10px] text-gray-600 mt-0.5">업로드 완료된 쇼츠의 제목·내용·태그를 정리합니다. (총 {uploads.length}개)</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="검색 (제목·내용·태그)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none w-56"
          />
          <button
            onClick={() => { if (showForm && !editId) resetForm(); else { resetForm(); setShowForm(true); } }}
            className="flex items-center gap-1.5 rounded-lg bg-brand/90 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-brand transition"
          >
            <Plus className="w-3 h-3" /> {showForm && !editId ? '닫기' : '새 완성본'}
          </button>
        </div>
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-brand">{editId ? '완성본 수정' : '새 완성본 등록'}</p>
            {editId && <span className="text-[9px] text-gray-500">ID #{editId}</span>}
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">제목 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="예: 전자렌지의 억울한 하소연"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">내용 / 설명</label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="영상 설명란에 쓸 본문이나 대본 원문을 붙여넣으세요."
                rows={5}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none font-mono resize-y" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">태그 (쉼표·줄바꿈으로 구분)</label>
                <input value={tagsText} onChange={e => setTagsText(e.target.value)}
                  placeholder="전자기기반란, 쇼츠, 전자렌지"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none" />
                {tagsText.trim() && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {parseTags(tagsText).map(t => (
                      <span key={t} className="text-[9px] text-brand/80 bg-brand/10 border border-brand/20 rounded px-1.5 py-0.5">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">유튜브 URL (선택 · 업로드 시 자동 저장됨)</label>
                <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand/50 focus:outline-none" />
              </div>
            </div>
            {!editId && (
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">영상 파일 (선택 · 등록 후 YouTube 업로드용)</label>
                <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv,.avi"
                  onChange={e => setPendingVideo(e.target.files?.[0] ?? null)}
                  className="w-full text-[11px] text-gray-400 file:mr-2 file:rounded-lg file:border-0 file:bg-brand/20 file:text-brand file:text-[10px] file:font-bold file:px-3 file:py-1.5 file:cursor-pointer" />
                {pendingVideo && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    선택됨: <span className="text-gray-300">{pendingVideo.name}</span> ({formatBytes(pendingVideo.size)})
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={submit} disabled={saving || !title.trim()}
              className="rounded-lg bg-brand px-3 py-1.5 text-[10px] font-bold text-white hover:bg-brand/80 disabled:opacity-40">
              {saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : (editId ? '수정 저장' : '등록')}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-gray-700 px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300">취소</button>
          </div>
        </div>
      )}

      {/* YouTube 인증 상태 */}
      <div className={clsx(
        'rounded-xl border p-3 flex items-center justify-between gap-3',
        ytAuth?.authorized ? 'border-emerald-700/30 bg-emerald-900/10' :
        ytAuth?.configured ? 'border-yellow-700/30 bg-yellow-900/10' :
        'border-gray-800 bg-gray-900/30'
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <Play className={clsx('w-4 h-4 flex-shrink-0',
            ytAuth?.authorized ? 'text-emerald-400' : ytAuth?.configured ? 'text-yellow-400' : 'text-gray-600')} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-200">
              YouTube 업로드:{' '}
              {!ytAuth ? '확인 중…'
                : !ytAuth.configured ? '환경변수 미설정'
                : ytAuth.authorized ? '인증 완료 — 업로드 가능'
                : '인증 필요'}
            </p>
            <p className="text-[9px] text-gray-600 truncate">
              {!ytAuth?.configured
                ? 'backend ENV에 YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 를 설정하세요.'
                : `Redirect URI: ${ytAuth.redirect_uri}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={loadAuth}
            className="text-[10px] text-gray-400 hover:text-gray-200 px-2 py-1 rounded-lg border border-gray-700"
            title="상태 새로고침">
            <RefreshCw className="w-3 h-3" />
          </button>
          {ytAuth?.configured && !ytAuth.authorized && (
            <button onClick={startYoutubeLogin}
              className="text-[10px] font-bold text-white bg-brand/90 hover:bg-brand px-3 py-1 rounded-lg">
              Google 로그인
            </button>
          )}
          {ytAuth?.authorized && (
            <button onClick={youtubeLogout}
              className="text-[10px] text-gray-500 hover:text-red-400 px-2 py-1 rounded-lg border border-gray-700">
              로그아웃
            </button>
          )}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-xs text-gray-600">
          {query.trim() ? '검색 결과가 없습니다.' : '아직 등록된 완성본이 없습니다. 상단 "새 완성본" 버튼으로 등록하세요.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-gray-700 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-semibold text-gray-100 truncate">{u.title}</h4>
                    {u.youtube_url && (
                      <a href={u.youtube_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-[10px] text-brand/80 hover:text-brand">
                        <ExternalLink className="w-2.5 h-2.5" /> 유튜브
                      </a>
                    )}
                  </div>
                  {u.content && (
                    <p className="text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed line-clamp-4">{u.content}</p>
                  )}
                  {u.tags && u.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.tags.map(t => (
                        <span key={t} className="text-[9px] text-brand/80 bg-brand/10 border border-brand/20 rounded px-1.5 py-0.5">#{t}</span>
                      ))}
                      <button onClick={() => copyTags(u.tags)}
                        className="text-[9px] text-gray-600 hover:text-gray-300 flex items-center gap-0.5 ml-1">
                        <Copy className="w-2.5 h-2.5" /> 복사
                      </button>
                    </div>
                  )}
                  <p className="text-[9px] text-gray-600">
                    등록 {u.created_at ? format(parseISO(u.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}
                    {u.updated_at && u.created_at && u.updated_at !== u.created_at && (
                      <> · 수정 {format(parseISO(u.updated_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</>
                    )}
                    {u.youtube_uploaded_at && (
                      <> · <span className="text-emerald-400">업로드 {format(parseISO(u.youtube_uploaded_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</span></>
                    )}
                  </p>

                  {/* 영상 + YouTube 업로드 */}
                  <div className="mt-2 pt-2 border-t border-gray-800/60 flex flex-wrap items-center gap-2">
                    {u.has_video ? (
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <FileText className="w-3 h-3 text-gray-600" />
                        <span className="truncate max-w-[200px]">{u.video_filename || '영상'}</span>
                        <span className="text-gray-600">({formatBytes(u.video_size)})</span>
                        {u.upload_status !== 'uploaded' && (
                          <button onClick={() => handleDetachVideo(u.id)}
                            className="text-gray-600 hover:text-red-400 ml-1" title="영상 제거">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className={clsx(
                        'text-[10px] cursor-pointer px-2 py-1 rounded-lg border transition flex items-center gap-1',
                        attachingId === u.id
                          ? 'border-gray-700 text-gray-600'
                          : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'
                      )}>
                        {attachingId === u.id
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> 업로드 중…</>
                          : <><Upload className="w-3 h-3" /> 영상 첨부</>}
                        <input type="file" className="hidden"
                          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv,.avi"
                          disabled={attachingId === u.id}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleAttachExisting(u.id, f);
                            e.target.value = '';
                          }} />
                      </label>
                    )}

                    {u.upload_status === 'uploaded' && u.youtube_video_id ? (
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 업로드 완료
                        </span>
                        {u.scheduled_at && (
                          <span className="text-[10px] text-yellow-300 flex items-center gap-1" title="예약 공개 시각">
                            <Clock className="w-3 h-3" /> {format(parseISO(u.scheduled_at), 'yyyy-MM-dd HH:mm', { locale: ko })} 공개 예약
                          </span>
                        )}
                      </div>
                    ) : u.has_video && (
                      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                        {scheduleOn[u.id] ? (
                          <>
                            <input type="datetime-local"
                              value={scheduleAt[u.id] ?? defaultScheduleValue()}
                              onChange={e => setScheduleAt(p => ({ ...p, [u.id]: e.target.value }))}
                              disabled={publishingId === u.id}
                              className="text-[10px] rounded border border-gray-700 bg-gray-900 px-1.5 py-1 text-gray-300" />
                            <button
                              onClick={() => setScheduleOn(p => ({ ...p, [u.id]: false }))}
                              disabled={publishingId === u.id}
                              title="예약 해제"
                              className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-1 rounded border border-gray-700">
                              즉시
                            </button>
                          </>
                        ) : (
                          <>
                            <select
                              value={privacyChoice[u.id] ?? 'private'}
                              onChange={e => setPrivacyChoice(p => ({ ...p, [u.id]: e.target.value as any }))}
                              disabled={publishingId === u.id}
                              className="text-[10px] rounded border border-gray-700 bg-gray-900 px-1.5 py-1 text-gray-300">
                              <option value="private">비공개</option>
                              <option value="unlisted">미등록</option>
                              <option value="public">전체공개</option>
                            </select>
                            <button
                              onClick={() => {
                                setScheduleOn(p => ({ ...p, [u.id]: true }));
                                setScheduleAt(p => ({ ...p, [u.id]: p[u.id] ?? defaultScheduleValue() }));
                              }}
                              disabled={publishingId === u.id}
                              title="예약 공개"
                              className="text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-1 rounded border border-gray-700 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> 예약
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => publishToYoutube(u)}
                          disabled={publishingId === u.id || !ytAuth?.authorized}
                          title={!ytAuth?.authorized ? 'YouTube 인증 필요' : 'YouTube Shorts로 업로드'}
                          className={clsx(
                            'text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition',
                            publishingId === u.id
                              ? 'bg-gray-800 text-gray-500'
                              : ytAuth?.authorized
                                ? 'bg-brand/90 hover:bg-brand text-white'
                                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          )}>
                          {publishingId === u.id
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> 업로드 중…</>
                            : scheduleOn[u.id]
                              ? <><Upload className="w-3 h-3" /> 예약 업로드</>
                              : <><Upload className="w-3 h-3" /> YouTube 업로드</>}
                        </button>
                      </div>
                    )}

                    {u.upload_status === 'failed' && u.upload_error && (
                      <p className="basis-full text-[10px] text-red-400 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="truncate" title={u.upload_error}>업로드 실패: {u.upload_error}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(u)} title="수정"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => remove(u.id)} title="삭제"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-white/5 transition">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function OpsTab({ project }: { project: PersonalProject }) {
  const localPath = project.local_path;
  const projectDir    = getProjectDir(localPath);
  const isDesignProject = projectDir === 'photopolio_maindesign';
  const isBlogProject   = projectDir === 'thive-lab';
  const isShortsProject = projectDir === 'youtube-shorts-automation';
  const isLongformProject  = projectDir === 'youtube-longform-automation';
  const isFloorplanProject = projectDir === 'instagram-floorplan-automation';
  const isAlmyeonProject   = projectDir === '알면편함-youtube-tools';
  const isWebtoonProject   = projectDir === 'webtoon-generator';
  const isXArticleProject  = projectDir === 'x-article-automation';
  const allowedCats   = getAllowedCats(projectDir);
  const visibleCatGroups = Array.from(new Set(
    OPS_ACTIONS.filter(a => allowedCats.includes(a.cat)).map(a => a.cat)
  ));
  const [health,         setHealth]         = useState<HealthResult[]>([]);
  const [git,            setGit]            = useState<GitStatus | null>(null);
  const [running,        setRunning]        = useState<string | null>(null);
  const [output,         setOutput]         = useState('');
  const [outputTitle,    setOutputTitle]    = useState('');
  const [autoRefresh,    setAutoRefresh]    = useState(true);
  const [lastCheck,      setLastCheck]      = useState<Date | null>(null);
  const [healthLoad,     setHealthLoad]     = useState(false);
  const [gitLoad,        setGitLoad]        = useState(false);
  const [queueing,       setQueueing]       = useState<string | null>(null);
  // 트렌드
  const [useTrends,      setUseTrends]      = useState(true);
  const [trendStatus,    setTrendStatus]    = useState<TrendStatus | null>(null);
  const [trendLoading,   setTrendLoading]   = useState(false);
  const [trendExpanded,  setTrendExpanded]  = useState(false);
  // git commit/push
  const [commitMsg,      setCommitMsg]      = useState('');
  const [pushBranch,     setPushBranch]     = useState('');
  // 디자인 관리 패널
  const [designPanel,    setDesignPanel]    = useState<'designs' | 'requests'>('designs');
  const [allDesigns,     setAllDesigns]     = useState<DesignItem[]>([]);
  const [allTotal,       setAllTotal]       = useState(0);
  const [allLoading,     setAllLoading]     = useState(false);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  // 신청 관리
  const [designRequests,   setDesignRequests]   = useState<DesignRequest[]>([]);
  const [requestsLoading,  setRequestsLoading]  = useState(false);
  const [updatingReqId,    setUpdatingReqId]    = useState<string | null>(null);
  const [reqStatusFilter,  setReqStatusFilter]  = useState<'all' | DesignRequest['status']>('all');
  // 블로그 가이드 관리 (ThiveLab 전용)
  const [blogGuides,       setBlogGuides]       = useState<Array<{id:number;title:string;slug:string;category:string|null;status:string;affiliate_url:string|null;product_image:string|null;created_at:string;view_count:number}>>([]);
  const [blogGuidesTotal,  setBlogGuidesTotal]  = useState(0);
  const [blogGuidesLoad,   setBlogGuidesLoad]   = useState(false);
  const [deletingGuideId,  setDeletingGuideId]  = useState<number | null>(null);
  const [editingGuide,     setEditingGuide]     = useState<null | {
    id: number;
    slug: string;
    title: string;
    summary: string;
    content: string;
    content_html: string;
    tagsText: string;
    category: string;
    status: 'draft' | 'published';
    affiliate_url: string;
  }>(null);
  const [editGuideLoad,    setEditGuideLoad]    = useState(false);
  const [editGuideSaving,  setEditGuideSaving]  = useState(false);
  // 유튜브 쇼츠 자동화 — 전자기기 반란 대본 생성 (입력 1개 → 관련 5개 그룹 생성)
  type ShortsItem = { device: string; script: string; script_ko?: string; tip_ko?: string; unified_video_prompt?: string };
  type ShortsHistory = { id: number; input_device: string; items: ShortsItem[]; model: string | null; tone?: string | null; hook?: string | null; created_at: string | null };
  type PresetOption = { key: string; label: string; desc: string; learned?: boolean };
  const [shortsDevice,      setShortsDevice]      = useState('');
  const [shortsItems,       setShortsItems]       = useState<ShortsItem[]>([]);
  const [shortsActiveId,    setShortsActiveId]    = useState<number | null>(null);
  const [shortsInputDevice, setShortsInputDevice] = useState<string>('');
  const [shortsLoading,     setShortsLoading]     = useState(false);
  const [shortsError,       setShortsError]       = useState<string | null>(null);
  const [shortsCopiedIdx,   setShortsCopiedIdx]   = useState<number | null>(null);
  const [shortsHistory,     setShortsHistory]     = useState<ShortsHistory[]>([]);
  const [shortsHistoryLoad, setShortsHistoryLoad] = useState(false);
  const [shortsHistoryOpen, setShortsHistoryOpen] = useState(true);
  const [historyExpanded,   setHistoryExpanded]   = useState<number | null>(null);
  const [shortsTab,      setShortsTab]      = useState<'topic' | 'history' | 'script' | 'image' | 'concat' | 'seo' | 'analytics'>('topic');
  // 주제 추천기 — 아직 대본이 만들어지지 않은 새 기기(=주제) 추천
  type TopicRec = { device: string; reason: string; category?: string };
  type TopicUsed = { device: string; created_at: string | null };
  const [topicRecs,       setTopicRecs]       = useState<TopicRec[]>([]);
  const [topicLoading,    setTopicLoading]    = useState(false);
  const [topicError,      setTopicError]      = useState<string | null>(null);
  const [topicUsedCount,  setTopicUsedCount]  = useState<number>(0);
  const [topicAvailCount, setTopicAvailCount] = useState<number>(0);
  const [topicPoolTotal,  setTopicPoolTotal]  = useState<number>(0);
  const [topicUsedList,     setTopicUsedList]     = useState<TopicUsed[]>([]);
  const [topicUsedOpen,     setTopicUsedOpen]     = useState(false);
  const [poolExpandLoading, setPoolExpandLoading] = useState(false);
  const [poolExpandError,   setPoolExpandError]   = useState<string | null>(null);
  const [poolExpandResult,  setPoolExpandResult]  = useState<{added: {device:string;reason:string;category:string}[];added_count:number} | null>(null);
  // 통합 배치 생성 (추천 + 대본 + 이미지 프롬프트)
  type BatchItem = {
    device: string;
    reason: string;
    category?: string;
    script: string;
    script_ko: string;
    tip_ko: string;
    image_situation: string;
    image_prompt: string;
    image_id?: number;
    unified_video_prompt?: string;
  };
  const [targetVideoModel, setTargetVideoModel] = useState<'grok' | 'veo' | 'sora' | 'kling'>('grok');
  const [batchLoading,    setBatchLoading]    = useState(false);
  const [batchError,      setBatchError]      = useState<string | null>(null);
  const [batchItems,      setBatchItems]      = useState<BatchItem[]>([]);
  const [batchGroupId,    setBatchGroupId]    = useState<number | null>(null);
  const [batchExpanded,   setBatchExpanded]   = useState<Record<number, 'script' | 'image' | 'unified' | null>>({});
  const [batchCopyKey,    setBatchCopyKey]    = useState<string | null>(null);
  const [showAdvancedTabs, setShowAdvancedTabs] = useState(false);
  // 채널 분석
  type ChannelStrategy = {
    overall_score: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    content_strategy: string[];
    upload_strategy: string[];
    growth_actions: string[];
    priority: string;
  };
  const [strategyLoading,    setStrategyLoading]    = useState(false);
  const [strategyError,      setStrategyError]      = useState<string | null>(null);
  const [strategy,           setStrategy]           = useState<ChannelStrategy | null>(null);
  const [strategyApplied,    setStrategyApplied]    = useState(false);
  const [ytAuth,             setYtAuth]             = useState<YoutubeAuthStatus | null>(null);
  const [analyticsLoading,   setAnalyticsLoading]   = useState(false);
  const [analyticsError,     setAnalyticsError]     = useState<string | null>(null);
  const [analyticsChannel,   setAnalyticsChannel]   = useState<AnalyticsChannel | null>(null);
  const [analyticsVideos,    setAnalyticsVideos]    = useState<AnalyticsVideo[]>([]);
  const [analyticsSummary,   setAnalyticsSummary]   = useState<AnalyticsSummary | null>(null);
  const [analyticsTop,       setAnalyticsTop]       = useState<AnalyticsVideo[]>([]);
  const [analyticsSort,      setAnalyticsSort]      = useState<'views' | 'recent' | 'likes'>('views');
  const [analyticsShortsOnly, setAnalyticsShortsOnly] = useState(true);
  const [trendingVideos,     setTrendingVideos]     = useState<AnalyticsVideo[]>([]);
  const [trendingLoading,    setTrendingLoading]    = useState(false);
  const [trendingError,      setTrendingError]      = useState<string | null>(null);
  const [insightsLoading,    setInsightsLoading]    = useState(false);
  const [insightsError,      setInsightsError]      = useState<string | null>(null);
  const [insightsPattern,    setInsightsPattern]    = useState<string>('');
  const [insightsRecs,       setInsightsRecs]       = useState<InsightRec[]>([]);
  // 저조 원인 AI 진단 (/ops/shorts-analyze)
  type DiagnoseItem = {
    title: string;
    views: number;
    tier: 'high' | 'mid' | 'low' | string;
    age_days?: number;
    views_per_day?: number;
    vs_median_pct?: number;
    weak_points?: string[];
    suggestions?: string[];
    reference_title?: string;
  };
  type DiagnoseResult = { summary?: string; median_views_per_day?: number; items: DiagnoseItem[]; target_audience?: 'domestic' | 'overseas' };
  const [diagnoseLoading,    setDiagnoseLoading]    = useState(false);
  const [diagnoseError,      setDiagnoseError]      = useState<string | null>(null);
  const [diagnoseResult,     setDiagnoseResult]     = useState<DiagnoseResult | null>(null);
  const [diagnoseTarget,     setDiagnoseTarget]     = useState<'domestic' | 'overseas'>('domestic');
  // 저조 영상 수정안 (propose → apply)
  type Proposal = {
    current: { title: string; description?: string; tags?: string[] };
    proposal: { new_title: string; new_description: string; new_tags: string[]; rationale: string };
    // 체크된 필드만 적용
    applyTitle: boolean;
    applyDesc: boolean;
    applyTags: boolean;
  };
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [proposeLoadingKey, setProposeLoadingKey] = useState<string | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [proposeError, setProposeError] = useState<Record<string, string>>({});
  const [appliedKeys, setAppliedKeys] = useState<Record<string, boolean>>({});
  const [trendingRegion,     setTrendingRegion]     = useState<string>('US');
  const [geography,          setGeography]          = useState<GeographyRow[]>([]);
  const [geoLoading,         setGeoLoading]         = useState(false);
  const [geoError,           setGeoError]           = useState<string | null>(null);
  const [performance,        setPerformance]        = useState<PerformanceRow[]>([]);
  const [perfSummary,        setPerfSummary]        = useState<PerformanceSummary | null>(null);
  const [perfLoading,        setPerfLoading]        = useState(false);
  const [perfError,          setPerfError]          = useState<string | null>(null);
  const [analyticsDays,      setAnalyticsDays]      = useState<number>(90);
  const [retention,          setRetention]          = useState<Record<string, RetentionPoint[]>>({});
  const [retentionLoading,   setRetentionLoading]   = useState<string | null>(null);
  const [retentionExpanded,  setRetentionExpanded]  = useState<string | null>(null);
  // 대사 생성기 톤 / 훅 프리셋
  const [tonePresets,   setTonePresets]   = useState<PresetOption[]>([]);
  const [hookPresets,   setHookPresets]   = useState<PresetOption[]>([]);
  const [shortsTone,    setShortsTone]    = useState<string>('grumpy_nag');
  const [shortsHook,    setShortsHook]    = useState<string>('none');
  // 훅 패턴 자기학습
  type LearnedPattern = {
    id: number;
    kind: 'tone' | 'hook' | 'title' | 'general';
    polarity?: 'positive' | 'negative';
    label: string;
    desc: string;
    prompt: string;
    source_titles: string[];
    enabled: boolean;
    model: string | null;
    created_at: string | null;
  };
  const [learnedPatterns,  setLearnedPatterns]  = useState<LearnedPattern[]>([]);
  const [learnLoading,     setLearnLoading]     = useState(false);
  const [learnError,       setLearnError]       = useState<string | null>(null);
  const [learnExpanded,    setLearnExpanded]    = useState<number | null>(null);
  const [avoidLearnLoading, setAvoidLearnLoading] = useState(false);
  const [avoidLearnError,  setAvoidLearnError]  = useState<string | null>(null);
  const [avoidLearnMsg,    setAvoidLearnMsg]    = useState<string | null>(null);
  // 경쟁 채널 벤치마킹
  type CompetitorChannel = {
    id: number;
    channel_id: string;
    handle: string | null;
    title: string;
    thumbnail: string | null;
    note: string | null;
    cache_fresh: boolean;
    cache: { fetched_at?: string; channel?: unknown; videos?: AnalyticsVideo[] };
    created_at: string | null;
  };
  type BenchmarkReport = {
    summary?: string;
    hook_gaps?: string[];
    tone_gaps?: string[];
    topic_gaps?: string[];
    actions?: string[];
  };
  const [competitors,      setCompetitors]      = useState<CompetitorChannel[]>([]);
  const [competitorInput,  setCompetitorInput]  = useState('');
  const [competitorAdding, setCompetitorAdding] = useState(false);
  const [competitorError,  setCompetitorError]  = useState<string | null>(null);
  const [competitorRefreshing, setCompetitorRefreshing] = useState<number | null>(null);
  const [benchmarkSelected,    setBenchmarkSelected]    = useState<Record<number, boolean>>({});
  const [benchmarkLoading,     setBenchmarkLoading]     = useState(false);
  const [benchmarkReport,      setBenchmarkReport]      = useState<BenchmarkReport | null>(null);
  const [benchmarkError,       setBenchmarkError]       = useState<string | null>(null);
  // 포스팅 타이밍 & 스냅샷
  type TimingHeatmap = {
    timezone: string;
    avg_views: number[][];       // 7×24
    upload_count: number[][];    // 7×24
    total_videos: number;
    best_slot: { weekday: number; hour: number; avg_views: number; count: number } | null;
    worst_slot: { weekday: number; hour: number; avg_views: number; count: number } | null;
  };
  type EarlyPerfItem = {
    video_id: string;
    title: string;
    published_at: string | null;
    views_at_1h: number | null;
    views_at_6h: number | null;
    views_at_24h: number | null;
    snapshots: { age_hours: number; view_count: number; like_count: number; captured_at: string | null }[];
  };
  const [timingHeatmap,    setTimingHeatmap]    = useState<TimingHeatmap | null>(null);
  const [timingLoading,    setTimingLoading]    = useState(false);
  const [timingError,      setTimingError]      = useState<string | null>(null);
  const [snapshotCapturing, setSnapshotCapturing] = useState(false);
  const [snapshotMsg,      setSnapshotMsg]      = useState<string | null>(null);
  const [earlyPerf,        setEarlyPerf]        = useState<EarlyPerfItem[]>([]);
  const [earlyPerfMedian,  setEarlyPerfMedian]  = useState<number | null>(null);
  // 이미지 프롬프트(8장면) 생성
  type SceneItem = { title: string; prompt: string };
  type ImageHistory = { id: number; input_device: string; character?: string; situation?: string; prompt?: string; scenes: SceneItem[]; model: string | null; source_group_id?: number | null; created_at: string | null };
  const [imgDevice,         setImgDevice]         = useState('');
  const [imgStylePresets,   setImgStylePresets]   = useState<PresetOption[]>([]);
  const [imgStyle,          setImgStyle]          = useState<string>('pixar_3d');
  const [imgCustomStyle,    setImgCustomStyle]    = useState<string>('');
  const [imgCharacter,      setImgCharacter]      = useState('');
  const [imgScenes,         setImgScenes]         = useState<SceneItem[]>([]);
  const [imgInputDevice,    setImgInputDevice]    = useState('');
  const [imgActiveId,       setImgActiveId]       = useState<number | null>(null);
  const [imgLoading,        setImgLoading]        = useState(false);
  const [imgError,          setImgError]          = useState<string | null>(null);
  const [imgCopiedIdx,      setImgCopiedIdx]      = useState<number | null>(null);
  const [imgCharCopied,     setImgCharCopied]     = useState(false);
  const [imgHistory,        setImgHistory]        = useState<ImageHistory[]>([]);
  const [imgHistoryLoad,    setImgHistoryLoad]    = useState(false);
  const [imgHistoryOpen,    setImgHistoryOpen]    = useState(true);
  // 대본 그룹 → 이미지 프롬프트 일괄 생성
  type BatchResult = {
    device: string;
    script?: string;     // 선택한 대본 그룹에서 전달
    status: 'pending' | 'loading' | 'done' | 'error';
    character?: string;
    scenes?: SceneItem[];
    error?: string;
    historyId?: number;
  };
  const [imgBatchSrcId,     setImgBatchSrcId]     = useState<number | null>(null);
  const [imgBatchResults,   setImgBatchResults]   = useState<BatchResult[]>([]);
  const [imgBatchRunning,   setImgBatchRunning]   = useState(false);
  const [imgBatchExpanded,  setImgBatchExpanded]  = useState<number | null>(null);
  const [imgBatchCopied,    setImgBatchCopied]    = useState<string | null>(null);
  // 영상 이어붙이기
  const [concatFiles,    setConcatFiles]    = useState<(File | null)[]>([null, null, null, null, null]);
  const [concatLoading,  setConcatLoading]  = useState(false);
  const [concatError,    setConcatError]    = useState<string | null>(null);
  const [concatResultUrl, setConcatResultUrl] = useState<string | null>(null);
  const [concatResultName, setConcatResultName] = useState<string>('concat.mp4');
  const [concatStatus,    setConcatStatus]    = useState<string>('');
  const [concatFinalUploadId, setConcatFinalUploadId] = useState<number | null>(null);
  const [concatCtaApplied,   setConcatCtaApplied]   = useState(false);
  // 인트로(시작 영상) 설정
  type IntroInfo = { has_intro: boolean; filename?: string; size_bytes?: number; suffix?: string; download_token?: string };
  const [introInfo,     setIntroInfo]     = useState<IntroInfo>({ has_intro: false });
  const [introLoading,  setIntroLoading]  = useState(false);
  const [introError,    setIntroError]    = useState<string | null>(null);
  const [prependIntro,  setPrependIntro]  = useState(true);
  // 아웃트로(마지막 인사 영상) 설정
  type OutroInfo = { has_outro: boolean; filename?: string; size_bytes?: number; suffix?: string; download_token?: string };
  const [outroInfo,     setOutroInfo]     = useState<OutroInfo>({ has_outro: false });
  const [outroLoading,  setOutroLoading]  = useState(false);
  const [outroError,    setOutroError]    = useState<string | null>(null);
  const [appendOutro,   setAppendOutro]   = useState(true);
  const [ctaEnabled,    setCtaEnabled]    = useState(false);
  const [ctaText,       setCtaText]       = useState('구독하고 더 보기 ▶');
  const [ctaSaved,      setCtaSaved]      = useState(false);
  // YouTube SEO (대본 그룹 기준 제목/설명/해시태그)
  const [seoTopic,        setSeoTopic]        = useState('');
  const [seoSrcId,        setSeoSrcId]        = useState<number | null>(null);
  const [seoLoading,      setSeoLoading]      = useState(false);
  const [seoError,        setSeoError]        = useState<string | null>(null);
  const [seoTitle,        setSeoTitle]        = useState('');
  const [seoDescription,  setSeoDescription]  = useState('');
  const [seoHashtags,     setSeoHashtags]     = useState<string[]>([]);
  const [seoCopied,       setSeoCopied]       = useState<string | null>(null);
  // 유튜브 롱폼 자동화
  type LongformOutlineItem = { chapter: string; summary: string };
  type LongformHistoryItem = {
    id: number; topic: string; category: string | null; duration_min: number | null;
    outline: LongformOutlineItem[] | null; script: string | null;
    hook_line?: string | null; seo_title: string | null; seo_desc: string | null;
    seo_tags: string[] | null; next_topic?: string | null;
    model: string | null; created_at: string | null;
  };
  type LongformTopicRec = { title: string; category: string; reason: string; hook: string };

  // X 알티클 타입
  type XArticleSection = { heading: string; content: string };
  type XArticleHistoryItem = {
    id: number; topic: string; category: string | null; title: string | null;
    hook: string | null; sections: XArticleSection[] | null;
    conclusion: string | null; hashtags: string[] | null;
    thread_preview: string | null; model: string | null; created_at: string | null;
  };
  type XArticleTopicRec = { title: string; category: string; reason: string; hook: string };
  const X_ARTICLE_CATEGORIES: Record<string, string> = {
    tool: 'AI 툴 소개 & 리뷰', workflow: '자동화 워크플로우', prompt: '프롬프트 엔지니어링',
    nocode: '노코드 자동화', business: 'AI 비즈니스 활용',
    productivity: '생산성 극대화', trend: 'AI 트렌드 & 인사이트', guide: '단계별 실전 가이드',
  };

  const LONGFORM_GENRES: Record<string, string> = {
    check: '건강검진 & 수치 해석', lifestyle: '생활습관 개선', prevention: '질환 예방',
    medication: '약물 & 영양제', exercise: '중년 맞춤 운동', mental: '중년 정신건강',
    diet: '식이요법 & 영양', symptom: '증상 해석 & 대처',
  };
  const [longformTab,       setLongformTab]       = useState<'topic' | 'generate' | 'history'>('topic');
  const [longformTopic,     setLongformTopic]     = useState('');
  const [longformGenre,     setLongformGenre]     = useState('tech_review');
  const [longformDuration,  setLongformDuration]  = useState(15);
  const [longformLoading,   setLongformLoading]   = useState(false);
  const [longformError,     setLongformError]     = useState<string | null>(null);
  const [longformResult,    setLongformResult]    = useState<LongformHistoryItem | null>(null);
  const [longformHistory,   setLongformHistory]   = useState<LongformHistoryItem[]>([]);
  const [longformHistLoad,  setLongformHistLoad]  = useState(false);
  const [longformActiveId,  setLongformActiveId]  = useState<number | null>(null);
  const [longformCopied,    setLongformCopied]    = useState<string | null>(null);
  const [longformTopics,    setLongformTopics]    = useState<LongformTopicRec[]>([]);

  // X 알티클 상태
  const [xArticleTab,        setXArticleTab]        = useState<'topic' | 'generate' | 'history'>('topic');
  const [xArticleTopic,      setXArticleTopic]      = useState('');
  const [xArticleCategory,   setXArticleCategory]   = useState('guide');
  const [xArticleLoading,    setXArticleLoading]    = useState(false);
  const [xArticleError,      setXArticleError]      = useState<string | null>(null);
  const [xArticleResult,     setXArticleResult]     = useState<XArticleHistoryItem | null>(null);
  const [xArticleHistory,    setXArticleHistory]    = useState<XArticleHistoryItem[]>([]);
  const [xArticleHistLoad,   setXArticleHistLoad]   = useState(false);
  const [xArticleActiveId,   setXArticleActiveId]   = useState<number | null>(null);
  const [xArticleCopied,     setXArticleCopied]     = useState<string | null>(null);
  const [xArticleTopics,     setXArticleTopics]     = useState<XArticleTopicRec[]>([]);

  // 알면 편함 — SEO
  const [almyeonTab,       setAlmyeonTab]       = useState<'seo' | 'video' | '3tips' | 'concat' | 'product'>('seo');
  const [almyeonBsOpen,    setAlmyeonBsOpen]    = useState(false);
  const [almyeonSeoTopic,  setAlmyeonSeoTopic]  = useState('');
  const [almyeonSeoLoading, setAlmyeonSeoLoading] = useState(false);
  const [almyeonSeoError,  setAlmyeonSeoError]  = useState<string | null>(null);
  const [almyeonSeoTitle,  setAlmyeonSeoTitle]  = useState('');
  const [almyeonSeoDesc,   setAlmyeonSeoDesc]   = useState('');
  const [almyeonSeoTags,   setAlmyeonSeoTags]   = useState<string[]>([]);
  const [almyeonSeoCopied, setAlmyeonSeoCopied] = useState<string | null>(null);
  // 알면 편함 — 영상 프롬프트
  const [almyeonVidTopic,  setAlmyeonVidTopic]  = useState('');
  const [almyeonVidLoading, setAlmyeonVidLoading] = useState(false);
  const [almyeonVidError,  setAlmyeonVidError]  = useState<string | null>(null);
  const [almyeonVidResult, setAlmyeonVidResult] = useState<{
    prompt_en: string;
    prompt_ko: string;
    shot_type: string;
    duration_note: string;
  } | null>(null);
  const [almyeonVidCopied, setAlmyeonVidCopied] = useState<string | null>(null);
  // 알면 편함 — 3팁 영상 프롬프트
  const [almyeon3Tips,     setAlmyeon3Tips]     = useState<[string, string, string]>(['', '', '']);
  const [almyeon3Loading,  setAlmyeon3Loading]  = useState(false);
  const [almyeon3Error,    setAlmyeon3Error]    = useState<string | null>(null);
  type Almyeon3Clip = { tip_label: string; verified: boolean; adaptation_note: string; prompt_en: string; shot_type: string; hook_ko: string; duration_note: string };
  const [almyeon3Result,   setAlmyeon3Result]   = useState<{ clips: Almyeon3Clip[]; footer: string } | null>(null);
  const [almyeon3Copied,   setAlmyeon3Copied]   = useState<string | null>(null);
  // 알면 편함 — 영상 합치기
  const [almyeonFiles,     setAlmyeonFiles]     = useState<(File | null)[]>([null, null, null]);
  const [almyeonLoading,   setAlmyeonLoading]   = useState(false);
  const [almyeonError,     setAlmyeonError]     = useState<string | null>(null);
  const [almyeonStatus,    setAlmyeonStatus]    = useState('');
  const [almyeonResultUrl, setAlmyeonResultUrl] = useState<string | null>(null);
  const [almyeonResultName, setAlmyeonResultName] = useState('');
  // 알면 편함 — 트렌딩 상품 탐색
  type AlmyeonTrendItem = { name: string; category: string; reason: string; price_range: string; video_type: string; hook_style: string };
  const [almyeonTrendLoading, setAlmyeonTrendLoading] = useState(false);
  const [almyeonTrendError,   setAlmyeonTrendError]   = useState<string | null>(null);
  const [almyeonTrendItems,   setAlmyeonTrendItems]   = useState<AlmyeonTrendItem[]>([]);
  const [almyeonTrendOpen,    setAlmyeonTrendOpen]    = useState(false);
  // 알면 편함 — 베스트셀러 크롤러
  type AlmyeonBsItem = { name: string; price: number | null; review_count: number; rating: number; url: string; category: string };
  const [almyeonBsCategory, setAlmyeonBsCategory] = useState('');
  const [almyeonBsLoading,  setAlmyeonBsLoading]  = useState(false);
  const [almyeonBsError,    setAlmyeonBsError]    = useState<string | null>(null);
  const [almyeonBsItems,    setAlmyeonBsItems]    = useState<AlmyeonBsItem[]>([]);
  // 알면 편함 — Grok 클립
  type AlmyeonGrokClip = { clip_no: number; section: string; time_range: string; prompt_en: string; prompt_ko: string; shot_type: string };
  const [almyeonGrokLoading, setAlmyeonGrokLoading] = useState(false);
  const [almyeonGrokError,   setAlmyeonGrokError]   = useState<string | null>(null);
  const [almyeonGrokClips,   setAlmyeonGrokClips]   = useState<AlmyeonGrokClip[]>([]);
  const [almyeonGrokCopied,  setAlmyeonGrokCopied]  = useState<number | null>(null);
  // 알면 편함 — AI 스크립트 생성
  type AlmyeonScriptResult = { title: string; thumbnail_text: string; tags: string[]; hook: string; body: string; cta: string; description: string; estimated_length: number };
  const [almyeonScriptProduct,   setAlmyeonScriptProduct]   = useState('');
  const [almyeonScriptPrice,     setAlmyeonScriptPrice]     = useState('');
  const [almyeonScriptVideoType, setAlmyeonScriptVideoType] = useState<'gadget' | 'lifehack' | 'comparison'>('gadget');
  const [almyeonScriptHookStyle, setAlmyeonScriptHookStyle] = useState<'warning' | 'reversal' | 'trust' | 'fact' | 'shock'>('trust');
  const [almyeonScriptLoading,   setAlmyeonScriptLoading]   = useState(false);
  const [almyeonScriptError,     setAlmyeonScriptError]     = useState<string | null>(null);
  const [almyeonScriptResult,    setAlmyeonScriptResult]    = useState<AlmyeonScriptResult | null>(null);
  const [almyeonScriptCopied,    setAlmyeonScriptCopied]    = useState<string | null>(null);
  // 알면 편함 — 설명란 생성
  const [almyeonDescCoupangUrl,  setAlmyeonDescCoupangUrl]  = useState('');
  const [almyeonDescVideoLength, setAlmyeonDescVideoLength] = useState(90);
  const [almyeonDescLoading,     setAlmyeonDescLoading]     = useState(false);
  const [almyeonDescError,       setAlmyeonDescError]       = useState<string | null>(null);
  const [almyeonDescResult,      setAlmyeonDescResult]      = useState('');
  const [almyeonDescCopied,      setAlmyeonDescCopied]      = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const links = parseLinks(project.links);

  async function fetchTrendStatus() {
    try {
      const data = await designQueueApi.getTrends(project.id);
      setTrendStatus(data);
    } catch { /* 조용히 무시 */ }
  }

  async function triggerTrendRefresh() {
    if (trendLoading) return;
    setTrendLoading(true);
    try {
      await designQueueApi.refreshTrends(project.id);
      // 갱신 완료될 때까지 5초마다 폴링
      const poll = setInterval(async () => {
        const s = await designQueueApi.getTrends(project.id);
        setTrendStatus(s);
        if (!s.refreshing) clearInterval(poll);
      }, 5000);
      setTimeout(() => clearInterval(poll), 120_000); // 최대 2분
    } catch (e: any) {
      alert(e.message ?? '트렌드 갱신 실패');
    } finally {
      setTrendLoading(false);
    }
  }

  async function fetchHealth() {
    if (!links.length) return;
    setHealthLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/health`, { headers: getAuthHeaders() });
      if (res.ok) { setHealth(await res.json()); setLastCheck(new Date()); }
    } finally { setHealthLoad(false); }
  }

  async function fetchGit() {
    if (!localPath) return;
    setGitLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/git`, { headers: getAuthHeaders() });
      if (res.ok) setGit(await res.json());
    } finally { setGitLoad(false); }
  }

  async function fetchDesignRequests() {
    setRequestsLoading(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/design-requests`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDesignRequests(data.requests ?? []);
      }
    } finally { setRequestsLoading(false); }
  }

  async function fetchBlogGuides() {
    setBlogGuidesLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/blog-guides?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBlogGuides(data.guides ?? []);
        setBlogGuidesTotal(data.total ?? data.guides?.length ?? 0);
      }
    } finally { setBlogGuidesLoad(false); }
  }

  async function deleteBlogGuide(id: number) {
    if (!confirm('이 가이드를 삭제할까요?\n사이트에서도 즉시 제거됩니다.')) return;
    setDeletingGuideId(id);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/blog-guides/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (res.ok || res.status === 204) {
        setBlogGuides(prev => prev.filter(g => g.id !== id));
        setBlogGuidesTotal(t => Math.max(0, t - 1));
      } else { alert('삭제 실패'); }
    } finally { setDeletingGuideId(null); }
  }

  async function openEditBlogGuide(id: number) {
    setEditGuideLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/blog-guides/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) { alert('가이드를 불러오지 못했습니다.'); return; }
      const { guide } = await res.json();
      setEditingGuide({
        id: guide.id,
        slug: guide.slug ?? '',
        title: guide.title ?? '',
        summary: guide.summary ?? '',
        content: guide.content ?? '',
        content_html: guide.content_html ?? '',
        tagsText: Array.isArray(guide.tags) ? guide.tags.join(', ') : '',
        category: guide.category ?? '',
        status: guide.status === 'published' ? 'published' : 'draft',
        affiliate_url: guide.affiliate_url ?? '',
      });
    } catch { alert('가이드를 불러오지 못했습니다.'); }
    finally { setEditGuideLoad(false); }
  }

  async function saveEditBlogGuide() {
    if (!editingGuide) return;
    if (!editingGuide.title.trim() || !editingGuide.slug.trim()) {
      alert('제목과 slug는 필수입니다.'); return;
    }
    setEditGuideSaving(true);
    try {
      const body = {
        slug: editingGuide.slug.trim(),
        title: editingGuide.title.trim(),
        summary: editingGuide.summary || null,
        content: editingGuide.content,
        content_html: editingGuide.content_html || null,
        tags: editingGuide.tagsText.split(',').map(t => t.trim()).filter(Boolean),
        category: editingGuide.category || null,
        status: editingGuide.status,
        affiliate_url: editingGuide.affiliate_url || null,
      };
      const res = await fetch(`${BASE}/${project.id}/ops/blog-guides/${editingGuide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`저장 실패: ${err.detail ?? res.statusText}`);
        return;
      }
      const { guide } = await res.json();
      setBlogGuides(prev => prev.map(g => g.id === guide.id ? {
        ...g,
        title: guide.title,
        slug: guide.slug,
        category: guide.category,
        status: guide.status,
        affiliate_url: guide.affiliate_url,
        product_image: guide.product_image,
      } : g));
      setEditingGuide(null);
    } finally { setEditGuideSaving(false); }
  }

  async function generateShortsScript() {
    const device = shortsDevice.trim();
    if (!device || shortsLoading) return;
    setShortsLoading(true);
    setShortsError(null);
    setShortsItems([]);
    setShortsActiveId(null);
    setShortsCopiedIdx(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          device,
          tone: shortsTone,
          hook: shortsHook,
          ...(strategyApplied && strategy ? {
            strategy_context: [
              ...strategy.content_strategy,
              ...strategy.growth_actions,
            ],
          } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShortsError(data.detail ?? '대본 생성에 실패했어요.');
      } else {
        const items: ShortsItem[] = Array.isArray(data.items) ? data.items : [];
        setShortsItems(items);
        setShortsInputDevice(data.input_device ?? device);
        setShortsActiveId(typeof data.id === 'number' ? data.id : null);
        fetchShortsHistory();
        fetchTopicUsed();
      }
    } catch {
      setShortsError('네트워크 오류가 발생했어요.');
    } finally {
      setShortsLoading(false);
    }
  }

  async function fetchShortsPresets() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-script/presets`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.tones)) setTonePresets(data.tones);
      if (Array.isArray(data.hooks)) setHookPresets(data.hooks);
      if (data.default_tone) setShortsTone(prev => prev || data.default_tone);
      if (data.default_hook) setShortsHook(prev => prev || data.default_hook);
    } catch { /* 조용히 무시 */ }
  }

  async function fetchLearnedPatterns() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-learned-patterns`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.patterns)) setLearnedPatterns(data.patterns);
    } catch { /* 무시 */ }
  }

  async function runLearnAvoidPatterns() {
    setAvoidLearnLoading(true);
    setAvoidLearnError(null);
    setAvoidLearnMsg(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-learn-avoid-patterns`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ recent: 3 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvoidLearnError(data.detail ?? '부정 패턴 학습에 실패했어요.');
        return;
      }
      setAvoidLearnMsg(`${(data.learned ?? []).length}개의 부정 패턴을 학습했어요 (저조 영상 ${data.analyzed_low_videos}개 기반).`);
      await fetchLearnedPatterns();
      await fetchShortsPresets();
    } catch (err) {
      setAvoidLearnError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setAvoidLearnLoading(false);
    }
  }

  async function runLearnPatterns() {
    setLearnLoading(true);
    setLearnError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-learn-patterns`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_n: 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLearnError(data.detail ?? '패턴 학습에 실패했어요.');
        return;
      }
      await fetchLearnedPatterns();
      await fetchShortsPresets();
    } catch (err) {
      setLearnError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setLearnLoading(false);
    }
  }

  async function togglePattern(id: number, enabled: boolean) {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-learned-patterns/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) return;
      await fetchLearnedPatterns();
      await fetchShortsPresets();
    } catch { /* 무시 */ }
  }

  async function deletePattern(id: number) {
    if (!confirm('이 학습 패턴을 삭제할까요?')) return;
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-learned-patterns/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      await fetchLearnedPatterns();
      await fetchShortsPresets();
    } catch { /* 무시 */ }
  }

  async function fetchCompetitors() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-competitors`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.competitors)) setCompetitors(data.competitors);
    } catch { /* 무시 */ }
  }

  async function addCompetitor() {
    const q = competitorInput.trim();
    if (!q) return;
    setCompetitorAdding(true);
    setCompetitorError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-competitors`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompetitorError(data.detail ?? '추가 실패');
        return;
      }
      setCompetitorInput('');
      await fetchCompetitors();
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setCompetitorAdding(false);
    }
  }

  async function refreshCompetitor(id: number) {
    setCompetitorRefreshing(id);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-competitors/${id}/refresh`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompetitorError(data.detail ?? '갱신 실패');
        return;
      }
      await fetchCompetitors();
    } catch { /* 무시 */ }
    finally { setCompetitorRefreshing(null); }
  }

  async function deleteCompetitor(id: number) {
    if (!confirm('이 경쟁 채널을 삭제할까요?')) return;
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-competitors/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      await fetchCompetitors();
    } catch { /* 무시 */ }
  }

  async function fetchTimingHeatmap() {
    setTimingLoading(true);
    setTimingError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-timing-heatmap`, { headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTimingError(data.detail ?? '히트맵 조회 실패');
        return;
      }
      setTimingHeatmap(data);
    } catch (err) {
      setTimingError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setTimingLoading(false);
    }
  }

  async function captureSnapshot() {
    setSnapshotCapturing(true);
    setSnapshotMsg(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-snapshots/capture`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSnapshotMsg(data.detail ?? '스냅샷 저장 실패');
        return;
      }
      setSnapshotMsg(`스냅샷 ${data.saved}개 저장됨`);
      await fetchEarlyPerf();
    } catch (err) {
      setSnapshotMsg(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setSnapshotCapturing(false);
    }
  }

  async function fetchEarlyPerf() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-snapshots/early-performance`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) setEarlyPerf(data.items);
      setEarlyPerfMedian(typeof data.median_24h === 'number' ? data.median_24h : null);
    } catch { /* 무시 */ }
  }

  async function runBenchmark() {
    const ids = Object.entries(benchmarkSelected).filter(([, v]) => v).map(([k]) => Number(k));
    if (ids.length === 0) {
      setBenchmarkError('비교할 경쟁 채널을 하나 이상 선택해주세요.');
      return;
    }
    setBenchmarkLoading(true);
    setBenchmarkError(null);
    setBenchmarkReport(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-competitors/benchmark`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_ids: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBenchmarkError(data.detail ?? '벤치마크 실패');
        return;
      }
      setBenchmarkReport(data.report ?? null);
      await fetchCompetitors();
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setBenchmarkLoading(false);
    }
  }

  async function fetchYtAuth() {
    try {
      const res = await fetch(`${BASE}/youtube/auth-status`, { headers: getAuthHeaders() });
      if (res.ok) setYtAuth(await res.json());
    } catch { /* noop */ }
  }

  async function reAuthYoutubeForWrite() {
    if (!confirm('YouTube 쓰기 권한을 추가하려면 기존 인증을 제거하고 다시 로그인해야 해요. 계속할까요?')) return;
    try {
      await fetch(`${BASE}/youtube/logout`, { method: 'POST', headers: getAuthHeaders() });
      const res = await fetch(`${BASE}/youtube/auth-url`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || '인증 URL 발급 실패');
        return;
      }
      const { auth_url } = await res.json();
      window.open(auth_url, '_blank', 'noopener,noreferrer');
      alert('새 탭에서 Google 로그인을 완료한 뒤, 이 페이지로 돌아와 "상태 새로고침" 버튼을 눌러주세요.');
      await fetchYtAuth();
    } catch (e: any) {
      alert(e?.message || '재인증 시작 실패');
    }
  }

  async function fetchMyVideos() {
    if (!project) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-analytics/my-videos?max_results=50`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAnalyticsError(data.detail ?? '영상을 불러오지 못했어요.');
      } else {
        setAnalyticsChannel(data.channel ?? null);
        setAnalyticsVideos(Array.isArray(data.videos) ? data.videos : []);
        setAnalyticsSummary(data.summary ?? null);
        setAnalyticsTop(Array.isArray(data.top) ? data.top : []);
      }
    } catch {
      setAnalyticsError('네트워크 오류가 발생했어요.');
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function runChannelStrategy() {
    if (!project) return;
    setStrategyLoading(true);
    setStrategyError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/channel-strategy`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: analyticsChannel ?? {},
          videos: analyticsVideos.map(v => ({
            title: v.title,
            view_count: v.view_count,
            like_count: v.like_count,
            is_short: v.is_short,
            published_at: v.published_at,
          })),
          perf_summary: perfSummary ?? {},
          geography: geography ?? [],
          timing: timingHeatmap ?? {},
          benchmark: benchmarkReport ?? {},
          diagnose: { summary: diagnoseResult?.summary ?? '' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStrategyError(data.detail ?? '분석에 실패했어요.');
      } else {
        setStrategy(data);
      }
    } catch {
      setStrategyError('네트워크 오류가 발생했어요.');
    } finally {
      setStrategyLoading(false);
    }
  }

  async function fetchTrending() {
    if (!project) return;
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const reg = (trendingRegion || 'US').trim().toUpperCase();
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-analytics/trending?region=${encodeURIComponent(reg)}&category_id=22&max_results=20`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrendingError(data.detail ?? '트렌딩 정보를 불러오지 못했어요.');
      } else {
        setTrendingVideos(Array.isArray(data.videos) ? data.videos : []);
      }
    } catch {
      setTrendingError('네트워크 오류가 발생했어요.');
    } finally {
      setTrendingLoading(false);
    }
  }

  async function fetchGeography() {
    if (!project) return;
    setGeoLoading(true);
    setGeoError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-analytics/geography?days=${analyticsDays}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGeoError(data.detail ?? '국가별 데이터를 불러오지 못했어요.');
      } else {
        setGeography(Array.isArray(data.countries) ? data.countries : []);
      }
    } catch {
      setGeoError('네트워크 오류가 발생했어요.');
    } finally {
      setGeoLoading(false);
    }
  }

  async function fetchPerformance() {
    if (!project) return;
    setPerfLoading(true);
    setPerfError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-analytics/performance?days=${analyticsDays}&max_results=50`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPerfError(data.detail ?? '성과 데이터를 불러오지 못했어요.');
      } else {
        setPerformance(Array.isArray(data.videos) ? data.videos : []);
        setPerfSummary(data.summary ?? null);
      }
    } catch {
      setPerfError('네트워크 오류가 발생했어요.');
    } finally {
      setPerfLoading(false);
    }
  }

  async function toggleRetention(videoId: string) {
    if (!project) return;
    if (retentionExpanded === videoId) { setRetentionExpanded(null); return; }
    setRetentionExpanded(videoId);
    if (retention[videoId]) return;
    setRetentionLoading(videoId);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-analytics/retention?video_id=${encodeURIComponent(videoId)}&days=${analyticsDays}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRetention(prev => ({ ...prev, [videoId]: Array.isArray(data.points) ? data.points : [] }));
      } else {
        setRetention(prev => ({ ...prev, [videoId]: [] }));
      }
    } catch {
      setRetention(prev => ({ ...prev, [videoId]: [] }));
    } finally {
      setRetentionLoading(null);
    }
  }

  async function generateInsights() {
    if (!project) return;
    const top = analyticsTop.length > 0 ? analyticsTop
      : [...analyticsVideos].sort((a, b) => b.view_count - a.view_count).slice(0, 5);
    if (top.length === 0) {
      setInsightsError('먼저 내 영상을 불러와주세요.');
      return;
    }
    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsPattern('');
    setInsightsRecs([]);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-analytics/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ top: top.map(v => ({
          title: v.title, tags: v.tags ?? [], view_count: v.view_count, like_count: v.like_count,
        })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInsightsError(data.detail ?? 'AI 추천 생성에 실패했어요.');
      } else {
        setInsightsPattern(String(data.pattern ?? ''));
        setInsightsRecs(Array.isArray(data.recommendations) ? data.recommendations : []);
      }
    } catch {
      setInsightsError('네트워크 오류가 발생했어요.');
    } finally {
      setInsightsLoading(false);
    }
  }

  async function runDiagnose() {
    if (!project) return;
    const pool = analyticsShortsOnly
      ? analyticsVideos.filter(v => v.is_short)
      : analyticsVideos;
    if (pool.length < 2) {
      setDiagnoseError('영상이 최소 2개 이상 필요해요. 먼저 내 영상을 불러와주세요.');
      return;
    }
    const payload = pool.slice(0, 50).map(v => ({
      id: v.id,
      title: v.title,
      views: v.view_count,
      published_at: v.published_at ?? undefined,
      duration_sec: v.duration_seconds,
      tags: v.tags ?? undefined,
    }));
    setDiagnoseLoading(true);
    setDiagnoseError(null);
    setDiagnoseResult(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ videos: payload, target_audience: diagnoseTarget }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDiagnoseError(data.detail ?? 'AI 진단에 실패했어요.');
      } else {
        const a = data.analysis ?? {};
        setDiagnoseResult({
          summary: String(a.summary ?? ''),
          median_views_per_day: typeof a.median_views_per_day === 'number' ? a.median_views_per_day : undefined,
          items: Array.isArray(a.items) ? a.items : [],
          target_audience: data.target_audience ?? diagnoseTarget,
        });
      }
    } catch {
      setDiagnoseError('네트워크 오류가 발생했어요.');
    } finally {
      setDiagnoseLoading(false);
    }
  }

  async function proposeForItem(item: DiagnoseItem) {
    if (!project) return;
    const key = item.title;
    const videoMeta = analyticsVideos.find(v => v.title === item.title);
    if (!videoMeta) {
      setProposeError(p => ({ ...p, [key]: '현재 영상 메타를 찾을 수 없어요 (새로고침 후 재시도)' }));
      return;
    }
    setProposeLoadingKey(key);
    setProposeError(p => { const { [key]: _, ...rest } = p; return rest; });
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-analyze/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          video: {
            title: videoMeta.title,
            description: videoMeta.description ?? '',
            tags: videoMeta.tags ?? [],
            views: videoMeta.view_count,
            duration_sec: videoMeta.duration_seconds,
            published_at: videoMeta.published_at,
          },
          weak_points: item.weak_points ?? [],
          suggestions: item.suggestions ?? [],
          target_audience: diagnoseResult?.target_audience ?? diagnoseTarget,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProposeError(p => ({ ...p, [key]: data.detail ?? '수정안 생성 실패' }));
      } else {
        setProposals(p => ({
          ...p,
          [key]: {
            current: data.current,
            proposal: data.proposal,
            applyTitle: true,
            applyDesc: true,
            applyTags: true,
          },
        }));
      }
    } catch {
      setProposeError(p => ({ ...p, [key]: '네트워크 오류' }));
    } finally {
      setProposeLoadingKey(null);
    }
  }

  async function applyProposal(item: DiagnoseItem) {
    if (!project) return;
    const key = item.title;
    const prop = proposals[key];
    const videoMeta = analyticsVideos.find(v => v.title === item.title);
    if (!prop || !videoMeta) return;
    if (!ytAuth?.has_write) {
      if (confirm('YouTube 쓰기 권한이 없어요. 지금 권한을 추가할까요? (로그아웃 후 재로그인)')) {
        await reAuthYoutubeForWrite();
      }
      return;
    }
    if (!prop.applyTitle && !prop.applyDesc && !prop.applyTags) {
      alert('적용할 필드를 하나 이상 선택해주세요.');
      return;
    }
    const changes: string[] = [];
    if (prop.applyTitle) changes.push('제목');
    if (prop.applyDesc) changes.push('설명');
    if (prop.applyTags) changes.push('태그');
    if (!confirm(`"${videoMeta.title}"\n\n${changes.join(', ')}을(를) YouTube에 실제 반영합니다. 계속할까요?`)) {
      return;
    }
    setApplyingKey(key);
    try {
      const body: Record<string, unknown> = { video_id: videoMeta.id };
      if (prop.applyTitle) body.title = prop.proposal.new_title;
      if (prop.applyDesc) body.description = prop.proposal.new_description;
      if (prop.applyTags) body.tags = prop.proposal.new_tags;
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-analyze/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProposeError(p => ({ ...p, [key]: data.detail ?? '적용 실패' }));
      } else {
        setAppliedKeys(a => ({ ...a, [key]: true }));
      }
    } catch {
      setProposeError(p => ({ ...p, [key]: '네트워크 오류' }));
    } finally {
      setApplyingKey(null);
    }
  }

  function toggleProposalField(key: string, field: 'applyTitle' | 'applyDesc' | 'applyTags') {
    setProposals(p => {
      const cur = p[key];
      if (!cur) return p;
      return { ...p, [key]: { ...cur, [field]: !cur[field] } };
    });
  }

  function applyDeviceToScript(device: string) {
    if (!device.trim()) return;
    setShortsDevice(device.trim());
    setShowAdvancedTabs(true);
    setShortsTab('script');
  }

  async function fetchTopicUsed() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-topic/used`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.used)) setTopicUsedList(data.used);
      if (typeof data.used_count === 'number') setTopicUsedCount(data.used_count);
      if (typeof data.pool_total === 'number') setTopicPoolTotal(data.pool_total);
      if (typeof data.available_count === 'number') setTopicAvailCount(data.available_count);
    } catch { /* 조용히 무시 */ }
  }

  async function expandTopicPool() {
    setPoolExpandLoading(true);
    setPoolExpandError(null);
    setPoolExpandResult(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-topic/pool/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ count: 15 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPoolExpandError(data.detail ?? '풀 확장에 실패했어요.');
        return;
      }
      setPoolExpandResult({ added: Array.isArray(data.added) ? data.added : [], added_count: data.added_count ?? 0 });
      if (typeof data.pool_total === 'number') setTopicPoolTotal(data.pool_total);
      if (typeof data.available_count === 'number') setTopicAvailCount(data.available_count);
      fetchTopicUsed();
    } catch (err) {
      setPoolExpandError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setPoolExpandLoading(false);
    }
  }

  async function generateTopicRecs() {
    setTopicLoading(true);
    setTopicError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-topic/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ count: 5 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTopicError(data.detail ?? '주제 추천에 실패했어요.');
        return;
      }
      setTopicRecs(Array.isArray(data.recommendations) ? data.recommendations : []);
      if (typeof data.used_count === 'number') setTopicUsedCount(data.used_count);
      if (typeof data.available_count === 'number') setTopicAvailCount(data.available_count);
      if (typeof data.pool_total === 'number') setTopicPoolTotal(data.pool_total);
    } catch (err) {
      setTopicError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setTopicLoading(false);
    }
  }

  async function generateBatch(overrideStrategyContext?: string[]) {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const body: Record<string, unknown> = {
        count: 5,
        tone: shortsTone,
        hook: shortsHook,
        style: imgStyle,
        target_model: targetVideoModel,
      };
      if (imgStyle === 'custom') {
        if (!imgCustomStyle.trim()) {
          setBatchError('커스텀 스타일 설명을 입력해주세요.');
          setBatchLoading(false);
          return;
        }
        body.custom_style = imgCustomStyle.trim();
      }
      const ctx = overrideStrategyContext ?? (strategyApplied && strategy ? [...strategy.content_strategy, ...strategy.growth_actions] : null);
      if (ctx && ctx.length > 0) body.strategy_context = ctx;
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-batch-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBatchError(data.detail ?? '일괄 생성에 실패했어요.');
        return;
      }
      setBatchItems(Array.isArray(data.items) ? data.items : []);
      setBatchGroupId(typeof data.group_id === 'number' ? data.group_id : null);
      setBatchExpanded({});
      if (typeof data.used_count === 'number') setTopicUsedCount(data.used_count);
      // 히스토리/used 목록 갱신
      fetchShortsHistory();
      fetchImgHistory();
      fetchTopicUsed();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setBatchLoading(false);
    }
  }

  async function copyGenItemText(key: string, text: string) {
    const ok = await safeCopy(text);
    if (!ok) {
      setBatchError('클립보드 복사에 실패했어요. 브라우저 권한을 확인하거나 텍스트를 길게 눌러 직접 복사해주세요.');
      return;
    }
    setBatchError(null);
    setBatchCopyKey(key);
    setTimeout(() => setBatchCopyKey(k => (k === key ? null : k)), 1200);
  }

  async function fetchImgStylePresets() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-image-prompts/presets`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.styles)) setImgStylePresets(data.styles);
      if (data.default_style) setImgStyle(prev => prev || data.default_style);
    } catch { /* 조용히 무시 */ }
  }

  async function fetchShortsHistory() {
    setShortsHistoryLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-script/history?limit=30`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setShortsHistory(Array.isArray(data.history) ? data.history : []);
      }
    } finally {
      setShortsHistoryLoad(false);
    }
  }

  async function fetchLongformHistory() {
    setLongformHistLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/longform-script/history?limit=50`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLongformHistory(Array.isArray(data) ? data : []);
      }
    } finally {
      setLongformHistLoad(false);
    }
  }

  async function fetchLongformTopics() {
    if (longformLoading) return;
    setLongformLoading(true);
    setLongformError(null);
    setLongformTopics([]);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/longform-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ category: longformGenre || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLongformError(data.detail ?? '주제 추천 생성에 실패했어요.');
      } else {
        setLongformTopics(Array.isArray(data.topics) ? data.topics : []);
      }
    } catch {
      setLongformError('네트워크 오류가 발생했어요.');
    } finally {
      setLongformLoading(false);
    }
  }

  async function generateLongformScript() {
    const topic = longformTopic.trim();
    if (!topic || longformLoading) return;
    setLongformLoading(true);
    setLongformError(null);
    setLongformResult(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/longform-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ topic, category: longformGenre || 'check', duration_min: longformDuration }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLongformError(data.detail ?? '대본 생성에 실패했어요.');
      } else {
        setLongformResult(data);
        setLongformActiveId(data.id ?? null);
        fetchLongformHistory();
      }
    } catch {
      setLongformError('네트워크 오류가 발생했어요.');
    } finally {
      setLongformLoading(false);
    }
  }

  async function deleteLongformHistory(id: number) {
    if (!confirm('이 히스토리를 삭제할까요?')) return;
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/longform-script/history/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLongformHistory(prev => prev.filter(h => h.id !== id));
        if (longformActiveId === id) { setLongformResult(null); setLongformActiveId(null); }
      }
    } catch { /* noop */ }
  }

  function loadLongformHistory(h: LongformHistoryItem) {
    setLongformResult(h);
    setLongformActiveId(h.id);
    setLongformError(null);
    setLongformTab('generate');
  }

  function longformCopy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setLongformCopied(key);
      setTimeout(() => setLongformCopied(null), 1500);
    });
  }

  // X 알티클 fetch 함수
  async function fetchXArticleHistory() {
    setXArticleHistLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/x-article/history`, { headers: getAuthHeaders() });
      const data = await res.json();
      setXArticleHistory(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setXArticleHistLoad(false);
    }
  }

  async function fetchXArticleTopics() {
    if (xArticleLoading) return;
    setXArticleLoading(true);
    setXArticleError(null);
    setXArticleTopics([]);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/x-article-topics`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: xArticleCategory || '' }),
      });
      const data = await res.json();
      if (!res.ok) { setXArticleError(data.detail ?? '주제 추천 생성에 실패했어요.'); return; }
      setXArticleTopics(Array.isArray(data.topics) ? data.topics : []);
    } catch { setXArticleError('네트워크 오류가 발생했어요.'); }
    finally { setXArticleLoading(false); }
  }

  async function generateXArticle() {
    const topic = xArticleTopic.trim();
    if (!topic || xArticleLoading) return;
    setXArticleLoading(true);
    setXArticleError(null);
    setXArticleResult(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/x-article`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, category: xArticleCategory || 'guide' }),
      });
      const data = await res.json();
      if (!res.ok) { setXArticleError(data.detail ?? '알티클 생성에 실패했어요.'); return; }
      setXArticleResult(data);
      setXArticleActiveId(data.id ?? null);
      setXArticleHistory(prev => [data, ...prev]);
    } catch { setXArticleError('네트워크 오류가 발생했어요.'); }
    finally { setXArticleLoading(false); }
  }

  async function deleteXArticleHistory(id: number) {
    if (!confirm('이 알티클을 삭제할까요?')) return;
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/x-article/history/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (res.ok || res.status === 204) {
        setXArticleHistory(prev => prev.filter(h => h.id !== id));
        if (xArticleActiveId === id) { setXArticleResult(null); setXArticleActiveId(null); }
      }
    } catch { /* ignore */ }
  }

  function loadXArticleHistory(h: XArticleHistoryItem) {
    setXArticleResult(h);
    setXArticleActiveId(h.id);
    setXArticleError(null);
    setXArticleTab('generate');
  }

  function xArticleCopy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setXArticleCopied(key);
      setTimeout(() => setXArticleCopied(null), 1500);
    });
  }

  function loadShortsHistory(h: ShortsHistory) {
    setShortsItems(h.items);
    setShortsInputDevice(h.input_device);
    setShortsActiveId(h.id);
    setShortsCopiedIdx(null);
    setShortsError(null);
  }

  async function deleteShortsHistory(id: number) {
    if (!confirm('이 히스토리를 삭제할까요?')) return;
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-script/history/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok || res.status === 204) {
        setShortsHistory(prev => prev.filter(h => h.id !== id));
        if (shortsActiveId === id) { setShortsItems([]); setShortsActiveId(null); }
      }
    } catch { /* noop */ }
  }

  async function generateImagePrompts() {
    const device = imgDevice.trim();
    if (!device || imgLoading) return;
    if (imgStyle === 'custom' && !imgCustomStyle.trim()) {
      setImgError('커스텀 스타일 설명을 입력해주세요.');
      return;
    }
    setImgLoading(true);
    setImgError(null);
    setImgScenes([]);
    setImgCharacter('');
    setImgActiveId(null);
    setImgCopiedIdx(null);
    setImgCharCopied(false);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-image-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ device, style: imgStyle, custom_style: imgCustomStyle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImgError(data.detail ?? '이미지 프롬프트 생성에 실패했어요.');
      } else {
        const prompt: string = data.prompt ?? (Array.isArray(data.scenes) && data.scenes[0]?.prompt) ?? '';
        setImgCharacter(data.situation ?? '');
        setImgScenes(prompt ? [{ title: data.input_device ?? device, prompt }] : []);
        setImgInputDevice(data.input_device ?? device);
        setImgActiveId(typeof data.id === 'number' ? data.id : null);
        fetchImgHistory();
      }
    } catch {
      setImgError('네트워크 오류가 발생했어요.');
    } finally {
      setImgLoading(false);
    }
  }

  async function fetchImgHistory() {
    setImgHistoryLoad(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-image-prompts/history?limit=30`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setImgHistory(Array.isArray(data.history) ? data.history : []);
      }
    } finally {
      setImgHistoryLoad(false);
    }
  }

  function loadImgHistory(h: ImageHistory) {
    setImgCharacter(h.situation ?? h.character ?? '');
    setImgScenes(Array.isArray(h.scenes) ? h.scenes : []);
    setImgInputDevice(h.input_device);
    setImgActiveId(h.id);
    setImgCopiedIdx(null);
    setImgCharCopied(false);
    setImgError(null);
  }

  async function deleteImgHistory(id: number) {
    if (!confirm('이 히스토리를 삭제할까요?')) return;
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-image-prompts/history/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok || res.status === 204) {
        setImgHistory(prev => prev.filter(h => h.id !== id));
        if (imgActiveId === id) { setImgScenes([]); setImgCharacter(''); setImgActiveId(null); }
      }
    } catch { /* noop */ }
  }

  async function copyImgScene(idx: number) {
    const item = imgScenes[idx];
    if (!item) return;
    const ok = await safeCopy(item.prompt);
    if (ok) {
      setImgCopiedIdx(idx);
      setTimeout(() => setImgCopiedIdx(prev => (prev === idx ? null : prev)), 1500);
    } else {
      setImgError('클립보드 복사에 실패했어요.');
    }
  }

  async function copyImgCharacter() {
    if (!imgCharacter) return;
    const ok = await safeCopy(imgCharacter);
    if (ok) {
      setImgCharCopied(true);
      setTimeout(() => setImgCharCopied(false), 1500);
    } else {
      setImgError('클립보드 복사에 실패했어요.');
    }
  }

  function pickBatchSource(historyId: number | null) {
    setImgBatchSrcId(historyId);
    setImgBatchExpanded(null);
    if (!historyId) {
      setImgBatchResults([]);
      return;
    }
    const src = shortsHistory.find(h => h.id === historyId);
    if (!src) { setImgBatchResults([]); return; }
    setImgBatchResults(src.items.map(it => ({ device: it.device, script: it.script, status: 'pending' })));
  }

  async function runBatchImgGen() {
    if (imgBatchRunning || imgBatchResults.length === 0) return;
    setImgBatchRunning(true);
    for (let i = 0; i < imgBatchResults.length; i++) {
      if (imgBatchResults[i].status === 'done') continue;
      setImgBatchResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'loading', error: undefined } : r
      ));
      try {
        const res = await fetch(`${BASE}/${project.id}/ops/shorts-image-prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ device: imgBatchResults[i].device, source_group_id: imgBatchSrcId, style: imgStyle, custom_style: imgCustomStyle }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setImgBatchResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', error: data.detail ?? '생성 실패' } : r
          ));
        } else {
          setImgBatchResults(prev => prev.map((r, idx) => {
            if (idx !== i) return r;
            const prompt: string = data.prompt ?? (Array.isArray(data.scenes) && data.scenes[0]?.prompt) ?? '';
            return {
              ...r, status: 'done',
              character: data.situation ?? '',
              scenes: prompt ? [{ title: data.input_device ?? r.device, prompt }] : [],
              historyId: typeof data.id === 'number' ? data.id : undefined,
            };
          }));
          setImgBatchExpanded(i);
        }
      } catch (e: any) {
        setImgBatchResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: e?.message ?? '네트워크 오류' } : r
        ));
      }
    }
    setImgBatchRunning(false);
    fetchImgHistory();
  }

  async function retryBatchItem(i: number) {
    const item = imgBatchResults[i];
    if (!item || imgBatchRunning) return;
    setImgBatchRunning(true);
    setImgBatchResults(prev => prev.map((r, idx) =>
      idx === i ? { ...r, status: 'loading', error: undefined } : r
    ));
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-image-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ device: item.device, source_group_id: imgBatchSrcId, style: imgStyle, custom_style: imgCustomStyle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImgBatchResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: data.detail ?? '생성 실패' } : r
        ));
      } else {
        setImgBatchResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r, status: 'done',
            character: data.character,
            scenes: Array.isArray(data.scenes) ? data.scenes : [],
            historyId: typeof data.id === 'number' ? data.id : undefined,
          } : r
        ));
        setImgBatchExpanded(i);
        fetchImgHistory();
      }
    } catch (e: any) {
      setImgBatchResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'error', error: e?.message ?? '네트워크 오류' } : r
      ));
    } finally {
      setImgBatchRunning(false);
    }
  }

  function resetBatch() {
    setImgBatchSrcId(null);
    setImgBatchResults([]);
    setImgBatchExpanded(null);
    setImgBatchCopied(null);
  }

  async function copyBatchText(key: string, text: string) {
    if (!text) return;
    const ok = await safeCopy(text);
    if (ok) {
      setImgBatchCopied(key);
      setTimeout(() => setImgBatchCopied(prev => (prev === key ? null : prev)), 1500);
    } else {
      setImgError('클립보드 복사에 실패했어요.');
    }
  }

  async function copyAllImgScenes() {
    if (imgScenes.length === 0) return;
    const text = imgScenes.map((s, i) => `[${i + 1}. ${s.title}]\n${s.prompt}`).join('\n\n');
    const ok = await safeCopy(text);
    if (ok) {
      setImgCopiedIdx(-1);
      setTimeout(() => setImgCopiedIdx(prev => (prev === -1 ? null : prev)), 1500);
    } else {
      setImgError('클립보드 복사에 실패했어요.');
    }
  }

  function setConcatFileAt(idx: number, file: File | null) {
    setConcatFiles(prev => prev.map((f, i) => (i === idx ? file : f)));
    setConcatError(null);
  }

  async function fetchIntroInfo() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-intro`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setIntroInfo(data);
    } catch { /* 조용히 무시 */ }
  }

  async function uploadIntro(file: File) {
    if (introLoading) return;
    setIntroError(null);
    setIntroLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-intro`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIntroError(data.detail ?? '인트로 업로드에 실패했어요.');
        return;
      }
      setIntroInfo(data);
    } catch (e: any) {
      setIntroError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setIntroLoading(false);
    }
  }

  async function deleteIntro() {
    if (introLoading) return;
    if (!confirm('설정된 인트로 영상을 삭제할까요?')) return;
    setIntroError(null);
    setIntroLoading(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-intro`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setIntroError(data.detail ?? '인트로 삭제에 실패했어요.');
        return;
      }
      setIntroInfo({ has_intro: false });
    } catch (e: any) {
      setIntroError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setIntroLoading(false);
    }
  }

  async function fetchOutroInfo() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-outro`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setOutroInfo(data);
    } catch { /* 조용히 무시 */ }
  }

  async function fetchCtaSettings() {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-concat/cta-settings`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCtaEnabled(!!data.cta_enabled);
      setCtaText(data.cta_text || '구독하고 더 보기 ▶');
    } catch { /* 조용히 무시 */ }
  }

  async function saveCtaSettings(enabled: boolean, text: string) {
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-concat/cta-settings`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cta_enabled: enabled, cta_text: text }),
      });
      if (res.ok) {
        setCtaSaved(true);
        setTimeout(() => setCtaSaved(false), 2000);
      }
    } catch { /* 조용히 무시 */ }
  }

  async function uploadOutro(file: File) {
    if (outroLoading) return;
    setOutroError(null);
    setOutroLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-outro`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOutroError(data.detail ?? '아웃트로 업로드에 실패했어요.');
        return;
      }
      setOutroInfo(data);
    } catch (e: any) {
      setOutroError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setOutroLoading(false);
    }
  }

  async function deleteOutro() {
    if (outroLoading) return;
    if (!confirm('설정된 아웃트로 영상을 삭제할까요?')) return;
    setOutroError(null);
    setOutroLoading(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/shorts-outro`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setOutroError(data.detail ?? '아웃트로 삭제에 실패했어요.');
        return;
      }
      setOutroInfo({ has_outro: false });
    } catch (e: any) {
      setOutroError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setOutroLoading(false);
    }
  }

  async function submitConcat() {
    const picked = concatFiles.filter((f): f is File => !!f);
    if (picked.length < 2) {
      setConcatError('최소 2개 이상의 영상을 선택해주세요.');
      return;
    }
    setConcatLoading(true);
    setConcatError(null);
    setConcatStatus('업로드 중...');
    setConcatResultUrl(null);
    setConcatFinalUploadId(null);
    setConcatCtaApplied(false);

    const totalMB = (picked.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);

    try {
      // 업로드 — XMLHttpRequest로 실제 진행률 + 정확한 에러 포착
      const job_id: string = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/${project.id}/ops/shorts-concat`, true);
        const headers = getAuthHeaders();
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.timeout = 60 * 60 * 1000;  // 1시간
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = ((e.loaded / e.total) * 100).toFixed(0);
            const loadedMB = (e.loaded / 1024 / 1024).toFixed(1);
            setConcatStatus(`업로드 중... ${pct}% (${loadedMB}/${totalMB} MB)`);
          }
        };
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            let detail = `업로드 실패 (HTTP ${xhr.status})`;
            try { const j = JSON.parse(xhr.responseText); detail = j.detail ?? detail; } catch { /* noop */ }
            reject(new Error(detail)); return;
          }
          try {
            const j = JSON.parse(xhr.responseText);
            if (!j.job_id) { reject(new Error('job_id를 받지 못했어요.')); return; }
            resolve(j.job_id);
          } catch (e: any) { reject(new Error('서버 응답 파싱 실패: ' + (e?.message ?? 'unknown'))); }
        };
        xhr.onerror = () => reject(new Error('업로드 중 네트워크 오류가 발생했어요. (XHR onerror)'));
        xhr.ontimeout = () => reject(new Error('업로드 시간이 초과됐어요 (1시간).'));
        xhr.onabort  = () => reject(new Error('업로드가 중단됐어요.'));
        const form = new FormData();
        picked.forEach(f => form.append('files', f));
        form.append('prepend_intro', (prependIntro && introInfo.has_intro) ? 'true' : 'false');
        form.append('append_outro', (appendOutro && outroInfo.has_outro) ? 'true' : 'false');
        form.append('cta_text', (ctaEnabled && ctaText.trim()) ? ctaText.trim() : '');
        xhr.send(form);
      });

      // 2단계: 2초마다 상태 폴링 (최대 30분)
      setConcatStatus('ffmpeg 재인코딩 대기 중...');
      const started = Date.now();
      let filename = '';
      let downloadToken = '';
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        if (Date.now() - started > 30 * 60_000) {
          setConcatError('처리 시간이 너무 오래 걸려 중단됐어요 (30분 초과).');
          return;
        }
        const s = await fetch(
          `${BASE}/${project.id}/ops/shorts-concat/status/${job_id}`,
          { headers: getAuthHeaders() },
        ).catch(() => null);
        if (!s || !s.ok) continue;
        const j = await s.json();
        const elapsed = Math.floor((Date.now() - started) / 1000);
        if (j.status === 'queued')     setConcatStatus(`대기 중... (${elapsed}s)`);
        if (j.status === 'processing') setConcatStatus(`ffmpeg 처리 중... (${elapsed}s)`);
        if (j.status === 'error') {
          setConcatError(j.error ?? '처리 중 오류가 발생했어요.');
          return;
        }
        if (j.status === 'done') {
          filename = j.filename;
          downloadToken = j.download_token ?? '';
          if (typeof j.final_upload_id === 'number') setConcatFinalUploadId(j.final_upload_id);
          if (j.cta_applied) setConcatCtaApplied(true);
          break;
        }
      }

      // 토큰 기반 공개 URL — 브라우저가 직접 스트리밍 (Bearer 헤더 불필요, blob 캐싱 없음)
      if (!downloadToken) {
        setConcatError('다운로드 토큰을 받지 못했어요.');
        return;
      }
      const publicUrl = `/api/personal-projects/shorts-concat/dl?token=${encodeURIComponent(downloadToken)}`;
      setConcatResultUrl(publicUrl);
      setConcatResultName(filename);
      setConcatStatus('');
    } catch (e: any) {
      setConcatError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setConcatLoading(false);
    }
  }

  function resetConcat() {
    setConcatResultUrl(null);
    setConcatFiles([null, null, null, null, null]);
    setConcatError(null);
  }

  function resetSeo() {
    setSeoSrcId(null);
    setSeoTopic('');
    setSeoTitle('');
    setSeoDescription('');
    setSeoHashtags([]);
    setSeoError(null);
  }

  // ── 알면 편함 핸들러 ──────────────────────────────────────────────────────

  async function almyeonGenerateSeo() {
    const topic = almyeonSeoTopic.trim();
    if (!topic || almyeonSeoLoading) return;
    setAlmyeonSeoLoading(true);
    setAlmyeonSeoError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/almyeon-seo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonSeoError(data.detail ?? 'SEO 생성 실패'); return; }
      setAlmyeonSeoTitle(data.title ?? '');
      setAlmyeonSeoDesc(data.description ?? '');
      setAlmyeonSeoTags(Array.isArray(data.tags) ? data.tags : []);
    } catch (e: any) {
      setAlmyeonSeoError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonSeoLoading(false);
    }
  }

  async function almyeonCopy(key: string, text: string) {
    const ok = await safeCopy(text);
    if (ok) {
      setAlmyeonSeoCopied(key);
      setTimeout(() => setAlmyeonSeoCopied(prev => (prev === key ? null : prev)), 1500);
    }
  }

  async function almyeonGenerateVideoPrompt() {
    const topic = almyeonVidTopic.trim();
    if (!topic || almyeonVidLoading) return;
    setAlmyeonVidLoading(true);
    setAlmyeonVidError(null);
    setAlmyeonVidResult(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/almyeon-video-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonVidError(data.detail ?? '프롬프트 생성 실패'); return; }
      setAlmyeonVidResult(data);
    } catch (e: any) {
      setAlmyeonVidError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonVidLoading(false);
    }
  }

  async function almyeonVidCopy(key: string, text: string) {
    const ok = await safeCopy(text);
    if (ok) {
      setAlmyeonVidCopied(key);
      setTimeout(() => setAlmyeonVidCopied(prev => (prev === key ? null : prev)), 1500);
    }
  }

  async function almyeon3Generate() {
    const tips = almyeon3Tips.map(t => t.trim());
    if (tips.some(t => !t) || almyeon3Loading) return;
    setAlmyeon3Loading(true);
    setAlmyeon3Error(null);
    setAlmyeon3Result(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/almyeon-3tips-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ tips }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeon3Error(data.detail ?? '프롬프트 생성 실패'); return; }
      setAlmyeon3Result(data);
    } catch (e: any) {
      setAlmyeon3Error(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeon3Loading(false);
    }
  }

  async function almyeon3Copy(key: string, text: string) {
    const ok = await safeCopy(text);
    if (ok) {
      setAlmyeon3Copied(key);
      setTimeout(() => setAlmyeon3Copied(prev => (prev === key ? null : prev)), 1500);
    }
  }

  function almyeonSetFileAt(idx: number, file: File | null) {
    setAlmyeonFiles(prev => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
    setAlmyeonError(null);
  }

  function almyeonAddSlot() {
    if (almyeonFiles.length >= 20) return;
    setAlmyeonFiles(prev => [...prev, null]);
  }

  function almyeonRemoveSlot(idx: number) {
    setAlmyeonFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function almyeonSubmitConcat() {
    const valid = almyeonFiles.filter(Boolean) as File[];
    if (valid.length < 2) { setAlmyeonError('최소 2개 이상의 영상을 선택해주세요.'); return; }
    setAlmyeonLoading(true);
    setAlmyeonError(null);
    setAlmyeonStatus('업로드 준비 중...');
    setAlmyeonResultUrl(null);
    try {
      // 세션 생성
      const initRes = await fetch(`${BASE}/${project.id}/ops/almyeon-concat/init`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      const initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(initData.detail ?? '세션 생성 실패');
      const uploadId: string = initData.upload_id;

      // 파일 순차 업로드
      let slotIdx = 0;
      for (let i = 0; i < almyeonFiles.length; i++) {
        const f = almyeonFiles[i];
        if (!f) continue;
        setAlmyeonStatus(`업로드 중... (${slotIdx + 1}/${valid.length})`);
        const form = new FormData();
        form.append('file', f);
        const upRes = await fetch(
          `${BASE}/${project.id}/ops/almyeon-concat/upload/${uploadId}?index=${slotIdx}`,
          { method: 'POST', headers: getAuthHeaders(), body: form }
        );
        if (!upRes.ok) {
          const err = await upRes.json().catch(() => ({}));
          throw new Error(err.detail ?? `파일 ${slotIdx + 1} 업로드 실패`);
        }
        slotIdx++;
      }

      // 합치기 실행
      setAlmyeonStatus('ffmpeg 처리 중...');
      const runRes = await fetch(`${BASE}/${project.id}/ops/almyeon-concat/run/${uploadId}`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      const runData = await runRes.json().catch(() => ({}));
      if (!runRes.ok) throw new Error(runData.detail ?? '합치기 실행 실패');
      const jobId: string = runData.job_id;

      // 폴링
      const deadline = Date.now() + 30 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const stRes = await fetch(`${BASE}/${project.id}/ops/almyeon-concat/status/${jobId}`, {
          headers: getAuthHeaders(),
        });
        const j = await stRes.json().catch(() => ({}));
        if (j.status === 'queued')     setAlmyeonStatus('대기 중...');
        if (j.status === 'processing') setAlmyeonStatus('ffmpeg 처리 중...');
        if (j.status === 'error') { setAlmyeonError(j.error ?? '처리 중 오류가 발생했어요.'); return; }
        if (j.status === 'done') {
          const dlToken: string | undefined = j.dl_token;
          const filename: string = j.filename ?? 'result.mp4';
          const publicUrl = dlToken
            ? `/api/personal-projects/almyeon-concat/dl?token=${encodeURIComponent(dlToken)}`
            : `${BASE}/${project.id}/ops/almyeon-concat/files/${filename}`;
          setAlmyeonResultUrl(publicUrl);
          setAlmyeonResultName(filename);
          setAlmyeonStatus('');
          return;
        }
      }
      setAlmyeonError('처리 시간이 너무 오래 걸려 중단됐어요.');
    } catch (e: any) {
      setAlmyeonError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setAlmyeonLoading(false);
    }
  }

  function almyeonResetConcat() {
    setAlmyeonResultUrl(null);
    setAlmyeonFiles([null, null, null]);
    setAlmyeonError(null);
    setAlmyeonStatus('');
  }

  // ── 알면 편함 — 트렌딩 상품 탐색 핸들러 ──────────────────────
  async function almyeonFetchTrending() {
    if (almyeonTrendLoading) return;
    setAlmyeonTrendLoading(true);
    setAlmyeonTrendError(null);
    setAlmyeonTrendItems([]);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/almyeon-trending-products`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonTrendError(data.detail ?? '트렌드 탐색 실패'); return; }
      setAlmyeonTrendItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setAlmyeonTrendError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonTrendLoading(false);
    }
  }

  function almyeonTrendSelectItem(item: AlmyeonTrendItem) {
    setAlmyeonScriptProduct(item.name);
    setAlmyeonScriptPrice(item.price_range ?? '');
    setAlmyeonScriptVideoType(item.video_type as 'gadget' | 'lifehack' | 'comparison');
    setAlmyeonScriptHookStyle(item.hook_style as 'warning' | 'reversal' | 'trust' | 'fact' | 'shock');
    setAlmyeonTrendOpen(false);
  }

  // ── 알면 편함 — Grok 클립 핸들러 ──────────────────────────
  async function almyeonGenerateGrokClips() {
    if (!almyeonScriptResult || almyeonGrokLoading) return;
    setAlmyeonGrokLoading(true);
    setAlmyeonGrokError(null);
    setAlmyeonGrokClips([]);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/generate-grok-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          script: almyeonScriptResult,
          video_length: almyeonDescVideoLength,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonGrokError(data.detail ?? '클립 생성 실패'); return; }
      setAlmyeonGrokClips(Array.isArray(data.clips) ? data.clips : []);
    } catch (e: any) {
      setAlmyeonGrokError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonGrokLoading(false);
    }
  }

  async function almyeonGrokCopy(clipNo: number, text: string) {
    const ok = await safeCopy(text);
    if (ok) {
      setAlmyeonGrokCopied(clipNo);
      setTimeout(() => setAlmyeonGrokCopied(prev => (prev === clipNo ? null : prev)), 1500);
    }
  }

  // ── 알면 편함 — 베스트셀러 크롤러 핸들러 ──────────────────────
  async function almyeonFetchBestSellers() {
    const cat = almyeonBsCategory.trim();
    if (!cat || almyeonBsLoading) return;
    setAlmyeonBsLoading(true);
    setAlmyeonBsError(null);
    setAlmyeonBsItems([]);
    try {
      const res = await fetch(
        `${BASE}/${project.id}/ops/coupang-best-sellers?category_id=${encodeURIComponent(cat)}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonBsError(data.detail ?? '크롤링 실패'); return; }
      setAlmyeonBsItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setAlmyeonBsError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonBsLoading(false);
    }
  }

  function almyeonBsSelectItem(item: { name: string; price: number | null }) {
    setAlmyeonScriptProduct(item.name);
    setAlmyeonScriptPrice(item.price ? `${item.price.toLocaleString()}원` : '');
  }

  // ── 알면 편함 — AI 스크립트 생성 핸들러 ──────────────────────
  async function almyeonGenerateScript() {
    const product = almyeonScriptProduct.trim();
    if (!product || almyeonScriptLoading) return;
    setAlmyeonScriptLoading(true);
    setAlmyeonScriptError(null);
    setAlmyeonScriptResult(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          product_name: product,
          price: almyeonScriptPrice,
          video_type: almyeonScriptVideoType,
          hook_style: almyeonScriptHookStyle,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonScriptError(data.detail ?? '스크립트 생성 실패'); return; }
      setAlmyeonScriptResult(data);
    } catch (e: any) {
      setAlmyeonScriptError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonScriptLoading(false);
    }
  }

  async function almyeonScriptCopy(key: string, text: string) {
    const ok = await safeCopy(text);
    if (ok) {
      setAlmyeonScriptCopied(key);
      setTimeout(() => setAlmyeonScriptCopied(prev => (prev === key ? null : prev)), 1500);
    }
  }

  // ── 알면 편함 — 설명란 생성 핸들러 ──────────────────────────
  async function almyeonBuildDescription() {
    if (!almyeonScriptResult || almyeonDescLoading) return;
    const url = almyeonDescCoupangUrl.trim();
    if (!url) { setAlmyeonDescError('쿠팡파트너스 URL을 입력해주세요.'); return; }
    setAlmyeonDescLoading(true);
    setAlmyeonDescError(null);
    setAlmyeonDescResult('');
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/build-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          script: almyeonScriptResult,
          coupang_url: url,
          video_length: almyeonDescVideoLength,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAlmyeonDescError(data.detail ?? '설명란 생성 실패'); return; }
      setAlmyeonDescResult(data.description ?? '');
    } catch (e: any) {
      setAlmyeonDescError(e?.message ?? '네트워크 오류');
    } finally {
      setAlmyeonDescLoading(false);
    }
  }

  async function almyeonDescCopy() {
    const ok = await safeCopy(almyeonDescResult);
    if (ok) {
      setAlmyeonDescCopied(true);
      setTimeout(() => setAlmyeonDescCopied(false), 1500);
    }
  }

  function buildSeoTopicFromGroup(h: ShortsHistory): string {
    const devices = (h.items ?? []).map(it => it.device).filter(Boolean);
    const uniq: string[] = [];
    for (const d of devices) { if (!uniq.includes(d)) uniq.push(d); }
    const list = uniq.length ? uniq : [h.input_device];
    return `compilation of ${list.join(', ')} ranting at humans`;
  }

  async function generateYoutubeSeo() {
    if (seoLoading) return;
    const src = shortsHistory.find(h => h.id === seoSrcId);
    if (!src) {
      setSeoError('대본 그룹을 먼저 선택해주세요.');
      return;
    }
    const topic = buildSeoTopicFromGroup(src);
    setSeoTopic(topic);
    if (!topic) return;
    setSeoLoading(true);
    setSeoError(null);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/youtube-seo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSeoError(data.detail ?? 'SEO 메타 생성 실패');
        return;
      }
      setSeoTitle(data.title ?? '');
      setSeoDescription(data.description ?? '');
      setSeoHashtags(Array.isArray(data.hashtags) ? data.hashtags : []);
    } catch (e: any) {
      setSeoError(e?.message ?? '네트워크 오류가 발생했어요.');
    } finally {
      setSeoLoading(false);
    }
  }

  // SEO 결과를 최신 완성본(등록 탭)에 자동 적용
  const [seoApplyState, setSeoApplyState] = useState<'idle' | 'applying' | 'done'>('idle');
  async function applySeoToLatestUpload() {
    if (!seoTitle) return;
    setSeoApplyState('applying');
    try {
      const listRes = await fetch(`${BASE}/${project.id}/ops/shorts-uploads?limit=1`, { headers: getAuthHeaders() });
      if (!listRes.ok) throw new Error('완성본 목록 조회 실패');
      const listData = await listRes.json();
      const latest = (listData.uploads ?? [])[0];
      if (!latest) {
        alert('적용할 완성본이 없습니다. 먼저 이어붙이기를 실행하세요.');
        setSeoApplyState('idle');
        return;
      }
      const tagsFromHashtags = seoHashtags.map(t => t.replace(/^#+/, '').trim()).filter(Boolean);
      const patchRes = await fetch(`${BASE}/${project.id}/ops/shorts-uploads/${latest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          title: seoTitle,
          content: seoDescription,
          tags: tagsFromHashtags,
        }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(err.detail || '적용 실패');
      }
      setSeoApplyState('done');
      setTimeout(() => setSeoApplyState('idle'), 2500);
    } catch (e: any) {
      alert(e?.message || '적용 실패');
      setSeoApplyState('idle');
    }
  }

  async function copySeoField(key: 'title' | 'desc' | 'tags' | 'all', text: string) {
    const ok = await safeCopy(text);
    if (ok) {
      setSeoCopied(key);
      setTimeout(() => setSeoCopied(prev => (prev === key ? null : prev)), 1500);
    } else {
      setSeoError('클립보드 복사에 실패했어요.');
    }
  }

  async function copyShortsItem(idx: number) {
    const item = shortsItems[idx];
    if (!item) return;
    const ok = await safeCopy(buildVideoPrompt('', item.script));
    if (ok) {
      setShortsCopiedIdx(idx);
      setTimeout(() => setShortsCopiedIdx(prev => (prev === idx ? null : prev)), 1500);
    } else {
      setShortsError('클립보드 복사에 실패했어요.');
    }
  }

  async function copyAllShorts() {
    if (shortsItems.length === 0) return;
    const text = shortsItems.map(it => `[${it.device}]\n${buildVideoPrompt('', it.script)}`).join('\n\n---\n\n');
    const ok = await safeCopy(text);
    if (ok) {
      setShortsCopiedIdx(-1);
      setTimeout(() => setShortsCopiedIdx(prev => (prev === -1 ? null : prev)), 1500);
    } else {
      setShortsError('클립보드 복사에 실패했어요.');
    }
  }

  async function updateRequestStatus(reqId: string, newStatus: DesignRequest['status']) {
    setUpdatingReqId(reqId);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/design-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setDesignRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: newStatus } : r));
      }
    } finally { setUpdatingReqId(null); }
  }

  async function fetchAllDesigns() {
    setAllLoading(true);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/designs?limit=50`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllDesigns(data.designs ?? []);
        setAllTotal(data.total ?? data.designs?.length ?? 0);
      }
    } finally { setAllLoading(false); }
  }

  async function deleteDesign(id: string) {
    if (!confirm('이 디자인을 삭제할까요?\n사이트에서도 즉시 제거됩니다.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/designs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok || res.status === 204) {
        setAllDesigns(prev => prev.filter(d => d.id !== id));
        setAllTotal(t => Math.max(0, t - 1));
      } else {
        alert('삭제 실패');
      }
    } finally { setDeletingId(null); }
  }

  // 초기 로드
  useEffect(() => {
    fetchHealth();
    fetchGit();
    fetchAllDesigns();
    fetchDesignRequests();
    fetchTrendStatus();
    if (isBlogProject) fetchBlogGuides();
    if (isShortsProject) { fetchShortsHistory(); fetchImgHistory(); fetchIntroInfo(); fetchOutroInfo(); fetchCtaSettings(); fetchShortsPresets(); fetchImgStylePresets(); fetchYtAuth(); fetchTopicUsed(); fetchLearnedPatterns(); fetchCompetitors(); fetchEarlyPerf(); }
    if (isLongformProject) { fetchLongformHistory(); }
    if (isXArticleProject) { fetchXArticleHistory(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // 자동 갱신 (30초)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && links.length) {
      intervalRef.current = setInterval(fetchHealth, 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, project.id, links.length]);

  const ctaInitializedRef = useRef(false);
  useEffect(() => {
    if (!isShortsProject) return;
    if (!ctaInitializedRef.current) { ctaInitializedRef.current = true; return; }
    const timer = setTimeout(() => { saveCtaSettings(ctaEnabled, ctaText); }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaEnabled, ctaText]);

  async function queueAction(actionId: string) {
    setQueueing(actionId);
    try {
      await designQueueApi.enqueue(project.id, actionId, { use_trends: useTrends });
      const trendNote = useTrends ? ' (트렌드 적용)' : ' (트렌드 OFF)';
      setOutputTitle('큐 등록 완료');
      setOutput(`[${actionId}]${trendNote} 잡이 백그라운드 큐에 등록됐습니다.\n화면 오른쪽 아래 "디자인 큐" 버튼에서 진행 상황을 확인하세요.`);
      // 완료 후 목록 갱신을 위해 30초 뒤 한 번 더 fetch (큐 완료 알림 대신)
      setTimeout(() => { fetchAllDesigns(); fetchDesignRequests(); }, 30000);
    } catch (e: any) {
      setOutputTitle('큐 등록 실패');
      setOutput(e.message ?? '큐 등록 실패');
    } finally {
      setQueueing(null);
    }
  }

  async function runAction(actionId: string, params: Record<string, string> = {}) {
    if (!localPath) { alert('로컬 경로가 설정되지 않았습니다.\n프로젝트 수정에서 로컬 경로를 입력해주세요.'); return; }
    const meta = OPS_ACTIONS.find(a => a.id === actionId);
    const label = actionId === 'git_commit' ? `git commit -m "${params.commit_message}"`
                : actionId === 'git_push'   ? `git push${params.branch ? ' origin ' + params.branch : ''}`
                : actionId === 'git_add_all' ? 'git add -A'
                : meta?.label ?? actionId;
    setRunning(actionId);
    setOutputTitle(`$ ${label}`);
    setOutput('실행 중...');
    try {
      const res = await fetch(`${BASE}/${project.id}/ops/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: actionId, params }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { setOutput(`서버 오류 (${res.status}):\n${text}`); return; }
      if (!res.ok) { setOutput(`오류 (${res.status}): ${(data.detail as string) ?? JSON.stringify(data)}`); return; }
      setOutput((data.output as string) || (data.success ? '(출력 없음 — 성공)' : '(출력 없음 — 실패)'));
      // git 관련 액션 후 git 상태 자동 갱신
      if (actionId.startsWith('git_')) setTimeout(fetchGit, 800);
      // 디자인 생성 후 목록 갱신
      if (actionId.startsWith('gen_design') && data.success) {
        setTimeout(fetchAllDesigns, 1000);
      }
    } catch (e) {
      setOutput(`네트워크 오류: ${e}`);
    } finally {
      setRunning(null);
    }
  }

  // 헬스 요약
  const allUp   = health.length > 0 && health.every(h => h.ok);
  const anyDown = health.some(h => !h.ok);

  // git ahead/behind 파싱
  let ahead = 0; let behind = 0;
  if (git?.ahead_behind) {
    const parts = git.ahead_behind.split(/\s+/);
    ahead  = parseInt(parts[0] ?? '0') || 0;
    behind = parseInt(parts[1] ?? '0') || 0;
  }
  const dirtyFiles = git?.dirty ? git.dirty.trim().split('\n').filter(Boolean) : [];

  // catGroups는 OpsTab 상단에서 visibleCatGroups로 이미 계산됨

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* 왼쪽: 상태 + 액션 패널 */}
      <div className="flex flex-col w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">

        {/* 서비스 상태 */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-semibold text-gray-300">서비스 상태</span>
              {health.length > 0 && (
                <span className={clsx('text-[9px] font-medium px-1.5 py-0.5 rounded-full', allUp ? 'bg-emerald-500/10 text-emerald-400' : anyDown ? 'bg-red-500/10 text-red-400' : '')}>
                  {allUp ? '정상' : `${health.filter(h=>!h.ok).length}개 장애`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {lastCheck && <span className="text-[9px] text-gray-600">{format(lastCheck, 'HH:mm:ss')}</span>}
              <button onClick={fetchHealth} disabled={healthLoad} title="새로고침" className="text-gray-600 hover:text-gray-300 transition-colors">
                <RefreshCw className={clsx('w-3 h-3', healthLoad && 'animate-spin')} />
              </button>
              <button onClick={() => setAutoRefresh(v => !v)} title={autoRefresh ? '자동갱신 끄기' : '자동갱신 켜기'}
                className={clsx('text-[9px] px-1.5 py-0.5 rounded border transition-colors',
                  autoRefresh ? 'border-brand/50 text-brand bg-brand/10' : 'border-gray-700 text-gray-600 hover:text-gray-400')}>
                {autoRefresh ? '30s 자동' : '수동'}
              </button>
            </div>
          </div>
          {links.length === 0 ? (
            <p className="text-[10px] text-gray-600">프로젝트 수정에서 서비스 URL을 추가하세요</p>
          ) : health.length === 0 && !healthLoad ? (
            <button onClick={fetchHealth} className="w-full text-[10px] text-brand hover:text-brand/80 border border-dashed border-brand/30 rounded-lg py-2">
              상태 확인하기
            </button>
          ) : (
            <div className="space-y-1.5">
              {health.map(h => (
                <div key={h.url} className={clsx('flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs',
                  h.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5')}>
                  {h.ok
                    ? <Wifi className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    : <WifiOff className="w-3 h-3 text-red-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-medium truncate', h.ok ? 'text-gray-300' : 'text-red-300')}>{h.label}</p>
                    {h.error
                      ? <p className="text-[9px] text-red-500 truncate">{h.error}</p>
                      : <p className="text-[9px] text-gray-600">{h.status} · {h.latency_ms}ms</p>}
                  </div>
                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-brand flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Git 상태 */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-gray-300">Git 상태</span>
              {git?.available && git.branch && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 font-mono">{git.branch}</span>
              )}
            </div>
            {localPath && (
              <button onClick={fetchGit} disabled={gitLoad} className="text-gray-600 hover:text-gray-300">
                <RefreshCw className={clsx('w-3 h-3', gitLoad && 'animate-spin')} />
              </button>
            )}
          </div>
          {!localPath ? (
            <p className="text-[10px] text-gray-600">로컬 경로 미설정</p>
          ) : !git ? (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600"><Loader2 className="w-3 h-3 animate-spin" />확인 중...</div>
          ) : !git.available ? (
            <p className="text-[10px] text-red-400">{git.reason}</p>
          ) : (
            <div className="space-y-2">
              {/* ahead/behind */}
              {git.ahead_behind && (ahead > 0 || behind > 0) && (
                <div className="flex items-center gap-2 text-[10px]">
                  {ahead > 0 && <span className="text-brand">↑ {ahead} ahead</span>}
                  {behind > 0 && <span className="text-yellow-400">↓ {behind} behind — Git Pull 권장</span>}
                </div>
              )}
              {/* 변경 파일 */}
              {dirtyFiles.length > 0 ? (
                <div>
                  <p className="text-[9px] text-yellow-400 mb-1">{dirtyFiles.length}개 변경됨</p>
                  <div className="space-y-0.5 max-h-20 overflow-y-auto">
                    {dirtyFiles.slice(0, 8).map((f, i) => (
                      <p key={i} className="text-[9px] font-mono text-gray-500 truncate">{f}</p>
                    ))}
                    {dirtyFiles.length > 8 && <p className="text-[9px] text-gray-700">+{dirtyFiles.length-8}개 더...</p>}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-emerald-400">워킹트리 깨끗함</p>
              )}
              {/* 최근 커밋 */}
              {git.log && (
                <div className="space-y-0.5">
                  {git.log.split('\n').slice(0, 5).map((line, i) => (
                    <p key={i} className="text-[9px] font-mono text-gray-600 truncate">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 빠른 액션 */}
        <div className="p-4 flex-1">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-semibold text-gray-300">빠른 실행</span>
            {!localPath && <span className="text-[9px] text-gray-600">(로컬 경로 필요)</span>}
          </div>

          {/* 블로그 파이프라인 — ThiveLab 전용 */}
          {isBlogProject && (
            <div className="mb-3">
              <BlogPipelinePanel project={project} />
            </div>
          )}

          {/* 고품질 생성 (백그라운드 큐) — 디자인 프로젝트 전용 */}
          {isDesignProject && <div className="mb-3">
            <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              고품질 AI 생성 (백그라운드)
            </p>

            {/* 트렌드 모드 패널 */}
            <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              {/* 헤더: 토글 + 상태 */}
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-[10px] text-emerald-300 font-medium flex-1">트렌드 모드</span>

                {/* 캐시 상태 */}
                {trendStatus && (
                  <span className={clsx(
                    'text-[9px] px-1.5 py-0.5 rounded-full',
                    trendStatus.stale || !trendStatus.cached
                      ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-emerald-500/15 text-emerald-400',
                  )}>
                    {trendStatus.refreshing
                      ? '갱신 중...'
                      : trendStatus.cached
                        ? `${trendStatus.age_hours}h 전`
                        : '미수집'}
                  </span>
                )}

                {/* 갱신 버튼 */}
                <button
                  onClick={triggerTrendRefresh}
                  disabled={trendLoading || trendStatus?.refreshing}
                  title="트렌드 캐시 강제 갱신"
                  className="text-gray-600 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className={clsx('w-3 h-3', (trendLoading || trendStatus?.refreshing) && 'animate-spin')} />
                </button>

                {/* 토글 ON/OFF */}
                <button
                  onClick={() => setUseTrends(v => !v)}
                  className={clsx(
                    'relative w-7 h-4 rounded-full transition-colors flex-shrink-0',
                    useTrends ? 'bg-emerald-500' : 'bg-gray-700',
                  )}
                >
                  <span className={clsx(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
                    useTrends ? 'translate-x-3.5' : 'translate-x-0.5',
                  )} />
                </button>

                {/* 트렌드 내용 펼치기 */}
                {trendStatus?.cached && trendStatus.trends && (
                  <button
                    onClick={() => setTrendExpanded(v => !v)}
                    className="text-gray-600 hover:text-gray-300"
                  >
                    <ChevronRight className={clsx('w-3 h-3 transition-transform', trendExpanded && 'rotate-90')} />
                  </button>
                )}
              </div>

              {/* 트렌드 내용 (펼쳐진 상태) */}
              {trendExpanded && trendStatus?.trends && (
                <div className="px-2.5 pb-2 space-y-1 border-t border-emerald-500/10">
                  {trendStatus.trends.trending_styles && (
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-wider mt-1.5 mb-0.5">인기 스타일</p>
                      <div className="flex flex-wrap gap-1">
                        {trendStatus.trends.trending_styles.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded">
                            {s.length > 30 ? s.slice(0, 30) + '…' : s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {trendStatus.trends.trending_layouts && (
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-wider mt-1 mb-0.5">레이아웃 트렌드</p>
                      <div className="flex flex-wrap gap-1">
                        {trendStatus.trends.trending_layouts.slice(0, 3).map((l, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded">
                            {l.length > 30 ? l.slice(0, 30) + '…' : l}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {trendStatus.trends.avoid_cliche && (
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-wider mt-1 mb-0.5">피해야 할 클리셰</p>
                      <div className="flex flex-wrap gap-1">
                        {trendStatus.trends.avoid_cliche.slice(0, 2).map((a, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                            {a.length > 35 ? a.slice(0, 35) + '…' : a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {trendStatus.trends.design_direction && (
                    <p className="text-[9px] text-gray-500 italic leading-relaxed mt-1">
                      "{trendStatus.trends.design_direction.slice(0, 120)}{trendStatus.trends.design_direction.length > 120 ? '…' : ''}"
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              {DESIGN_QUEUE_ACTIONS.map(action => {
                const isQueuing = queueing === action.id;
                const isDisabled = !localPath || queueing !== null;
                const isAmber = action.variant === 'amber';
                return (
                  <button key={action.id}
                    disabled={isDisabled}
                    onClick={() => queueAction(action.id)}
                    title={action.desc + (useTrends ? ' · 트렌드 적용' : ' · 트렌드 OFF')}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                      isQueuing
                        ? isAmber
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        : isDisabled
                          ? 'text-gray-700 cursor-not-allowed'
                          : isAmber
                            ? 'text-amber-300 hover:text-amber-100 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40'
                            : 'text-indigo-300 hover:text-indigo-100 hover:bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40'
                    )}>
                    {isQueuing
                      ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                      : <action.Icon className={clsx('w-3 h-3 flex-shrink-0', isAmber ? 'text-amber-400' : 'text-indigo-400')} />}
                    <span className="flex-1">{action.label}</span>
                    {useTrends && !isQueuing && (
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-500/60 flex-shrink-0" />
                    )}
                    <span className={clsx('text-[9px] flex-shrink-0', isAmber ? 'text-amber-500/60' : 'text-indigo-500/60')}>큐</span>
                  </button>
                );
              })}
            </div>
          </div>}

          {/* Git Commit / Push 폼 */}
          <div className="mb-3">
            <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Git Commit / Push</p>
            <div className="space-y-1.5">
              {/* Add All + Commit */}
              <div className="flex gap-1.5">
                <button
                  disabled={!localPath || running !== null}
                  onClick={() => runAction('git_add_all')}
                  title="git add -A"
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all flex-shrink-0',
                    !localPath || running !== null
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent hover:border-gray-800'
                  )}>
                  {running === 'git_add_all'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <GitBranch className="w-3 h-3" />}
                  add -A
                </button>
                <input
                  type="text"
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  placeholder="커밋 메시지..."
                  disabled={!localPath}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && commitMsg.trim() && running === null) {
                      runAction('git_commit', { commit_message: commitMsg.trim() });
                      setCommitMsg('');
                    }
                  }}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-40 min-w-0"
                />
                <button
                  disabled={!localPath || !commitMsg.trim() || running !== null}
                  onClick={() => { runAction('git_commit', { commit_message: commitMsg.trim() }); setCommitMsg(''); }}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                    !localPath || !commitMsg.trim() || running !== null
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/30'
                  )}>
                  {running === 'git_commit'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <GitCommit className="w-3 h-3" />}
                  Commit
                </button>
              </div>

              {/* Push */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={pushBranch}
                  onChange={e => setPushBranch(e.target.value)}
                  placeholder="브랜치 (비우면 현재)"
                  disabled={!localPath}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && running === null)
                      runAction('git_push', { branch: pushBranch.trim() });
                  }}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-40 min-w-0"
                />
                <button
                  disabled={!localPath || running !== null}
                  onClick={() => runAction('git_push', { branch: pushBranch.trim() })}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                    !localPath || running !== null
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30'
                  )}>
                  {running === 'git_push'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <GitPullRequest className="w-3 h-3" />}
                  Push
                </button>
              </div>
            </div>
          </div>

          {visibleCatGroups.map(cat => (
            <div key={cat} className="mb-3">
              <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{ACTION_CATS[cat]}</p>
              <div className="space-y-1">
                {OPS_ACTIONS.filter(a => a.cat === cat).map(action => {
                  const isAI = action.cat === 'ai_design' || action.cat === 'ai_blog';
                  const isRunning = running === action.id;
                  const isDisabled = !localPath || running !== null;
                  return (
                    <button key={action.id}
                      disabled={isDisabled}
                      onClick={() => runAction(action.id)}
                      title={action.desc}
                      className={clsx(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                        isRunning
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : isDisabled
                            ? 'text-gray-700 cursor-not-allowed'
                            : isAI
                              ? 'text-purple-300 hover:text-purple-100 hover:bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent hover:border-gray-800'
                      )}>
                      {isRunning
                        ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                        : <action.Icon className={clsx('w-3 h-3 flex-shrink-0', isAI && !isDisabled && 'text-purple-400')} />}
                      <span className="flex-1">{action.label}</span>
                      {isAI && !isDisabled && !isRunning && (
                        <span className="text-[9px] text-purple-500/60 flex-shrink-0">AI</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 중앙: 터미널 출력 (일반) 또는 평면도 / 웹툰 생성 패널 */}
      {isFloorplanProject ? (
        <FloorplanGeneratorPanel projectId={project.id} />
      ) : isWebtoonProject ? (
        <WebtoonGeneratorPanel projectId={project.id} />
      ) : isShortsProject ? null : isLongformProject ? null : isAlmyeonProject ? null : isXArticleProject ? null : (
      <div className="flex-1 flex flex-col min-w-0 bg-black/30 border-r border-gray-800 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60 sticky top-0 bg-[#0d0d0d] z-10">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-500 font-mono">{outputTitle || '터미널 출력'}</span>
          </div>
          {output && (
            <button onClick={() => { setOutput(''); setOutputTitle(''); }}
              className="text-[10px] text-gray-700 hover:text-gray-400 transition-colors">지우기</button>
          )}
        </div>
        <div className={clsx('font-mono text-[11px] leading-relaxed', output ? 'p-4' : 'flex-none')}>
          {output ? (
            <pre className={clsx('whitespace-pre-wrap break-all',
              output.startsWith('오류') || output.startsWith('네트워크') ? 'text-red-400' : 'text-gray-300')}>
              {output}
            </pre>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-700">
              <Terminal className="w-8 h-8 opacity-30" />
              <p className="text-xs">왼쪽 패널에서 액션을 선택하면 결과가 여기에 표시됩니다</p>
              {!localPath && (
                <p className="text-[10px] text-yellow-500/60">로컬 경로를 설정해야 명령을 실행할 수 있습니다</p>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 우측: 디자인 관리 패널 — 디자인 프로젝트 전용 */}
      {/* 우측: 가이드 관리 패널 — ThiveLab 전용 */}
      {isBlogProject && <div className="w-80 flex-shrink-0 flex flex-col border-l border-gray-800 bg-surface overflow-hidden">
        <div className="flex-shrink-0 border-b border-gray-800 bg-surface-raised">
          <div className="flex items-center px-3 py-2 gap-2">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-300">게시된 글</span>
            {blogGuidesTotal > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/15 text-amber-400">{blogGuidesTotal}</span>
            )}
            <div className="flex-1" />
            <button onClick={fetchBlogGuides} disabled={blogGuidesLoad}
              className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
              <RefreshCw className={clsx('w-3 h-3', blogGuidesLoad && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {blogGuidesLoad && blogGuides.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[10px] text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" />불러오는 중...
            </div>
          ) : blogGuides.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-700">
              <FileText className="w-6 h-6 opacity-30" />
              <p className="text-[10px]">아직 게시된 글이 없습니다</p>
              <p className="text-[9px] text-gray-600">blog_generator.py를 실행해 주세요</p>
            </div>
          ) : (
            blogGuides.map(g => (
              <div key={g.id}
                className="rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/40 transition-all">
                {/* 썸네일 (있을 때) */}
                {g.product_image && (
                  <div className="aspect-video overflow-hidden bg-gray-900 rounded-t-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.product_image} alt={g.title}
                      className="w-full h-full object-cover object-center" />
                  </div>
                )}
                {/* 글 정보 */}
                <div className="px-2.5 py-2 space-y-1.5">
                  <p className="text-[10px] font-medium text-gray-300 line-clamp-2 leading-snug">{g.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {g.category && <span className="text-[9px] text-amber-400/70">{g.category}</span>}
                    <span className={clsx('text-[9px] px-1 py-0.5 rounded',
                      g.status === 'published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'
                    )}>{g.status}</span>
                    {g.affiliate_url && <span className="text-[9px] text-amber-400/50">제휴✓</span>}
                    {g.view_count > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-gray-500">
                        <Eye className="w-2.5 h-2.5" />{g.view_count.toLocaleString()}
                      </span>
                    )}
                    <span className="text-[9px] text-gray-600 ml-auto">{format(parseISO(g.created_at), 'MM/dd HH:mm')}</span>
                  </div>
                  {/* 링크 + 삭제 — 항상 표시 */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-gray-800/50">
                    <a href={`https://thivelab.com/blog/${g.slug}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-brand/10 hover:bg-brand/20 rounded text-brand text-[9px] font-medium transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" />사이트에서 보기
                    </a>
                    <button onClick={() => openEditBlogGuide(g.id)} disabled={editGuideLoad}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded text-amber-300 text-[9px] font-medium transition-colors disabled:opacity-50 ml-auto">
                      {editGuideLoad && editingGuide?.id === g.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Pencil className="w-2.5 h-2.5" />}
                      수정
                    </button>
                    <button onClick={() => deleteBlogGuide(g.id)} disabled={deletingGuideId === g.id}
                      className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded text-red-400 text-[9px] font-medium transition-colors disabled:opacity-50">
                      {deletingGuideId === g.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>}

      {/* 우측: 유튜브 쇼츠 자동화 패널 */}
      {isShortsProject && <div className="flex-1 min-w-0 flex flex-col border-l border-gray-800 bg-surface overflow-hidden">
        <div className="flex-shrink-0 border-b border-gray-800 bg-surface-raised">
          <div className="flex items-center px-3 pt-2 gap-1">
            <button
              onClick={() => setShortsTab('topic')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'topic'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Lightbulb className="w-3 h-3" />
              주제 추천기
            </button>
            <button
              onClick={() => { setShortsTab('history'); fetchShortsHistory(); fetchImgHistory(); }}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'history'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Clock className="w-3 h-3" />
              히스토리
              {shortsHistory.length > 0 && <span className="text-[9px] text-rose-300/80">({shortsHistory.length})</span>}
            </button>
            {showAdvancedTabs && <button
              onClick={() => setShortsTab('script')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'script'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Sparkles className="w-3 h-3" />
              대사 생성기
            </button>}
            {showAdvancedTabs && <button
              onClick={() => setShortsTab('image')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'image'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <ImageIcon className="w-3 h-3" />
              이미지 프롬프트
            </button>}
            <button
              onClick={() => setShortsTab('concat')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'concat'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Package className="w-3 h-3" />
              영상 이어붙이기
            </button>
            <button
              onClick={() => setShortsTab('seo')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'seo'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <TrendingUp className="w-3 h-3" />
              SEO
            </button>
            <button
              onClick={() => setShortsTab('analytics')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                shortsTab === 'analytics'
                  ? 'border-rose-400 text-rose-300 bg-rose-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <BarChart2 className="w-3 h-3" />
              채널 분석
            </button>
          </div>
        </div>
        {shortsTab === 'topic' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 통합 일괄 생성기 — 톤/훅/스타일 선택 + 5개 주제+대본+이미지 한 번에 */}
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-rose-300" />
              <span className="text-[11px] font-semibold text-rose-200 uppercase tracking-wider">통합 생성기</span>
              <span className="text-[9px] text-gray-500">주제 5개 + 대본 + 이미지 프롬프트</span>
            </div>
            {strategyApplied && strategy && (
              <div className="flex items-center gap-2 rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-1.5">
                <Sparkles className="w-3 h-3 text-fuchsia-300 shrink-0" />
                <p className="text-[10px] text-fuchsia-200 flex-1">채널 전략 반영 중 — 콘텐츠 전략 · 성장 액션이 대본에 자동 주입됩니다</p>
                <button onClick={() => setStrategyApplied(false)} className="text-[9px] text-fuchsia-300/60 hover:text-fuchsia-200 shrink-0">해제</button>
              </div>
            )}

            {/* 톤 선택 */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">톤 (대본)</label>
              <select
                value={shortsTone}
                onChange={e => setShortsTone(e.target.value)}
                disabled={batchLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                {(tonePresets.length ? tonePresets : [{ key: 'grumpy_nag', label: '투덜이 잔소리꾼', desc: '' }]).map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <p className="text-[9px] text-gray-500 leading-snug">{tonePresets.find(p => p.key === shortsTone)?.desc ?? ''}</p>
            </div>

            {/* 훅 선택 */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">훅 (대본 오프너)</label>
              <select
                value={shortsHook}
                onChange={e => setShortsHook(e.target.value)}
                disabled={batchLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                {(hookPresets.length ? hookPresets : [{ key: 'none', label: '자유 시작', desc: '' }]).map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <p className="text-[9px] text-gray-500 leading-snug">{hookPresets.find(p => p.key === shortsHook)?.desc ?? ''}</p>
            </div>

            {/* 대상 비디오 모델 */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">대상 비디오 모델 (통합 프롬프트)</label>
              <select
                value={targetVideoModel}
                onChange={e => setTargetVideoModel(e.target.value as 'grok' | 'veo' | 'sora' | 'kling')}
                disabled={batchLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                <option value="grok">Grok Imagine (xAI) — 시각 우선, 듀레이션 유연</option>
                <option value="veo">Google Veo 3 — 정확한 10초 + 립싱크</option>
                <option value="sora">OpenAI Sora — 연기 지시 강화</option>
                <option value="kling">Kling 2 — 카메라 무빙 포함</option>
              </select>
              <p className="text-[9px] text-gray-500 leading-snug">
                {targetVideoModel === 'grok' && '시각 묘사를 맨 앞에, 립싱크 지시 완화, "around 10s" 유연 듀레이션.'}
                {targetVideoModel === 'veo' && '엄격한 10초 + 입모양 정확 싱크.'}
                {targetVideoModel === 'sora' && '과장된 표정 연기 + 문장 사이 비트.'}
                {targetVideoModel === 'kling' && '얼굴 미세 푸시-인 카메라 무빙 포함.'}
              </p>
            </div>

            {/* 이미지 스타일 */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">이미지 스타일 (5개 공통)</label>
              <select
                value={imgStyle}
                onChange={e => setImgStyle(e.target.value)}
                disabled={batchLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                {(imgStylePresets.length ? imgStylePresets : [{ key: 'pixar_3d', label: '픽사풍 3D', desc: '' }]).map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <p className="text-[9px] text-gray-500 leading-snug">{imgStylePresets.find(p => p.key === imgStyle)?.desc ?? ''}</p>
              {imgStyle === 'custom' && (
                <input
                  type="text"
                  value={imgCustomStyle}
                  onChange={e => setImgCustomStyle(e.target.value)}
                  disabled={batchLoading}
                  placeholder="예: vaporwave low-poly 3D render"
                  maxLength={120}
                  className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
                />
              )}
            </div>

            <button
              onClick={() => generateBatch()}
              disabled={batchLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-rose-500/90 hover:bg-rose-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {batchLoading ? '생성 중... (최대 1-2분)' : '추천 + 대본 + 이미지 프롬프트 일괄 생성'}
            </button>

            <p className="text-[10px] text-gray-400 leading-snug">
              이미 대본이 만들어진 주제는 자동 제외. (사용됨 {topicUsedCount}
              {topicPoolTotal ? ` / 풀 ${topicPoolTotal}` : ''}
              {topicAvailCount > 0 ? ` · 남은 주제 ${topicAvailCount}개` : ''})
            </p>
          </div>

          {/* 풀 고갈 경고 + 확장 패널 */}
          {topicPoolTotal > 0 && topicAvailCount <= 10 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/8 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-[11px] font-semibold text-amber-200">
                  주제 풀이 거의 소진됐어요 (남은 {topicAvailCount}개)
                </span>
              </div>
              <p className="text-[10px] text-amber-300/80 leading-snug">
                트렌드 기반으로 새 기기 주제 15개를 AI가 자동 발굴합니다. 기존 풀·히스토리와 중복은 자동 제외돼요.
              </p>
              <button
                onClick={expandTopicPool}
                disabled={poolExpandLoading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-amber-500/80 hover:bg-amber-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {poolExpandLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {poolExpandLoading ? '트렌드 주제 발굴 중...' : '트렌드 주제 15개 풀에 추가'}
              </button>
              {poolExpandError && (
                <p className="text-[10px] text-red-400">{poolExpandError}</p>
              )}
              {poolExpandResult && (
                <div className="space-y-1">
                  <p className="text-[10px] text-emerald-300 font-semibold">
                    ✓ {poolExpandResult.added_count}개 추가됨 (풀 {topicPoolTotal}개 · 남은 {topicAvailCount}개)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {poolExpandResult.added.map((a, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-200" title={a.reason}>
                        {a.device}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 수동 풀 확장 버튼 (여유 있을 때도 접근 가능) */}
          {topicPoolTotal > 0 && topicAvailCount > 10 && (
            <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-500">
                  남은 주제 {topicAvailCount}개 · 풀 {topicPoolTotal}개
                </span>
                <button
                  onClick={expandTopicPool}
                  disabled={poolExpandLoading}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded border border-gray-700 bg-gray-800/60 text-gray-300 hover:text-white hover:border-gray-600 disabled:opacity-50"
                >
                  {poolExpandLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <TrendingUp className="w-2.5 h-2.5" />}
                  트렌드 주제 추가
                </button>
              </div>
              {poolExpandError && <p className="text-[10px] text-red-400">{poolExpandError}</p>}
              {poolExpandResult && (
                <p className="text-[10px] text-emerald-300">✓ {poolExpandResult.added_count}개 추가됨</p>
              )}
            </div>
          )}

          {batchError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
              {batchError}
            </div>
          )}

          {batchLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2.5 text-[11px] text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              추천 → 대본 → 이미지 프롬프트 순서로 생성 중이에요...
            </div>
          )}

          {!batchLoading && batchItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider">
                  그룹 #{batchGroupId} · {batchItems.length}개
                </span>
              </div>
              {batchItems.map((it, i) => {
                const exp = batchExpanded[i] ?? null;
                return (
                  <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-rose-500/20 bg-rose-500/10">
                      <span className="text-rose-400 text-[10px] font-bold">#{i + 1}</span>
                      <span className="text-[11px] font-semibold text-rose-100 flex-1 truncate">{it.device}</span>
                      {it.category && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-200 text-[9px] uppercase tracking-wider">{it.category}</span>
                      )}
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      {it.reason && <p className="text-[10px] text-gray-400 leading-snug italic">{it.reason}</p>}

                      {/* 🎬 통합 비디오 프롬프트 — Veo/Sora/Kling 에 그대로 붙여넣는 one-shot 프롬프트 */}
                      {it.unified_video_prompt && (
                        <div className="rounded-md border border-violet-500/40 bg-violet-500/10 p-2 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-violet-300" />
                            <span className="text-[10px] font-semibold text-violet-200 uppercase tracking-wider">비디오 통합 프롬프트</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/30 text-violet-100 font-semibold uppercase tracking-wider">
                              {targetVideoModel}
                            </span>
                            <button
                              onClick={() => copyGenItemText(`u-${i}`, it.unified_video_prompt!)}
                              className={clsx(
                                'ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded',
                                batchCopyKey === `u-${i}`
                                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                                  : 'bg-violet-500/80 hover:bg-violet-400 text-white'
                              )}
                            >
                              {batchCopyKey === `u-${i}` ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />전체 복사</>}
                            </button>
                          </div>
                          <button
                            onClick={() => setBatchExpanded(prev => ({ ...prev, [i]: prev[i] === 'unified' ? null : 'unified' }))}
                            className="w-full text-left text-[9px] text-violet-200/70 hover:text-violet-200"
                          >
                            {exp === 'unified' ? '▾ 프롬프트 미리보기 접기' : '▸ 프롬프트 미리보기 펼치기'}
                          </button>
                          {exp === 'unified' && (
                            <pre className="text-[10px] leading-relaxed text-gray-200 whitespace-pre-wrap font-mono bg-gray-950/60 border border-violet-500/20 rounded px-2 py-1.5 max-h-72 overflow-y-auto">{it.unified_video_prompt}</pre>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => setBatchExpanded(prev => ({ ...prev, [i]: prev[i] === 'script' ? null : 'script' }))}
                          className={clsx(
                            'flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold border',
                            exp === 'script'
                              ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                              : 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                          )}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          대본
                        </button>
                        <button
                          onClick={() => setBatchExpanded(prev => ({ ...prev, [i]: prev[i] === 'image' ? null : 'image' }))}
                          className={clsx(
                            'flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold border',
                            exp === 'image'
                              ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                              : 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                          )}
                        >
                          <ImageIcon className="w-2.5 h-2.5" />
                          이미지 프롬프트
                        </button>
                      </div>

                      {exp === 'script' && (() => {
                        const wrappedScript = buildVideoPrompt('', it.script);
                        const parts = wrappedScript.split(`Dialogue: ${it.script}`);
                        const before = parts[0] ?? '';
                        const after = parts.length > 1 ? parts.slice(1).join(`Dialogue: ${it.script}`) : '';
                        return (
                        <div className="space-y-2 rounded border border-gray-800 bg-gray-950/60 p-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider">10초 영상 프롬프트 (템플릿 + 대사)</span>
                              <button onClick={() => copyGenItemText(`s-en-${i}`, wrappedScript)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                {batchCopyKey === `s-en-${i}` ? '복사됨' : '전체 복사'}
                              </button>
                            </div>
                            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words font-mono bg-gray-950/50 border border-gray-800 rounded px-2 py-1.5 max-h-72 overflow-y-auto"><span className="text-gray-400">{before}</span><span className="text-rose-200 bg-rose-500/10 rounded px-1">Dialogue: {it.script}</span><span className="text-gray-400">{after}</span></pre>
                          </div>
                          {it.script_ko && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">한국어 번역</span>
                                <button onClick={() => copyGenItemText(`s-ko-${i}`, it.script_ko)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                  {batchCopyKey === `s-ko-${i}` ? '복사됨' : '복사'}
                                </button>
                              </div>
                              <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{it.script_ko}</p>
                            </div>
                          )}
                          {it.tip_ko && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">핵심 팁 (캡션용)</span>
                                <button onClick={() => copyGenItemText(`s-tip-${i}`, it.tip_ko)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                  {batchCopyKey === `s-tip-${i}` ? '복사됨' : '복사'}
                                </button>
                              </div>
                              <p className="text-[11px] text-amber-200/90 leading-relaxed whitespace-pre-wrap">{it.tip_ko}</p>
                            </div>
                          )}
                        </div>
                        );
                      })()}

                      {exp === 'image' && (
                        <div className="space-y-2 rounded border border-gray-800 bg-gray-950/60 p-2">
                          {it.image_situation && (
                            <div>
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider">situation</span>
                              <p className="text-[10px] text-gray-400 italic mt-0.5">{it.image_situation}</p>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider">이미지 생성 프롬프트</span>
                              <button onClick={() => copyGenItemText(`i-${i}`, it.image_prompt)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                {batchCopyKey === `i-${i}` ? '복사됨' : '복사'}
                              </button>
                            </div>
                            <pre className="text-[10px] text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{it.image_prompt}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!batchLoading && batchItems.length === 0 && !batchError && (
            <div className="rounded-md border border-gray-800 bg-gray-900/30 px-3 py-6 text-center text-[11px] text-gray-500">
              <Lightbulb className="w-5 h-5 mx-auto mb-2 text-gray-600" />
              위에서 톤·훅·스타일을 고르고
              <br /><span className="text-rose-300">일괄 생성</span> 버튼을 눌러주세요.
            </div>
          )}

          {/* 이미 사용한 주제 목록 (접이식) */}
          <div className="rounded-md border border-gray-800 bg-gray-900/30 overflow-hidden">
            <button
              onClick={() => { setTopicUsedOpen(o => !o); if (!topicUsedOpen) fetchTopicUsed(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:bg-gray-900/50"
            >
              <ChevronDown className={clsx('w-3 h-3 transition-transform', !topicUsedOpen && '-rotate-90')} />
              이미 생성한 주제
              {topicUsedCount > 0 && <span className="text-rose-300 normal-case">({topicUsedCount})</span>}
            </button>
            {topicUsedOpen && (
              <div className="px-3 pb-3 pt-1">
                {topicUsedList.length === 0 ? (
                  <p className="text-[10px] text-gray-600">아직 생성한 주제가 없어요.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {topicUsedList.map((u, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-gray-800/70 text-[10px] text-gray-300" title={u.created_at ?? ''}>
                        {u.device}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => { setShortsTab('history'); fetchShortsHistory(); fetchImgHistory(); }}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold rounded border border-gray-800 bg-gray-900/40 text-gray-400 hover:text-gray-200 hover:border-gray-700"
          >
            <Clock className="w-3 h-3" />
            이전 생성 히스토리 보기
          </button>

          {/* 고급 모드 토글 — 개별 대사 생성기 / 이미지 프롬프트 탭 노출 */}
          <button
            onClick={() => setShowAdvancedTabs(v => !v)}
            className="w-full text-[9px] text-gray-500 hover:text-gray-300 py-1"
          >
            {showAdvancedTabs ? '개별 생성기 탭 숨기기' : '개별 생성기(단건) 탭 보기'}
          </button>
        </div>}

        {shortsTab === 'history' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-rose-300" />
            <span className="text-[11px] font-semibold text-rose-200 uppercase tracking-wider">생성 히스토리</span>
            <span className="text-[9px] text-gray-500">그룹 단위 · 최근 30개</span>
            <button
              onClick={() => { fetchShortsHistory(); fetchImgHistory(); }}
              disabled={shortsHistoryLoad}
              className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 rounded border border-gray-800 bg-gray-900/40"
            >
              {shortsHistoryLoad ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              새로고침
            </button>
          </div>

          {shortsHistoryLoad && shortsHistory.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[11px] text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 불러오는 중...
            </div>
          ) : shortsHistory.length === 0 ? (
            <div className="rounded-md border border-gray-800 bg-gray-900/30 px-3 py-8 text-center text-[11px] text-gray-500">
              <Clock className="w-5 h-5 mx-auto mb-2 text-gray-600" />
              아직 생성된 그룹이 없어요.
              <br /><span className="text-rose-300">주제 추천기</span> 탭에서 먼저 생성해주세요.
            </div>
          ) : (
            <div className="space-y-2">
              {shortsHistory.map(h => {
                const open = historyExpanded === h.id;
                const imgsForGroup = imgHistory.filter(im => im.source_group_id === h.id);
                const imgByDevice: Record<string, ImageHistory | undefined> = {};
                imgsForGroup.forEach(im => { imgByDevice[im.input_device] = im; });
                const toneLabel = tonePresets.find(p => p.key === h.tone)?.label ?? h.tone ?? '-';
                const hookLabel = hookPresets.find(p => p.key === h.hook)?.label ?? h.hook ?? '-';
                return (
                  <div key={h.id} className="rounded-lg border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                    <button
                      onClick={() => setHistoryExpanded(open ? null : h.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 border-b border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/15 text-left"
                    >
                      <span className="text-rose-400 text-[10px] font-bold">#{h.id}</span>
                      <span className="text-[11px] font-semibold text-rose-100 flex-1 truncate">{h.input_device}</span>
                      <span className="text-[9px] text-gray-400 hidden md:inline">톤: {toneLabel}</span>
                      <span className="text-[9px] text-gray-400 hidden md:inline">훅: {hookLabel}</span>
                      <span className="text-[9px] text-gray-500">{h.created_at ? format(parseISO(h.created_at), 'MM/dd HH:mm', { locale: ko }) : '-'}</span>
                      <ChevronDown className={clsx('w-3 h-3 text-gray-400 transition-transform', !open && '-rotate-90')} />
                    </button>
                    {open && (
                      <div className="px-3 py-2 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span>톤 <span className="text-gray-200">{toneLabel}</span></span>
                          <span>·</span>
                          <span>훅 <span className="text-gray-200">{hookLabel}</span></span>
                          <span>·</span>
                          <span>{h.items.length}개 대본</span>
                          {imgsForGroup.length > 0 && (
                            <>
                              <span>·</span>
                              <span>이미지 {imgsForGroup.length}개</span>
                            </>
                          )}
                          <button
                            onClick={() => deleteShortsHistory(h.id)}
                            className="ml-auto text-[9px] text-red-400 hover:text-red-300 px-1"
                          >
                            삭제
                          </button>
                        </div>
                        {h.items.map((it, idx) => {
                          const wrapped = buildVideoPrompt('', it.script);
                          const parts = wrapped.split(`Dialogue: ${it.script}`);
                          const before = parts[0] ?? '';
                          const after = parts.length > 1 ? parts.slice(1).join(`Dialogue: ${it.script}`) : '';
                          const img = imgByDevice[it.device];
                          const scene = img && Array.isArray(img.scenes) && img.scenes[0] ? img.scenes[0] : null;
                          return (
                            <div key={idx} className="rounded border border-gray-800 bg-gray-950/60 p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-rose-400 text-[10px] font-bold">#{idx + 1}</span>
                                <span className="text-[11px] font-semibold text-rose-100 flex-1 truncate">{it.device}</span>
                              </div>
                              {it.unified_video_prompt && (
                                <div className="rounded border border-violet-500/40 bg-violet-500/10 p-1.5 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Package className="w-3 h-3 text-violet-300" />
                                    <span className="text-[9px] font-semibold text-violet-200 uppercase tracking-wider">비디오 통합 프롬프트</span>
                                    <button
                                      onClick={() => copyGenItemText(`h-${h.id}-u-${idx}`, it.unified_video_prompt!)}
                                      className="ml-auto text-[9px] text-violet-200 hover:text-violet-100 px-1.5 py-0.5 rounded bg-violet-500/30"
                                    >
                                      {batchCopyKey === `h-${h.id}-u-${idx}` ? '복사됨' : '전체 복사'}
                                    </button>
                                  </div>
                                  <pre className="text-[10px] leading-relaxed text-gray-200 whitespace-pre-wrap font-mono bg-gray-950/60 rounded px-1.5 py-1 max-h-48 overflow-y-auto">{it.unified_video_prompt}</pre>
                                </div>
                              )}
                              <div>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">10초 영상 프롬프트</span>
                                  <button onClick={() => copyGenItemText(`h-${h.id}-s-${idx}`, wrapped)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                    {batchCopyKey === `h-${h.id}-s-${idx}` ? '복사됨' : '전체 복사'}
                                  </button>
                                </div>
                                <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words font-mono bg-gray-950/50 border border-gray-800 rounded px-2 py-1.5 max-h-60 overflow-y-auto"><span className="text-gray-400">{before}</span><span className="text-rose-200 bg-rose-500/10 rounded px-1">Dialogue: {it.script}</span><span className="text-gray-400">{after}</span></pre>
                              </div>
                              {it.script_ko && (
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">한국어 번역</span>
                                    <button onClick={() => copyGenItemText(`h-${h.id}-ko-${idx}`, it.script_ko!)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                      {batchCopyKey === `h-${h.id}-ko-${idx}` ? '복사됨' : '복사'}
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{it.script_ko}</p>
                                </div>
                              )}
                              {it.tip_ko && (
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">핵심 팁</span>
                                    <button onClick={() => copyGenItemText(`h-${h.id}-tip-${idx}`, it.tip_ko!)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                      {batchCopyKey === `h-${h.id}-tip-${idx}` ? '복사됨' : '복사'}
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-amber-200/90 leading-relaxed whitespace-pre-wrap">{it.tip_ko}</p>
                                </div>
                              )}
                              {scene && (
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">이미지 프롬프트</span>
                                    <button onClick={() => copyGenItemText(`h-${h.id}-i-${idx}`, scene.prompt)} className="text-[9px] text-rose-300 hover:text-rose-200">
                                      {batchCopyKey === `h-${h.id}-i-${idx}` ? '복사됨' : '복사'}
                                    </button>
                                  </div>
                                  <pre className="text-[10px] text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{scene.prompt}</pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>}

        {shortsTab === 'script' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 전략 적용 배너 */}
          {strategyApplied && strategy && (
            <div className="flex items-start gap-2 rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-2">
              <Sparkles className="w-3 h-3 text-fuchsia-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-fuchsia-200">채널 전략 반영 중</p>
                <p className="text-[9px] text-fuchsia-100/60 leading-snug mt-0.5">콘텐츠 전략 · 성장 액션이 대본 생성에 자동 주입됩니다</p>
              </div>
              <button
                onClick={() => setStrategyApplied(false)}
                className="text-[9px] text-fuchsia-300/60 hover:text-fuchsia-200 shrink-0"
              >
                해제
              </button>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">전자기기 이름</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shortsDevice}
                onChange={e => setShortsDevice(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !shortsLoading) generateShortsScript(); }}
                disabled={shortsLoading}
                placeholder="예: 전자레인지, 드라이기"
                maxLength={50}
                className="flex-1 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-rose-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={generateShortsScript}
                disabled={shortsLoading || !shortsDevice.trim()}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed ${strategyApplied && strategy ? 'bg-fuchsia-600/90 hover:bg-fuchsia-500' : 'bg-rose-500/90 hover:bg-rose-400'}`}
              >
                {shortsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                생성
              </button>
            </div>
            <p className="text-[9px] text-gray-600">입력 기기 + 관련 기기 4개 = 5개 영어 대본 한 번에 생성 (10초 보이스오버용 · 약 25~30단어)</p>
            <p className="text-[9px] text-gray-500">복사 시 10초 영상 프롬프트 템플릿 Dialogue에 자동 삽입됩니다</p>
          </div>

          {/* 톤 / 훅 프리셋 선택 */}
          <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-rose-300" />
              <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider">스타일 옵션</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">감정 / 톤</span>
                <select
                  value={shortsTone}
                  onChange={e => setShortsTone(e.target.value)}
                  disabled={shortsLoading || tonePresets.length === 0}
                  className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1.5 text-[11px] text-gray-100 focus:border-rose-500 focus:outline-none disabled:opacity-50"
                >
                  {tonePresets.length === 0 ? (
                    <option value="">불러오는 중...</option>
                  ) : tonePresets.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[9px] text-gray-500 leading-snug">
                  {tonePresets.find(t => t.key === shortsTone)?.desc ?? ''}
                </p>
              </label>
              <label className="space-y-1">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">시작 훅</span>
                <select
                  value={shortsHook}
                  onChange={e => setShortsHook(e.target.value)}
                  disabled={shortsLoading || hookPresets.length === 0}
                  className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1.5 text-[11px] text-gray-100 focus:border-rose-500 focus:outline-none disabled:opacity-50"
                >
                  {hookPresets.length === 0 ? (
                    <option value="">불러오는 중...</option>
                  ) : hookPresets.map(h => (
                    <option key={h.key} value={h.key}>{h.label}</option>
                  ))}
                </select>
                <p className="text-[9px] text-gray-500 leading-snug">
                  {hookPresets.find(h => h.key === shortsHook)?.desc ?? ''}
                </p>
              </label>
            </div>
          </div>

          {shortsLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2.5 text-[11px] text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              Claude가 영어 대본 5개를 짜고 있어요... (30초~1분)
            </div>
          )}

          {shortsError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
              {shortsError}
            </div>
          )}

          {shortsItems.length > 0 && !shortsLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider">
                  {shortsInputDevice} · {shortsItems.length}개 대본
                </span>
                <button
                  onClick={copyAllShorts}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                    shortsCopiedIdx === -1
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400 hover:text-rose-300'
                  )}
                >
                  {shortsCopiedIdx === -1 ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />전체 복사</>}
                </button>
              </div>
              {shortsItems.map((it, idx) => {
                const words = it.script.trim().split(/\s+/).filter(Boolean).length;
                const okLen = words >= 22 && words <= 32;
                const wrapped = buildVideoPrompt('', it.script);
                return (
                  <div key={idx} className="rounded-lg border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-rose-500/20 bg-rose-500/10">
                      <span className="text-[10px] font-semibold text-rose-200">
                        <span className="text-rose-400 mr-1.5">#{idx + 1}</span>{it.device}
                      </span>
                      <button
                        onClick={() => copyShortsItem(idx)}
                        className={clsx(
                          'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                          shortsCopiedIdx === idx
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400 hover:text-rose-300'
                        )}
                      >
                        {shortsCopiedIdx === idx ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                      </button>
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                      {it.tip_ko && (
                        <div className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1.5">
                          <p className="text-[10px] font-semibold text-sky-300 uppercase tracking-wider mb-0.5">💡 핵심 팁</p>
                          <p className="text-xs leading-relaxed text-sky-100 whitespace-pre-wrap break-words">{it.tip_ko}</p>
                        </div>
                      )}
                      {it.script_ko && (
                        <>
                          <p className="text-[10px] font-semibold text-amber-300/80 uppercase tracking-wider">한글 뜻</p>
                          <p className="text-xs leading-relaxed text-amber-100/90 whitespace-pre-wrap break-words">{it.script_ko}</p>
                        </>
                      )}
                      <p className="text-[10px] font-semibold text-rose-300/80 uppercase tracking-wider">Script (복사됨)</p>
                      <p className="text-xs leading-relaxed text-gray-100 whitespace-pre-wrap break-words">{it.script}</p>
                      <p className={clsx('text-[9px]', okLen ? 'text-emerald-400' : 'text-amber-400')}>
                        {words} words · {it.script.length} chars {okLen ? '✓' : '(권장 22~32단어 범위 밖)'}
                      </p>
                      <div className="pt-1">
                        <p className="text-[10px] font-semibold text-rose-300/80 uppercase tracking-wider mb-1">복사될 최종 프롬프트</p>
                        <pre className="text-[10px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words font-mono bg-gray-950/50 border border-gray-800 rounded px-2 py-1.5 max-h-60 overflow-y-auto">{wrapped}</pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 히스토리 */}
          <div className="pt-2 border-t border-gray-800/70">
            <button
              onClick={() => setShortsHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-1 hover:text-gray-200"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                히스토리
                {shortsHistory.length > 0 && <span className="text-rose-300 normal-case">({shortsHistory.length})</span>}
              </span>
              <ChevronDown className={clsx('w-3 h-3 transition-transform', !shortsHistoryOpen && '-rotate-90')} />
            </button>

            {shortsHistoryOpen && (
              <div className="mt-2 space-y-1.5">
                {shortsHistoryLoad && shortsHistory.length === 0 ? (
                  <div className="flex items-center gap-1.5 py-2 text-[10px] text-gray-600">
                    <Loader2 className="w-3 h-3 animate-spin" />불러오는 중...
                  </div>
                ) : shortsHistory.length === 0 ? (
                  <p className="py-3 text-center text-[10px] text-gray-600">생성 기록이 없어요</p>
                ) : (
                  shortsHistory.map(h => (
                    <div
                      key={h.id}
                      className={clsx(
                        'group flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors cursor-pointer',
                        shortsActiveId === h.id
                          ? 'border-rose-500/40 bg-rose-500/10'
                          : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
                      )}
                      onClick={() => loadShortsHistory(h)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-100 truncate">{h.input_device}</p>
                        <p className="text-[9px] text-gray-500">
                          {h.items?.length ?? 0}개 · {h.created_at ? format(parseISO(h.created_at), 'MM/dd HH:mm') : '-'}
                        </p>
                        {(h.tone || h.hook) && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {h.tone && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                {tonePresets.find(t => t.key === h.tone)?.label ?? h.tone}
                              </span>
                            )}
                            {h.hook && h.hook !== 'none' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {hookPresets.find(x => x.key === h.hook)?.label ?? h.hook}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteShortsHistory(h.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>}

        {shortsTab === 'image' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">전자기기 이름</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imgDevice}
                onChange={e => setImgDevice(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !imgLoading) generateImagePrompts(); }}
                disabled={imgLoading}
                placeholder="예: 충전기, 에어프라이어"
                maxLength={50}
                className="flex-1 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-rose-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={generateImagePrompts}
                disabled={imgLoading || !imgDevice.trim()}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md bg-rose-500/90 hover:bg-rose-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {imgLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                생성
              </button>
            </div>
            <p className="text-[9px] text-gray-600">제품당 이미지 프롬프트 1개 생성 (고정 템플릿 · 9:16 세로)</p>
          </div>

          {/* 이미지 스타일 프리셋 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">이미지 스타일</label>
            <select
              value={imgStyle}
              onChange={e => setImgStyle(e.target.value)}
              disabled={imgLoading || imgBatchRunning}
              className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1.5 text-[11px] text-gray-100 focus:border-rose-500 focus:outline-none disabled:opacity-50"
            >
              {imgStylePresets.length === 0 ? (
                <option value={imgStyle}>로딩 중...</option>
              ) : imgStylePresets.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <p className="text-[9px] text-gray-600 leading-snug">
              {imgStylePresets.find(s => s.key === imgStyle)?.desc ?? ''}
            </p>
            {imgStyle === 'custom' && (
              <input
                type="text"
                value={imgCustomStyle}
                onChange={e => setImgCustomStyle(e.target.value)}
                disabled={imgLoading || imgBatchRunning}
                placeholder="예: 수묵화, 레고 블록, 유화, 사이버펑크 네온 등"
                maxLength={120}
                className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-rose-500 focus:outline-none disabled:opacity-50"
              />
            )}
          </div>

          {/* 대본 그룹 → 이미지 프롬프트 일괄 생성 */}
          <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-amber-200 uppercase tracking-wider">대본 그룹 일괄 생성</span>
              {imgBatchResults.length > 0 && (
                <button onClick={resetBatch} disabled={imgBatchRunning}
                        className="ml-auto text-[9px] text-gray-500 hover:text-gray-300 disabled:opacity-50">초기화</button>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={imgBatchSrcId ?? ''}
                onChange={e => pickBatchSource(e.target.value ? Number(e.target.value) : null)}
                disabled={imgBatchRunning || shortsHistory.length === 0}
                className="flex-1 rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1.5 text-[11px] text-gray-100 focus:border-amber-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">
                  {shortsHistory.length === 0 ? '대사 생성기 탭에서 대본 그룹을 먼저 생성하세요' : '대본 그룹 선택...'}
                </option>
                {shortsHistory.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.input_device} · {h.items?.length ?? 0}개 · {h.created_at ? format(parseISO(h.created_at), 'MM/dd HH:mm') : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={runBatchImgGen}
                disabled={imgBatchRunning || imgBatchResults.filter(r => r.status !== 'done').length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-amber-500/90 hover:bg-amber-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {imgBatchRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                일괄 생성
              </button>
            </div>

            {imgBatchResults.length > 0 && (
              <div className="space-y-1.5">
                {imgBatchResults.map((r, i) => {
                  const expanded = imgBatchExpanded === i;
                  return (
                    <div key={i} className={clsx(
                      'rounded-md border transition-colors',
                      r.status === 'done'   ? 'border-emerald-500/30 bg-emerald-500/5' :
                      r.status === 'loading'? 'border-amber-500/40 bg-amber-500/5' :
                      r.status === 'error'  ? 'border-red-500/30 bg-red-500/5' :
                                              'border-gray-800 bg-gray-900/40'
                    )}>
                      <button
                        onClick={() => r.status === 'done' && setImgBatchExpanded(expanded ? null : i)}
                        disabled={r.status !== 'done'}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                      >
                        <span className="w-5 h-5 rounded-full bg-gray-900 text-[9px] font-bold text-gray-400 flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-[11px] text-gray-100 truncate">{r.device}</span>
                        {r.status === 'pending'  && <span className="text-[9px] text-gray-500">대기</span>}
                        {r.status === 'loading'  && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                        {r.status === 'done'     && <>
                          <span className="text-[9px] text-emerald-300">프롬프트 ✓</span>
                          <ChevronDown className={clsx('w-3 h-3 text-gray-500 transition-transform', expanded && 'rotate-180')} />
                        </>}
                        {r.status === 'error'    && (
                          <span className="text-[9px] text-red-300 truncate max-w-[140px]" title={r.error}>
                            에러: {r.error}
                          </span>
                        )}
                      </button>

                      {r.status === 'error' && !imgBatchRunning && (
                        <div className="px-2.5 pb-2">
                          <button onClick={() => retryBatchItem(i)}
                                  className="text-[10px] text-amber-300 hover:text-amber-200 underline">
                            다시 시도
                          </button>
                        </div>
                      )}

                      {expanded && r.status === 'done' && (
                        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-gray-800/60 pt-2">
                          {r.character && (
                            <p className="text-[9px] text-amber-300/80 italic">상황: {r.character}</p>
                          )}
                          {(r.scenes ?? []).map((sc, si) => (
                            <div key={si} className="rounded border border-rose-500/20 bg-rose-500/5">
                              <div className="flex items-center justify-between px-2 py-1 border-b border-rose-500/20 bg-rose-500/10">
                                <span className="text-[9px] font-semibold text-rose-200">{sc.title}</span>
                                <button
                                  onClick={() => copyBatchText(`s-${i}-${si}`, sc.prompt)}
                                  className={clsx(
                                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors',
                                    imgBatchCopied === `s-${i}-${si}`
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                      : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400'
                                  )}
                                >
                                  {imgBatchCopied === `s-${i}-${si}` ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                                </button>
                              </div>
                              <p className="px-2 py-1.5 text-[10px] leading-relaxed text-gray-100 whitespace-pre-wrap break-words">{sc.prompt}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {imgLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2.5 text-[11px] text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              Claude가 프롬프트를 만들고 있어요...
            </div>
          )}

          {imgError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
              {imgError}
            </div>
          )}

          {imgScenes.length > 0 && !imgLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider">
                  {imgInputDevice} · 이미지 프롬프트
                </span>
                <button
                  onClick={copyAllImgScenes}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                    imgCopiedIdx === -1
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400 hover:text-rose-300'
                  )}
                >
                  {imgCopiedIdx === -1 ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />전체 복사</>}
                </button>
              </div>

              {imgCharacter && (
                <p className="text-[9px] text-amber-300/80 italic px-1">상황: {imgCharacter}</p>
              )}

              {/* 단일 프롬프트 */}
              {imgScenes.map((sc, idx) => (
                <div key={idx} className="rounded-lg border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-rose-500/20 bg-rose-500/10">
                    <span className="text-[10px] font-semibold text-rose-200">{sc.title}</span>
                    <button
                      onClick={() => copyImgScene(idx)}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                        imgCopiedIdx === idx
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400 hover:text-rose-300'
                      )}
                    >
                      {imgCopiedIdx === idx ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                    </button>
                  </div>
                  <p className="px-3 py-2 text-[11px] leading-relaxed text-gray-100 whitespace-pre-wrap break-words">{sc.prompt}</p>
                </div>
              ))}
            </div>
          )}

          {/* 히스토리 */}
          <div className="pt-2 border-t border-gray-800/70">
            <button
              onClick={() => setImgHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-1 hover:text-gray-200"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                히스토리
                {imgHistory.length > 0 && <span className="text-rose-300 normal-case">({imgHistory.length})</span>}
              </span>
              <ChevronDown className={clsx('w-3 h-3 transition-transform', !imgHistoryOpen && '-rotate-90')} />
            </button>

            {imgHistoryOpen && (
              <div className="mt-2 space-y-1.5">
                {imgHistoryLoad && imgHistory.length === 0 ? (
                  <div className="flex items-center gap-1.5 py-2 text-[10px] text-gray-600">
                    <Loader2 className="w-3 h-3 animate-spin" />불러오는 중...
                  </div>
                ) : imgHistory.length === 0 ? (
                  <p className="py-3 text-center text-[10px] text-gray-600">생성 기록이 없어요</p>
                ) : (() => {
                  // 그룹 아이디로 묶기: 같은 대본 그룹에서 일괄 생성된 것들끼리 한 덩어리로
                  // 단독 생성(그룹 없음)은 각자 하나의 가짜 그룹으로 처리
                  const groups: { key: string; srcId: number | null; rows: ImageHistory[] }[] = [];
                  const byGroup = new Map<number, ImageHistory[]>();
                  const loose: ImageHistory[] = [];
                  imgHistory.forEach(h => {
                    if (typeof h.source_group_id === 'number') {
                      const arr = byGroup.get(h.source_group_id) ?? [];
                      arr.push(h);
                      byGroup.set(h.source_group_id, arr);
                    } else {
                      loose.push(h);
                    }
                  });
                  // 최신 항목이 먼저 오도록 정렬 — 그룹은 그 안의 가장 최근 created_at 기준
                  const groupEntries = Array.from(byGroup.entries()).map(([sid, rows]) => {
                    rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
                    return { key: `g-${sid}`, srcId: sid, rows };
                  });
                  groupEntries.sort((a, b) =>
                    (b.rows[0]?.created_at ?? '').localeCompare(a.rows[0]?.created_at ?? '')
                  );
                  groups.push(...groupEntries);
                  loose.forEach(h => groups.push({ key: `s-${h.id}`, srcId: null, rows: [h] }));

                  return groups.map(g => {
                    if (g.srcId === null) {
                      const h = g.rows[0];
                      return (
                        <div
                          key={g.key}
                          className={clsx(
                            'group flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors cursor-pointer',
                            imgActiveId === h.id
                              ? 'border-rose-500/40 bg-rose-500/10'
                              : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
                          )}
                          onClick={() => loadImgHistory(h)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-100 truncate">{h.input_device}</p>
                            <p className="text-[9px] text-gray-500">
                              단독 · {h.created_at ? format(parseISO(h.created_at), 'MM/dd HH:mm') : '-'}
                            </p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteImgHistory(h.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }
                    const src = shortsHistory.find(s => s.id === g.srcId);
                    const headerLabel = src?.input_device ?? `그룹 #${g.srcId}`;
                    const latest = g.rows[0]?.created_at;
                    return (
                      <div key={g.key} className="rounded-md border border-amber-500/25 bg-amber-500/5 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-amber-500/20 bg-amber-500/10">
                          <Package className="w-2.5 h-2.5 text-amber-300 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-amber-200 truncate">{headerLabel}</span>
                          <span className="text-[9px] text-amber-300/70 normal-case">· {g.rows.length}개</span>
                          <span className="ml-auto text-[9px] text-gray-500">
                            {latest ? format(parseISO(latest), 'MM/dd HH:mm') : '-'}
                          </span>
                        </div>
                        <div className="p-1 space-y-1">
                          {g.rows.map(h => (
                            <div
                              key={h.id}
                              className={clsx(
                                'group flex items-center gap-2 rounded-md border px-2 py-1 transition-colors cursor-pointer',
                                imgActiveId === h.id
                                  ? 'border-rose-500/40 bg-rose-500/10'
                                  : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
                              )}
                              onClick={() => loadImgHistory(h)}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-gray-100 truncate">{h.input_device}</p>
                                <p className="text-[9px] text-gray-500">
                                  {h.created_at ? format(parseISO(h.created_at), 'MM/dd HH:mm') : '-'}
                                </p>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteImgHistory(h.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
                                title="삭제"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>}

        {shortsTab === 'concat' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">영상 5개 이어붙이기</p>
            <p className="text-[9px] text-gray-600">각 슬롯에 영상을 넣으면 1080×1920 세로 쇼츠로 재인코딩해 합칩니다.</p>
          </div>

          {/* 인트로 영상 설정 (시작 영상) */}
          <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-3 h-3 text-sky-400 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-sky-200 uppercase tracking-wider">인트로 영상 (항상 맨 앞)</span>
            </div>

            {introInfo.has_intro ? (
              <>
                <div className="flex items-center gap-2 rounded border border-sky-500/30 bg-sky-500/5 px-2 py-1.5">
                  <Check className="w-3 h-3 text-sky-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-100 truncate">{introInfo.filename}</p>
                    <p className="text-[9px] text-gray-500">
                      {((introInfo.size_bytes ?? 0) / 1024 / 1024).toFixed(1)} MB · 자동으로 맨 앞에 추가됨
                    </p>
                  </div>
                  <label className={clsx(
                    'px-2 py-1 text-[10px] font-medium rounded border border-gray-700 bg-gray-900/50 cursor-pointer',
                    introLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-sky-400 text-gray-300'
                  )}>
                    교체
                    <input type="file" accept="video/*" className="hidden" disabled={introLoading}
                           onChange={e => { const f = e.target.files?.[0]; if (f) uploadIntro(f); e.target.value = ''; }} />
                  </label>
                  <button onClick={deleteIntro} disabled={introLoading}
                          className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {introInfo.download_token && (
                  <video
                    src={`/api/personal-projects/shorts-concat/dl?token=${encodeURIComponent(introInfo.download_token)}`}
                    controls className="w-full rounded max-h-40 bg-black" />
                )}
                <label className="flex items-center gap-2 text-[10px] text-gray-300 cursor-pointer select-none">
                  <input type="checkbox" checked={prependIntro}
                         onChange={e => setPrependIntro(e.target.checked)}
                         className="w-3 h-3 rounded border-gray-700 bg-gray-900 accent-sky-500" />
                  이어붙이기 할 때 인트로 자동 추가
                </label>
              </>
            ) : (
              <label className={clsx(
                'flex items-center gap-1.5 rounded border border-dashed border-gray-700 bg-gray-900/40 px-2.5 py-2 text-[10px] cursor-pointer transition-colors',
                introLoading ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-sky-300 hover:border-sky-500/50'
              )}>
                {introLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                시작 영상 업로드 (항상 맨 앞에 붙습니다)
                <input type="file" accept="video/*" className="hidden" disabled={introLoading}
                       onChange={e => { const f = e.target.files?.[0]; if (f) uploadIntro(f); e.target.value = ''; }} />
              </label>
            )}

            {introError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 break-all">
                {introError}
              </div>
            )}
          </div>

          {/* 아웃트로 영상 설정 (마지막 인사 영상) */}
          <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-amber-200 uppercase tracking-wider">아웃트로 영상 (항상 마지막)</span>
            </div>

            {outroInfo.has_outro ? (
              <>
                <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
                  <Check className="w-3 h-3 text-amber-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-100 truncate">{outroInfo.filename}</p>
                    <p className="text-[9px] text-gray-500">
                      {((outroInfo.size_bytes ?? 0) / 1024 / 1024).toFixed(1)} MB · 자동으로 맨 끝에 추가됨
                    </p>
                  </div>
                  <label className={clsx(
                    'px-2 py-1 text-[10px] font-medium rounded border border-gray-700 bg-gray-900/50 cursor-pointer',
                    outroLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400 text-gray-300'
                  )}>
                    교체
                    <input type="file" accept="video/*" className="hidden" disabled={outroLoading}
                           onChange={e => { const f = e.target.files?.[0]; if (f) uploadOutro(f); e.target.value = ''; }} />
                  </label>
                  <button onClick={deleteOutro} disabled={outroLoading}
                          className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {outroInfo.download_token && (
                  <video
                    src={`/api/personal-projects/shorts-concat/dl?token=${encodeURIComponent(outroInfo.download_token)}`}
                    controls className="w-full rounded max-h-40 bg-black" />
                )}
                <label className="flex items-center gap-2 text-[10px] text-gray-300 cursor-pointer select-none">
                  <input type="checkbox" checked={appendOutro}
                         onChange={e => setAppendOutro(e.target.checked)}
                         className="w-3 h-3 rounded border-gray-700 bg-gray-900 accent-amber-500" />
                  이어붙이기 할 때 아웃트로 자동 추가
                </label>
              </>
            ) : (
              <label className={clsx(
                'flex items-center gap-1.5 rounded border border-dashed border-gray-700 bg-gray-900/40 px-2.5 py-2 text-[10px] cursor-pointer transition-colors',
                outroLoading ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-amber-300 hover:border-amber-500/50'
              )}>
                {outroLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                마지막 인사 영상 업로드 (항상 맨 끝에 붙습니다)
                <input type="file" accept="video/*" className="hidden" disabled={outroLoading}
                       onChange={e => { const f = e.target.files?.[0]; if (f) uploadOutro(f); e.target.value = ''; }} />
              </label>
            )}

            {outroError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 break-all">
                {outroError}
              </div>
            )}
          </div>

          {/* CTA 자막 설정 */}
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                <input
                  type="checkbox"
                  checked={ctaEnabled}
                  onChange={e => setCtaEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-rose-500"
                />
                <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider">구독 유도 CTA 자막</span>
              </label>
              <span className="text-[9px] text-gray-500">마지막 2.5초</span>
              {ctaSaved && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                  <CheckCircle2 className="w-2.5 h-2.5" />저장됨
                </span>
              )}
            </div>
            {ctaEnabled && (
              <>
                <input
                  type="text"
                  value={ctaText}
                  onChange={e => setCtaText(e.target.value)}
                  maxLength={40}
                  placeholder="구독하고 더 보기 ▶"
                  className="w-full rounded border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-[11px] text-gray-100 placeholder-gray-600 focus:border-rose-500 focus:outline-none"
                />
                <p className="text-[9px] text-gray-500 leading-snug">
                  영상 끝 2.5초에 화면 중앙 하단에 흰색 자막으로 표시됩니다.
                  한글·이모지 모두 지원. 최대 40자. 변경 시 자동 저장됩니다.
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            {concatFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-2.5 py-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                {f ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-100 truncate">{f.name}</p>
                      <p className="text-[9px] text-gray-500">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => setConcatFileAt(i, null)} disabled={concatLoading}
                            className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-50">
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <label className={clsx(
                    'flex-1 flex items-center gap-1.5 text-[10px] cursor-pointer transition-colors',
                    concatLoading ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-rose-300'
                  )}>
                    <Upload className="w-3 h-3" />
                    영상 파일 선택 (mp4, mov, webm...)
                    <input type="file" accept="video/*" className="hidden" disabled={concatLoading}
                           onChange={e => setConcatFileAt(i, e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={submitConcat}
              disabled={concatLoading || concatFiles.filter(Boolean).length < 2}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-rose-500/90 hover:bg-rose-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {concatLoading ? <><Loader2 className="w-3 h-3 animate-spin" />처리 중...</> : <><Package className="w-3 h-3" />이어붙이기</>}
            </button>
            <button
              onClick={resetConcat}
              disabled={concatLoading}
              className="px-3 py-2 text-[11px] font-medium rounded-md border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 disabled:opacity-50"
            >
              초기화
            </button>
          </div>

          {concatLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2.5 text-[11px] text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
              {concatStatus || 'ffmpeg로 재인코딩 중...'}
            </div>
          )}

          {concatError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 break-all">
              {concatError}
            </div>
          )}

          {concatResultUrl && !concatLoading && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/10">
                <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">완성된 영상</span>
                <a href={concatResultUrl} download={concatResultName}
                   className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                  <Download className="w-2.5 h-2.5" />
                  다운로드
                </a>
              </div>
              <div className="p-2">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={concatResultUrl} controls className="w-full rounded max-h-64 bg-black" />
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <p className="text-[9px] text-gray-500 truncate flex-1">{concatResultName}</p>
                  {concatCtaApplied && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[9px] font-semibold flex-shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />CTA 자막 삽입됨
                    </span>
                  )}
                </div>
                {concatFinalUploadId && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded border border-brand/30 bg-brand/10 px-2 py-1.5">
                    <span className="text-[10px] text-brand">
                      <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                      완성본 등록 탭에 자동 추가됨 (#{concatFinalUploadId})
                    </span>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('safesquare:switch-workspace-tab', { detail: { tab: 'uploads' } }))}
                      className="text-[10px] font-bold text-white bg-brand/80 hover:bg-brand px-2 py-0.5 rounded">
                      완성본 등록 열기 →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>}

        {shortsTab === 'seo' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">YouTube SEO 메타</p>
            <p className="text-[9px] text-gray-600">앞에서 생성한 대본 그룹을 선택하면 그 기기들 기준으로 제목·설명·해시태그를 만듭니다.</p>
          </div>

          <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-red-200 uppercase tracking-wider">대본 그룹 기준 생성</span>
              {(seoTitle || seoSrcId) && (
                <button onClick={resetSeo} disabled={seoLoading}
                        className="ml-auto text-[9px] text-gray-500 hover:text-gray-300 disabled:opacity-50">초기화</button>
              )}
            </div>
            <select
              value={seoSrcId ?? ''}
              onChange={e => setSeoSrcId(e.target.value ? Number(e.target.value) : null)}
              disabled={seoLoading || shortsHistory.length === 0}
              className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1.5 text-[11px] text-gray-100 focus:border-red-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {shortsHistory.length === 0 ? '대사 생성기 탭에서 대본 그룹을 먼저 생성하세요' : '대본 그룹 선택...'}
              </option>
              {shortsHistory.map(h => (
                <option key={h.id} value={h.id}>
                  {h.input_device} · {h.items?.length ?? 0}개 · {h.created_at ? format(parseISO(h.created_at), 'MM/dd HH:mm') : ''}
                </option>
              ))}
            </select>

            {seoSrcId && (() => {
              const src = shortsHistory.find(h => h.id === seoSrcId);
              if (!src) return null;
              const devices: string[] = [];
              (src.items ?? []).forEach(it => { if (it.device && !devices.includes(it.device)) devices.push(it.device); });
              return (
                <div className="rounded bg-gray-900/60 border border-gray-800 px-2 py-1.5 flex flex-wrap gap-1">
                  {devices.map((d, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">{d}</span>
                  ))}
                </div>
              );
            })()}

            <button
              onClick={generateYoutubeSeo}
              disabled={seoLoading || !seoSrcId}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-red-500/90 hover:bg-red-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {seoLoading ? <><Loader2 className="w-3 h-3 animate-spin" />Claude가 만들고 있어요...</> : <><Sparkles className="w-3 h-3" />제목 · 설명 · 해시태그 생성</>}
            </button>
          </div>

          {seoError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300">
              {seoError}
            </div>
          )}

          {seoTitle && !seoLoading && (
            <>
              <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-gray-800">
                  <span className="text-[10px] font-semibold text-red-200">Title</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-500">{seoTitle.length} chars</span>
                    <button
                      onClick={() => copySeoField('title', seoTitle)}
                      className={clsx(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                        seoCopied === 'title'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-red-400'
                      )}
                    >
                      {seoCopied === 'title' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                    </button>
                  </div>
                </div>
                <p className="px-2.5 py-1.5 text-[11px] text-gray-100 break-words">{seoTitle}</p>
              </div>

              <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-gray-800">
                  <span className="text-[10px] font-semibold text-red-200">Description</span>
                  <button
                    onClick={() => copySeoField('desc', seoDescription)}
                    className={clsx(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                      seoCopied === 'desc'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-red-400'
                    )}
                  >
                    {seoCopied === 'desc' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                  </button>
                </div>
                <pre className="px-2.5 py-1.5 text-[10px] leading-relaxed text-gray-100 whitespace-pre-wrap break-words font-sans max-h-48 overflow-y-auto">{seoDescription}</pre>
              </div>

              {seoHashtags.length > 0 && (
                <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-1 border-b border-gray-800">
                    <span className="text-[10px] font-semibold text-red-200">Hashtags ({seoHashtags.length})</span>
                    <button
                      onClick={() => copySeoField('tags', seoHashtags.join(', '))}
                      className={clsx(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                        seoCopied === 'tags'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-red-400'
                      )}
                    >
                      {seoCopied === 'tags' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                    </button>
                  </div>
                  <div className="px-2.5 py-1.5 flex flex-wrap gap-1">
                    {seoHashtags.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => copySeoField('all', `${seoTitle}\n\n${seoDescription}`)}
                className={clsx(
                  'w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium border transition-colors',
                  seoCopied === 'all'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-red-400'
                )}
              >
                {seoCopied === 'all' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />제목+설명 한 번에 복사</>}
              </button>

              {/* 최신 완성본(이어붙이기 결과)에 SEO 결과 주입 */}
              <button
                onClick={applySeoToLatestUpload}
                disabled={seoApplyState === 'applying'}
                className={clsx(
                  'w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold border transition-colors',
                  seoApplyState === 'done'
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                    : 'border-brand/40 bg-brand/15 text-brand hover:bg-brand/25'
                )}
              >
                {seoApplyState === 'applying'
                  ? <><Loader2 className="w-3 h-3 animate-spin" />적용 중…</>
                  : seoApplyState === 'done'
                    ? <><Check className="w-3 h-3" />완성본에 적용됨</>
                    : <><Upload className="w-3 h-3" />최신 완성본에 적용 (제목·설명·태그)</>}
              </button>
            </>
          )}
        </div>}

        {shortsTab === 'analytics' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 인증 상태 */}
          {!ytAuth?.authorized ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5 text-[11px] text-yellow-200 space-y-1.5">
              <p className="font-semibold">YouTube 로그인이 필요해요</p>
              <p className="text-[10px] text-yellow-300/80">완성본 등록 탭에서 먼저 Google 로그인을 진행해주세요.</p>
            </div>
          ) : !ytAuth?.has_readonly ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-100 space-y-2">
              <p className="font-semibold">읽기 권한이 없어요</p>
              <p className="text-[10px] text-amber-200/90 leading-snug">
                기존 로그인은 업로드 전용이라 내 채널 영상을 불러올 수 없어요.<br/>
                <b>완성본 등록 탭 → YouTube 로그아웃 → 다시 로그인</b>하면 읽기 권한이 추가됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* ━━ 종합 운영 전략 ━━ */}
              <div className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/5 p-3 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
                  <span className="text-[11px] font-semibold text-fuchsia-200 uppercase tracking-wider">AI 채널 종합 운영 전략</span>
                  {strategy && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 text-[10px] font-bold">
                      채널 점수 {strategy.overall_score}/10
                    </span>
                  )}
                  <button
                    onClick={runChannelStrategy}
                    disabled={strategyLoading || analyticsVideos.length === 0}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded bg-fuchsia-500/80 hover:bg-fuchsia-400 text-white disabled:opacity-50"
                  >
                    {strategyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {strategy ? '다시 분석' : '전략 분석 시작'}
                  </button>
                </div>
                <p className="text-[9px] text-fuchsia-100/60 leading-snug">
                  채널 데이터·영상 성과·업로드 타이밍·경쟁 분석을 종합해 지금 당장 실행 가능한 운영 전략을 제안합니다.
                  영상을 먼저 불러온 후 실행하면 더 정확합니다.
                </p>
                {strategyError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{strategyError}</div>
                )}
                {strategyLoading && (
                  <div className="flex items-center gap-2 rounded border border-fuchsia-500/20 bg-fuchsia-500/5 px-2 py-1.5 text-[10px] text-fuchsia-200">
                    <Loader2 className="w-3 h-3 animate-spin text-fuchsia-400" />
                    Claude가 채널 전체를 분석 중이에요... (30초~1분)
                  </div>
                )}
                {strategy && (
                  <div className="space-y-2.5">
                    {/* 종합 평가 */}
                    <div className="rounded border border-fuchsia-500/20 bg-gray-950/60 px-2.5 py-2">
                      <p className="text-[11px] text-fuchsia-100 leading-relaxed italic">{strategy.summary}</p>
                    </div>
                    {/* 우선순위 액션 */}
                    {strategy.priority && (
                      <div className="rounded border border-amber-400/40 bg-amber-400/10 px-2.5 py-2">
                        <p className="text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">⚡ 지금 당장 해야 할 것</p>
                        <p className="text-[11px] text-amber-100 leading-snug font-medium">{strategy.priority}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {/* 강점 */}
                      <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1">
                        <p className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">강점</p>
                        {strategy.strengths.map((s, i) => (
                          <p key={i} className="text-[10px] text-gray-300 leading-snug">✓ {s}</p>
                        ))}
                      </div>
                      {/* 약점 */}
                      <div className="rounded border border-red-500/30 bg-red-500/5 p-2 space-y-1">
                        <p className="text-[9px] font-bold text-red-300 uppercase tracking-wider">약점</p>
                        {strategy.weaknesses.map((w, i) => (
                          <p key={i} className="text-[10px] text-gray-300 leading-snug">△ {w}</p>
                        ))}
                      </div>
                    </div>
                    {/* 콘텐츠 전략 */}
                    <div className="rounded border border-sky-500/30 bg-sky-500/5 p-2 space-y-1">
                      <p className="text-[9px] font-bold text-sky-300 uppercase tracking-wider">콘텐츠 전략</p>
                      {strategy.content_strategy.map((s, i) => (
                        <p key={i} className="text-[10px] text-gray-300 leading-snug">▸ {s}</p>
                      ))}
                    </div>
                    {/* 업로드 전략 */}
                    <div className="rounded border border-cyan-500/30 bg-cyan-500/5 p-2 space-y-1">
                      <p className="text-[9px] font-bold text-cyan-300 uppercase tracking-wider">업로드 전략</p>
                      {strategy.upload_strategy.map((s, i) => (
                        <p key={i} className="text-[10px] text-gray-300 leading-snug">▸ {s}</p>
                      ))}
                    </div>
                    {/* 성장 액션 */}
                    <div className="rounded border border-violet-500/30 bg-violet-500/5 p-2 space-y-1">
                      <p className="text-[9px] font-bold text-violet-300 uppercase tracking-wider">성장 액션 5가지</p>
                      {strategy.growth_actions.map((a, i) => (
                        <p key={i} className="text-[10px] text-gray-300 leading-snug">
                          <span className="text-violet-400 font-bold">{i + 1}.</span> {a}
                        </p>
                      ))}
                    </div>
                    {/* 전략 기반 통합 생성 버튼 */}
                    <div className="pt-1 border-t border-fuchsia-500/20">
                      <button
                        onClick={() => {
                          setStrategyApplied(true);
                          setShortsTab('topic');
                          const ctx = [...strategy.content_strategy, ...strategy.growth_actions];
                          generateBatch(ctx);
                        }}
                        disabled={batchLoading}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-md bg-fuchsia-600/80 hover:bg-fuchsia-500 text-white transition-colors disabled:opacity-50"
                      >
                        {batchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        이 전략으로 5개 통합 생성 (대본 + 이미지)
                      </button>
                      <p className="text-[9px] text-fuchsia-200/50 text-center mt-1">미업로드 기기 자동 스캔 · 콘텐츠 전략 반영 · 대본+이미지 프롬프트 한 번에</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 채널 요약 */}
              <div className="rounded-md border border-gray-800 bg-gray-900/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {analyticsChannel?.thumbnail && (
                    <img src={analyticsChannel.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-100 truncate">{analyticsChannel?.title ?? '내 채널'}</p>
                    <p className="text-[9px] text-gray-500">
                      {analyticsChannel?.subscriber_count != null && (
                        <>구독 {analyticsChannel.subscriber_count.toLocaleString()} · </>
                      )}
                      영상 {analyticsChannel?.video_count?.toLocaleString() ?? '-'} · 총 조회 {analyticsChannel?.view_count?.toLocaleString() ?? '-'}
                    </p>
                  </div>
                  <button
                    onClick={fetchMyVideos}
                    disabled={analyticsLoading}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-rose-500/90 hover:bg-rose-400 text-white disabled:opacity-50"
                  >
                    {analyticsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    새로고침
                  </button>
                </div>

                {analyticsSummary && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <div className="rounded bg-gray-900/60 border border-gray-800 p-1.5 text-center">
                      <p className="text-[9px] text-gray-500 uppercase">최근 영상</p>
                      <p className="text-[13px] font-bold text-gray-100">{analyticsSummary.total}</p>
                      <p className="text-[8px] text-gray-600">숏 {analyticsSummary.shorts_count} · 롱 {analyticsSummary.longs_count}</p>
                    </div>
                    <div className="rounded bg-gray-900/60 border border-gray-800 p-1.5 text-center">
                      <p className="text-[9px] text-gray-500 uppercase">평균 조회</p>
                      <p className="text-[13px] font-bold text-rose-300">{analyticsSummary.avg_views.toLocaleString()}</p>
                    </div>
                    <div className="rounded bg-gray-900/60 border border-gray-800 p-1.5 text-center">
                      <p className="text-[9px] text-gray-500 uppercase">누적 좋아요</p>
                      <p className="text-[13px] font-bold text-amber-300">{analyticsSummary.total_likes.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {analyticsError && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  {analyticsError}
                </div>
              )}

              {/* Tier 1 Analytics (리텐션 · CTR · 지역) */}
              {!ytAuth?.has_analytics ? (
                <div className="rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2.5 text-[11px] text-violet-100 space-y-1.5">
                  <p className="font-semibold">📊 성장 분석에 권한 하나만 더 필요해요</p>
                  <p className="text-[10px] text-violet-200/80 leading-snug">
                    리텐션 곡선 · 썸네일 CTR · 시청자 국가 분포를 보려면 <b>YouTube Analytics</b> 권한이 필요합니다.<br/>
                    완성본 등록 탭 → <b>YouTube 로그아웃 → 다시 로그인</b>하면 자동 포함됩니다.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BarChart2 className="w-3 h-3 text-violet-300" />
                    <span className="text-[10px] font-semibold text-violet-200 uppercase tracking-wider">성장 분석</span>
                    <select
                      value={analyticsDays}
                      onChange={e => setAnalyticsDays(Number(e.target.value))}
                      className="rounded border border-gray-800 bg-gray-900/60 px-1.5 py-0.5 text-[10px] text-gray-100 focus:border-violet-500 focus:outline-none"
                    >
                      <option value={7}>최근 7일</option>
                      <option value={30}>최근 30일</option>
                      <option value={90}>최근 90일</option>
                      <option value={365}>최근 1년</option>
                    </select>
                    <button
                      onClick={() => { fetchGeography(); fetchPerformance(); }}
                      disabled={geoLoading || perfLoading}
                      className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-violet-500/80 hover:bg-violet-400 text-white disabled:opacity-50"
                    >
                      {(geoLoading || perfLoading) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      분석 불러오기
                    </button>
                  </div>

                  {(geoError || perfError) && (
                    <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
                      {geoError || perfError}
                    </div>
                  )}

                  {/* 요약 카드 */}
                  {perfSummary && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="rounded bg-gray-900/60 border border-gray-800 p-1.5 text-center">
                        <p className="text-[9px] text-gray-500 uppercase">평균 CTR</p>
                        <p className="text-[13px] font-bold text-violet-300">{(perfSummary.avg_ctr * 100).toFixed(2)}%</p>
                        <p className="text-[8px] text-gray-600">썸네일 클릭률</p>
                      </div>
                      <div className="rounded bg-gray-900/60 border border-gray-800 p-1.5 text-center">
                        <p className="text-[9px] text-gray-500 uppercase">평균 시청률</p>
                        <p className="text-[13px] font-bold text-rose-300">{perfSummary.avg_view_percentage.toFixed(1)}%</p>
                        <p className="text-[8px] text-gray-600">AVP (영상 길이 대비)</p>
                      </div>
                      <div className="rounded bg-gray-900/60 border border-gray-800 p-1.5 text-center">
                        <p className="text-[9px] text-gray-500 uppercase">순증 구독</p>
                        <p className={clsx('text-[13px] font-bold', perfSummary.net_subscribers >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                          {perfSummary.net_subscribers >= 0 ? '+' : ''}{perfSummary.net_subscribers.toLocaleString()}
                        </p>
                        <p className="text-[8px] text-gray-600">gained − lost</p>
                      </div>
                    </div>
                  )}

                  {/* 국가 분포 */}
                  {geography.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-violet-200 uppercase tracking-wider">🌍 시청자 국가 TOP 10</p>
                      {geography.slice(0, 10).map(g => {
                        const pct = Math.round(g.share * 100);
                        return (
                          <div key={g.country} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-300 w-8">{g.country}</span>
                            <div className="flex-1 h-3 rounded bg-gray-900/70 overflow-hidden relative">
                              <div className="absolute inset-y-0 left-0 bg-violet-500/60" style={{ width: `${pct}%` }} />
                              <span className="absolute inset-0 flex items-center px-1.5 text-[9px] text-gray-100">
                                {pct}% · {g.views.toLocaleString()} 조회 · +{g.subscribers_gained.toLocaleString()} 구독
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 영상별 성과 + 리텐션 */}
                  {performance.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-violet-200 uppercase tracking-wider">🎯 영상별 성과 (노출·CTR·리텐션)</p>
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 gap-y-0.5 text-[9px] text-gray-500 uppercase px-1.5">
                        <span>영상</span>
                        <span className="text-right">조회</span>
                        <span className="text-right">노출</span>
                        <span className="text-right">CTR</span>
                        <span className="text-right">AVP</span>
                        <span className="text-right">+구독</span>
                      </div>
                      {performance.slice(0, 15).map(p => {
                        const meta = analyticsVideos.find(v => v.id === p.video_id);
                        const title = meta?.title ?? p.video_id;
                        const isOpen = retentionExpanded === p.video_id;
                        const pts = retention[p.video_id];
                        return (
                          <div key={p.video_id} className="rounded border border-gray-800 bg-gray-900/40">
                            <button
                              onClick={() => toggleRetention(p.video_id)}
                              className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 items-center px-1.5 py-1 text-left hover:bg-gray-900/70"
                            >
                              <span className="text-[10px] text-gray-100 truncate min-w-0" title={title}>{title}</span>
                              <span className="text-[10px] text-right text-gray-300 tabular-nums">{p.views.toLocaleString()}</span>
                              <span className="text-[10px] text-right text-gray-300 tabular-nums">{p.impressions > 0 ? p.impressions.toLocaleString() : '-'}</span>
                              <span className={clsx('text-[10px] text-right tabular-nums', p.impressions_ctr >= 0.04 ? 'text-emerald-300' : p.impressions_ctr > 0 ? 'text-amber-300' : 'text-gray-500')}>
                                {p.impressions_ctr > 0 ? `${(p.impressions_ctr * 100).toFixed(1)}%` : '-'}
                              </span>
                              <span className={clsx('text-[10px] text-right tabular-nums', p.avg_view_percentage >= 60 ? 'text-emerald-300' : p.avg_view_percentage >= 40 ? 'text-amber-300' : 'text-red-300')}>
                                {p.avg_view_percentage.toFixed(0)}%
                              </span>
                              <span className={clsx('text-[10px] text-right tabular-nums', p.subscribers_net > 0 ? 'text-emerald-300' : p.subscribers_net < 0 ? 'text-red-300' : 'text-gray-500')}>
                                {p.subscribers_net > 0 ? '+' : ''}{p.subscribers_net}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="px-2 py-1.5 border-t border-gray-800/60">
                                {retentionLoading === p.video_id ? (
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                    <Loader2 className="w-3 h-3 animate-spin" /> 리텐션 불러오는 중…
                                  </div>
                                ) : !pts || pts.length === 0 ? (
                                  <p className="text-[10px] text-gray-500">리텐션 데이터가 부족해요 (노출/시청이 적으면 비어있을 수 있어요).</p>
                                ) : (
                                  <>
                                    <p className="text-[9px] text-gray-500 mb-1">시청 지속 곡선 (X: 영상 진행 %, Y: 시청자 비율)</p>
                                    <svg viewBox="0 0 100 40" className="w-full h-16 bg-gray-950/70 rounded">
                                      {(() => {
                                        const max = Math.max(...pts.map(pt => pt.watch), 1);
                                        const path = pts.map((pt, i) => {
                                          const x = pt.elapsed * 100;
                                          const y = 40 - (pt.watch / max) * 38;
                                          return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
                                        }).join(' ');
                                        return (
                                          <>
                                            <path d={path} fill="none" stroke="#a78bfa" strokeWidth="0.8" />
                                            <path d={`${path} L100,40 L0,40 Z`} fill="#a78bfa" fillOpacity="0.15" />
                                          </>
                                        );
                                      })()}
                                    </svg>
                                    <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                                      <span>시작 {(pts[0]?.watch * 100).toFixed(0)}%</span>
                                      <span>25% {(pts[Math.floor(pts.length * 0.25)]?.watch * 100 || 0).toFixed(0)}%</span>
                                      <span>50% {(pts[Math.floor(pts.length * 0.5)]?.watch * 100 || 0).toFixed(0)}%</span>
                                      <span>75% {(pts[Math.floor(pts.length * 0.75)]?.watch * 100 || 0).toFixed(0)}%</span>
                                      <span>끝 {(pts[pts.length - 1]?.watch * 100 || 0).toFixed(0)}%</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TOP 5 */}
              {analyticsTop.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-semibold text-amber-200 uppercase tracking-wider">내 채널 TOP 5</span>
                  </div>
                  {analyticsTop.map((v, i) => (
                    <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-1.5 hover:bg-amber-500/10">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      {v.thumbnail && <img src={v.thumbnail} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-100 truncate">{v.title}</p>
                        <p className="text-[9px] text-gray-500">
                          조회 {v.view_count.toLocaleString()} · 좋아요 {v.like_count.toLocaleString()}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* 훅/톤 패턴 자기학습 */}
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">훅 / 톤 패턴 자기학습</span>
                  <button
                    onClick={runLearnPatterns}
                    disabled={learnLoading || analyticsVideos.length === 0}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/80 hover:bg-emerald-400 text-white disabled:opacity-50"
                  >
                    {learnLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {learnedPatterns.length ? '다시 학습' : '상위 영상에서 학습'}
                  </button>
                </div>
                <p className="text-[9px] text-emerald-100/70 leading-snug">
                  내 채널 상위 10개 쇼츠의 제목·설명에서 반복되는 훅/톤 패턴을 Claude가 뽑아 대본 생성기 프리셋(🎓 마크)에 자동 추가합니다.
                </p>
                {learnError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{learnError}</div>
                )}
                {learnedPatterns.length > 0 ? (
                  <div className="space-y-1.5">
                    {learnedPatterns.map(p => {
                      const open = learnExpanded === p.id;
                      const isNeg = p.polarity === 'negative';
                      const kindLabel = p.kind === 'tone' ? '톤' : p.kind === 'hook' ? '훅' : p.kind === 'title' ? '제목' : '일반';
                      const kindColor = isNeg
                        ? 'bg-red-500/20 text-red-200'
                        : p.kind === 'tone' ? 'bg-rose-500/20 text-rose-200' : 'bg-sky-500/20 text-sky-200';
                      return (
                      <div key={p.id} className={clsx(
                        'rounded border p-1.5',
                        !p.enabled ? 'border-gray-800 bg-gray-900/20 opacity-60'
                          : isNeg ? 'border-red-500/30 bg-red-500/5'
                            : 'border-emerald-500/30 bg-gray-900/40'
                      )}>
                        <div className="flex items-center gap-1.5">
                          {isNeg && <span className="text-red-300 text-[10px]">⛔</span>}
                          <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider', kindColor)}>
                            {isNeg ? `피할 ${kindLabel}` : kindLabel}
                          </span>
                          <span className="flex-1 min-w-0 text-[11px] font-semibold text-gray-100 truncate">{p.label}</span>
                          <button
                            onClick={() => setLearnExpanded(open ? null : p.id)}
                            className="text-[9px] text-gray-400 hover:text-gray-200 px-1"
                          >
                            {open ? '접기' : '펼치기'}
                          </button>
                          <button
                            onClick={() => togglePattern(p.id, !p.enabled)}
                            className={clsx(
                              'text-[9px] px-1.5 py-0.5 rounded border',
                              p.enabled
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                                : 'border-gray-700 bg-gray-900/60 text-gray-400'
                            )}
                          >
                            {p.enabled ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => deletePattern(p.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 px-1"
                          >
                            삭제
                          </button>
                        </div>
                        {p.desc && <p className="text-[10px] text-gray-400 leading-snug mt-1">{p.desc}</p>}
                        {open && (
                          <div className="mt-1.5 space-y-1 border-t border-gray-800/70 pt-1.5">
                            <p className="text-[9px] text-gray-500 uppercase tracking-wider">프롬프트 지시문</p>
                            <pre className="text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap font-mono bg-gray-950/50 border border-gray-800 rounded px-2 py-1">{p.prompt}</pre>
                            {p.source_titles.length > 0 && (
                              <>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wider">근거 영상</p>
                                <ul className="text-[10px] text-gray-400 space-y-0.5">
                                  {p.source_titles.map((t, i) => <li key={i} className="truncate">· {t}</li>)}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500 italic">학습된 패턴이 아직 없어요. 내 영상을 먼저 불러온 뒤 버튼을 눌러주세요.</p>
                )}
              </div>

              {/* 경쟁 채널 벤치마킹 */}
              <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-3 h-3 text-indigo-300" />
                  <span className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wider">경쟁 채널 벤치마킹</span>
                  <span className="ml-auto text-[9px] text-indigo-200/60">24h 캐시</span>
                </div>
                <p className="text-[9px] text-indigo-100/70 leading-snug">
                  동종 채널을 등록해두면 내 상위 5 vs 경쟁 상위 5의 훅·톤·주제 갭을 LLM이 분석합니다. URL, @handle, UC_id 모두 가능.
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={competitorInput}
                    onChange={e => setCompetitorInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !competitorAdding) addCompetitor(); }}
                    disabled={competitorAdding}
                    placeholder="@channelhandle 또는 youtube.com/channel/UC..."
                    className="flex-1 rounded border border-gray-800 bg-gray-900/50 px-2 py-1 text-[11px] text-gray-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={addCompetitor}
                    disabled={competitorAdding || !competitorInput.trim()}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-indigo-500/80 hover:bg-indigo-400 text-white disabled:opacity-50"
                  >
                    {competitorAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : '추가'}
                  </button>
                </div>
                {competitorError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{competitorError}</div>
                )}
                {competitors.length > 0 ? (
                  <div className="space-y-1">
                    {competitors.map(c => {
                      const checked = !!benchmarkSelected[c.id];
                      return (
                      <div key={c.id} className={clsx(
                        'rounded border p-1.5 flex items-center gap-2',
                        checked ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-gray-800 bg-gray-900/40'
                      )}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setBenchmarkSelected(prev => ({ ...prev, [c.id]: e.target.checked }))}
                          className="flex-shrink-0"
                        />
                        {c.thumbnail && <img src={c.thumbnail} alt="" className="w-7 h-7 rounded-full flex-shrink-0 object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-100 truncate">{c.title || c.channel_id}</p>
                          <p className="text-[9px] text-gray-500 truncate">
                            {c.handle || c.channel_id}
                            {' · '}
                            {c.cache_fresh ? <span className="text-emerald-400">캐시 신선</span> : <span className="text-amber-400">캐시 오래됨</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => refreshCompetitor(c.id)}
                          disabled={competitorRefreshing === c.id}
                          className="text-[9px] text-indigo-300 hover:text-indigo-200 px-1 disabled:opacity-50"
                        >
                          {competitorRefreshing === c.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '갱신'}
                        </button>
                        <button
                          onClick={() => deleteCompetitor(c.id)}
                          className="text-[9px] text-red-400 hover:text-red-300 px-1"
                        >
                          삭제
                        </button>
                      </div>
                      );
                    })}
                    <button
                      onClick={runBenchmark}
                      disabled={benchmarkLoading || Object.values(benchmarkSelected).filter(Boolean).length === 0}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded bg-indigo-500/80 hover:bg-indigo-400 text-white disabled:opacity-50"
                    >
                      {benchmarkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      선택한 채널과 비교 분석
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500 italic">아직 등록된 경쟁 채널이 없어요.</p>
                )}
                {benchmarkError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{benchmarkError}</div>
                )}
                {benchmarkLoading && (
                  <div className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/40 px-2 py-1.5 text-[10px] text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    Claude가 훅·톤 갭을 분석 중이에요... (30초~1분)
                  </div>
                )}
                {benchmarkReport && (
                  <div className="rounded border border-indigo-500/30 bg-gray-950/60 p-2 space-y-2">
                    {benchmarkReport.summary && (
                      <p className="text-[11px] text-indigo-100 leading-relaxed italic">{benchmarkReport.summary}</p>
                    )}
                    {benchmarkReport.hook_gaps && benchmarkReport.hook_gaps.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold text-indigo-300/80 uppercase tracking-wider mb-0.5">훅 갭</p>
                        <ul className="text-[10px] text-gray-300 space-y-0.5">
                          {benchmarkReport.hook_gaps.map((x, i) => <li key={i}>· {x}</li>)}
                        </ul>
                      </div>
                    )}
                    {benchmarkReport.tone_gaps && benchmarkReport.tone_gaps.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold text-indigo-300/80 uppercase tracking-wider mb-0.5">톤 갭</p>
                        <ul className="text-[10px] text-gray-300 space-y-0.5">
                          {benchmarkReport.tone_gaps.map((x, i) => <li key={i}>· {x}</li>)}
                        </ul>
                      </div>
                    )}
                    {benchmarkReport.topic_gaps && benchmarkReport.topic_gaps.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold text-indigo-300/80 uppercase tracking-wider mb-0.5">주제 갭</p>
                        <ul className="text-[10px] text-gray-300 space-y-0.5">
                          {benchmarkReport.topic_gaps.map((x, i) => <li key={i}>· {x}</li>)}
                        </ul>
                      </div>
                    )}
                    {benchmarkReport.actions && benchmarkReport.actions.length > 0 && (
                      <div>
                        <p className="text-[9px] font-semibold text-emerald-300/90 uppercase tracking-wider mb-0.5">즉시 적용</p>
                        <ul className="text-[10px] text-emerald-100/90 space-y-0.5">
                          {benchmarkReport.actions.map((x, i) => <li key={i}>▸ {x}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 포스팅 타이밍 & 초기 성과 */}
              <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-cyan-300" />
                  <span className="text-[10px] font-semibold text-cyan-200 uppercase tracking-wider">포스팅 타이밍 & 초기 성과</span>
                  <button
                    onClick={fetchTimingHeatmap}
                    disabled={timingLoading}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-cyan-500/80 hover:bg-cyan-400 text-white disabled:opacity-50"
                  >
                    {timingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    히트맵 새로고침
                  </button>
                </div>
                <p className="text-[9px] text-cyan-100/70 leading-snug">
                  요일×시각별 평균 조회수 (KST). 셀이 진할수록 해당 시간대 업로드가 평균적으로 더 높은 조회수를 기록했습니다.
                </p>
                {timingError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{timingError}</div>
                )}
                {timingHeatmap && timingHeatmap.total_videos > 0 && (() => {
                  const flat = timingHeatmap.avg_views.flat().filter(x => x > 0);
                  const max = flat.length ? Math.max(...flat) : 0;
                  const dayLabels = ['월','화','수','목','금','토','일'];
                  return (
                    <div className="space-y-1.5">
                      <div className="overflow-x-auto">
                        <table className="text-[8px] border-collapse">
                          <thead>
                            <tr>
                              <th className="px-0.5 py-0.5 text-gray-500"> </th>
                              {Array.from({length: 24}, (_, h) => (
                                <th key={h} className="px-0.5 py-0.5 font-normal text-gray-500 min-w-[14px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dayLabels.map((lbl, wd) => (
                              <tr key={wd}>
                                <td className="px-1 py-0.5 text-gray-400 font-semibold">{lbl}</td>
                                {Array.from({length: 24}, (_, hr) => {
                                  const avg = timingHeatmap.avg_views[wd][hr];
                                  const cnt = timingHeatmap.upload_count[wd][hr];
                                  const ratio = max > 0 ? avg / max : 0;
                                  return (
                                    <td
                                      key={hr}
                                      title={cnt > 0 ? `${lbl} ${hr}시 · 업로드 ${cnt}회 · 평균 ${Math.round(avg).toLocaleString()} 뷰` : `${lbl} ${hr}시 · 업로드 없음`}
                                      className="border border-gray-900"
                                      style={{
                                        width: 14, height: 14,
                                        backgroundColor: cnt === 0 ? 'rgba(55,65,81,0.3)' : `rgba(6,182,212,${0.15 + ratio * 0.75})`,
                                      }}
                                    />
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {timingHeatmap.best_slot && (
                          <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1">
                            <p className="text-[9px] text-emerald-300/80 uppercase tracking-wider">최고 시간대</p>
                            <p className="text-emerald-100">
                              {dayLabels[timingHeatmap.best_slot.weekday]} {timingHeatmap.best_slot.hour}시 · 평균 {Math.round(timingHeatmap.best_slot.avg_views).toLocaleString()} 뷰 ({timingHeatmap.best_slot.count}회 업로드)
                            </p>
                          </div>
                        )}
                        {timingHeatmap.worst_slot && (
                          <div className="rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1">
                            <p className="text-[9px] text-rose-300/80 uppercase tracking-wider">최저 시간대</p>
                            <p className="text-rose-100">
                              {dayLabels[timingHeatmap.worst_slot.weekday]} {timingHeatmap.worst_slot.hour}시 · 평균 {Math.round(timingHeatmap.worst_slot.avg_views).toLocaleString()} 뷰 ({timingHeatmap.worst_slot.count}회 업로드)
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-500">표본 {timingHeatmap.total_videos}개 · KST 기준</p>
                    </div>
                  );
                })()}
                {timingHeatmap && timingHeatmap.total_videos === 0 && (
                  <p className="text-[10px] text-gray-500 italic">게시된 쇼츠가 없어요.</p>
                )}

                {/* 초기 성과 스냅샷 */}
                <div className="pt-2 mt-2 border-t border-cyan-500/20 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-cyan-200 uppercase tracking-wider">1h / 6h / 24h 스냅샷</span>
                    <button
                      onClick={captureSnapshot}
                      disabled={snapshotCapturing}
                      className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 disabled:opacity-50"
                    >
                      {snapshotCapturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      지금 스냅샷 캡처
                    </button>
                  </div>
                  <p className="text-[9px] text-cyan-100/70 leading-snug">
                    주기적으로(예: 1시간마다) 이 엔드포인트를 호출하면 업로드 직후 1h / 6h / 24h 시점 조회수가 기록됩니다. 채널 중앙값보다 낮으면 초기 실패로 판정.
                  </p>
                  <div className="rounded border border-gray-800 bg-gray-950/60 px-2 py-1.5 font-mono text-[9px] text-gray-400 break-all">
                    {`*/30 * * * * curl -s -X POST -H "Authorization: Bearer <TOKEN>" ${BASE}/${project.id}/ops/shorts-snapshots/capture > /dev/null`}
                  </div>
                  {snapshotMsg && (
                    <div className="text-[10px] text-cyan-200">{snapshotMsg}</div>
                  )}
                  {earlyPerf.length > 0 && (
                    <div className="space-y-1">
                      {earlyPerfMedian !== null && (
                        <p className="text-[9px] text-gray-400">채널 24h 중앙값: <span className="text-cyan-200 font-semibold">{earlyPerfMedian.toLocaleString()} 뷰</span></p>
                      )}
                      {earlyPerf.slice(0, 10).map(item => {
                        const v24 = item.views_at_24h;
                        const failing = v24 !== null && earlyPerfMedian !== null && v24 < earlyPerfMedian * 0.5;
                        return (
                          <div key={item.video_id} className={clsx(
                            'rounded border p-1.5 text-[10px]',
                            failing ? 'border-rose-500/40 bg-rose-500/5' : 'border-gray-800 bg-gray-900/40'
                          )}>
                            <p className="text-gray-100 truncate font-semibold">{item.title}</p>
                            <div className="flex gap-2 text-gray-400 text-[9px] mt-0.5">
                              <span>1h: <span className="text-gray-200">{item.views_at_1h?.toLocaleString() ?? '-'}</span></span>
                              <span>6h: <span className="text-gray-200">{item.views_at_6h?.toLocaleString() ?? '-'}</span></span>
                              <span>24h: <span className={clsx('font-semibold', failing ? 'text-rose-300' : 'text-gray-200')}>
                                {v24?.toLocaleString() ?? '-'}
                              </span></span>
                              {failing && <span className="ml-auto text-rose-300">초기 부진</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* AI 추천 */}
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-rose-300" />
                  <span className="text-[10px] font-semibold text-rose-200 uppercase tracking-wider">AI 다음 쇼츠 기기 추천</span>
                  <button
                    onClick={generateInsights}
                    disabled={insightsLoading || analyticsVideos.length === 0}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-500/80 hover:bg-rose-400 text-white disabled:opacity-50"
                  >
                    {insightsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {insightsRecs.length ? '다시 생성' : '생성'}
                  </button>
                </div>
                {insightsError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{insightsError}</div>
                )}
                {insightsPattern && (
                  <p className="text-[10px] text-rose-100/90 leading-snug italic">{insightsPattern}</p>
                )}
                {insightsRecs.length > 0 && (
                  <div className="space-y-1.5">
                    {insightsRecs.map((r, i) => (
                      <div key={i} className="rounded border border-rose-500/20 bg-gray-900/40 p-1.5 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-100 truncate">{r.device}</p>
                          <p className="text-[9px] text-gray-400 leading-snug">{r.reason}</p>
                        </div>
                        <button
                          onClick={() => applyDeviceToScript(r.device)}
                          className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                          title="대사 생성 탭으로 보내기"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          대본 생성
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI 저조 원인 진단 */}
              <div className={clsx(
                'rounded-md border p-2.5 space-y-2',
                diagnoseTarget === 'overseas'
                  ? 'border-sky-500/40 bg-sky-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              )}>
                <div className="flex items-center gap-2 flex-wrap">
                  <BarChart2 className={clsx('w-3 h-3', diagnoseTarget === 'overseas' ? 'text-sky-300' : 'text-amber-300')} />
                  <span className={clsx('text-[10px] font-semibold uppercase tracking-wider', diagnoseTarget === 'overseas' ? 'text-sky-200' : 'text-amber-200')}>
                    AI 저조 원인 진단
                  </span>
                  {/* 국내 / 해외 토글 */}
                  <div className="flex items-center rounded overflow-hidden border border-gray-700 text-[9px] font-semibold">
                    <button
                      onClick={() => { setDiagnoseTarget('domestic'); setDiagnoseResult(null); }}
                      className={clsx(
                        'px-2 py-0.5 transition-colors',
                        diagnoseTarget === 'domestic'
                          ? 'bg-amber-500/70 text-white'
                          : 'bg-gray-900/60 text-gray-400 hover:text-gray-200'
                      )}
                    >🇰🇷 국내</button>
                    <button
                      onClick={() => { setDiagnoseTarget('overseas'); setDiagnoseResult(null); }}
                      className={clsx(
                        'px-2 py-0.5 transition-colors',
                        diagnoseTarget === 'overseas'
                          ? 'bg-sky-500/70 text-white'
                          : 'bg-gray-900/60 text-gray-400 hover:text-gray-200'
                      )}
                    >🌐 해외</button>
                  </div>
                  <span className="text-[9px] text-gray-500">
                    {diagnoseTarget === 'overseas' ? '언어장벽·썸네일·국제SEO·Geography 분석' : '연령보정·리텐션·댓글·경쟁채널 통합'}
                  </span>
                  <button
                    onClick={runDiagnose}
                    disabled={diagnoseLoading || analyticsVideos.length < 2}
                    className={clsx(
                      'ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded text-white disabled:opacity-50',
                      diagnoseTarget === 'overseas'
                        ? 'bg-sky-500/80 hover:bg-sky-400'
                        : 'bg-amber-500/80 hover:bg-amber-400'
                    )}
                  >
                    {diagnoseLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {diagnoseResult ? '다시 분석' : '진단 시작'}
                  </button>
                  <button
                    onClick={runLearnAvoidPatterns}
                    disabled={avoidLearnLoading}
                    title="최근 진단에서 공통 저조 패턴을 뽑아 대본 생성기의 'Avoid' 섹션에 자동 주입"
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-200 disabled:opacity-50"
                  >
                    {avoidLearnLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                    부정 패턴 학습
                  </button>
                </div>
                {/* 해외 타겟 모드 안내 */}
                {diagnoseTarget === 'overseas' && !diagnoseResult && !diagnoseLoading && (
                  <div className="rounded border border-sky-500/30 bg-sky-500/8 px-2.5 py-2 space-y-1">
                    <p className="text-[10px] font-semibold text-sky-200">🌐 해외 타겟 진단 모드</p>
                    <ul className="text-[9px] text-sky-200/80 leading-relaxed space-y-0.5">
                      <li>• 언어 장벽: 한국어 전용 제목·태그의 해외 노출 차단 여부</li>
                      <li>• 문화적 범용성: 해외 시청자가 설명 없이 이해 가능한지</li>
                      <li>• 썸네일 독해성: 한글 텍스트 없이 비주얼만으로 전달되는지</li>
                      <li>• 국제 SEO: 영어 키워드·해시태그·글로벌 트렌드 매칭</li>
                      <li>• Geography: Analytics 연동 시 국가 비율 자동 분석 포함</li>
                    </ul>
                    <p className="text-[9px] text-sky-300/70">수정안 생성 시 영한 혼합 제목·영어 태그로 자동 최적화됩니다.</p>
                  </div>
                )}
                {avoidLearnError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{avoidLearnError}</div>
                )}
                {avoidLearnMsg && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-200">{avoidLearnMsg}</div>
                )}
                {diagnoseError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{diagnoseError}</div>
                )}
                {diagnoseResult?.summary && (
                  <div className="space-y-1">
                    {diagnoseResult.target_audience === 'overseas' && (
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-500/20 text-sky-200 border border-sky-500/30">🌐 해외 타겟 진단</span>
                        <span className="text-[9px] text-gray-500">영어 수정안 자동 생성 · Geography 반영</span>
                      </div>
                    )}
                    <p className={clsx(
                      'text-[10px] leading-snug italic',
                      diagnoseResult.target_audience === 'overseas' ? 'text-sky-100/90' : 'text-amber-100/90'
                    )}>{diagnoseResult.summary}</p>
                  </div>
                )}
                {diagnoseResult?.median_views_per_day !== undefined && (
                  <p className="text-[9px] text-gray-400">
                    채널 중앙값: <span className={clsx('font-semibold', diagnoseResult.target_audience === 'overseas' ? 'text-sky-200' : 'text-amber-200')}>{Math.round(diagnoseResult.median_views_per_day).toLocaleString()} 뷰/일</span>
                    {' · '}tier 기준: high(≥+30%) / low(≤-30%)
                  </p>
                )}
                {diagnoseResult && diagnoseResult.items.length > 0 && (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                    {diagnoseResult.items.map((it, i) => {
                      const tier = (it.tier ?? 'mid').toLowerCase();
                      const tone = tier === 'low'
                        ? 'border-red-500/30 bg-red-500/5'
                        : tier === 'high'
                          ? 'border-emerald-500/25 bg-emerald-500/5'
                          : 'border-gray-700 bg-gray-900/40';
                      const tierLabel = tier === 'low' ? '저조' : tier === 'high' ? '상위' : '평균';
                      const tierColor = tier === 'low' ? 'text-red-300' : tier === 'high' ? 'text-emerald-300' : 'text-gray-400';
                      return (
                        <div key={i} className={clsx('rounded border p-1.5', tone)}>
                          <div className="flex items-start gap-1.5">
                            <span className={clsx('text-[9px] font-bold px-1 py-0.5 rounded bg-gray-900/60', tierColor)}>{tierLabel}</span>
                            <p className="flex-1 text-[11px] font-semibold text-gray-100 line-clamp-2 leading-tight">{it.title}</p>
                            <span className="text-[9px] text-gray-500 flex-shrink-0">{(it.views ?? 0).toLocaleString()}</span>
                          </div>
                          {(it.age_days !== undefined || it.vs_median_pct !== undefined) && (
                            <div className="flex items-center gap-2 mt-1 text-[9px] flex-wrap">
                              {it.age_days !== undefined && (
                                <span className="text-gray-500">게시 {it.age_days}일</span>
                              )}
                              {it.views_per_day !== undefined && (
                                <span className="text-gray-400">{Math.round(it.views_per_day).toLocaleString()} 뷰/일</span>
                              )}
                              {it.vs_median_pct !== undefined && (
                                <span className={clsx(
                                  'px-1 py-0.5 rounded font-mono font-semibold',
                                  it.vs_median_pct >= 30 ? 'bg-emerald-500/15 text-emerald-300'
                                    : it.vs_median_pct <= -30 ? 'bg-red-500/15 text-red-300'
                                      : 'bg-gray-800/60 text-gray-300'
                                )}>
                                  중앙값 대비 {it.vs_median_pct > 0 ? '+' : ''}{it.vs_median_pct.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          )}
                          {(it.weak_points?.length ?? 0) > 0 && (
                            <div className="mt-1 pl-1 border-l border-red-500/30">
                              <p className="text-[9px] font-semibold text-red-300 uppercase tracking-wider">부족한 점</p>
                              {it.weak_points!.map((w, j) => (
                                <p key={j} className="text-[10px] text-gray-300 leading-snug">• {w}</p>
                              ))}
                            </div>
                          )}
                          {(it.suggestions?.length ?? 0) > 0 && (
                            <div className="mt-1 pl-1 border-l border-violet-500/30">
                              <p className="text-[9px] font-semibold text-violet-300 uppercase tracking-wider">개선 제안</p>
                              {it.suggestions!.map((s, j) => (
                                <p key={j} className="text-[10px] text-gray-300 leading-snug">• {s}</p>
                              ))}
                            </div>
                          )}
                          {it.reference_title && (
                            <p className="mt-1 text-[9px] text-sky-300/90">참고 상위: {it.reference_title}</p>
                          )}

                          {/* 수정안 생성 / 적용 — 저조 영상에만 노출 */}
                          {tier === 'low' && analyticsVideos.some(v => v.title === it.title) && (() => {
                            const key = it.title;
                            const prop = proposals[key];
                            const loading = proposeLoadingKey === key;
                            const applying = applyingKey === key;
                            const applied = appliedKeys[key];
                            const err = proposeError[key];
                            return (
                              <div className="mt-2 pt-1.5 border-t border-red-500/20">
                                {!prop ? (
                                  <button
                                    onClick={() => proposeForItem(it)}
                                    disabled={loading}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-violet-500/70 hover:bg-violet-400 text-white disabled:opacity-50"
                                  >
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    {diagnoseResult?.target_audience === 'overseas' ? '🌐 영문 수정안 생성' : '수정안 생성'}
                                  </button>
                                ) : (
                                  <div className="space-y-1.5">
                                    {prop.proposal.rationale && (
                                      <p className="text-[9px] text-violet-200/80 italic leading-snug">💡 {prop.proposal.rationale}</p>
                                    )}
                                    {/* 제목 diff */}
                                    <label className="flex items-start gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={prop.applyTitle}
                                             onChange={() => toggleProposalField(key, 'applyTitle')}
                                             disabled={applying || applied}
                                             className="mt-0.5 w-3 h-3 accent-violet-500" />
                                      <div className="flex-1 min-w-0 text-[10px]">
                                        <p className="text-gray-500 line-through">{prop.current.title}</p>
                                        <p className="text-violet-200 font-semibold">{prop.proposal.new_title}</p>
                                      </div>
                                    </label>
                                    {/* 설명 diff */}
                                    <label className="flex items-start gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={prop.applyDesc}
                                             onChange={() => toggleProposalField(key, 'applyDesc')}
                                             disabled={applying || applied}
                                             className="mt-0.5 w-3 h-3 accent-violet-500" />
                                      <div className="flex-1 min-w-0 text-[10px]">
                                        <p className="text-gray-500 line-clamp-1">설명: {(prop.current.description || '(비어있음)').slice(0, 40)}</p>
                                        <p className="text-violet-200 line-clamp-2">{prop.proposal.new_description}</p>
                                      </div>
                                    </label>
                                    {/* 태그 diff */}
                                    <label className="flex items-start gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={prop.applyTags}
                                             onChange={() => toggleProposalField(key, 'applyTags')}
                                             disabled={applying || applied}
                                             className="mt-0.5 w-3 h-3 accent-violet-500" />
                                      <div className="flex-1 min-w-0 text-[10px]">
                                        <p className="text-gray-500 line-clamp-1">기존 태그: {(prop.current.tags ?? []).slice(0, 6).join(', ') || '(없음)'}</p>
                                        <p className="text-violet-200 line-clamp-2">{prop.proposal.new_tags.join(', ')}</p>
                                      </div>
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                      {applied ? (
                                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                                          <CheckCircle2 className="w-3 h-3" /> 적용됨
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => applyProposal(it)}
                                          disabled={applying || !ytAuth?.has_write}
                                          title={!ytAuth?.has_write ? 'YouTube 쓰기 권한 필요 (재로그인)' : 'YouTube에 반영'}
                                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-500/80 hover:bg-rose-400 text-white disabled:opacity-50"
                                        >
                                          {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                          YouTube에 적용
                                        </button>
                                      )}
                                      <button
                                        onClick={() => proposeForItem(it)}
                                        disabled={loading || applying}
                                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-violet-500/30 text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
                                      >
                                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : '다시 생성'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {err && (
                                  <p className="mt-1 text-[10px] text-red-300">{err}</p>
                                )}
                                {tier === 'low' && !ytAuth?.has_write && prop && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <p className="text-[9px] text-amber-300 flex-1">⚠ YouTube 쓰기 권한이 필요해요</p>
                                    <button
                                      onClick={reAuthYoutubeForWrite}
                                      className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-500/80 hover:bg-amber-400 text-white"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5" />
                                      권한 추가하러 가기
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!diagnoseResult && !diagnoseLoading && !diagnoseError && (
                  <p className="text-[10px] text-amber-100/70 leading-snug">
                    내 영상 목록을 AI에게 보내 조회수 저조 원인(훅·길이·태그·업로드시간 등)과 개선안을 받아봅니다.
                  </p>
                )}
              </div>

              {/* 내 영상 전체 목록 */}
              {analyticsVideos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">내 영상</span>
                    <div className="ml-auto flex items-center gap-1">
                      <label className="flex items-center gap-1 text-[9px] text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={analyticsShortsOnly}
                               onChange={e => setAnalyticsShortsOnly(e.target.checked)}
                               className="w-3 h-3 accent-rose-500" />
                        쇼츠만
                      </label>
                      <select
                        value={analyticsSort}
                        onChange={e => setAnalyticsSort(e.target.value as 'views' | 'recent' | 'likes')}
                        className="rounded border border-gray-800 bg-gray-900/60 px-1.5 py-0.5 text-[10px] text-gray-100 focus:border-rose-500 focus:outline-none"
                      >
                        <option value="views">조회수순</option>
                        <option value="likes">좋아요순</option>
                        <option value="recent">최신순</option>
                      </select>
                    </div>
                  </div>
                  {[...analyticsVideos]
                    .filter(v => !analyticsShortsOnly || v.is_short)
                    .sort((a, b) => {
                      if (analyticsSort === 'views') return b.view_count - a.view_count;
                      if (analyticsSort === 'likes') return b.like_count - a.like_count;
                      return (b.published_at ?? '').localeCompare(a.published_at ?? '');
                    })
                    .map(v => (
                      <div key={v.id} className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/30 p-1.5">
                        {v.thumbnail && (
                          <a href={v.url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                            <img src={v.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                          </a>
                        )}
                        <div className="flex-1 min-w-0">
                          <a href={v.url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-100 hover:text-rose-300 line-clamp-2 leading-tight">
                            {v.title}
                          </a>
                          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-500">
                            <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{v.view_count.toLocaleString()}</span>
                            <span className="flex items-center gap-0.5"><ThumbsUp className="w-2.5 h-2.5" />{v.like_count.toLocaleString()}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{v.comment_count.toLocaleString()}</span>
                            {v.is_short && <span className="px-1 rounded bg-rose-500/15 text-rose-300">쇼츠</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 지역 인기 쇼츠 */}
              <div className="rounded-md border border-gray-800 bg-gray-900/30 p-2.5 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">지역 인기 쇼츠</span>
                  <select
                    value={trendingRegion}
                    onChange={e => setTrendingRegion(e.target.value)}
                    disabled={trendingLoading}
                    className="rounded border border-gray-800 bg-gray-900/60 px-1.5 py-0.5 text-[10px] text-gray-100 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="US">🇺🇸 US</option>
                    <option value="GB">🇬🇧 UK</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="BR">🇧🇷 Brazil</option>
                    <option value="MX">🇲🇽 Mexico</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="KR">🇰🇷 Korea</option>
                  </select>
                  <button
                    onClick={fetchTrending}
                    disabled={trendingLoading}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/80 hover:bg-emerald-400 text-white disabled:opacity-50"
                  >
                    {trendingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    불러오기
                  </button>
                </div>
                {trendingError && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{trendingError}</div>
                )}
                {trendingVideos.length > 0 && (
                  <div className="space-y-1">
                    {trendingVideos.map((v, i) => (
                      <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                         className="flex items-center gap-2 rounded border border-gray-800/70 bg-gray-900/40 p-1.5 hover:border-emerald-500/30">
                        <span className="flex-shrink-0 w-4 h-4 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                        {v.thumbnail && <img src={v.thumbnail} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-100 truncate">{v.title}</p>
                          <p className="text-[9px] text-gray-500 truncate">조회 {v.view_count.toLocaleString()}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>}
      </div>}

      {/* 블로그 가이드 수정 모달 */}
      {editingGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
             onClick={() => !editGuideSaving && setEditingGuide(null)}>
          <div onClick={e => e.stopPropagation()}
               className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-xl border border-gray-800 bg-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-surface-raised">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-gray-100">블로그 가이드 수정</h3>
                <span className="text-[10px] text-gray-500">#{editingGuide.id}</span>
              </div>
              <button onClick={() => setEditingGuide(null)} disabled={editGuideSaving}
                      className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">제목 *</span>
                  <input type="text" value={editingGuide.title}
                         onChange={e => setEditingGuide({ ...editingGuide, title: e.target.value })}
                         className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">Slug *</span>
                  <input type="text" value={editingGuide.slug}
                         onChange={e => setEditingGuide({ ...editingGuide, slug: e.target.value })}
                         className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">카테고리</span>
                  <input type="text" value={editingGuide.category}
                         onChange={e => setEditingGuide({ ...editingGuide, category: e.target.value })}
                         className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">상태</span>
                  <select value={editingGuide.status}
                          onChange={e => setEditingGuide({ ...editingGuide, status: e.target.value as 'draft'|'published' })}
                          className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none">
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400">제휴 URL</span>
                  <input type="text" value={editingGuide.affiliate_url}
                         onChange={e => setEditingGuide({ ...editingGuide, affiliate_url: e.target.value })}
                         placeholder="https://..."
                         className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none" />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-gray-400">태그 (쉼표 구분)</span>
                <input type="text" value={editingGuide.tagsText}
                       onChange={e => setEditingGuide({ ...editingGuide, tagsText: e.target.value })}
                       placeholder="게이밍, 추천, 가이드"
                       className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none" />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-gray-400">요약</span>
                <textarea value={editingGuide.summary} rows={2}
                          onChange={e => setEditingGuide({ ...editingGuide, summary: e.target.value })}
                          className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-100 focus:border-amber-500 focus:outline-none resize-y" />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-gray-400">본문 (Markdown)</span>
                <textarea value={editingGuide.content} rows={12}
                          onChange={e => setEditingGuide({ ...editingGuide, content: e.target.value })}
                          className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 font-mono text-[11px] text-gray-100 focus:border-amber-500 focus:outline-none resize-y" />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-gray-400">
                  본문 HTML <span className="text-gray-600 font-normal">(비우면 Markdown에서 렌더)</span>
                </span>
                <textarea value={editingGuide.content_html} rows={6}
                          onChange={e => setEditingGuide({ ...editingGuide, content_html: e.target.value })}
                          className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 font-mono text-[11px] text-gray-100 focus:border-amber-500 focus:outline-none resize-y" />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-surface-raised">
              <button onClick={() => setEditingGuide(null)} disabled={editGuideSaving}
                      className="px-4 py-1.5 text-xs font-medium rounded-md border border-gray-800 text-gray-300 hover:bg-gray-800 disabled:opacity-50">
                취소
              </button>
              <button onClick={saveEditBlogGuide} disabled={editGuideSaving}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-amber-500/90 text-white hover:bg-amber-400 disabled:opacity-50">
                {editGuideSaving ? <><Loader2 className="w-3 h-3 animate-spin" />저장 중...</> : <><Check className="w-3 h-3" />저장</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 우측: 유튜브 롱폼 자동화 패널 (40·50대 건강 채널) */}
      {isLongformProject && <div className="flex-1 min-w-0 flex flex-col border-l border-gray-800 bg-surface overflow-hidden">
        <div className="flex-shrink-0 border-b border-gray-800 bg-surface-raised">
          <div className="flex items-center px-3 pt-2 gap-1">
            <button
              onClick={() => setLongformTab('topic')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                longformTab === 'topic'
                  ? 'border-red-500 text-red-300 bg-red-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Lightbulb className="w-3 h-3" />
              주제 추천
            </button>
            <button
              onClick={() => setLongformTab('generate')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                longformTab === 'generate'
                  ? 'border-red-500 text-red-300 bg-red-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Sparkles className="w-3 h-3" />
              대본 생성
            </button>
            <button
              onClick={() => { setLongformTab('history'); fetchLongformHistory(); }}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                longformTab === 'history'
                  ? 'border-red-500 text-red-300 bg-red-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Clock className="w-3 h-3" />
              히스토리
              {longformHistory.length > 0 && <span className="text-[9px] text-red-300/80">({longformHistory.length})</span>}
            </button>
          </div>
          {/* 채널 정체성 뱃지 */}
          <div className="px-3 py-1.5 flex items-center gap-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 font-medium">40·50대 건강 실전 채널</span>
            <span className="text-[9px] text-gray-600">· 마르지 않는 에버그린 콘텐츠</span>
          </div>
        </div>

        {/* ── 주제 추천 탭 ── */}
        {longformTab === 'topic' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-red-300" />
              <span className="text-[11px] font-semibold text-red-200 uppercase tracking-wider">주제 추천기</span>
              <span className="text-[9px] text-gray-500">이미 다룬 주제 제외 · 5개 추천</span>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">카테고리 (선택)</label>
              <select
                value={longformGenre}
                onChange={e => setLongformGenre(e.target.value)}
                disabled={longformLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                <option value="">전체 카테고리 골고루</option>
                {Object.entries(LONGFORM_GENRES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchLongformTopics}
              disabled={longformLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-red-500/90 hover:bg-red-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {longformLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
              {longformLoading ? '추천 생성 중...' : '주제 추천 받기'}
            </button>
            {longformError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{longformError}</div>
            )}
          </div>

          {longformTopics.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-600">클릭하면 대본 생성으로 이동합니다</p>
              {longformTopics.map((t, i) => (
                <div key={i}
                  onClick={() => { setLongformTopic(t.title); setLongformGenre(t.category || ''); setLongformTab('generate'); }}
                  className="rounded-lg border border-gray-800 hover:border-red-500/40 bg-gray-900/40 p-3 cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-red-400/60 flex-shrink-0 pt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-200 group-hover:text-red-200 transition-colors">{t.title}</p>
                      {t.reason && <p className="text-[9px] text-gray-500 leading-snug mt-0.5">{t.reason}</p>}
                      {t.hook && (
                        <div className="mt-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1">
                          <p className="text-[9px] text-amber-300/80 leading-snug">💡 훅: {t.hook}</p>
                        </div>
                      )}
                    </div>
                    {t.category && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 flex-shrink-0">
                        {LONGFORM_GENRES[t.category] ?? t.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {longformHistory.length > 0 && (
            <div className="rounded-md border border-gray-800 bg-gray-900/30 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">이미 다룬 주제 ({longformHistory.length}개)</p>
              <div className="flex flex-wrap gap-1.5">
                {longformHistory.map(h => (
                  <span key={h.id} className="text-[9px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 line-through">{h.topic}</span>
                ))}
              </div>
            </div>
          )}
        </div>}

        {/* ── 대본 생성 탭 ── */}
        {longformTab === 'generate' && <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-red-300" />
              <span className="text-[11px] font-semibold text-red-200 uppercase tracking-wider">대본 생성기</span>
              <span className="text-[9px] text-gray-500">아웃라인 · 훅 · 대본 · SEO</span>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">주제</label>
              <textarea
                value={longformTopic}
                onChange={e => setLongformTopic(e.target.value)}
                disabled={longformLoading}
                rows={2}
                placeholder="예: 혈압약 먹기 전에 먼저 해야 할 것 3가지"
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-600 resize-none focus:border-red-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">카테고리</label>
                <select
                  value={longformGenre}
                  onChange={e => setLongformGenre(e.target.value)}
                  disabled={longformLoading}
                  className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
                >
                  {Object.entries(LONGFORM_GENRES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">목표 길이</label>
                <select
                  value={longformDuration}
                  onChange={e => setLongformDuration(Number(e.target.value))}
                  disabled={longformLoading}
                  className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
                >
                  {[5, 8, 10, 12, 15, 20, 25, 30].map(m => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={generateLongformScript}
              disabled={longformLoading || !longformTopic.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-red-500/90 hover:bg-red-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {longformLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {longformLoading ? '생성 중... (1~2분)' : '대본 + SEO 생성'}
            </button>
            {longformError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{longformError}</div>
            )}
          </div>

          {longformResult && (
            <div className="space-y-3">
              {/* 훅 라인 */}
              {longformResult.hook_line && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">첫 5초 훅 · 썸네일 카피</span>
                    <button onClick={() => longformCopy('hook', longformResult.hook_line!)}
                      className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
                      {longformCopied === 'hook' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}복사
                    </button>
                  </div>
                  <p className="text-[12px] font-semibold text-amber-200">{longformResult.hook_line}</p>
                </div>
              )}

              {/* SEO 제목 */}
              {longformResult.seo_title && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">YouTube 제목</span>
                    <button onClick={() => longformCopy('seo_title', longformResult.seo_title!)}
                      className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
                      {longformCopied === 'seo_title' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}복사
                    </button>
                  </div>
                  <p className="text-[12px] font-medium text-gray-200">{longformResult.seo_title}</p>
                </div>
              )}

              {/* 챕터 아웃라인 */}
              {longformResult.outline && longformResult.outline.length > 0 && (
                <div className="rounded-md border border-gray-700 bg-gray-900/40 p-3 space-y-2">
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">챕터 아웃라인</span>
                  <div className="space-y-1.5">
                    {longformResult.outline.map((ch, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-[10px] font-bold text-blue-400/60 flex-shrink-0 pt-0.5">{i + 1}</span>
                        <div>
                          <p className="text-[11px] font-medium text-gray-300">{ch.chapter}</p>
                          <p className="text-[10px] text-gray-500 leading-snug">{ch.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 전체 대본 */}
              {longformResult.script && (
                <div className="rounded-md border border-gray-700 bg-gray-900/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">전체 대본</span>
                    <button onClick={() => longformCopy('script', longformResult.script!)}
                      className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
                      {longformCopied === 'script' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}전체 복사
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-[10px] text-gray-300 leading-relaxed max-h-96 overflow-y-auto">
                    {longformResult.script}
                  </pre>
                </div>
              )}

              {/* SEO 설명 & 태그 */}
              {(longformResult.seo_desc || (longformResult.seo_tags && longformResult.seo_tags.length > 0)) && (
                <div className="rounded-md border border-gray-700 bg-gray-900/40 p-3 space-y-2">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">SEO</span>
                  {longformResult.seo_desc && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">설명란</span>
                        <button onClick={() => longformCopy('seo_desc', longformResult.seo_desc!)}
                          className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
                          {longformCopied === 'seo_desc' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}복사
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-snug whitespace-pre-wrap">{longformResult.seo_desc}</p>
                    </div>
                  )}
                  {longformResult.seo_tags && longformResult.seo_tags.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">태그</span>
                        <button onClick={() => longformCopy('seo_tags', longformResult.seo_tags!.join(', '))}
                          className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
                          {longformCopied === 'seo_tags' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}복사
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {longformResult.seo_tags.map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[9px]">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 다음 주제 추천 */}
              {longformResult.next_topic && (
                <div
                  onClick={() => { setLongformTopic(longformResult.next_topic!); setLongformResult(null); }}
                  className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 cursor-pointer hover:border-blue-500/40 transition-colors space-y-1"
                >
                  <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">다음 영상 추천 주제</p>
                  <p className="text-[11px] text-blue-200">{longformResult.next_topic}</p>
                  <p className="text-[9px] text-gray-600">클릭하면 이 주제로 대본 생성</p>
                </div>
              )}
            </div>
          )}
        </div>}

        {/* ── 히스토리 탭 ── */}
        {longformTab === 'history' && <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[10px] text-gray-600">총 {longformHistory.length}개 영상</span>
            <button onClick={fetchLongformHistory} disabled={longformHistLoad}
              className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
              <RefreshCw className={clsx('w-3 h-3', longformHistLoad && 'animate-spin')} />
            </button>
          </div>
          {longformHistLoad ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[10px] text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" />불러오는 중...
            </div>
          ) : longformHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-700">
              <Clock className="w-6 h-6 opacity-30" />
              <p className="text-[10px]">아직 생성 기록이 없습니다</p>
              <button onClick={() => setLongformTab('topic')}
                className="text-[10px] text-red-400 hover:text-red-300">주제 추천받기 →</button>
            </div>
          ) : longformHistory.map(h => (
            <div key={h.id}
              onClick={() => loadLongformHistory(h)}
              className={clsx(
                'rounded-lg border p-3 cursor-pointer transition-all space-y-1.5',
                longformActiveId === h.id ? 'border-red-500/50 bg-red-500/5' : 'border-gray-800 hover:border-gray-700 bg-gray-900/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium text-gray-300 leading-snug flex-1">{h.seo_title || h.topic}</p>
                <button onClick={e => { e.stopPropagation(); deleteLongformHistory(h.id); }}
                  className="p-1 text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {h.category && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">
                    {LONGFORM_GENRES[h.category] ?? h.category}
                  </span>
                )}
                {h.duration_min && <span className="text-[9px] text-gray-600">{h.duration_min}분</span>}
                {h.outline && <span className="text-[9px] text-blue-400/70">챕터 {h.outline.length}개</span>}
                {h.created_at && (
                  <span className="text-[9px] text-gray-700 ml-auto">
                    {format(parseISO(h.created_at), 'MM/dd HH:mm', { locale: ko })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>}
      </div>}

      {/* 우측: 디자인 관리 패널 — 디자인 프로젝트 전용 */}
      {isDesignProject && <div className="w-80 flex-shrink-0 flex flex-col border-l border-gray-800 bg-surface overflow-hidden">
        {/* 탭 헤더 */}
        <div className="flex-shrink-0 border-b border-gray-800 bg-surface-raised">
          <div className="flex items-center px-3 pt-2 gap-1">
            <button
              onClick={() => setDesignPanel('designs')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                designPanel === 'designs'
                  ? 'border-purple-400 text-purple-300 bg-purple-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}>
              <Zap className="w-3 h-3" />
              디자인
              {allTotal > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-purple-400/15 text-purple-400">{allTotal}</span>
              )}
            </button>
            <button
              onClick={() => { setDesignPanel('requests'); if (designRequests.length === 0) fetchDesignRequests(); }}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                designPanel === 'requests'
                  ? 'border-yellow-400 text-yellow-300 bg-yellow-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}>
              <GitPullRequest className="w-3 h-3" />
              신청
              {designRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-400/15 text-yellow-400">
                  {designRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => designPanel === 'designs' ? fetchAllDesigns() : fetchDesignRequests()}
              disabled={designPanel === 'designs' ? allLoading : requestsLoading}
              className="p-1 text-gray-600 hover:text-gray-300 transition-colors mb-1">
              <RefreshCw className={clsx('w-3 h-3', (allLoading || requestsLoading) && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 디자인 탭 */}
        {designPanel === 'designs' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {allLoading && allDesigns.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[10px] text-gray-600">
                <Loader2 className="w-3 h-3 animate-spin" />불러오는 중...
              </div>
            ) : allDesigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-700">
                <Zap className="w-6 h-6 opacity-30" />
                <p className="text-[10px]">아직 게시된 디자인이 없습니다</p>
              </div>
            ) : (
              allDesigns.map(d => (
                <div key={d.id}
                  className="group relative rounded-lg border border-gray-800 hover:border-gray-700 overflow-hidden bg-gray-900/40 transition-all">
                  {/* 썸네일 */}
                  <div className="aspect-video overflow-hidden bg-gray-900 relative">
                    {d.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.image_url} alt={d.title}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Zap className="w-5 h-5 text-gray-700" />
                      </div>
                    )}
                    {/* 호버 오버레이 */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <a href={`https://ui-syntax.com/design/${d.slug}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[10px] font-medium transition-colors">
                        <ExternalLink className="w-3 h-3" />사이트
                      </a>
                      <button
                        onClick={() => deleteDesign(d.id)}
                        disabled={deletingId === d.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-300 text-[10px] font-medium transition-colors disabled:opacity-50">
                        {deletingId === d.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                        삭제
                      </button>
                    </div>
                    {/* 점수 배지 */}
                    {d.quality_score != null && (
                      <div className={clsx(
                        'absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded',
                        d.quality_score >= 90 ? 'bg-emerald-500/90 text-white' :
                        d.quality_score >= 75 ? 'bg-blue-500/90 text-white' :
                        'bg-gray-700/90 text-gray-300'
                      )}>
                        {d.quality_score}pt
                      </div>
                    )}
                  </div>
                  {/* 메타 */}
                  <div className="px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-gray-300 truncate">{d.title}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-purple-400/70">{d.category}</span>
                      <span className="text-[9px] text-gray-600">{format(parseISO(d.created_at), 'MM/dd HH:mm')}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 신청 탭 */}
        {designPanel === 'requests' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 상태 필터 */}
            <div className="flex gap-1 px-3 py-2 border-b border-gray-800/60 flex-shrink-0 overflow-x-auto">
              {(['all', 'pending', 'in_progress', 'completed', 'rejected'] as const).map(s => {
                const labels: Record<string, string> = { all:'전체', pending:'대기', in_progress:'진행', completed:'완료', rejected:'거절' };
                const colors: Record<string, string> = {
                  all:        reqStatusFilter === 'all'        ? 'bg-gray-600 text-gray-200'         : 'text-gray-600 hover:text-gray-400',
                  pending:    reqStatusFilter === 'pending'    ? 'bg-yellow-500/20 text-yellow-300'  : 'text-gray-600 hover:text-yellow-400',
                  in_progress:reqStatusFilter === 'in_progress'? 'bg-blue-500/20 text-blue-300'     : 'text-gray-600 hover:text-blue-400',
                  completed:  reqStatusFilter === 'completed'  ? 'bg-emerald-500/20 text-emerald-300': 'text-gray-600 hover:text-emerald-400',
                  rejected:   reqStatusFilter === 'rejected'   ? 'bg-red-500/20 text-red-300'       : 'text-gray-600 hover:text-red-400',
                };
                return (
                  <button key={s} onClick={() => setReqStatusFilter(s)}
                    className={clsx('flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full transition-colors', colors[s])}>
                    {labels[s]}
                    {s !== 'all' && (
                      <span className="ml-0.5 opacity-60">
                        {designRequests.filter(r => r.status === s).length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 신청 목록 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {requestsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-[10px] text-gray-600">
                  <Loader2 className="w-3 h-3 animate-spin" />불러오는 중...
                </div>
              ) : designRequests.filter(r => reqStatusFilter === 'all' || r.status === reqStatusFilter).length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-700">
                  <GitPullRequest className="w-6 h-6 opacity-30" />
                  <p className="text-[10px]">신청 내역이 없습니다</p>
                </div>
              ) : (
                designRequests
                  .filter(r => reqStatusFilter === 'all' || r.status === reqStatusFilter)
                  .map(r => {
                    const statusMeta: Record<DesignRequest['status'], { label: string; cls: string }> = {
                      pending:    { label:'대기', cls:'bg-yellow-400/10 text-yellow-400' },
                      in_progress:{ label:'진행', cls:'bg-blue-400/10 text-blue-400' },
                      completed:  { label:'완료', cls:'bg-emerald-400/10 text-emerald-400' },
                      rejected:   { label:'거절', cls:'bg-red-400/10 text-red-400' },
                    };
                    const sm = statusMeta[r.status];
                    const isUpdating = updatingReqId === r.id;
                    return (
                      <div key={r.id}
                        className="rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/30 p-2.5 transition-colors">
                        {/* 제목 + 상태 */}
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <p className="text-[10px] font-medium text-gray-300 leading-tight flex-1 min-w-0 truncate">{r.title}</p>
                          <span className={clsx('flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium', sm.cls)}>
                            {sm.label}
                          </span>
                        </div>
                        {/* 카테고리 + 투표 + 날짜 */}
                        <div className="flex items-center gap-2 mb-2">
                          {r.category && (
                            <span className="text-[9px] text-purple-400/70">{r.category}</span>
                          )}
                          {r.vote_count != null && r.vote_count > 0 && (
                            <span className="text-[9px] text-gray-500">↑{r.vote_count}</span>
                          )}
                          <span className="text-[9px] text-gray-700 ml-auto">{format(parseISO(r.created_at), 'MM/dd')}</span>
                        </div>
                        {/* 상태 변경 버튼 */}
                        <div className="flex gap-1 flex-wrap">
                          {r.status !== 'in_progress' && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(r.id, 'in_progress')}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 transition-colors">
                              진행
                            </button>
                          )}
                          {r.status !== 'completed' && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(r.id, 'completed')}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors">
                              완료
                            </button>
                          )}
                          {r.status !== 'rejected' && r.status !== 'completed' && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(r.id, 'rejected')}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors">
                              거절
                            </button>
                          )}
                          {r.status !== 'pending' && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(r.id, 'pending')}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-500 hover:bg-gray-700 disabled:opacity-40 transition-colors">
                              되돌리기
                            </button>
                          )}
                          {isUpdating && <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-500 self-center" />}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>}

      {/* ── 알면 편함 패널 ── */}
      {isAlmyeonProject && <div className="flex-1 min-w-0 flex flex-col border-l border-gray-800 bg-surface overflow-hidden">
        <div className="flex-shrink-0 border-b border-gray-800 bg-surface-raised">
          <div className="flex items-center px-3 pt-2 gap-1">
            <button
              onClick={() => setAlmyeonTab('seo')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                almyeonTab === 'seo'
                  ? 'border-sky-400 text-sky-300 bg-sky-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <TrendingUp className="w-3 h-3" />
              SEO 추천
            </button>
            <button
              onClick={() => setAlmyeonTab('video')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                almyeonTab === 'video'
                  ? 'border-sky-400 text-sky-300 bg-sky-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Sparkles className="w-3 h-3" />
              영상 프롬프트
            </button>
            <button
              onClick={() => setAlmyeonTab('3tips')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                almyeonTab === '3tips'
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Sparkles className="w-3 h-3" />
              3팁 영상
            </button>
            <button
              onClick={() => setAlmyeonTab('concat')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                almyeonTab === 'concat'
                  ? 'border-sky-400 text-sky-300 bg-sky-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Package className="w-3 h-3" />
              영상 합치기
            </button>
            <button
              onClick={() => setAlmyeonTab('product')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                almyeonTab === 'product'
                  ? 'border-violet-400 text-violet-300 bg-violet-400/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <ShoppingCart className="w-3 h-3" />
              상품 영상 제작
            </button>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 font-medium">알면 편함</span>
            <span className="text-[9px] text-gray-600">· 실용 정보 · 생활 꿀팁</span>
          </div>
        </div>

        {/* ── SEO 추천 탭 ── */}
        {almyeonTab === 'seo' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              <span className="text-[11px] font-semibold text-sky-200 uppercase tracking-wider">한국어 SEO 생성기</span>
              {(almyeonSeoTitle) && (
                <button
                  onClick={() => { setAlmyeonSeoTitle(''); setAlmyeonSeoDesc(''); setAlmyeonSeoTags([]); setAlmyeonSeoError(null); }}
                  className="ml-auto text-[9px] text-gray-500 hover:text-gray-300"
                >초기화</button>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">영상 주제</label>
              <textarea
                value={almyeonSeoTopic}
                onChange={e => setAlmyeonSeoTopic(e.target.value)}
                disabled={almyeonSeoLoading}
                rows={3}
                placeholder="예: 편의점 도시락을 더 맛있게 먹는 방법&#10;예: 아이폰 배터리 오래 쓰는 설정 3가지"
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-600 resize-none focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              onClick={almyeonGenerateSeo}
              disabled={almyeonSeoLoading || !almyeonSeoTopic.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-sky-500/90 hover:bg-sky-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {almyeonSeoLoading
                ? <><Loader2 className="w-3 h-3 animate-spin" />Claude가 만들고 있어요...</>
                : <><Sparkles className="w-3 h-3" />제목 · 설명 · 태그 생성</>}
            </button>
            {almyeonSeoError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{almyeonSeoError}</div>
            )}
          </div>

          {almyeonSeoTitle && !almyeonSeoLoading && (
            <>
              {/* 제목 */}
              <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-gray-800">
                  <span className="text-[10px] font-semibold text-sky-200">제목</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-500">{almyeonSeoTitle.length}자</span>
                    <button
                      onClick={() => almyeonCopy('title', almyeonSeoTitle)}
                      className={clsx(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                        almyeonSeoCopied === 'title'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-sky-400'
                      )}
                    >
                      {almyeonSeoCopied === 'title' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                    </button>
                  </div>
                </div>
                <p className="px-2.5 py-1.5 text-[11px] text-gray-100 break-words">{almyeonSeoTitle}</p>
              </div>

              {/* 설명 */}
              <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-gray-800">
                  <span className="text-[10px] font-semibold text-sky-200">설명</span>
                  <button
                    onClick={() => almyeonCopy('desc', almyeonSeoDesc)}
                    className={clsx(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                      almyeonSeoCopied === 'desc'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-sky-400'
                    )}
                  >
                    {almyeonSeoCopied === 'desc' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                  </button>
                </div>
                <pre className="px-2.5 py-1.5 text-[10px] leading-relaxed text-gray-100 whitespace-pre-wrap break-words font-sans max-h-48 overflow-y-auto">{almyeonSeoDesc}</pre>
              </div>

              {/* 태그 */}
              {almyeonSeoTags.length > 0 && (
                <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-1 border-b border-gray-800">
                    <span className="text-[10px] font-semibold text-sky-200">태그 ({almyeonSeoTags.length})</span>
                    <button
                      onClick={() => almyeonCopy('tags', almyeonSeoTags.join(' '))}
                      className={clsx(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                        almyeonSeoCopied === 'tags'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-sky-400'
                      )}
                    >
                      {almyeonSeoCopied === 'tags' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                    </button>
                  </div>
                  <div className="px-2.5 py-1.5 flex flex-wrap gap-1">
                    {almyeonSeoTags.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => almyeonCopy('all', `${almyeonSeoTitle}\n\n${almyeonSeoDesc}`)}
                className={clsx(
                  'w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium border transition-colors',
                  almyeonSeoCopied === 'all'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-sky-400'
                )}
              >
                {almyeonSeoCopied === 'all' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />제목+설명 한 번에 복사</>}
              </button>
            </>
          )}
        </div>}

        {/* ── 영상 프롬프트 탭 ── */}
        {almyeonTab === 'video' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              <span className="text-[11px] font-semibold text-sky-200 uppercase tracking-wider">Grok Aurora 프롬프트</span>
              <span className="text-[9px] text-gray-500">실제 시연 강제 적용</span>
              {almyeonVidResult && (
                <button
                  onClick={() => { setAlmyeonVidResult(null); setAlmyeonVidError(null); }}
                  className="ml-auto text-[9px] text-gray-500 hover:text-gray-300"
                >초기화</button>
              )}
            </div>

            {/* 프롬프트 엔지니어링 규칙 뱃지 */}
            <div className="rounded border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 space-y-2">
              <p className="text-[9px] font-semibold text-amber-300 uppercase tracking-wider">적용된 프롬프트 규칙</p>
              <div className="space-y-1">
                <p className="text-[8px] font-semibold text-sky-400/70 uppercase tracking-wider">Aurora 메카닉스</p>
                <ul className="space-y-1">
                  {([
                    ['M1 동사 정밀도', '"loops through", "cinches tight", "peels back" 등 물리적 동사 사용 — "shows", "demonstrates" 금지'],
                    ['M2 렌즈·조리개', '85mm macro f/2.8 (손 작업) / 35mm f/4 POV (기기) / 50mm f/5.6 (오버헤드) 상황별 명시'],
                    ['M3 일관성 고정어', '"camera perfectly still", "no lighting change", "continuous uninterrupted motion" 삽입'],
                    ['M4 재료 물리학', '"stiff hemp cord that springs back", "papery skin that flakes" 등 소재 질감·물리 거동 서술'],
                    ['M5 조명 스펙', '5200K / 상단 좌측 / +0.3 EV 오버 / 작업면 그림자 없음 — 촬영감독 브리핑 수준'],
                    ['M6 스타일 앵커', '"Photorealistic documentary instructional footage." 첫 문장으로 출력 레지스터 고정'],
                    ['M7 오디오 힌트', '"subtle sound of rope friction" 등 — Aurora 오디오 일체형 생성으로 동작 일관성 향상'],
                  ] as [string, string][]).map(([tag, desc], i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="flex-shrink-0 text-[8px] font-bold text-sky-400 bg-sky-400/10 px-1 py-0.5 rounded mt-0.5 leading-none">{tag}</span>
                      <span className="text-[9px] text-gray-400 leading-snug">{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1 pt-1 border-t border-amber-500/10">
                <p className="text-[8px] font-semibold text-amber-400/70 uppercase tracking-wider">사실성 규칙</p>
                <ul className="space-y-1">
                  {([
                    ['R1 인체 존재', '실제 손 필수. 피부 질감·손톱. 양손 작업 시 두 손 동시 노출'],
                    ['R2 물리적 연속성', '점프컷·상태 점프 금지. 모든 전환이 물리적으로 설명 가능해야 함'],
                    ['R3 학습 최적 앵글', '오버헤드(접기) / 45°(매듭) / POV(기기) / 측면 매크로(삽입·조임)'],
                    ['R4 속도 제어', '기본 실제 속도. 세밀 동작은 half speed. 빨리감기 금지'],
                    ['R5 소품 사실성', '구체적 실물명 + 약간의 마모. 실제 가정 환경 배경'],
                    ['R6 결과 고정 노출', '완성 결과물 마지막 프레임에 정지 노출 필수'],
                  ] as [string, string][]).map(([tag, desc], i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="flex-shrink-0 text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded mt-0.5 leading-none">{tag}</span>
                      <span className="text-[9px] text-gray-400 leading-snug">{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">영상 팁 주제</label>
              <textarea
                value={almyeonVidTopic}
                onChange={e => setAlmyeonVidTopic(e.target.value)}
                disabled={almyeonVidLoading}
                rows={3}
                placeholder="예: 신발 끈 풀리지 않게 묶는 방법&#10;예: 비닐봉지 깔끔하게 묶기&#10;예: 마늘 10초 안에 까는 법"
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-600 resize-none focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              onClick={almyeonGenerateVideoPrompt}
              disabled={almyeonVidLoading || !almyeonVidTopic.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-sky-500/90 hover:bg-sky-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {almyeonVidLoading
                ? <><Loader2 className="w-3 h-3 animate-spin" />프롬프트 생성 중...</>
                : <><Sparkles className="w-3 h-3" />Grok Aurora 프롬프트 생성</>}
            </button>
            {almyeonVidError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{almyeonVidError}</div>
            )}
          </div>

          {almyeonVidResult && !almyeonVidLoading && (
            <div className="space-y-2">
              {/* 샷 정보 뱃지 */}
              <div className="flex items-center gap-2 flex-wrap">
                {almyeonVidResult.shot_type && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-medium">
                    {almyeonVidResult.shot_type}
                  </span>
                )}
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">
                  {almyeonVidResult.duration_note || '10초'}
                </span>
              </div>

              {/* 영문 프롬프트 */}
              <div className="rounded-md border border-sky-500/30 bg-gray-900/50 overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-sky-500/20 bg-sky-500/5">
                  <span className="text-[10px] font-semibold text-sky-200">Grok Aurora 프롬프트 (EN)</span>
                  <button
                    onClick={() => almyeonVidCopy('en', almyeonVidResult.prompt_en)}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors',
                      almyeonVidCopied === 'en'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
                    )}
                  >
                    {almyeonVidCopied === 'en' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                  </button>
                </div>
                <p className="px-3 py-2.5 text-[11px] leading-relaxed text-gray-100 font-mono whitespace-pre-wrap">{almyeonVidResult.prompt_en}</p>
              </div>

              {/* 한국어 요약 */}
              <div className="rounded-md border border-gray-800 bg-gray-900/30 px-3 py-2">
                <p className="text-[9px] font-semibold text-gray-500 mb-1">한국어 요약</p>
                <p className="text-[10px] leading-relaxed text-gray-400">{almyeonVidResult.prompt_ko}</p>
              </div>
            </div>
          )}
        </div>}

        {/* ── 3팁 영상 프롬프트 탭 ── */}
        {almyeonTab === '3tips' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider">3팁 쇼츠 프롬프트 생성기</span>
              <span className="text-[9px] text-gray-500">30초 = 10초×3클립</span>
              {almyeon3Result && (
                <button
                  onClick={() => { setAlmyeon3Result(null); setAlmyeon3Error(null); }}
                  className="ml-auto text-[9px] text-gray-500 hover:text-gray-300"
                >초기화</button>
              )}
            </div>

            {/* 구조 안내 뱃지 */}
            <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 space-y-1">
              <p className="text-[9px] font-semibold text-emerald-300/80 uppercase tracking-wider">클립 구조</p>
              <div className="grid grid-cols-3 gap-1 text-[8px]">
                <div className="rounded bg-gray-900/50 px-1.5 py-1 text-center">
                  <p className="font-semibold text-sky-300">0–2초</p>
                  <p className="text-gray-400">강력 훅</p>
                </div>
                <div className="rounded bg-gray-900/50 px-1.5 py-1 text-center">
                  <p className="font-semibold text-amber-300">2–8초</p>
                  <p className="text-gray-400">단계별 데모</p>
                </div>
                <div className="rounded bg-gray-900/50 px-1.5 py-1 text-center">
                  <p className="font-semibold text-emerald-300">8–10초</p>
                  <p className="text-gray-400">결과 + fade</p>
                </div>
              </div>
            </div>

            {/* 팁 입력 3개 */}
            <div className="space-y-2">
              {([0, 1, 2] as const).map((idx) => (
                <div key={idx} className="space-y-0.5">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    팁 {idx + 1}
                  </label>
                  <input
                    type="text"
                    value={almyeon3Tips[idx]}
                    onChange={e => setAlmyeon3Tips(prev => {
                      const next: [string, string, string] = [...prev] as [string, string, string];
                      next[idx] = e.target.value;
                      return next;
                    })}
                    disabled={almyeon3Loading}
                    placeholder={
                      idx === 0 ? '예: 라면 냄비에 물이 끓기 전 뚜껑 덮으면 더 빨리 끓는다' :
                      idx === 1 ? '예: 바나나 꼭지 쪽을 랩으로 감으면 2배 오래 보관 가능' :
                                  '예: 전자레인지에 음식 가운데를 비우면 균일하게 익는다'
                    }
                    className="w-full px-2.5 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={almyeon3Generate}
              disabled={almyeon3Loading || almyeon3Tips.some(t => !t.trim())}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-emerald-600/90 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {almyeon3Loading
                ? <><Loader2 className="w-3 h-3 animate-spin" />Claude가 3개 클립 만드는 중...</>
                : <><Sparkles className="w-3 h-3" />30초 쇼츠 프롬프트 생성</>}
            </button>
            {almyeon3Error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{almyeon3Error}</div>
            )}
          </div>

          {/* 결과 */}
          {almyeon3Result && !almyeon3Loading && (
            <div className="space-y-3">
              {almyeon3Result.clips.map((clip, idx) => (
                <div key={idx} className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                  {/* 클립 헤더 */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-800 bg-gray-900/60">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                    <span className="flex-1 text-[10px] font-semibold text-gray-200 truncate">{clip.tip_label}</span>
                    {clip.verified ? (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">✓ 검증됨</span>
                    ) : (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex-shrink-0">⚠ 수정됨</span>
                    )}
                  </div>

                  {/* 메타 배지 */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 flex-wrap">
                    {clip.shot_type && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">{clip.shot_type}</span>
                    )}
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{clip.duration_note || '10초'}</span>
                    {clip.hook_ko && (
                      <span className="text-[8px] text-gray-500 italic truncate max-w-[160px]">훅: {clip.hook_ko}</span>
                    )}
                  </div>

                  {/* 수정 안내 */}
                  {clip.adaptation_note && (
                    <div className="mx-2.5 mb-1 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[9px] text-amber-300">
                      {clip.adaptation_note}
                    </div>
                  )}

                  {/* 프롬프트 본문 */}
                  <div>
                    <div className="flex items-center justify-between px-2.5 py-1 border-t border-gray-800">
                      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Grok 프롬프트 (EN)</span>
                      <button
                        onClick={() => almyeon3Copy(`clip${idx}`, clip.prompt_en)}
                        className={clsx(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                          almyeon3Copied === `clip${idx}`
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-emerald-400'
                        )}
                      >
                        {almyeon3Copied === `clip${idx}` ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />복사</>}
                      </button>
                    </div>
                    <p className="px-2.5 py-2 text-[10px] leading-relaxed text-gray-200 font-mono whitespace-pre-wrap">{clip.prompt_en}</p>
                  </div>
                </div>
              ))}

              {/* 전체 복사 + footer */}
              <div className="space-y-2">
                <button
                  onClick={() => almyeon3Copy('all', almyeon3Result.clips.map((c, i) => `【클립 ${i+1} — ${c.tip_label}】\n${c.prompt_en}`).join('\n\n'))}
                  className={clsx(
                    'w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium border transition-colors',
                    almyeon3Copied === 'all'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-emerald-400'
                  )}
                >
                  {almyeon3Copied === 'all' ? <><Check className="w-2.5 h-2.5" />복사됨</> : <><Copy className="w-2.5 h-2.5" />클립 3개 전체 복사</>}
                </button>
                <p className="text-center text-[10px] text-emerald-400 font-medium">{almyeon3Result.footer}</p>
              </div>
            </div>
          )}
        </div>}

        {/* ── 영상 합치기 탭 ── */}
        {almyeonTab === 'concat' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">10초 클립 이어붙이기</p>
            <p className="text-[9px] text-gray-600">클립을 순서대로 넣으면 1080×1920 세로 영상으로 합칩니다. 최대 20개.</p>
          </div>

          <div className="space-y-2">
            {almyeonFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-2.5 py-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/15 text-sky-300 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                {f ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-100 truncate">{f.name}</p>
                      <p className="text-[9px] text-gray-500">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => almyeonSetFileAt(i, null)} disabled={almyeonLoading}
                            className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-50">
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <label className={clsx(
                    'flex-1 flex items-center gap-1.5 text-[10px] cursor-pointer transition-colors',
                    almyeonLoading ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-sky-300'
                  )}>
                    <Upload className="w-3 h-3" />
                    영상 파일 선택 (mp4, mov, webm...)
                    <input type="file" accept="video/*" className="hidden" disabled={almyeonLoading}
                           onChange={e => almyeonSetFileAt(i, e.target.files?.[0] ?? null)} />
                  </label>
                )}
                {almyeonFiles.length > 2 && (
                  <button onClick={() => almyeonRemoveSlot(i)} disabled={almyeonLoading}
                          className="p-1 text-gray-600 hover:text-red-400 disabled:opacity-50 flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={almyeonAddSlot}
              disabled={almyeonLoading || almyeonFiles.length >= 20}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded border border-dashed border-gray-700 text-gray-400 hover:text-sky-300 hover:border-sky-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3 h-3" />슬롯 추가
            </button>
            <span className="text-[9px] text-gray-600">{almyeonFiles.filter(Boolean).length} / {almyeonFiles.length} 선택됨</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={almyeonSubmitConcat}
              disabled={almyeonLoading || almyeonFiles.filter(Boolean).length < 2}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-sky-500/90 hover:bg-sky-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {almyeonLoading ? <><Loader2 className="w-3 h-3 animate-spin" />처리 중...</> : <><Package className="w-3 h-3" />이어붙이기</>}
            </button>
            <button
              onClick={almyeonResetConcat}
              disabled={almyeonLoading}
              className="px-3 py-2 text-[11px] font-medium rounded-md border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 disabled:opacity-50"
            >
              초기화
            </button>
          </div>

          {almyeonLoading && (
            <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2.5 text-[11px] text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
              {almyeonStatus || 'ffmpeg로 재인코딩 중...'}
            </div>
          )}

          {almyeonError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 break-all">
              {almyeonError}
            </div>
          )}

          {almyeonResultUrl && !almyeonLoading && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/10">
                <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">완성된 영상</span>
                <a href={almyeonResultUrl} download={almyeonResultName}
                   className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                  <Download className="w-2.5 h-2.5" />다운로드
                </a>
              </div>
              <div className="p-2">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={almyeonResultUrl} controls className="w-full rounded max-h-64 bg-black" />
                <p className="mt-1 text-[9px] text-gray-500 truncate">{almyeonResultName}</p>
              </div>
            </div>
          )}
        </div>}

        {/* ── 상품 영상 제작 (단계별) ── */}
        {almyeonTab === 'product' && <div className="flex-1 overflow-y-auto p-4 space-y-0">

          {/* ─── STEP 1: 상품 정보 ─────────────────────────────── */}
          <div className="relative pl-8 pb-6">
            <div className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-800" />
            <div className={clsx(
              'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors',
              almyeonScriptProduct.trim()
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-violet-500 bg-violet-500/10 text-violet-300'
            )}>
              {almyeonScriptProduct.trim() ? <Check className="w-3 h-3" /> : '1'}
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-semibold text-gray-200">상품 정보</span>
              {almyeonScriptProduct.trim() && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 truncate max-w-[140px]">
                  {almyeonScriptProduct}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <input
                value={almyeonScriptProduct}
                onChange={e => setAlmyeonScriptProduct(e.target.value)}
                placeholder="상품명 *  예: 샤오미 에어프라이어 5L"
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded-md text-[11px] text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              />
              <input
                value={almyeonScriptPrice}
                onChange={e => setAlmyeonScriptPrice(e.target.value)}
                placeholder="가격 (선택)  예: 49,900원"
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded-md text-[11px] text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
              />

              {/* 소스 선택 토글 */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setAlmyeonTrendOpen(v => !v); setAlmyeonBsOpen(false); }}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded border transition-colors',
                    almyeonTrendOpen
                      ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                  )}
                >
                  <Sparkles className="w-2.5 h-2.5" />AI 트렌드 추천
                </button>
                <button
                  onClick={() => { setAlmyeonBsOpen(v => !v); setAlmyeonTrendOpen(false); }}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded border transition-colors',
                    almyeonBsOpen
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                  )}
                >
                  <ShoppingCart className="w-2.5 h-2.5" />베스트셀러 검색
                </button>
              </div>

              {/* AI 트렌드 추천 패널 */}
              {almyeonTrendOpen && (
                <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-violet-400 font-semibold">Claude가 지금 뜨는 상품을 추천합니다</p>
                    <button
                      onClick={almyeonFetchTrending}
                      disabled={almyeonTrendLoading}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-violet-500/80 hover:bg-violet-400 text-white disabled:opacity-50"
                    >
                      {almyeonTrendLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                      {almyeonTrendItems.length > 0 ? '새로고침' : '탐색 시작'}
                    </button>
                  </div>
                  {almyeonTrendError && <p className="text-[10px] text-red-400">{almyeonTrendError}</p>}
                  {almyeonTrendLoading && (
                    <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />Claude가 트렌드를 분석 중...
                    </p>
                  )}
                  {almyeonTrendItems.length > 0 && !almyeonTrendLoading && (
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {almyeonTrendItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => almyeonTrendSelectItem(item)}
                          className="w-full flex items-start gap-2 px-2 py-2 rounded border border-gray-800 bg-gray-900/40 hover:border-violet-500/40 hover:bg-violet-500/5 text-left transition-colors"
                        >
                          <span className="flex-shrink-0 text-[9px] text-violet-400 font-bold w-4 mt-0.5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-gray-100 font-medium">{item.name}</span>
                              <span className="text-[8px] px-1 py-0.5 rounded bg-gray-800 text-gray-500">{item.category}</span>
                              {item.price_range && (
                                <span className="text-[8px] text-violet-400">{item.price_range}</span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-500 mt-0.5 truncate">{item.reason}</p>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                            <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">{item.video_type}</span>
                            <span className="text-[8px] text-gray-600">{item.hook_style}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 쿠팡 베스트셀러 검색 패널 */}
              {almyeonBsOpen && (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={almyeonBsCategory}
                      onChange={e => setAlmyeonBsCategory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && almyeonFetchBestSellers()}
                      disabled={almyeonBsLoading}
                      placeholder="카테고리 ID  예: 1001"
                      className="flex-1 px-2.5 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={almyeonFetchBestSellers}
                      disabled={almyeonBsLoading || !almyeonBsCategory.trim()}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded bg-amber-500/80 hover:bg-amber-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {almyeonBsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      수집
                    </button>
                  </div>
                  {almyeonBsError && <p className="text-[10px] text-red-400">{almyeonBsError}</p>}
                  {almyeonBsLoading && (
                    <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />크롤링 중...
                    </p>
                  )}
                  {almyeonBsItems.length > 0 && !almyeonBsLoading && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {almyeonBsItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => { almyeonBsSelectItem(item); setAlmyeonBsOpen(false); }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-gray-800 bg-gray-900/40 hover:border-amber-500/40 hover:bg-amber-500/5 text-left transition-colors"
                        >
                          <span className="flex-shrink-0 text-[9px] text-amber-400 font-bold w-4">{i + 1}</span>
                          <span className="flex-1 text-[10px] text-gray-200 truncate">{item.name}</span>
                          {item.price != null && (
                            <span className="flex-shrink-0 text-[9px] text-amber-300">{item.price.toLocaleString()}원</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── STEP 2: 스크립트 생성 ──────────────────────────── */}
          <div className={clsx('relative pl-8 pb-6 transition-opacity', !almyeonScriptProduct.trim() && 'opacity-40 pointer-events-none')}>
            <div className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-800" />
            <div className={clsx(
              'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors',
              almyeonScriptResult
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-violet-500/60 bg-violet-500/10 text-violet-400'
            )}>
              {almyeonScriptResult ? <Check className="w-3 h-3" /> : '2'}
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-semibold text-gray-200">영상 설정 &amp; 스크립트 생성</span>
              {almyeonScriptResult && (
                <button
                  onClick={() => { setAlmyeonScriptResult(null); setAlmyeonScriptError(null); setAlmyeonDescResult(''); }}
                  className="text-[9px] text-gray-600 hover:text-gray-400"
                >재생성</button>
              )}
            </div>
            <div className="space-y-2.5">
              {/* 영상 유형 버튼 그룹 */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">영상 유형</p>
                <div className="flex gap-1.5">
                  {(['gadget', 'lifehack', 'comparison'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setAlmyeonScriptVideoType(v)}
                      className={clsx(
                        'flex-1 py-1.5 text-[10px] font-medium rounded border transition-colors',
                        almyeonScriptVideoType === v
                          ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                          : 'border-gray-700 bg-gray-900/40 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                      )}
                    >
                      {v === 'gadget' ? '가전/IT' : v === 'lifehack' ? '생활팁' : '비교'}
                    </button>
                  ))}
                </div>
              </div>
              {/* 훅 스타일 버튼 그룹 */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">훅 스타일</p>
                <div className="flex flex-wrap gap-1">
                  {([
                    ['trust',    '엔지니어 경험'],
                    ['warning',  '모르면 손해'],
                    ['reversal', '비싼 거 말고'],
                    ['fact',     '오해 깨기'],
                    ['shock',    '이 행동이 잘못'],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setAlmyeonScriptHookStyle(v)}
                      className={clsx(
                        'px-2 py-1 text-[10px] font-medium rounded border transition-colors',
                        almyeonScriptHookStyle === v
                          ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                          : 'border-gray-700 bg-gray-900/40 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                      )}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {/* 생성 버튼 */}
              <button
                onClick={almyeonGenerateScript}
                disabled={almyeonScriptLoading || !almyeonScriptProduct.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-md bg-violet-500/90 hover:bg-violet-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {almyeonScriptLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" />Claude가 작성 중...</>
                  : <><Sparkles className="w-3 h-3" />스크립트 생성</>}
              </button>
              {almyeonScriptError && <p className="text-[10px] text-red-400">{almyeonScriptError}</p>}
            </div>
            {/* 결과 */}
            {almyeonScriptResult && !almyeonScriptLoading && (() => {
              const r = almyeonScriptResult;
              return (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">{r.estimated_length}초</span>
                    {r.tags?.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">#{t}</span>
                    ))}
                  </div>
                  {([
                    ['제목',      r.title],
                    ['썸네일',    r.thumbnail_text],
                    ['훅',        r.hook],
                    ['본론',      r.body],
                    ['CTA',       r.cta],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded border border-gray-800 bg-gray-900/40 overflow-hidden">
                      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800">
                        <span className="text-[9px] font-semibold text-violet-300">{label}</span>
                        <button
                          onClick={() => almyeonScriptCopy(label, value)}
                          className={clsx(
                            'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border transition-colors',
                            almyeonScriptCopied === label
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-gray-700 text-gray-400 hover:border-violet-400'
                          )}
                        >
                          {almyeonScriptCopied === label ? <><Check className="w-2 h-2" />복사됨</> : <><Copy className="w-2 h-2" />복사</>}
                        </button>
                      </div>
                      <p className="px-2 py-1.5 text-[10px] text-gray-200 whitespace-pre-wrap leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ─── STEP 3: 설명란 완성 ────────────────────────────── */}
          <div className={clsx('relative pl-8 pb-2 transition-opacity', !almyeonScriptResult && 'opacity-40 pointer-events-none')}>
            <div className={clsx(
              'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors',
              almyeonDescResult
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-teal-500/60 bg-teal-500/10 text-teal-400'
            )}>
              {almyeonDescResult ? <Check className="w-3 h-3" /> : '3'}
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-semibold text-gray-200">설명란 완성</span>
            </div>
            <div className="space-y-2">
              <input
                value={almyeonDescCoupangUrl}
                onChange={e => setAlmyeonDescCoupangUrl(e.target.value)}
                disabled={almyeonDescLoading}
                placeholder="쿠팡파트너스 URL *  https://link.coupang.com/a/..."
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded-md text-[11px] text-gray-200 placeholder-gray-600 focus:border-teal-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-500 whitespace-nowrap">영상 길이</span>
                <input
                  type="range"
                  min={30} max={600} step={10}
                  value={almyeonDescVideoLength}
                  onChange={e => setAlmyeonDescVideoLength(Number(e.target.value))}
                  disabled={almyeonDescLoading}
                  className="flex-1 accent-teal-400 h-1"
                />
                <span className="text-[10px] text-teal-300 font-semibold w-10 text-right">
                  {Math.floor(almyeonDescVideoLength / 60)}:{String(almyeonDescVideoLength % 60).padStart(2, '0')}
                </span>
              </div>
              <button
                onClick={almyeonBuildDescription}
                disabled={almyeonDescLoading || !almyeonScriptResult || !almyeonDescCoupangUrl.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-md bg-teal-500/90 hover:bg-teal-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {almyeonDescLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" />생성 중...</>
                  : <><AlignLeft className="w-3 h-3" />설명란 완성</>}
              </button>
              {almyeonDescError && <p className="text-[10px] text-red-400">{almyeonDescError}</p>}
            </div>
            {almyeonDescResult && !almyeonDescLoading && (
              <div className="mt-3 rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800">
                  <span className="text-[9px] font-semibold text-teal-300 uppercase tracking-wider">완성된 설명란</span>
                  <button
                    onClick={almyeonDescCopy}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium border transition-colors',
                      almyeonDescCopied
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-gray-700 text-gray-400 hover:border-teal-400'
                    )}
                  >
                    {almyeonDescCopied ? <><Check className="w-2 h-2" />복사됨</> : <><Copy className="w-2 h-2" />전체 복사</>}
                  </button>
                </div>
                <pre className="px-2.5 py-2 text-[10px] text-gray-300 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
                  {almyeonDescResult}
                </pre>
              </div>
            )}
          </div>

          {/* ─── STEP 4: Grok 클립 프롬프트 ─────────────────────── */}
          <div className={clsx('relative pl-8 pb-2 transition-opacity', !almyeonScriptResult && 'opacity-40 pointer-events-none')}>
            <div className={clsx(
              'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors',
              almyeonGrokClips.length > 0
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-orange-500/60 bg-orange-500/10 text-orange-400'
            )}>
              {almyeonGrokClips.length > 0 ? <Check className="w-3 h-3" /> : '4'}
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-semibold text-gray-200">Grok 클립 프롬프트</span>
              {almyeonScriptResult && (
                <span className="text-[9px] text-gray-600">
                  {Math.round(almyeonDescVideoLength / 10)}개 × 10초
                </span>
              )}
              {almyeonGrokClips.length > 0 && (
                <button
                  onClick={() => { setAlmyeonGrokClips([]); setAlmyeonGrokError(null); }}
                  className="text-[9px] text-gray-600 hover:text-gray-400"
                >재생성</button>
              )}
            </div>
            <div className="space-y-2">
              {/* 영상 길이 공유 안내 */}
              <p className="text-[9px] text-gray-600">
                영상 길이는 3단계 설정({Math.floor(almyeonDescVideoLength / 60)}:{String(almyeonDescVideoLength % 60).padStart(2, '0')})을 그대로 사용합니다.
              </p>
              <button
                onClick={almyeonGenerateGrokClips}
                disabled={almyeonGrokLoading || !almyeonScriptResult}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold rounded-md bg-orange-500/80 hover:bg-orange-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {almyeonGrokLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" />Claude가 클립 분할 중...</>
                  : <><Camera className="w-3 h-3" />Grok 클립 생성</>}
              </button>
              {almyeonGrokError && <p className="text-[10px] text-red-400">{almyeonGrokError}</p>}
            </div>

            {/* 클립 결과 */}
            {almyeonGrokClips.length > 0 && !almyeonGrokLoading && (
              <div className="mt-3 space-y-2">
                {almyeonGrokClips.map((clip) => (
                  <div key={clip.clip_no} className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                    {/* 클립 헤더 */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800 bg-orange-500/5">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/15 text-orange-300 text-[9px] font-bold flex items-center justify-center">
                          {clip.clip_no}
                        </span>
                        <span className="text-[10px] font-semibold text-orange-200">{clip.section}</span>
                        <span className="text-[9px] text-gray-600">{clip.time_range}</span>
                        <span className="text-[8px] px-1 py-0.5 rounded bg-gray-800 text-gray-500">{clip.shot_type}</span>
                      </div>
                      <button
                        onClick={() => almyeonGrokCopy(clip.clip_no, clip.prompt_en)}
                        className={clsx(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border transition-colors',
                          almyeonGrokCopied === clip.clip_no
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-gray-700 text-gray-400 hover:border-orange-400'
                        )}
                      >
                        {almyeonGrokCopied === clip.clip_no ? <><Check className="w-2 h-2" />복사됨</> : <><Copy className="w-2 h-2" />EN 복사</>}
                      </button>
                    </div>
                    {/* 영문 프롬프트 */}
                    <p className="px-2.5 py-2 text-[10px] text-gray-200 leading-relaxed">{clip.prompt_en}</p>
                    {/* 한국어 요약 */}
                    {clip.prompt_ko && (
                      <p className="px-2.5 pb-2 text-[9px] text-gray-500 leading-relaxed border-t border-gray-800/50 pt-1.5">
                        {clip.prompt_ko}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>}
      </div>}

      {/* ── X 알티클 패널 ── */}
      {isXArticleProject && <div className="flex-1 min-w-0 flex flex-col border-l border-gray-800 bg-surface overflow-hidden">
        <div className="flex-shrink-0 border-b border-gray-800 bg-surface-raised">
          <div className="flex items-center px-3 pt-2 gap-1">
            <button
              onClick={() => setXArticleTab('topic')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                xArticleTab === 'topic'
                  ? 'border-[#1d9bf0] text-[#60b8f8] bg-[#1d9bf0]/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Lightbulb className="w-3 h-3" />
              주제 추천
            </button>
            <button
              onClick={() => setXArticleTab('generate')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                xArticleTab === 'generate'
                  ? 'border-[#1d9bf0] text-[#60b8f8] bg-[#1d9bf0]/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Sparkles className="w-3 h-3" />
              알티클 생성
            </button>
            <button
              onClick={() => { setXArticleTab('history'); fetchXArticleHistory(); }}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg border-b-2 transition-colors',
                xArticleTab === 'history'
                  ? 'border-[#1d9bf0] text-[#60b8f8] bg-[#1d9bf0]/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              <Clock className="w-3 h-3" />
              히스토리
              {xArticleHistory.length > 0 && <span className="text-[9px] text-[#60b8f8]/80">({xArticleHistory.length})</span>}
            </button>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1d9bf0]/10 text-[#60b8f8] font-medium">AI 자동화 실전 채널</span>
            <span className="text-[9px] text-gray-600">· X 알티클 (구 트위터 아티클)</span>
          </div>
        </div>

        {/* ── 주제 추천 탭 ── */}
        {xArticleTab === 'topic' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-md border border-[#1d9bf0]/30 bg-[#1d9bf0]/5 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-[#60b8f8]" />
              <span className="text-[11px] font-semibold text-[#93d1ff] uppercase tracking-wider">주제 추천기</span>
              <span className="text-[9px] text-gray-500">이미 다룬 주제 제외 · 5개 추천</span>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">카테고리 (선택)</label>
              <select
                value={xArticleCategory}
                onChange={e => setXArticleCategory(e.target.value)}
                disabled={xArticleLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                <option value="">전체 카테고리 골고루</option>
                {Object.entries(X_ARTICLE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchXArticleTopics}
              disabled={xArticleLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-[#1d9bf0]/90 hover:bg-[#1d9bf0] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {xArticleLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
              {xArticleLoading ? '추천 생성 중...' : '주제 추천 받기'}
            </button>
            {xArticleError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{xArticleError}</div>
            )}
          </div>

          {xArticleTopics.length > 0 && (
            <div className="space-y-2">
              {xArticleTopics.map((t, i) => (
                <div key={i} className="rounded-md border border-gray-800 bg-gray-900/40 p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-gray-200">{t.title}</span>
                    <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-[#1d9bf0]/10 text-[#60b8f8]">
                      {X_ARTICLE_CATEGORIES[t.category] ?? t.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">{t.reason}</p>
                  {t.hook && <p className="text-[10px] text-[#60b8f8]/70 italic">&ldquo;{t.hook}&rdquo;</p>}
                  <button
                    onClick={() => { setXArticleTopic(t.title); setXArticleCategory(t.category); setXArticleTab('generate'); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-[#1d9bf0]/30 text-[#60b8f8] hover:bg-[#1d9bf0]/10 transition-colors"
                  >
                    <Sparkles className="w-2.5 h-2.5" />이 주제로 알티클 생성
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* ── 알티클 생성 탭 ── */}
        {xArticleTab === 'generate' && <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-md border border-[#1d9bf0]/30 bg-[#1d9bf0]/5 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#60b8f8]" />
              <span className="text-[11px] font-semibold text-[#93d1ff] uppercase tracking-wider">알티클 생성기</span>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">카테고리</label>
              <select
                value={xArticleCategory}
                onChange={e => setXArticleCategory(e.target.value)}
                disabled={xArticleLoading}
                className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200"
              >
                {Object.entries(X_ARTICLE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">주제</label>
              <textarea
                value={xArticleTopic}
                onChange={e => setXArticleTopic(e.target.value)}
                disabled={xArticleLoading}
                rows={3}
                placeholder="예: ChatGPT + Zapier로 이메일 자동 분류 워크플로우 만들기&#10;예: 프롬프트 엔지니어링 5가지 핵심 기법"
                className="w-full px-2.5 py-2 bg-gray-900/60 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-600 resize-none focus:border-[#1d9bf0] focus:outline-none"
              />
            </div>
            <button
              onClick={generateXArticle}
              disabled={xArticleLoading || !xArticleTopic.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded bg-[#1d9bf0]/90 hover:bg-[#1d9bf0] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {xArticleLoading
                ? <><Loader2 className="w-3 h-3 animate-spin" />Claude가 작성 중...</>
                : <><FileText className="w-3 h-3" />알티클 생성</>}
            </button>
            {xArticleError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{xArticleError}</div>
            )}
          </div>

          {xArticleResult && !xArticleLoading && (() => {
            const r = xArticleResult;
            const fullText = [
              r.title ? `# ${r.title}` : '',
              r.hook ?? '',
              ...(r.sections ?? []).map(s => `## ${s.heading}\n\n${s.content}`),
              r.conclusion ?? '',
              r.hashtags ? r.hashtags.join(' ') : '',
            ].filter(Boolean).join('\n\n');

            return (
              <div className="space-y-3">
                {/* 제목 */}
                {r.title && (
                  <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800 bg-gray-900/60">
                      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">제목</span>
                      <button onClick={() => xArticleCopy('title', r.title!)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-gray-300 hover:bg-white/5">
                        {xArticleCopied === 'title' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        {xArticleCopied === 'title' ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <p className="px-3 py-2 text-[12px] font-semibold text-gray-100">{r.title}</p>
                  </div>
                )}

                {/* 훅 */}
                {r.hook && (
                  <div className="rounded-md border border-[#1d9bf0]/20 bg-[#1d9bf0]/5 overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1d9bf0]/20">
                      <span className="text-[9px] font-semibold text-[#60b8f8] uppercase tracking-wider">훅 (도입부)</span>
                      <button onClick={() => xArticleCopy('hook', r.hook!)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-gray-300 hover:bg-white/5">
                        {xArticleCopied === 'hook' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        {xArticleCopied === 'hook' ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-gray-300 leading-relaxed whitespace-pre-line">{r.hook}</p>
                  </div>
                )}

                {/* 섹션들 */}
                {(r.sections ?? []).map((sec, idx) => (
                  <div key={idx} className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800">
                      <span className="text-[10px] font-semibold text-gray-300">{sec.heading}</span>
                      <button onClick={() => xArticleCopy(`sec-${idx}`, `## ${sec.heading}\n\n${sec.content}`)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-gray-300 hover:bg-white/5">
                        {xArticleCopied === `sec-${idx}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        {xArticleCopied === `sec-${idx}` ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-gray-400 leading-relaxed whitespace-pre-line">{sec.content}</p>
                  </div>
                ))}

                {/* 결론 */}
                {r.conclusion && (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-emerald-500/20">
                      <span className="text-[9px] font-semibold text-emerald-300 uppercase tracking-wider">결론 & CTA</span>
                      <button onClick={() => xArticleCopy('conclusion', r.conclusion!)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-gray-300 hover:bg-white/5">
                        {xArticleCopied === 'conclusion' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        {xArticleCopied === 'conclusion' ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-gray-300 leading-relaxed whitespace-pre-line">{r.conclusion}</p>
                  </div>
                )}

                {/* 해시태그 */}
                {r.hashtags && r.hashtags.length > 0 && (
                  <div className="rounded-md border border-gray-800 bg-gray-900/40 overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800">
                      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">해시태그</span>
                      <button onClick={() => xArticleCopy('hashtags', r.hashtags!.join(' '))}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-gray-300 hover:bg-white/5">
                        {xArticleCopied === 'hashtags' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        {xArticleCopied === 'hashtags' ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <div className="px-3 py-2 flex flex-wrap gap-1.5">
                      {r.hashtags.map((tag, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d9bf0]/10 text-[#60b8f8]">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 트위터 스레드 첫 트윗 */}
                {r.thread_preview && (
                  <div className="rounded-md border border-[#1d9bf0]/30 bg-[#1d9bf0]/5 overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1d9bf0]/30">
                      <span className="text-[9px] font-semibold text-[#60b8f8] uppercase tracking-wider">X 홍보 트윗 (알티클 링크 첨부용)</span>
                      <button onClick={() => xArticleCopy('thread', r.thread_preview!)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-gray-500 hover:text-gray-300 hover:bg-white/5">
                        {xArticleCopied === 'thread' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        {xArticleCopied === 'thread' ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-line">{r.thread_preview}</p>
                      <p className="mt-1 text-[9px] text-gray-600">{r.thread_preview.length}/280자</p>
                    </div>
                  </div>
                )}

                {/* 전체 복사 */}
                <button
                  onClick={() => xArticleCopy('all', fullText)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded border border-[#1d9bf0]/30 text-[#60b8f8] hover:bg-[#1d9bf0]/10 transition-colors"
                >
                  {xArticleCopied === 'all' ? <><Check className="w-3 h-3 text-emerald-400" />전체 복사됨</> : <><Copy className="w-3 h-3" />전체 알티클 복사</>}
                </button>
              </div>
            );
          })()}
        </div>}

        {/* ── 히스토리 탭 ── */}
        {xArticleTab === 'history' && <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {xArticleHistLoad ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">불러오는 중...</span>
            </div>
          ) : xArticleHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FileText className="w-8 h-8 text-gray-700" />
              <p className="text-xs text-gray-600">아직 생성된 알티클이 없습니다</p>
            </div>
          ) : xArticleHistory.map(h => (
            <div key={h.id}
              className={clsx(
                'rounded-md border p-3 cursor-pointer transition-colors',
                xArticleActiveId === h.id
                  ? 'border-[#1d9bf0]/40 bg-[#1d9bf0]/5'
                  : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
              )}
              onClick={() => loadXArticleHistory(h)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-gray-200 truncate">{h.title ?? h.topic}</p>
                  {h.title && <p className="text-[10px] text-gray-500 truncate mt-0.5">{h.topic}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {h.category && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1d9bf0]/10 text-[#60b8f8]">
                        {X_ARTICLE_CATEGORIES[h.category] ?? h.category}
                      </span>
                    )}
                    {h.sections && <span className="text-[9px] text-gray-600">{h.sections.length}섹션</span>}
                    <span className="text-[9px] text-gray-700 ml-auto">
                      {h.created_at ? format(new Date(h.created_at), 'MM/dd HH:mm', { locale: ko }) : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteXArticleHistory(h.id); }}
                  className="flex-shrink-0 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>}
      </div>}
    </div>
  );
}

// ── ENV 탭 ────────────────────────────────────────────────────

function EnvTab({ projectId, initialEnvs }: { projectId: number; initialEnvs: EnvVar[] }) {
  const [envs,        setEnvs]        = useState<EnvVar[]>(initialEnvs);
  const [showValues,  setShowValues]  = useState<Set<number>>(new Set());
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editForm,    setEditForm]    = useState<Partial<EnvVar>>({});
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [newEnv,      setNewEnv]      = useState({ key:'', value:'', is_secret:false, description:'', group_name:'' });
  const [importText,  setImportText]  = useState('');
  const [importGroup, setImportGroup] = useState('');
  const [showImport,  setShowImport]  = useState(false);
  const [importing,   setImporting]   = useState(false);
  const { copied, copy }              = useCopy();

  // 그룹별 분류
  const groups = Array.from(new Set(envs.map(e => e.group_name ?? '기타'))).sort();

  function toggleShow(id: number) {
    setShowValues(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function maskValue(value: string) {
    if (!value) return <span className="text-gray-700 italic text-[10px]">미설정</span>;
    return <span className="font-mono text-[11px] text-gray-500">{'•'.repeat(Math.min(value.length, 16))}</span>;
  }

  async function saveEdit(id: number) {
    // editForm에 변경 없으면 그냥 닫기
    if (Object.keys(editForm).length === 0) { setEditingId(null); return; }
    const res = await fetch(`${BASE}/${projectId}/envs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setEnvs(prev => prev.map(e => e.id === id ? updated : e));
      setEditingId(null); setEditForm({});
    } else {
      alert('저장 실패: ' + res.status);
    }
  }

  async function deleteEnv(id: number) {
    if (!confirm('삭제할까요?')) return;
    const res = await fetch(`${BASE}/${projectId}/envs/${id}`, { method:'DELETE', headers: getAuthHeaders() });
    if (res.ok) setEnvs(prev => prev.filter(e => e.id !== id));
  }

  async function addEnv(group: string) {
    if (!newEnv.key.trim()) return;
    const res = await fetch(`${BASE}/${projectId}/envs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ ...newEnv, group_name: group || null, description: newEnv.description || null }),
    });
    if (res.ok) {
      const created = await res.json();
      setEnvs(prev => [...prev, created]);
      setNewEnv({ key:'', value:'', is_secret:false, description:'', group_name:'' });
      setAddingGroup(null);
    }
  }

  async function importEnvs() {
    if (!importText.trim()) return;
    setImporting(true);
    const res = await fetch(`${BASE}/${projectId}/envs/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ raw: importText, group_name: importGroup || null, overwrite: true }),
    });
    if (res.ok) {
      const created = await res.json();
      setEnvs(prev => {
        const ids = new Set(created.map((e: EnvVar) => e.id));
        return [...prev.filter(e => !created.find((c: EnvVar) => c.key === e.key)), ...created];
      });
      setImportText(''); setShowImport(false);
    }
    setImporting(false);
  }

  function exportEnv(group?: string) {
    const filtered = group ? envs.filter(e => (e.group_name ?? '기타') === group) : envs;
    const lines = filtered.map(e => `${e.description ? `# ${e.description}\n` : ''}${e.key}=${e.value}`);
    const text = lines.join('\n');
    safeCopy(text);
  }

  const totalSet   = envs.filter(e => e.value).length;
  const totalUnset = envs.filter(e => !e.value).length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* 요약 + 액션 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-500">{totalSet}개 설정됨</span>
          </div>
          {totalUnset > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-red-400 font-medium">{totalUnset}개 미설정</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportEnv()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> .env 내보내기
          </button>
          <button onClick={() => setShowImport(v => !v)}
            className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 px-3 py-1.5 rounded-lg border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors">
            <Upload className="w-3.5 h-3.5" /> .env 붙여넣기
          </button>
        </div>
      </div>

      {/* Import 패널 */}
      {showImport && (
        <div className="mb-5 p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-brand">.env 파일 내용 붙여넣기</p>
            <button onClick={() => setShowImport(false)} className="text-gray-600 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
          </div>
          <textarea
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs font-mono text-gray-300 outline-none focus:border-brand resize-none transition-colors"
            rows={8} placeholder="# .env.local 내용을 여기에 붙여넣으세요&#10;NEXT_PUBLIC_SUPABASE_URL=https://...&#10;ADMIN_PASSWORD=your-password"
            value={importText} onChange={e => setImportText(e.target.value)} />
          <div className="flex items-center gap-2">
            <input className="input text-xs flex-1" placeholder="그룹명 (예: Next.js App)" value={importGroup} onChange={e => setImportGroup(e.target.value)} />
            <button onClick={importEnvs} disabled={importing || !importText.trim()}
              className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-40">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5" />등록</>}
            </button>
          </div>
          <p className="text-[10px] text-gray-600">🔒 KEY 이름에 key/secret/password/token 포함 시 자동으로 비밀값 처리됩니다.</p>
        </div>
      )}

      {/* 그룹별 ENV 테이블 */}
      <div className="space-y-6">
        {groups.map(group => {
          const groupEnvs = envs.filter(e => (e.group_name ?? '기타') === group);
          const unset = groupEnvs.filter(e => !e.value).length;
          return (
            <div key={group}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400">{group}</span>
                  {unset > 0 && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">{unset}개 미설정</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => exportEnv(group)} title=".env 복사"
                    className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors">
                    <Copy className="w-3 h-3" /> 복사
                  </button>
                  <button onClick={() => setAddingGroup(group)}
                    className="text-[10px] text-brand hover:text-brand/80 flex items-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> 추가
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full">
                  <colgroup><col className="w-[200px]" /><col /><col className="w-[90px]" /></colgroup>
                  <thead>
                    <tr className="border-b border-gray-800 bg-white/[0.02]">
                      <th className="text-left text-[10px] text-gray-600 font-semibold px-3 py-2 uppercase tracking-wide">키</th>
                      <th className="text-left text-[10px] text-gray-600 font-semibold px-3 py-2 uppercase tracking-wide">값</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {groupEnvs.map((env, i) => (
                      <tr key={env.id} className={clsx('border-b border-gray-800/50 last:border-0 transition-colors', editingId === env.id ? 'bg-brand/5' : 'hover:bg-white/[0.02]')}>
                        {editingId === env.id ? (
                          <>
                            <td className="px-3 py-2" colSpan={3}>
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <input className="input text-xs font-mono" placeholder="KEY" value={editForm.key ?? ''}
                                    onChange={e => setEditForm(f => ({...f, key: e.target.value}))} />
                                  <input className="input text-xs font-mono" placeholder="VALUE" value={editForm.value ?? ''}
                                    onChange={e => setEditForm(f => ({...f, value: e.target.value}))} />
                                </div>
                                <div className="flex items-center gap-3">
                                  <input className="input text-xs flex-1" placeholder="설명 (선택)" value={editForm.description ?? ''}
                                    onChange={e => setEditForm(f => ({...f, description: e.target.value}))} />
                                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer flex-shrink-0">
                                    <input type="checkbox" className="rounded" checked={editForm.is_secret ?? false}
                                      onChange={e => setEditForm(f => ({...f, is_secret: e.target.checked}))} />
                                    <Shield className="w-3 h-3" /> 비밀값
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(env.id)} className="btn-primary text-xs px-3 py-1">저장</button>
                                  <button onClick={() => { setEditingId(null); setEditForm({}); }} className="btn-ghost text-xs px-3 py-1">취소</button>
                                </div>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {env.is_secret && <Shield className="w-3 h-3 text-yellow-500/60 flex-shrink-0" />}
                                <span className="font-mono text-xs text-gray-300">{env.key}</span>
                              </div>
                              {env.description && <p className="text-[10px] text-gray-600 mt-0.5 ml-4.5" style={{marginLeft: env.is_secret ? '18px' : '0'}}>{env.description}</p>}
                            </td>
                            <td className="px-3 py-2.5">
                              {env.value ? (
                                <div className="flex items-center gap-2">
                                  {env.is_secret && !showValues.has(env.id)
                                    ? maskValue(env.value)
                                    : <span className="font-mono text-[11px] text-gray-300 break-all">{env.value}</span>
                                  }
                                </div>
                              ) : (
                                <span className="text-[10px] text-red-400/80 italic">미설정</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                {env.is_secret && (
                                  <button onClick={() => toggleShow(env.id)} className="p-1 text-gray-700 hover:text-gray-400 rounded transition-colors" title={showValues.has(env.id) ? '숨기기' : '보기'}>
                                    {showValues.has(env.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                )}
                                {env.value && (
                                  <button onClick={() => copy(env.value, String(env.id))} className="p-1 text-gray-700 hover:text-gray-400 rounded transition-colors" title="복사">
                                    {copied === String(env.id) ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                )}
                                <button onClick={() => { setEditingId(env.id); setEditForm({ key: env.key, value: env.value, is_secret: env.is_secret, description: env.description ?? '', group_name: env.group_name ?? '' }); }} className="p-1 text-gray-700 hover:text-gray-300 rounded transition-colors">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteEnv(env.id)} className="p-1 text-gray-700 hover:text-red-400 rounded transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}

                    {/* 인라인 추가 행 */}
                    {addingGroup === group && (
                      <tr className="bg-brand/5 border-t border-brand/20">
                        <td className="px-3 py-2" colSpan={3}>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input autoFocus className="input text-xs font-mono" placeholder="KEY *" value={newEnv.key}
                                onChange={e => setNewEnv(f => ({...f, key: e.target.value}))} />
                              <input className="input text-xs font-mono" placeholder="VALUE" value={newEnv.value}
                                onChange={e => setNewEnv(f => ({...f, value: e.target.value}))} />
                            </div>
                            <div className="flex items-center gap-3">
                              <input className="input text-xs flex-1" placeholder="설명 (선택)" value={newEnv.description}
                                onChange={e => setNewEnv(f => ({...f, description: e.target.value}))} />
                              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer flex-shrink-0">
                                <input type="checkbox" checked={newEnv.is_secret}
                                  onChange={e => setNewEnv(f => ({...f, is_secret: e.target.checked}))} />
                                <Shield className="w-3 h-3" /> 비밀값
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => addEnv(group)} className="btn-primary text-xs px-3 py-1">추가</button>
                              <button onClick={() => setAddingGroup(null)} className="btn-ghost text-xs px-3 py-1">취소</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* 새 그룹 추가 */}
        <button onClick={() => { setAddingGroup('새 그룹'); setNewEnv(f => ({...f, group_name: '새 그룹'})); }}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-700 hover:text-gray-500 border border-dashed border-gray-800 hover:border-gray-700 rounded-xl py-2.5 transition-colors">
          <Plus className="w-3.5 h-3.5" /> 환경변수 추가
        </button>
      </div>
    </div>
  );
}

// ── 운영 로그 탭 ──────────────────────────────────────────────

function LogTab({ project }: { project: PersonalProject }) {
  const [notes, setNotes]   = useState<Note[]>(project.notes);
  const [text,  setText]    = useState('');
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch(`${BASE}/${project.id}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (res.ok) { const note = await res.json(); setNotes(prev => [note, ...prev]); setText(''); }
    setSaving(false);
  }

  async function deleteNote(id: number) {
    const res = await fetch(`${BASE}/${project.id}/notes/${id}`, { method:'DELETE', headers: getAuthHeaders() });
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <textarea
            className="w-full bg-gray-800/40 border border-gray-800 hover:border-gray-700 focus:border-brand rounded-xl px-4 py-3 text-sm text-gray-300 outline-none resize-none transition-colors"
            rows={4} placeholder="오늘 한 작업, 이슈, 결정사항, 메모... (⌘Enter로 저장)"
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }} />
          <div className="flex justify-end">
            <button onClick={addNote} disabled={saving || !text.trim()}
              className="btn-primary text-sm px-5 flex items-center gap-1.5 disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '기록하기'}
            </button>
          </div>
        </div>

        {notes.length === 0
          ? <p className="text-sm text-gray-600 text-center py-10">운영 기록이 없습니다.</p>
          : (
            <div className="space-y-3 mt-2">
              {notes.map(n => (
                <div key={n.id} className="group flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand/40 mt-1.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{n.content}</p>
                      <button onClick={() => deleteNote(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 flex-shrink-0 transition-all mt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {format(parseISO(n.created_at), 'yyyy.MM.dd HH:mm (EEE)', { locale: ko })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── 쿠팡 파트너스 수익 탭 (ThiveLab 전용) ────────────────────

interface CoupangDayRow {
  date:         string;
  click:        number;
  order_count:  number;
  gmv:          number;
  commission:   number;
  cancel_count: number;
}

interface CoupangReportResponse {
  start_date:  string;
  end_date:    string;
  error?:      string;
  daily:       CoupangDayRow[];
  summary: {
    total_click:      number;
    total_orders:     number;
    total_cancels:    number;
    total_gmv:        number;
    total_commission: number;
  };
  api_errors?: Record<string, string>;
}

function CoupangRevenueTab({ project }: { project: PersonalProject }) {
  const [range,   setRange]   = useState<7 | 14 | 30>(30);
  const [data,    setData]    = useState<CoupangReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function fetchReport(days: number) {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const end   = today.toISOString().slice(0, 10);
      const start = new Date(today.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
      const res   = await fetch(
        `${BASE}/${project.id}/ops/coupang-report?start_date=${start}&end_date=${end}`,
        { headers: getAuthHeaders() },
      );
      const json: CoupangReportResponse = await res.json();
      if (json.error) { setError(json.error); setData(null); }
      else setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReport(range); }, [range, project.id]);

  const fmtKRW  = (v: number) => new Intl.NumberFormat('ko-KR').format(Math.round(v));
  const fmtDate = (d: string) =>
    d.length === 8 ? `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}` : d;

  const s   = data?.summary;
  const rows = data?.daily ?? [];
  const apiErrorEntries = data?.api_errors ? Object.entries(data.api_errors) : [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl space-y-5">

        {/* 헤더 + 기간 선택 */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              쿠팡 파트너스 수익 리포트
            </h3>
            {data && (
              <p className="text-[11px] text-gray-600 mt-0.5">
                {fmtDate(data.start_date)} ~ {fmtDate(data.end_date)} · 매일 오후 15:00 업데이트
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => setRange(d)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  range === d ? 'bg-brand text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200')}>
                {d}일
              </button>
            ))}
            <button onClick={() => fetchReport(range)} disabled={loading}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors disabled:opacity-40">
              <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ENV 에러 */}
        {error && (
          <div className="rounded-xl border border-red-800/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            {error}
            {error.includes('ENV') && (
              <p className="text-[11px] text-red-500/70 mt-1">
                ENV 탭에서 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY를 설정해주세요.
              </p>
            )}
          </div>
        )}

        {/* API 개별 에러 */}
        {apiErrorEntries.length > 0 && (
          <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 px-4 py-3 text-xs text-yellow-400 space-y-0.5">
            {apiErrorEntries.map(([k, v]) => <p key={k}><span className="opacity-60">{k}:</span> {v}</p>)}
          </div>
        )}

        {/* KPI 카드 */}
        {data && !error && s && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                { label: '총 클릭',      value: fmtKRW(s.total_click),      unit: '회',  Icon: MousePointerClick, color: 'text-sky-400',     bg: 'bg-sky-400/10',     border: 'border-sky-800/40'     },
                { label: '주문',         value: fmtKRW(s.total_orders),     unit: '건',  Icon: ShoppingCart,      color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-800/40' },
                { label: '취소',         value: fmtKRW(s.total_cancels),    unit: '건',  Icon: Ban,               color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-800/40'     },
                { label: '파트너스 수익', value: fmtKRW(s.total_commission), unit: '원',  Icon: DollarSign,        color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-800/40'   },
              ] as const).map(({ label, value, unit, Icon, color, bg, border }) => (
                <div key={label} className={clsx('rounded-xl border p-4', bg, border)}>
                  <div className={clsx('flex items-center gap-1.5 mb-2', color)}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">{label}</span>
                  </div>
                  <p className={clsx('text-xl font-bold tabular-nums', color)}>{value}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{unit}</p>
                </div>
              ))}
            </div>

            {/* GMV 배너 */}
            {s.total_gmv > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/30 px-4 py-3">
                <BarChart2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500">총 거래액 (GMV)</p>
                  <p className="text-sm font-bold text-gray-300 tabular-nums">{fmtKRW(s.total_gmv)}원</p>
                </div>
                {s.total_orders > 0 && (
                  <div className="text-right">
                    <p className="text-[11px] text-gray-500">주문당 수익</p>
                    <p className="text-sm font-bold text-amber-400 tabular-nums">
                      {fmtKRW(s.total_commission / s.total_orders)}원
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 일별 테이블 */}
            {rows.length > 0 ? (
              <div className="rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900/60">
                        {['날짜', '클릭', '주문', '취소', '전환율', 'GMV(원)', '수익(원)'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const cr = r.order_count && r.click ? ((r.order_count / r.click) * 100).toFixed(1) : null;
                        return (
                          <tr key={r.date} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 font-mono text-gray-400 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-4 py-2.5 text-sky-400 tabular-nums">{fmtKRW(r.click)}</td>
                            <td className="px-4 py-2.5 text-emerald-400 tabular-nums">{r.order_count || '-'}</td>
                            <td className="px-4 py-2.5 text-red-400 tabular-nums">{r.cancel_count || '-'}</td>
                            <td className="px-4 py-2.5 text-gray-400">{cr ? `${cr}%` : '-'}</td>
                            <td className="px-4 py-2.5 text-gray-500 tabular-nums">{r.gmv ? fmtKRW(r.gmv) : '-'}</td>
                            <td className="px-4 py-2.5 text-amber-400 font-medium tabular-nums">
                              {r.commission ? fmtKRW(r.commission) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-900/40">
                        <td className="px-4 py-2.5 text-gray-500 font-semibold">합계</td>
                        <td className="px-4 py-2.5 text-sky-400 font-semibold tabular-nums">{fmtKRW(s.total_click)}</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-semibold tabular-nums">{s.total_orders || '-'}</td>
                        <td className="px-4 py-2.5 text-red-400 font-semibold tabular-nums">{s.total_cancels || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-400 font-semibold">
                          {s.total_click > 0 ? `${((s.total_orders / s.total_click) * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 font-semibold tabular-nums">{fmtKRW(s.total_gmv)}</td>
                        <td className="px-4 py-2.5 text-amber-400 font-bold tabular-nums">{fmtKRW(s.total_commission)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : !loading && (
              <div className="rounded-xl border border-gray-800 py-12 text-center">
                <DollarSign className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-600">조회된 실적이 없습니다.</p>
                <p className="text-[11px] text-gray-700 mt-1">일별 실적은 매일 오후 15:00에 업데이트됩니다.</p>
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 프로젝트 워크스페이스 ─────────────────────────────────────

function ProjectWorkspace({ project, onEdit, onDelete }: {
  project: PersonalProject; onEdit: () => void; onDelete: () => void;
}) {
  const [activeTab,    setActiveTab]    = useState<WorkspaceTab>('ops');
  const [tasks,        setTasks]        = useState<Task[]>(project.milestones);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [headerHealth, setHeaderHealth] = useState<'unknown'|'ok'|'warn'|'down'>('unknown');

  // 자식 컴포넌트(OpsTab 등)에서 탭 전환 요청을 받는 브로드캐스트 리스너
  useEffect(() => {
    function onSwitch(e: Event) {
      const detail = (e as CustomEvent).detail as { tab?: WorkspaceTab } | undefined;
      if (detail?.tab) { setActiveTab(detail.tab); setSelectedTask(null); }
    }
    window.addEventListener('safesquare:switch-workspace-tab', onSwitch as EventListener);
    return () => window.removeEventListener('safesquare:switch-workspace-tab', onSwitch as EventListener);
  }, []);

  const sm    = STATUS_META[project.status];
  const cat   = CATEGORY_META[project.category];
  const links = parseLinks(project.links);

  const totalTasks   = tasks.length;
  const doneTasks    = tasks.filter(t => t.status === 'done').length;
  const overdueTasks = tasks.filter(t => t.due_date && t.status !== 'done' && isAfter(new Date(), parseISO(t.due_date))).length;
  const unsetEnvs    = project.envs.filter(e => !e.value).length;

  // 헤더 서비스 상태 자동 체크 (30초)
  useEffect(() => {
    if (!links.length) return;
    const check = async () => {
      try {
        const res = await fetch(`${BASE}/${project.id}/ops/health`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data: HealthResult[] = await res.json();
        if (!data.length) return;
        const down = data.filter(h => !h.ok).length;
        setHeaderHealth(down === 0 ? 'ok' : down === data.length ? 'down' : 'warn');
      } catch { /* ignore */ }
    };
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, links.length]);

  const tasksByStatus = (s: TaskStatus) => tasks.filter(t => t.status === s).sort((a, b) => a.sort_order - b.sort_order);

  function handleTaskChange(updated: Task) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selectedTask?.id === updated.id) setSelectedTask(updated);
  }

  const projectDir = project.local_path ? project.local_path.split('/').filter(Boolean).pop() ?? '' : '';
  const isThiveLab = projectDir === 'thive-lab';
  const isShortsWorkspace = projectDir === 'youtube-shorts-automation';

  const TABS = [
    { id: 'ops'   as WorkspaceTab, label: '자동화',   Icon: Zap       },
    { id: 'cron'  as WorkspaceTab, label: '크론 설정', Icon: Timer     },
    ...(isShortsWorkspace ? [{ id: 'uploads' as WorkspaceTab, label: '완성본 등록', Icon: Upload }] : []),
    { id: 'board' as WorkspaceTab, label: '작업 보드', Icon: ListChecks },
    { id: 'env'   as WorkspaceTab, label: `ENV 설정${unsetEnvs > 0 ? ` (${unsetEnvs}미설정)` : ''}`, Icon: Settings },
    { id: 'log'   as WorkspaceTab, label: '운영 로그', Icon: Terminal   },
    ...(isThiveLab ? [{ id: 'revenue' as WorkspaceTab, label: '파트너스 수익', Icon: DollarSign }] : []),
  ];

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* 워크스페이스 헤더 */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800"
        style={{ background: 'linear-gradient(180deg,#181b26 0%,#13161f 100%)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{cat.emoji}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-100">{project.title}</h2>
                <span className={clsx('flex items-center gap-1 text-[10px] font-medium', sm.color)}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', sm.dot)} />{sm.label}
                </span>
                {headerHealth === 'ok'   && <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />서비스 정상</span>}
                {headerHealth === 'warn' && <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-yellow-400" />일부 장애</span>}
                {headerHealth === 'down' && <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />서비스 다운</span>}
              </div>
              {project.description && <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[10px] text-gray-600">
                  작업 {doneTasks}/{totalTasks} 완료{totalTasks > 0 && ` · ${Math.round((doneTasks/totalTasks)*100)}%`}
                </span>
                {overdueTasks > 0 && <span className="flex items-center gap-0.5 text-[10px] text-red-400"><AlertCircle className="w-2.5 h-2.5" />기한 초과 {overdueTasks}건</span>}
                {unsetEnvs > 0 && <span className="flex items-center gap-0.5 text-[10px] text-yellow-400"><Shield className="w-2.5 h-2.5" />ENV {unsetEnvs}개 미설정</span>}
                {project.target_date && <span className="flex items-center gap-0.5 text-[10px] text-gray-600"><Calendar className="w-2.5 h-2.5" />목표: {fmtFull(project.target_date)}</span>}
                {links.map((lk, i) => (
                  <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[10px] text-brand/70 hover:text-brand transition-colors">
                    <ExternalLink className="w-2.5 h-2.5" />{lk.label || lk.url}
                  </a>
                ))}
                {project.local_path && (
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-600" title={project.local_path}>
                    <FolderOpen className="w-2.5 h-2.5" /><span className="font-mono truncate max-w-[200px]">{project.local_path}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors border border-gray-800">
              <Pencil className="w-3 h-3" /> 수정
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-white/5 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 진행률 바 */}
        {totalTasks > 0 && (
          <div className="mt-3 h-1 rounded-full bg-gray-800">
            <div className="h-1 rounded-full transition-all" style={{ width:`${Math.round((doneTasks/totalTasks)*100)}%`, background:'linear-gradient(90deg,#4f8ef7,#6ba3ff)' }} />
          </div>
        )}

        {/* 탭 */}
        <div className="flex items-center gap-0 mt-4 -mb-4">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedTask(null); }}
              className={clsx('flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors relative border-b-2',
                activeTab === tab.id ? 'text-brand border-brand' : 'text-gray-500 hover:text-gray-300 border-transparent')}>
              <tab.Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 — EnvTab·LogTab은 display:none으로 숨겨 상태 유지 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 작업 보드 */}
        <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'board' && 'hidden')}>
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map(col => (
                <KanbanColumn key={col.status} column={col} tasks={tasksByStatus(col.status)} projectId={project.id}
                  onTaskAdd={t => setTasks(prev => [...prev, t])} onTaskSelect={setSelectedTask} />
              ))}
            </div>
          </div>
          {selectedTask && (
            <TaskDetailPanel task={selectedTask} projectId={project.id} onClose={() => setSelectedTask(null)}
              onChange={handleTaskChange} onDelete={id => { setTasks(prev => prev.filter(t => t.id !== id)); setSelectedTask(null); }} />
          )}
        </div>
        {/* 자동화 — 탭 전환 시 자동갱신 인터벌 유지 */}
        <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'ops' && 'hidden')}>
          <OpsTab project={project} />
        </div>
        {/* 크론 설정 */}
        <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'cron' && 'hidden')}>
          <CronTab project={project} />
        </div>
        {/* 완성본 등록 (쇼츠 자동화 전용) */}
        {isShortsWorkspace && (
          <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'uploads' && 'hidden')}>
            <ShortsUploadsTab project={project} />
          </div>
        )}
        {/* ENV 설정 — 항상 마운트, 탭 전환 시 상태 보존 */}
        <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'env' && 'hidden')}>
          <EnvTab projectId={project.id} initialEnvs={project.envs} />
        </div>
        {/* 운영 로그 — 항상 마운트 */}
        <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'log' && 'hidden')}>
          <LogTab project={project} />
        </div>
        {/* 쿠팡 파트너스 수익 (ThiveLab 전용) */}
        {isThiveLab && (
          <div className={clsx('flex flex-1 min-h-0 overflow-hidden', activeTab !== 'revenue' && 'hidden')}>
            <CoupangRevenueTab project={project} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Instagram Floorplan 생성 패널 ───────────────────────────────

const FLOORPLAN_STYLES = [
  { v: 'warm-wood-tone',      label: '웜 우드톤 (Warm Wood)' },
  { v: 'mid-century-modern',  label: '미드센추리 모던' },
  { v: 'modern-minimal',      label: '모던 미니멀' },
  { v: 'scandinavian',        label: '스칸디나비안' },
  { v: 'industrial-loft',     label: '인더스트리얼 로프트' },
  { v: 'japandi',             label: '자판디 (Japandi)' },
  { v: 'luxury-classic',      label: '럭셔리 클래식' },
];

type FloorplanVideoPrompt = {
  target_model: 'runway' | 'sora' | 'kling' | 'veo';
  scene_prompt: string;
  camera_keyframes: string[];
  negative_prompt: string;
  duration_sec: number;
  aspect_ratio: string;
};
type FloorplanInstagramPost = {
  caption_ko: string;
  caption_en: string;
  hashtags: string[];
  alt_text: string;
};
type FloorplanAnalysisOut = {
  total_area_m2: number | null;
  layout_type: string;
  rooms: { name: string; approx_area_m2: number | null; features: string[] }[];
  entry_point: string;
  walkthrough_order: string[];
  natural_light: string;
  notes: string;
};
type FloorplanResult = {
  output_id: string;
  seed: number | null;
  analysis: FloorplanAnalysisOut;
  video_prompts: FloorplanVideoPrompt[];
  instagram_post: FloorplanInstagramPost;
  floorplan_url: string | null;
  post_card_url: string | null;
};

type FloorplanHistoryItem = {
  output_id: string;
  created_at: string;
  seed: number | null;
  style: string | null;
  with_furniture: boolean | null;
  total_area_m2: number | null;
  layout_type: string | null;
  rooms: string[];
  has_card: boolean;
  has_floorplan: boolean;
  restorable?: boolean;
  caption_preview: string;
};

function FloorplanGeneratorPanel({ projectId }: { projectId: number }) {
  const [style,         setStyle]         = useState('warm-wood-tone');
  const [seedMode,      setSeedMode]      = useState<'auto' | 'fixed'>('auto');
  const [seed,          setSeed]          = useState<string>('42');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [result,        setResult]        = useState<FloorplanResult | null>(null);
  const [activeModel,   setActiveModel]   = useState<FloorplanVideoPrompt['target_model']>('runway');
  const [copied,        setCopied]        = useState<string | null>(null);
  const [history,       setHistory]       = useState<FloorplanHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingId,     setLoadingId]     = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/floorplan/history`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { fetchHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function loadHistoryItem(outputId: string) {
    setLoadingId(outputId); setError(null);
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/floorplan/history/${outputId}`, {
        headers: getAuthHeaders(),
      });
      const text = await res.text();
      if (!res.ok) {
        try { setError(JSON.parse(text).detail ?? text); } catch { setError(text); }
        return;
      }
      setResult(JSON.parse(text) as FloorplanResult);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDeleteHistory(outputId: string, label: string) {
    if (!confirm(`정말 삭제할까요?\n\n${label}\n(${outputId})\n\n해당 폴더와 히스토리 항목이 모두 제거됩니다.`)) return;
    setDeletingId(outputId);
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/floorplan/history/${outputId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const text = await res.text();
        try { setError(JSON.parse(text).detail ?? text); } catch { setError(text); }
        return;
      }
      // 현재 보고 있던 항목이 삭제된 거면 결과 클리어
      if (result?.output_id === outputId) {
        setResult(null);
      }
      fetchHistory();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerate() {
    setLoading(true); setError(null);
    try {
      const body: Record<string, unknown> = { style };
      if (seedMode === 'fixed' && seed.trim()) body.seed = Number(seed);

      const res = await fetch(`${BASE}/${projectId}/ops/floorplan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        try { setError(JSON.parse(text).detail ?? text); } catch { setError(text); }
        return;
      }
      setResult(JSON.parse(text) as FloorplanResult);
      fetchHistory();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const activePrompt = result?.video_prompts.find(p => p.target_model === activeModel);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14] border-r border-gray-800 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/60 sticky top-0 bg-[#0d0d0d] z-10">
        <Zap className="w-3.5 h-3.5 text-rose-400" />
        <span className="text-xs text-gray-300 font-semibold">랜덤 평면도 → 3D 1인칭 영상 프롬프트 + 인스타 게시물</span>
      </div>

      <div className="p-5 space-y-4">
        {/* 입력 폼 — 스타일 + 시드만 */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="text-[10px] text-gray-500 font-semibold">인테리어 스타일</span>
            <select value={style} onChange={e => setStyle(e.target.value)}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200">
              {FLOORPLAN_STYLES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-gray-500 font-semibold">평면도 랜덤 모드</span>
            <select value={seedMode} onChange={e => setSeedMode(e.target.value as 'auto' | 'fixed')}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200">
              <option value="auto">매번 다른 평면도 (auto)</option>
              <option value="fixed">시드 고정 (재현 가능)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-gray-500 font-semibold">시드 번호 {seedMode === 'auto' && '(비활성)'}</span>
            <input value={seed} onChange={e => setSeed(e.target.value)} disabled={seedMode === 'auto'}
              type="number"
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 disabled:opacity-40" />
          </label>
        </div>

        <p className="text-[10px] text-gray-500 leading-relaxed">
          면적·방 개수·배치·창문·현관 위치가 매 호출마다 랜덤으로 달라집니다.
          생성된 평면도 구조를 바탕으로 영상 프롬프트와 인스타 게시물이 자동 작성됩니다.
        </p>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-rose-500/90 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {loading ? '생성 중...' : '🎲 랜덤 평면도 + 프롬프트 + 게시물 생성'}
        </button>

        {/* 생성된 평면도 미리보기 */}
        {result?.floorplan_url && (
          <div className="rounded border border-gray-800 bg-gray-900/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-rose-300">🏠 생성된 평면도</span>
              <span className="text-[10px] text-gray-500 font-mono">
                seed={result.seed ?? 'auto'} · {result.analysis.total_area_m2}㎡ · {result.analysis.rooms.length}개 방
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.floorplan_url} alt="random floor plan"
              className="w-full rounded border border-gray-800 bg-white" />
            <div className="mt-2 flex flex-wrap gap-1">
              {result.analysis.rooms.map((r, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                  {r.name}{r.approx_area_m2 ? ` · ${r.approx_area_m2}㎡` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="space-y-4">
            {/* 영상 프롬프트 탭 */}
            <div className="rounded border border-gray-800 bg-gray-900/40">
              <div className="flex items-center gap-1 px-2 pt-2 border-b border-gray-800">
                {result.video_prompts.map(p => (
                  <button key={p.target_model} onClick={() => setActiveModel(p.target_model)}
                    className={clsx('px-3 py-1.5 text-[11px] font-semibold rounded-t transition-colors',
                      activeModel === p.target_model
                        ? 'bg-rose-500/15 text-rose-300 border-b-2 border-rose-400'
                        : 'text-gray-500 hover:text-gray-300')}>
                    {p.target_model.toUpperCase()}
                  </button>
                ))}
              </div>
              {activePrompt && (
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>Duration: <span className="text-gray-300">{activePrompt.duration_sec}s</span></span>
                    <span>Aspect: <span className="text-gray-300">{activePrompt.aspect_ratio}</span></span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500 font-semibold">Scene prompt</span>
                      <button onClick={() => copy(`scene-${activeModel}`, activePrompt.scene_prompt)}
                        className="text-[10px] text-brand hover:text-brand/80">
                        {copied === `scene-${activeModel}` ? '✓ 복사됨' : '복사'}
                      </button>
                    </div>
                    <pre className="text-[11px] text-gray-200 bg-black/40 p-2 rounded whitespace-pre-wrap break-words font-mono">
                      {activePrompt.scene_prompt}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-semibold">Camera keyframes</span>
                    <ul className="mt-1 text-[11px] text-gray-300 space-y-0.5 pl-4 list-disc">
                      {activePrompt.camera_keyframes.map((kf, i) => <li key={i}>{kf}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500 font-semibold">Negative prompt</span>
                      <button onClick={() => copy(`neg-${activeModel}`, activePrompt.negative_prompt)}
                        className="text-[10px] text-brand hover:text-brand/80">
                        {copied === `neg-${activeModel}` ? '✓ 복사됨' : '복사'}
                      </button>
                    </div>
                    <pre className="text-[11px] text-gray-400 bg-black/40 p-2 rounded whitespace-pre-wrap break-words font-mono">
                      {activePrompt.negative_prompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* 인스타 게시물 */}
            <div className="rounded border border-gray-800 bg-gray-900/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-300">📷 인스타그램 게시물</span>
                <button onClick={() => copy('caption', `${result.instagram_post.caption_ko}\n\n—\n\n${result.instagram_post.caption_en}\n\n${result.instagram_post.hashtags.join(' ')}`)}
                  className="text-[10px] text-brand hover:text-brand/80">
                  {copied === 'caption' ? '✓ 전체 복사됨' : '캡션+해시태그 전체 복사'}
                </button>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-semibold">캡션 (한)</span>
                <pre className="mt-1 text-[11px] text-gray-200 bg-black/40 p-2 rounded whitespace-pre-wrap">
                  {result.instagram_post.caption_ko}
                </pre>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-semibold">Caption (EN)</span>
                <pre className="mt-1 text-[11px] text-gray-200 bg-black/40 p-2 rounded whitespace-pre-wrap">
                  {result.instagram_post.caption_en}
                </pre>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-semibold">해시태그</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.instagram_post.hashtags.map((h, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 font-mono">{h}</span>
                  ))}
                </div>
              </div>
              {result.post_card_url && (
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold">포스트 카드</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.post_card_url} alt="post card"
                    className="mt-1 max-w-xs rounded border border-gray-800" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 히스토리 */}
        <div className="rounded border border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/60">
            <span className="text-[11px] font-semibold text-gray-300">
              📚 생성 히스토리 <span className="text-gray-500">({history.length})</span>
            </span>
            <button onClick={fetchHistory}
              className="text-[10px] text-gray-400 hover:text-gray-200">
              {historyLoading ? '...' : '새로고침'}
            </button>
          </div>
          {history.length === 0 ? (
            <div className="p-4 text-[11px] text-gray-500 text-center">
              아직 생성 기록이 없습니다. 위에서 평면도를 생성하면 여기에 쌓입니다.
            </div>
          ) : (
            <ul className="divide-y divide-gray-800/60 max-h-96 overflow-y-auto">
              {history.map(h => {
                const restorable = h.restorable !== false;
                const label = h.layout_type || (h.seed != null ? `seed ${h.seed}` : h.output_id);
                return (
                  <li key={h.output_id} className="relative">
                    <button
                      onClick={() => restorable && loadHistoryItem(h.output_id)}
                      disabled={loadingId === h.output_id || !restorable}
                      title={restorable ? '클릭하여 결과 보기' : '복원 불가 (분석 파일 없음) — 삭제만 가능합니다'}
                      className="w-full text-left pl-3 pr-10 py-2 hover:bg-gray-800/30 disabled:hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-200 font-mono">
                          {h.seed != null ? `seed ${h.seed}` : h.output_id}
                          {h.total_area_m2 != null && (
                            <span className="text-gray-500"> · {h.total_area_m2}㎡</span>
                          )}
                          {h.layout_type && (
                            <span className="text-gray-500"> · {h.layout_type}</span>
                          )}
                        </span>
                        <span className="text-[9px] text-gray-600">
                          {loadingId === h.output_id ? '로딩…' :
                            h.created_at.replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {!restorable && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-300"
                                title="floorplan_analysis.json 없음 — 클릭해서 열 수 없습니다">
                            복원 불가
                          </span>
                        )}
                        {h.style && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/10 text-rose-300">
                            {h.style}
                          </span>
                        )}
                        {h.with_furniture === true && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-300">
                            가구
                          </span>
                        )}
                        {h.with_furniture === false && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-gray-700/40 text-gray-400">
                            가구없음
                          </span>
                        )}
                        {h.rooms.slice(0, 6).map((r, i) => (
                          <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-400">
                            {r}
                          </span>
                        ))}
                        {h.rooms.length > 6 && (
                          <span className="text-[9px] text-gray-500">+{h.rooms.length - 6}</span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(h.output_id, label)}
                      disabled={deletingId === h.output_id}
                      title="히스토리에서 삭제 (폴더와 함께)"
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {deletingId === h.output_id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <span className="text-[14px] leading-none">×</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 웹툰 생성기 패널 (Grok Imagine용 1~4컷) ─────────────────

type WebtoonPanel = {
  index: number;
  scene_ko: string;
  dialogue_ko: string;
  narration_ko: string;
  emotion: string;
  camera: string;
  grok_prompt: string;
};

type WebtoonEntry = {
  id: string;
  created_at: string;
  topic: string;
  panels_n: number;
  style: string;
  tone: string;
  character: string;
  extra_style: string;
  model: string;
  title_ko: string;
  summary_ko: string;
  panels: WebtoonPanel[];
};

type WebtoonConfig = {
  styles: { key: string; label: string }[];
  tones:  { key: string; label: string; note: string }[];
  panel_options: number[];
};

function WebtoonGeneratorPanel({ projectId }: { projectId: number }) {
  const [topic,      setTopic]      = useState('');
  const [panels,     setPanels]     = useState<number>(4);
  const [style,      setStyle]      = useState('kr_webtoon');
  const [tone,       setTone]       = useState('slice_of_life');
  const [character,  setCharacter]  = useState('');
  const [extraStyle, setExtraStyle] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [result,     setResult]     = useState<WebtoonEntry | null>(null);
  const [config,     setConfig]     = useState<WebtoonConfig | null>(null);
  const [history,    setHistory]    = useState<WebtoonEntry[]>([]);
  const [historyLoad,setHistoryLoad]= useState(false);
  const [copiedKey,  setCopiedKey]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchConfig() {
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/webtoon/config`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      setConfig(await res.json());
    } catch (e) { console.error(e); }
  }

  async function fetchHistory() {
    setHistoryLoad(true);
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/webtoon/history?limit=50`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.items || []);
    } catch (e) { console.error(e); } finally { setHistoryLoad(false); }
  }

  useEffect(() => { fetchConfig(); fetchHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function handleGenerate() {
    if (!topic.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/webtoon/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          topic: topic.trim(),
          panels,
          style,
          tone,
          character: character.trim(),
          extra_style: extraStyle.trim(),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        try { setError(JSON.parse(text).detail ?? text); } catch { setError(text); }
        return;
      }
      setResult(JSON.parse(text) as WebtoonEntry);
      fetchHistory();
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }

  async function handleDelete(id: string, topicLabel: string) {
    if (!confirm(`삭제할까요?\n\n${topicLabel}`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/${projectId}/ops/webtoon/history/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      if (result?.id === id) setResult(null);
      fetchHistory();
    } finally { setDeletingId(null); }
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  const styles = config?.styles ?? [{ key: 'kr_webtoon', label: '한국 웹툰 (기본)' }];
  const tones  = config?.tones  ?? [{ key: 'slice_of_life', label: '일상', note: '' }];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14] border-r border-gray-800 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/60 sticky top-0 bg-[#0d0d0d] z-10">
        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
        <span className="text-xs text-gray-300 font-semibold">웹툰 생성기 — Grok Imagine용 1~4컷 프롬프트</span>
      </div>

      <div className="p-5 space-y-4">
        {/* 입력 폼 */}
        <label className="block">
          <span className="text-[10px] text-gray-500 font-semibold">주제 / 전제</span>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="예) 첫 출근날 지각한 회사원의 하루. 엘리베이터에서 짝사랑 상대를 마주침."
            rows={3}
            className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 resize-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] text-gray-500 font-semibold">컷 수</span>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setPanels(n)}
                  className={clsx('flex-1 py-1.5 text-xs font-semibold rounded border transition-colors',
                    panels === n
                      ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200'
                      : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-700')}>
                  {n}컷
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] text-gray-500 font-semibold">톤</span>
            <select value={tone} onChange={e => setTone(e.target.value)}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200">
              {tones.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] text-gray-500 font-semibold">그림체</span>
            <select value={style} onChange={e => setStyle(e.target.value)}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200">
              {styles.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] text-gray-500 font-semibold">캐릭터 설정 <span className="text-gray-600">(선택, 동일인 유지용)</span></span>
            <input value={character} onChange={e => setCharacter(e.target.value)}
              placeholder="예) 단발머리 20대 여성, 흰 셔츠에 베이지 슬랙스, 안경"
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200" />
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] text-gray-500 font-semibold">스타일 보강 <span className="text-gray-600">(선택)</span></span>
            <input value={extraStyle} onChange={e => setExtraStyle(e.target.value)}
              placeholder="예) golden hour lighting, soft bloom"
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200" />
          </label>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-fuchsia-500/90 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? '생성 중...' : `✨ ${panels}컷 웹툰 프롬프트 생성`}
        </button>

        {error && (
          <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="space-y-3">
            <div className="rounded border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-fuchsia-200 truncate">{result.title_ko || '(제목 없음)'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{result.summary_ko}</p>
                </div>
                <button onClick={() => copy('all-prompts', result.panels.map((p, i) => `# ${i+1}컷 (${p.emotion}, ${p.camera})\n${p.grok_prompt}`).join('\n\n'))}
                  className="flex-shrink-0 text-[10px] px-2 py-1 rounded bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-200">
                  {copiedKey === 'all-prompts' ? '✓ 전체 복사됨' : '전체 프롬프트 복사'}
                </button>
              </div>
            </div>

            {result.panels.map(p => (
              <div key={p.index} className="rounded border border-gray-800 bg-gray-900/40 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-fuchsia-300">{p.index}컷</span>
                  {p.emotion && <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300">{p.emotion}</span>}
                  {p.camera && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{p.camera}</span>}
                </div>
                {p.scene_ko && (
                  <p className="text-[11px] text-gray-200 leading-relaxed">{p.scene_ko}</p>
                )}
                {(p.dialogue_ko || p.narration_ko) && (
                  <div className="space-y-1 text-[10px]">
                    {p.dialogue_ko && <p className="text-gray-300">💬 <span className="text-gray-200">{p.dialogue_ko}</span></p>}
                    {p.narration_ko && <p className="text-gray-400 italic">📖 {p.narration_ko}</p>}
                  </div>
                )}
                <div className="pt-2 border-t border-gray-800/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500 font-semibold">Grok Imagine 프롬프트</span>
                    <button onClick={() => copy(`panel-${p.index}`, p.grok_prompt)}
                      className="text-[10px] text-brand hover:text-brand/80">
                      {copiedKey === `panel-${p.index}` ? '✓ 복사됨' : '복사'}
                    </button>
                  </div>
                  <pre className="text-[10.5px] text-gray-200 bg-black/40 p-2 rounded whitespace-pre-wrap break-words font-mono">
                    {p.grok_prompt}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 히스토리 */}
        <div className="rounded border border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/60">
            <span className="text-[11px] font-semibold text-gray-300">
              📚 생성 히스토리 <span className="text-gray-500">({history.length})</span>
            </span>
            <button onClick={fetchHistory}
              className="text-[10px] text-gray-400 hover:text-gray-200">
              {historyLoad ? '...' : '새로고침'}
            </button>
          </div>
          {history.length === 0 ? (
            <div className="p-4 text-[11px] text-gray-500 text-center">
              아직 생성 기록이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-gray-800/60 max-h-96 overflow-y-auto">
              {history.map(h => (
                <li key={h.id} className="relative">
                  <button
                    onClick={() => setResult(h)}
                    className="w-full text-left pl-3 pr-10 py-2 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-200 truncate">
                        {h.title_ko || h.topic.slice(0, 40)}
                      </span>
                      <span className="text-[9px] text-gray-600 flex-shrink-0">
                        {h.created_at.replace('T', ' ').slice(0, 16)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[9px] px-1 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-300">{h.panels_n}컷</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-400">{h.style}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-400">{h.tone}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(h.id, h.title_ko || h.topic)}
                    disabled={deletingId === h.id}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">
                    {deletingId === h.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <span className="text-[14px] leading-none">×</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function PersonalProjectsPage() {
  const [projects,    setProjects]    = useState<PersonalProject[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [editProject, setEditProject] = useState<PersonalProject | null>(null);

  useEffect(() => {
    fetch(BASE, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then((list: PersonalProject[]) => { setProjects(list); if (list.length > 0) setSelectedId(list[0].id); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('프로젝트를 삭제할까요?')) return;
    const res = await fetch(`${BASE}/${id}`, { method:'DELETE', headers: getAuthHeaders() });
    if (res.ok) { const next = projects.filter(p => p.id !== id); setProjects(next); setSelectedId(next.length > 0 ? next[0].id : null); }
  }

  function handleSave(p: PersonalProject) {
    setProjects(prev => { const idx = prev.findIndex(x => x.id === p.id); return idx >= 0 ? prev.map(x => x.id === p.id ? {...x,...p} : x) : [...prev, p]; });
    if (!editProject) setSelectedId(p.id);
    setShowForm(false); setEditProject(null);
  }

  const selectedProject = projects.find(p => p.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />

      {/* 프로젝트 목록 패널 */}
      <div className="flex-shrink-0 w-56 border-r border-gray-800 flex flex-col" style={{ background:'#0d1017' }}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-semibold text-gray-300">개인 프로젝트</span>
          </div>
          <button onClick={() => { setEditProject(null); setShowForm(true); }} className="p-1 text-gray-600 hover:text-brand transition-colors" title="새 프로젝트">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-brand" /></div>
          : projects.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[11px] text-gray-600">프로젝트가 없습니다</p>
              <button onClick={() => setShowForm(true)} className="mt-2 text-[11px] text-brand hover:text-brand/80">+ 새로 만들기</button>
            </div>
          ) : projects.map(p => {
            const sm  = STATUS_META[p.status];
            const cat = CATEGORY_META[p.category];
            const done = p.milestones.filter(m => m.status === 'done').length;
            const total = p.milestones.length;
            const unsetEnv = p.envs.filter(e => !e.value).length;
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={clsx('w-full text-left px-3 py-2.5 transition-colors group', selectedId === p.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]')}>
                <div className="flex items-center gap-2">
                  <span className="text-base flex-shrink-0">{cat.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-xs font-medium truncate', selectedId === p.id ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-300')}>{p.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', sm.dot)} />
                      <span className="text-[10px] text-gray-600">{sm.label}</span>
                      {total > 0 && <span className="text-[10px] text-gray-700 ml-auto">{done}/{total}</span>}
                      {unsetEnv > 0 && <span className="text-[10px] text-yellow-500">⚠</span>}
                    </div>
                  </div>
                </div>
                {total > 0 && <div className="mt-1.5 h-0.5 rounded-full bg-gray-800 ml-7"><div className="h-0.5 rounded-full bg-brand/60 transition-all" style={{width:`${Math.round((done/total)*100)}%`}} /></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 워크스페이스 */}
      {selectedProject
        ? <ProjectWorkspace key={selectedProject.id} project={selectedProject} onEdit={() => { setEditProject(selectedProject); setShowForm(true); }} onDelete={() => handleDelete(selectedProject.id)} />
        : <div className="flex-1 flex items-center justify-center"><div className="text-center"><FolderKanban className="w-16 h-16 text-gray-800 mx-auto mb-3" /><p className="text-sm text-gray-600">프로젝트를 선택하거나 새로 만드세요</p><button onClick={() => setShowForm(true)} className="mt-4 btn-primary text-sm"><Plus className="w-4 h-4 inline mr-1" />새 프로젝트</button></div></div>
      }

      {showForm && <ProjectFormModal initial={editProject} onClose={() => { setShowForm(false); setEditProject(null); }} onSave={handleSave} />}
    </div>
  );
}
