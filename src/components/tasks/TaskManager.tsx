'use client';

import { useEffect, useState, useCallback } from 'react';
import { tasksApi } from '@/lib/api';
import {
  Plus, Calendar, User, AlertCircle, CheckCircle2, Clock, X,
  Edit2, LayoutGrid, List, ChevronRight, Rocket, Wrench,
  HeadphonesIcon, GraduationCap, Users, MoreHorizontal, Flag,
  TrendingUp, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── 타입 ── */
interface Task {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}
interface Props { projectId: number; }

/* ── 메타 (oklch) ── */
const STATUS_META: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  topBorder: string;
  icon: React.ElementType;
}> = {
  pending:     { label: '대기',   color: 'oklch(0.60 0.01 245)', bg: 'oklch(0.20 0.010 240 / 0.60)', border: 'oklch(0.26 0.010 236)',  glow: 'oklch(0.60 0.01 245 / 0.10)', topBorder: 'oklch(0.40 0.01 245)', icon: AlertCircle  },
  in_progress: { label: '진행중', color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.10)', border: 'oklch(0.55 0.14 218 / 0.30)', glow: 'oklch(0.68 0.18 218 / 0.18)', topBorder: 'oklch(0.72 0.18 218)', icon: Clock        },
  completed:   { label: '완료',   color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.10)', border: 'oklch(0.58 0.12 152 / 0.30)', glow: 'oklch(0.76 0.16 152 / 0.18)', topBorder: 'oklch(0.76 0.16 152)', icon: CheckCircle2 },
  cancelled:   { label: '취소',   color: 'oklch(0.45 0.01 245)', bg: 'oklch(0.18 0.010 242 / 0.40)', border: 'oklch(0.24 0.010 238)',  glow: 'oklch(0.45 0.01 245 / 0.08)', topBorder: 'oklch(0.30 0.01 245)', icon: X            },
};

const PRIORITY_META: Record<string, { label: string; color: string; border: string; dot: string; glow: string }> = {
  urgent: { label: '긴급', color: 'oklch(0.70 0.20 22)', border: 'oklch(0.55 0.14 22 / 0.40)', dot: 'oklch(0.70 0.20 22)', glow: 'oklch(0.70 0.20 22 / 0.35)' },
  high:   { label: '높음', color: 'oklch(0.78 0.16 60)', border: 'oklch(0.62 0.12 60 / 0.35)', dot: 'oklch(0.78 0.16 60)', glow: 'oklch(0.78 0.16 60 / 0.30)'  },
  medium: { label: '중간', color: 'oklch(0.72 0.18 218)', border: 'oklch(0.55 0.14 218 / 0.30)', dot: 'oklch(0.72 0.18 218)', glow: 'oklch(0.72 0.18 218 / 0.25)' },
  low:    { label: '낮음', color: 'oklch(0.50 0.01 245)', border: 'oklch(0.28 0.010 238)',       dot: 'oklch(0.40 0.01 245)', glow: 'oklch(0.50 0.01 245 / 0.15)' },
};

const TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  deployment:  { label: '배포',    icon: Rocket          },
  maintenance: { label: '유지보수', icon: Wrench          },
  support:     { label: '지원',    icon: HeadphonesIcon  },
  training:    { label: '교육',    icon: GraduationCap   },
  meeting:     { label: '회의',    icon: Users           },
  other:       { label: '기타',    icon: MoreHorizontal  },
};

const KANBAN_COLS = ['pending', 'in_progress', 'completed'] as const;

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return false;
  return isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
}

function dueDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return { text: '오늘 마감', color: 'oklch(0.78 0.16 60)' };
  const diff = differenceInDays(d, new Date());
  if (diff < 0)  return { text: `${Math.abs(diff)}일 지연`, color: 'oklch(0.70 0.20 22)' };
  if (diff <= 3) return { text: `D-${diff}`, color: 'oklch(0.78 0.16 60)' };
  return { text: format(d, 'MM/dd (E)', { locale: ko }), color: 'oklch(0.50 0.01 245)' };
}

/* ── 통계 카드 메타 ── */
const STAT_META = [
  { key: 'total',      label: '전체',   Icon: Flag,          color: 'oklch(0.60 0.01 245)', bg: 'oklch(0.22 0.010 240 / 0.60)', border: 'oklch(0.28 0.010 238)',     glow: 'oklch(0.60 0.01 245 / 0.15)' },
  { key: 'inProgress', label: '진행중', Icon: TrendingUp,    color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', border: 'oklch(0.55 0.14 218 / 0.30)', glow: 'oklch(0.68 0.18 218 / 0.20)' },
  { key: 'overdue',    label: '지연',   Icon: AlertTriangle, color: 'oklch(0.70 0.20 22)',  bg: 'oklch(0.70 0.20 22 / 0.12)',  border: 'oklch(0.55 0.14 22 / 0.30)',  glow: 'oklch(0.70 0.20 22 / 0.20)'  },
  { key: 'completed',  label: '완료',   Icon: CheckCircle2,  color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.30)', glow: 'oklch(0.76 0.16 152 / 0.20)' },
] as const;

/* ═══════════════════════════════════════════════════════════ */
export default function TaskManager({ projectId }: Props) {
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [view,        setView]        = useState<'kanban' | 'list'>('kanban');
  const [filterSt,    setFilterSt]    = useState('all');
  const [filterPr,    setFilterPr]    = useState('all');
  const [editTask,    setEditTask]    = useState<Task | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [draggingId,  setDraggingId]  = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.list(projectId);
      setTasks(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    await tasksApi.update(id, { status });
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  };

  const deleteTask = async (id: number) => {
    if (!await confirm('태스크를 삭제하시겠습니까?')) return;
    await tasksApi.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const filtered = tasks.filter((t) => {
    if (filterSt !== 'all' && t.status !== filterSt) return false;
    if (filterPr !== 'all' && t.priority !== filterPr) return false;
    return true;
  });

  const stats = {
    total:       tasks.length,
    inProgress:  tasks.filter((t) => t.status === 'in_progress').length,
    overdue:     tasks.filter(isOverdue).length,
    completed:   tasks.filter((t) => t.status === 'completed').length,
  };

  const kanbanGroups = KANBAN_COLS.reduce((acc, s) => {
    acc[s] = filtered.filter((t) => t.status === s);
    return acc;
  }, {} as Record<string, Task[]>);

  const openCreate = () => { setEditTask(null); setShowModal(true); };
  const openEdit   = (t: Task) => { setEditTask(t); setShowModal(true); };

  const handleDragStart = (id: number) => setDraggingId(id);
  const handleDragEnd   = () => { setDraggingId(null); setDragOverCol(null); };

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    setDragOverCol(col);
  };

  const handleDrop = async (col: string) => {
    if (draggingId === null) return;
    const task = tasks.find((t) => t.id === draggingId);
    if (!task || task.status === col) return;
    setDraggingId(null);
    setDragOverCol(null);
    await updateStatus(draggingId, col);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 헤더 ── */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{
          borderBottom: '1px solid oklch(0.20 0.010 240)',
          background: 'linear-gradient(180deg, oklch(0.17 0.010 243) 0%, oklch(0.15 0.010 245) 100%)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>일정 관리</h2>
          <div className="flex items-center gap-2">
            {/* 뷰 전환 */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: '1px solid oklch(0.24 0.010 238)' }}
            >
              {(['kanban', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all"
                  style={{
                    background: view === v ? 'oklch(0.76 0.16 196)' : 'transparent',
                    color: view === v ? 'oklch(0.10 0.015 245)' : 'var(--text-faint)',
                  }}
                >
                  {v === 'kanban' ? <><LayoutGrid className="w-3.5 h-3.5" /> 칸반</> : <><List className="w-3.5 h-3.5" /> 목록</>}
                </button>
              ))}
            </div>
            <button onClick={openCreate} className="btn btn-primary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> 새 태스크
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {STAT_META.map(({ key, label, Icon, color, bg, border, glow }) => (
            <div
              key={key}
              className="relative overflow-hidden rounded-xl px-3 py-2.5 flex items-center gap-2.5"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              {/* accent top line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
                  opacity: 0.5,
                }}
              />
              <div
                className="p-1.5 rounded-lg flex-shrink-0"
                style={{
                  background: `${color}1a`,
                  border: `1px solid ${border}`,
                  boxShadow: `0 0 10px ${glow}`,
                  color,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{label}</p>
                <p className="text-lg font-black leading-none" style={{ color }}>
                  {stats[key as keyof typeof stats]}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-0.5">
            {['all', 'pending', 'in_progress', 'completed', 'cancelled'].map((s) => {
              const meta = s !== 'all' ? STATUS_META[s] : null;
              const isActive = filterSt === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterSt(s)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    background: isActive
                      ? (meta ? meta.bg : 'oklch(0.76 0.16 196 / 0.15)')
                      : 'transparent',
                    color: isActive
                      ? (meta ? meta.color : 'var(--accent)')
                      : 'var(--text-faint)',
                    border: `1px solid ${isActive ? (meta ? meta.border : 'oklch(0.55 0.12 196 / 0.30)') : 'transparent'}`,
                  }}
                >
                  {s === 'all' ? '전체' : meta?.label}
                </button>
              );
            })}
          </div>
          <div
            className="flex gap-0.5 pl-4"
            style={{ borderLeft: '1px solid oklch(0.22 0.010 240)' }}
          >
            {['all', 'urgent', 'high', 'medium', 'low'].map((p) => {
              const meta = p !== 'all' ? PRIORITY_META[p] : null;
              const isActive = filterPr === p;
              return (
                <button
                  key={p}
                  onClick={() => setFilterPr(p)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    background: isActive && meta ? `${meta.color}1a` : 'transparent',
                    color: isActive ? (meta ? meta.color : 'var(--text-dim)') : 'var(--text-faint)',
                    border: `1px solid ${isActive && meta ? meta.border : 'transparent'}`,
                  }}
                >
                  {p === 'all' ? '우선순위' : meta?.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="flex-1 overflow-auto p-6" style={{ background: 'oklch(0.14 0.010 245)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-faint)' }}>
            로딩 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'oklch(0.72 0.18 218 / 0.10)',
                border: '1px solid oklch(0.55 0.14 218 / 0.25)',
                boxShadow: '0 0 16px oklch(0.72 0.18 218 / 0.10)',
              }}
            >
              <AlertCircle className="w-5 h-5" style={{ color: 'oklch(0.72 0.18 218 / 0.60)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>태스크가 없습니다</p>
              <button
                onClick={openCreate}
                className="text-xs mt-1 transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                첫 태스크 추가 →
              </button>
            </div>
          </div>
        ) : view === 'kanban' ? (
          /* 칸반 */
          <div className="flex gap-3 h-full overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-x-visible">
            {KANBAN_COLS.map((col) => {
              const meta    = STATUS_META[col];
              const Icon    = meta.icon;
              const isOver  = dragOverCol === col;
              const isDragging = draggingId !== null;
              return (
                <div
                  key={col}
                  onDragOver={(e) => handleDragOver(e, col)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleDrop(col)}
                  className="flex flex-col rounded-xl overflow-hidden transition-all flex-shrink-0 w-[280px] md:w-auto"
                  style={{
                    background: isOver ? `${meta.color}08` : 'oklch(0.16 0.010 244)',
                    border: `1px solid ${isOver ? meta.border : 'oklch(0.22 0.010 240)'}`,
                    boxShadow: isOver ? `0 0 20px ${meta.glow}` : 'none',
                    borderStyle: isDragging && !isOver ? 'dashed' : 'solid',
                  }}
                >
                  {/* 칸반 컬럼 헤더 — accent top border */}
                  <div
                    className="relative flex items-center gap-2 px-4 py-3 transition-colors"
                    style={{
                      borderBottom: `1px solid ${isOver ? meta.border : 'oklch(0.20 0.010 240)'}`,
                      background: isOver ? `${meta.color}0a` : 'transparent',
                    }}
                  >
                    {/* top accent line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{
                        background: `linear-gradient(90deg, transparent 0%, ${meta.topBorder} 50%, transparent 100%)`,
                        opacity: isOver ? 0.9 : 0.6,
                      }}
                    />
                    <div
                      className="p-1 rounded-md"
                      style={{
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.border}`,
                        color: meta.color,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: isOver ? meta.color : 'var(--text-dim)' }}>
                      {meta.label}
                    </span>
                    <span
                      className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${meta.color}15`,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      {kanbanGroups[col].length}
                    </span>
                  </div>

                  <div
                    className="flex-1 overflow-y-auto p-3 space-y-2 transition-colors"
                    style={{ background: isOver ? `${meta.color}05` : 'transparent' }}
                  >
                    {kanbanGroups[col].map((t) => (
                      <KanbanCard
                        key={t.id}
                        task={t}
                        onEdit={openEdit}
                        onDelete={deleteTask}
                        onStatusChange={updateStatus}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingId === t.id}
                      />
                    ))}
                    {kanbanGroups[col].length === 0 && (
                      <div
                        className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed transition-colors"
                        style={{
                          borderColor: isOver ? meta.border : 'oklch(0.22 0.010 240)',
                          color: isOver ? meta.color : 'var(--text-faint)',
                        }}
                      >
                        {isOver ? (
                          <>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
                              style={{ background: `${meta.color}20` }}
                            >
                              <Plus className="w-4 h-4" style={{ color: meta.color }} />
                            </div>
                            <p className="text-xs font-medium">여기에 놓기</p>
                          </>
                        ) : (
                          <p className="text-xs">없음</p>
                        )}
                      </div>
                    )}
                  </div>
                  {col === 'pending' && (
                    <div className="p-3" style={{ borderTop: '1px solid oklch(0.20 0.010 240)' }}>
                      <button
                        onClick={openCreate}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          border: '1px dashed oklch(0.26 0.010 236)',
                          color: 'var(--text-faint)',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)';
                          (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.32 0.010 234)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
                          (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.26 0.010 236)';
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> 추가
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* 목록 */
          <div className="space-y-2">
            {filtered
              .slice()
              .sort((a, b) => {
                const ao = isOverdue(a) ? -1 : 0;
                const bo = isOverdue(b) ? -1 : 0;
                if (ao !== bo) return ao - bo;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
              })
              .map((t) => (
                <ListRow key={t.id} task={t} onEdit={openEdit} onDelete={deleteTask} onStatusChange={updateStatus} />
              ))}
          </div>
        )}
      </div>

      {showModal && (
        <TaskModal
          projectId={projectId}
          task={editTask}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

/* ── 칸반 카드 ── */
function KanbanCard({ task, onEdit, onDelete, onStatusChange, onDragStart, onDragEnd, isDragging }: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, s: string) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const pm = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const tm = TYPE_META[task.type] ?? TYPE_META.other;
  const TypeIcon = tm.icon;
  const overdue = isOverdue(task);

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className="group relative rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all duration-150"
      style={{
        background: 'oklch(0.14 0.010 245)',
        border: `1px solid ${overdue ? 'oklch(0.55 0.14 22 / 0.30)' : 'oklch(0.22 0.010 240)'}`,
        opacity: isDragging ? 0.40 : 1,
        transform: isDragging ? 'scale(0.96) rotate(1deg)' : 'translateY(0)',
        boxShadow: isDragging ? 'none' : 'none',
      }}
      onMouseEnter={e => {
        if (!isDragging) {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.30)';
          (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.30 0.010 236)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = overdue ? 'oklch(0.55 0.14 22 / 0.30)' : 'oklch(0.22 0.010 240)';
      }}
    >
      {/* 우선순위 인디케이터 (glow) */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
        style={{
          background: pm.dot,
          boxShadow: `0 0 6px ${pm.glow}`,
        }}
      />

      {/* 상단 */}
      <div className="flex items-start gap-2 mb-2 pl-2">
        <TypeIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
        <p className="text-sm font-medium flex-1 leading-snug" style={{ color: 'var(--text-dim)' }}>
          {task.title}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 22)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs line-clamp-2 pl-2 mb-2" style={{ color: 'var(--text-faint)' }}>
          {task.description}
        </p>
      )}

      {/* 하단 메타 */}
      <div className="flex items-center gap-1.5 pl-2 flex-wrap">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            color: pm.color,
            border: `1px solid ${pm.border}`,
            background: `${pm.dot}12`,
          }}
        >
          {pm.label}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            color: 'var(--text-faint)',
            background: 'oklch(0.20 0.010 240)',
          }}
        >
          {tm.label}
        </span>
        {task.due_date && (() => {
          const dl = dueDateLabel(task.due_date);
          return (
            <span className="text-[10px] flex items-center gap-0.5 ml-auto" style={{ color: dl.color }}>
              <Calendar className="w-3 h-3" />{dl.text}
            </span>
          );
        })()}
      </div>

      {task.assigned_to && (
        <div className="flex items-center gap-1.5 mt-2 pl-2">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'oklch(0.76 0.16 196 / 0.18)',
              border: '1px solid oklch(0.55 0.12 196 / 0.30)',
            }}
          >
            <span className="text-[9px] font-bold" style={{ color: 'var(--accent)' }}>
              {task.assigned_to[0].toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
            {task.assigned_to}
          </span>
        </div>
      )}

      {/* 퀵 상태 변경 */}
      {task.status !== 'completed' && task.status !== 'cancelled' && (
        <div
          className="opacity-0 group-hover:opacity-100 mt-2 pt-2 flex gap-1 transition-all"
          style={{ borderTop: '1px solid oklch(0.20 0.010 240)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {task.status === 'pending' && (
            <button
              onClick={() => onStatusChange(task.id, 'in_progress')}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded transition-all"
              style={{ color: 'oklch(0.72 0.18 218)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.68 0.18 218 / 0.10)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <ChevronRight className="w-3 h-3" /> 진행 시작
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              onClick={() => onStatusChange(task.id, 'completed')}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded transition-all"
              style={{ color: 'oklch(0.76 0.16 152)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 152 / 0.10)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <CheckCircle2 className="w-3 h-3" /> 완료 처리
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 목록 행 ── */
function ListRow({ task, onEdit, onDelete, onStatusChange }: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, s: string) => void;
}) {
  const pm   = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const sm   = STATUS_META[task.status]     ?? STATUS_META.pending;
  const tm   = TYPE_META[task.type]         ?? TYPE_META.other;
  const TypeIcon   = tm.icon;
  const StatusIcon = sm.icon;
  const overdue = isOverdue(task);

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150"
      style={{
        background: overdue ? 'oklch(0.70 0.20 22 / 0.05)' : 'oklch(0.16 0.010 244)',
        border: `1px solid ${overdue ? 'oklch(0.55 0.14 22 / 0.25)' : 'oklch(0.22 0.010 240)'}`,
      }}
      onClick={() => onEdit(task)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = overdue ? 'oklch(0.55 0.14 22 / 0.40)' : 'oklch(0.30 0.010 236)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = overdue ? 'oklch(0.55 0.14 22 / 0.25)' : 'oklch(0.22 0.010 240)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* 우선순위 점 (glow) */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: pm.dot,
          boxShadow: `0 0 6px ${pm.glow}`,
        }}
      />

      {/* 상태 아이콘 */}
      <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: sm.color }} />

      {/* 제목 + 설명 */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: task.status === 'completed' ? 'var(--text-faint)' : 'var(--text-dim)',
            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {task.description}
          </p>
        )}
      </div>

      {/* 유형 */}
      <div className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
        <TypeIcon className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{tm.label}</span>
      </div>

      {/* 담당자 */}
      {task.assigned_to ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: 'oklch(0.76 0.16 196 / 0.18)',
              border: '1px solid oklch(0.55 0.12 196 / 0.30)',
            }}
          >
            <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
              {task.assigned_to[0].toUpperCase()}
            </span>
          </div>
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{task.assigned_to}</span>
        </div>
      ) : <div className="w-24 flex-shrink-0" />}

      {/* 마감일 */}
      <div className="w-24 flex-shrink-0 text-right">
        {task.due_date ? (() => {
          const dl = dueDateLabel(task.due_date);
          return <span className="text-xs" style={{ color: dl.color }}>{dl.text}</span>;
        })() : <span className="text-xs" style={{ color: 'var(--text-faint)' }}>-</span>}
      </div>

      {/* 상태 배지 */}
      <span
        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
        style={{
          background: sm.bg,
          color: sm.color,
          border: `1px solid ${sm.border}`,
        }}
      >
        {sm.label}
      </span>

      {/* 액션 */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(task)}
          className="p-1.5 rounded transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1.5 rounded transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 22)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.70 0.20 22 / 0.10)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── 생성/편집 모달 ── */
function TaskModal({ projectId, task, onClose, onSuccess }: {
  projectId: number;
  task: Task | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!task;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title:       task?.title       ?? '',
    description: task?.description ?? '',
    type:        task?.type        ?? 'deployment',
    priority:    task?.priority    ?? 'medium',
    status:      task?.status      ?? 'pending',
    assigned_to: task?.assigned_to ?? '',
    due_date:    task?.due_date ? task.due_date.split('T')[0] : '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        due_date:    form.due_date    || null,
        assigned_to: form.assigned_to || null,
        description: form.description || null,
      };
      if (isEdit) {
        await tasksApi.update(task!.id, payload);
      } else {
        await tasksApi.create({ project_id: projectId, ...payload });
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const pm = PRIORITY_META[form.priority] ?? PRIORITY_META.medium;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'oklch(0.06 0.006 245 / 0.80)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, oklch(0.20 0.010 240) 0%, oklch(0.18 0.010 242) 100%)',
          border: `1px solid ${pm.border}`,
          borderRadius: 16,
          boxShadow: [
            '0 32px 80px rgba(0,0,0,0.65)',
            '0 0 0 1px rgba(255,255,255,0.05)',
            `0 0 40px ${pm.glow}`,
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          ].join(', '),
          animation: 'modalIn 0.20s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* accent top line */}
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${pm.color} 50%, transparent 100%)`,
            opacity: 0.6,
          }}
        />

        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid oklch(0.22 0.010 240)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: `${pm.color}15`,
                border: `1px solid ${pm.border}`,
                boxShadow: `0 0 12px ${pm.glow}`,
                color: pm.color,
              }}
            >
              <Flag className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {isEdit ? '태스크 수정' : '새 태스크'}
            </h3>
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
            <label className="label">제목 *</label>
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="태스크 제목" autoFocus required />
          </div>

          <div>
            <label className="label">설명</label>
            <textarea className="textarea" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="상세 내용" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">유형</label>
              <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">우선순위</label>
              <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {Object.entries(PRIORITY_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="label">상태</label>
              <div className="flex gap-2">
                {Object.entries(STATUS_META).map(([v, m]) => {
                  const Icon = m.icon;
                  const active = form.status === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('status', v)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: active ? m.bg : 'transparent',
                        color: active ? m.color : 'var(--text-faint)',
                        border: `1px solid ${active ? m.border : 'oklch(0.24 0.010 238)'}`,
                        boxShadow: active ? `0 0 8px ${m.glow}` : 'none',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />{m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">담당자</label>
              <input className="input" value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} placeholder="이름" />
            </div>
            <div>
              <label className="label">마감일</label>
              <input className="input" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? '저장 중...' : isEdit ? '수정' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
