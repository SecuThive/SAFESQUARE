'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Plus, Trash2, Tag, CalendarDays, Pencil, X, Save,
  ChevronLeft, ChevronRight, GripVertical, Circle,
  CheckCircle2, Timer, AlertCircle, Calendar, MessageSquare, UserCircle2, ChevronDown,
} from 'lucide-react';
import UserBadge from '@/components/ui/UserBadge';
import CommentSection from '@/components/ui/CommentSection';
import {
  format, isPast, isToday, parseISO, isSameDay,
  startOfWeek, addDays, addWeeks, subWeeks,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { getAuthHeaders, authApi, type Member } from '@/lib/api';
import { confirm } from '@/lib/confirm';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'high' | 'medium' | 'low';
type Status   = 'todo' | 'in_progress' | 'done';

interface TodoItem {
  id:          number;
  title:       string;
  description: string | null;
  priority:    Priority;
  status:      Status;
  due_date:    string | null;
  category:    string | null;
  assigned_to: string | null;
  created_by:  string | null;
  created_at:  string;
  updated_at:  string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; dot: string; bar: string }> = {
  high:   { label: '높음', color: 'text-red-400',   bg: 'bg-red-500/10',   dot: 'bg-red-400',   bar: 'bg-red-500'   },
  medium: { label: '보통', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', bar: 'bg-amber-500' },
  low:    { label: '낮음', color: 'text-sky-400',   bg: 'bg-sky-500/10',   dot: 'bg-sky-400',   bar: 'bg-sky-500'   },
};

const COLUMN_META: Record<Status, {
  label: string; color: string; bg: string; border: string; headerBg: string; emptyLabel: string;
}> = {
  todo:        { label: '할 일',  color: 'text-slate-300',   bg: 'bg-slate-900/60',  border: 'border-slate-700/60',  headerBg: 'bg-slate-800/80',   emptyLabel: '할 일이 없습니다' },
  in_progress: { label: '진행 중', color: 'text-amber-300',  bg: 'bg-amber-950/20',  border: 'border-amber-800/40',  headerBg: 'bg-amber-950/60',   emptyLabel: '진행 중인 항목이 없습니다' },
  done:        { label: '완료',   color: 'text-emerald-300', bg: 'bg-emerald-950/20', border: 'border-emerald-800/40', headerBg: 'bg-emerald-950/60', emptyLabel: '완료된 항목이 없습니다' },
};

const STATUS_ICON: Record<Status, React.ReactNode> = {
  todo:        <Circle       className="w-3.5 h-3.5" />,
  in_progress: <Timer        className="w-3.5 h-3.5" />,
  done:        <CheckCircle2 className="w-3.5 h-3.5" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitDueDate(due: string | null) {
  if (!due) return { date: '', time: '' };
  const [date, time] = due.split('T');
  return { date: date ?? '', time: time ?? '' };
}

function combineDueDate(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}` : date;
}

function formatDueLabel(due: string): { text: string; cls: string; icon: React.ReactNode } {
  try {
    const d = parseISO(due);
    const { time } = splitDueDate(due);
    const dateText = isToday(d)
      ? '오늘'
      : format(d, 'M/d(EEE)', { locale: ko });
    const text = time ? `${dateText} ${time}` : dateText;

    if (isPast(d) && !isToday(d))
      return { text, cls: 'text-red-400',   icon: <AlertCircle className="w-3 h-3" /> };
    if (isToday(d))
      return { text, cls: 'text-amber-400', icon: <Calendar    className="w-3 h-3" /> };
    return   { text, cls: 'text-gray-400',  icon: <Calendar    className="w-3 h-3" /> };
  } catch {
    return { text: due, cls: 'text-gray-400', icon: <Calendar className="w-3 h-3" /> };
  }
}

// ─── Date Strip ───────────────────────────────────────────────────────────────

function DateStrip({ selected, onSelect, items }: {
  selected: string;
  onSelect: (d: string) => void;
  items: TodoItem[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const days   = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const datesWithItems = new Set(
    items.filter(i => i.due_date).map(i => i.due_date!.split('T')[0]),
  );

  const monthLabel = (() => {
    const first = days[0];
    const last  = days[6];
    if (first.getMonth() === last.getMonth())
      return format(first, 'yyyy년 M월', { locale: ko });
    return `${format(first, 'M월', { locale: ko })} – ${format(last, 'M월', { locale: ko })}`;
  })();

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-gray-800/80 bg-gray-900/40">
      {/* 전체 */}
      <button
        onClick={() => onSelect('')}
        className={clsx(
          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
          selected === ''
            ? 'bg-brand/20 text-brand'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60',
        )}>
        전체
      </button>

      <div className="w-px h-5 bg-gray-800" />

      {/* 월 + 주 탐색 */}
      <span className="text-[11px] text-gray-500 whitespace-nowrap">{monthLabel}</span>
      <button onClick={() => setWeekOffset(w => w - 1)}
        className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800/60 transition-all">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={() => setWeekOffset(w => w + 1)}
        className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800/60 transition-all">
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* 요일 버튼들 */}
      <div className="flex gap-1.5 overflow-x-auto">
        {days.map(day => {
          const ds       = format(day, 'yyyy-MM-dd');
          const isActive = selected === ds;
          const today    = isToday(day);
          const hasDots  = datesWithItems.has(ds);

          return (
            <button key={ds} onClick={() => onSelect(isActive ? '' : ds)}
              className={clsx(
                'flex flex-col items-center px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all min-w-[44px] relative',
                isActive
                  ? 'bg-brand text-white shadow-md shadow-brand/20'
                  : today
                  ? 'bg-brand/10 text-brand border border-brand/30'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60',
              )}>
              <span className="leading-none mb-0.5 opacity-70">
                {format(day, 'EEE', { locale: ko })}
              </span>
              <span className="text-sm font-bold leading-none">
                {format(day, 'd')}
              </span>
              {hasDots && (
                <span className={clsx(
                  'absolute bottom-1 w-1 h-1 rounded-full',
                  isActive ? 'bg-white/60' : 'bg-brand',
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* 오늘로 */}
      {weekOffset !== 0 && (
        <button onClick={() => setWeekOffset(0)}
          className="ml-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-all whitespace-nowrap">
          오늘로
        </button>
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ status, items, editingId, onEdit, onDelete, onPatch, onCycleStatus, activeId, members, commentOpen, onToggleComment }: {
  status: Status;
  items: TodoItem[];
  editingId: number | null;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onPatch: (id: number, p: Partial<TodoItem>) => Promise<void>;
  onCycleStatus: (item: TodoItem) => void;
  activeId: string | null;
  members: Member[];
  commentOpen: Set<number>;
  onToggleComment: (id: number) => void;
}) {
  const meta = COLUMN_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}`, data: { status } });

  return (
    <div className="flex flex-col flex-shrink-0 w-[280px] sm:min-w-0 sm:flex-1">
      {/* 컬럼 헤더 */}
      <div className={clsx(
        'flex items-center gap-2 px-3 py-2.5 rounded-t-xl border-t border-x',
        meta.headerBg, meta.border,
      )}>
        <span className={meta.color}>{STATUS_ICON[status]}</span>
        <span className={clsx('text-sm font-semibold', meta.color)}>{meta.label}</span>
        <span className={clsx(
          'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
          meta.bg, meta.color,
        )}>
          {items.length}
        </span>
      </div>

      {/* 드롭 영역 */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 flex flex-col gap-2 p-2 rounded-b-xl border-b border-x overflow-y-auto transition-all min-h-[120px]',
          meta.border,
          isOver
            ? `${meta.bg} ring-2 ring-inset ring-brand/40`
            : 'bg-gray-900/30',
        )}>
        {items.length === 0 && !isOver && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-1.5">
            <p className="text-xs text-gray-600">{meta.emptyLabel}</p>
            {status === 'todo' && (
              <p className="text-[10px] text-gray-700">위 입력창에서 바로 추가하세요</p>
            )}
          </div>
        )}

        {items.map(item =>
          editingId === item.id ? (
            <EditCard key={item.id} item={item} onSave={onPatch} onCancel={() => onEdit(-1)} members={members} />
          ) : (
            <DraggableCard
              key={item.id}
              item={item}
              isBeingDragged={activeId === String(item.id)}
              onEdit={() => onEdit(item.id)}
              onDelete={() => onDelete(item.id)}
              onCycleStatus={() => onCycleStatus(item)}
              commentOpen={commentOpen.has(item.id)}
              onToggleComment={() => onToggleComment(item.id)}
            />
          )
        )}

        {/* 드롭 가이드 */}
        {isOver && (
          <div className="border-2 border-dashed border-brand/40 rounded-xl h-16 flex items-center justify-center">
            <p className="text-xs text-brand/60">여기에 놓기</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCard({ item, isBeingDragged, onEdit, onDelete, onCycleStatus, commentOpen, onToggleComment }: {
  item: TodoItem;
  isBeingDragged: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCycleStatus: () => void;
  commentOpen: boolean;
  onToggleComment: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(item.id),
    data: { item },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx('transition-opacity', isDragging ? 'opacity-30' : 'opacity-100')}
    >
      <CardContent
        item={item}
        dragHandleProps={{ ...attributes, ...listeners }}
        onEdit={onEdit}
        onDelete={onDelete}
        onCycleStatus={onCycleStatus}
        commentOpen={commentOpen}
        onToggleComment={onToggleComment}
      />
    </div>
  );
}

// ─── Card Content ─────────────────────────────────────────────────────────────

function CardContent({ item, dragHandleProps, onEdit, onDelete, onCycleStatus, commentOpen, onToggleComment }: {
  item: TodoItem;
  dragHandleProps?: Record<string, unknown>;
  onEdit?: () => void;
  onDelete?: () => void;
  onCycleStatus?: () => void;
  commentOpen?: boolean;
  onToggleComment?: () => void;
}) {
  const pri  = PRIORITY_META[item.priority];
  const done = item.status === 'done';
  const due  = item.due_date ? formatDueLabel(item.due_date) : null;
  const isOverdue = item.due_date && !done
    && isPast(parseISO(item.due_date)) && !isToday(parseISO(item.due_date));

  return (
    <div className={clsx(
      'group relative flex rounded-xl border overflow-hidden transition-all duration-150 cursor-default',
      done
        ? 'border-gray-800/50 bg-gray-900/40 opacity-60'
        : isOverdue
        ? 'border-red-900/40 bg-gray-900/80 hover:border-red-800/50'
        : 'border-gray-800/70 bg-gray-900/70 hover:border-gray-700/80 hover:bg-gray-900',
    )}>
      {/* 우선순위 바 */}
      <div className={clsx('w-[3px] flex-shrink-0', pri.bar, done ? 'opacity-20' : 'opacity-60 group-hover:opacity-100')} />

      <div className="flex-1 px-3 py-2.5 min-w-0">
        {/* 상단 행: 드래그 핸들 + 제목 + 액션 */}
        <div className="flex items-start gap-2">
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="flex-shrink-0 mt-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
              tabIndex={-1}>
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}

          <p className={clsx(
            'flex-1 text-sm font-medium leading-snug min-w-0',
            done ? 'line-through text-gray-500' : 'text-gray-100',
          )}>
            {item.title}
          </p>

          {/* 액션 버튼들 */}
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleComment && (
              <button onClick={onToggleComment}
                className={clsx(
                  'p-1 rounded transition-all',
                  commentOpen
                    ? 'text-brand bg-brand/10'
                    : 'text-gray-600 hover:text-brand hover:bg-brand/10',
                )}>
                <MessageSquare className="w-3 h-3" />
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit}
                className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 transition-all">
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete}
                className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 설명 미리보기 */}
        {item.description && (
          <p className="text-[11px] text-gray-500 mt-1 ml-5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}

        {/* 메타 행 */}
        <div className="flex items-center gap-2 mt-2 ml-5 flex-wrap">
          <span className={clsx(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded',
            pri.bg, pri.color,
          )}>
            <span className={clsx('w-1 h-1 rounded-full', pri.dot)} />
            {pri.label}
          </span>

          {due && (
            <span className={clsx('inline-flex items-center gap-1 text-[10px]', due.cls)}>
              {due.icon}
              {due.text}
            </span>
          )}

          {item.category && (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-800/60 px-1.5 py-0.5 rounded">
              <Tag className="w-2.5 h-2.5" />
              {item.category}
            </span>
          )}

          {/* 담당자 */}
          {item.assigned_to && (
            <UserBadge
              username={item.assigned_to}
              size="xs"
              className="text-sky-400"
            />
          )}

          {/* 작성자 */}
          {item.created_by && (
            <UserBadge username={item.created_by} size="xs" className="ml-auto" />
          )}
        </div>

        {/* 댓글 섹션 */}
        {commentOpen && onToggleComment && (
          <div className="mt-2 ml-5 border-t border-gray-800/60 pt-0.5">
            <CommentSection entityType="todo" entityId={item.id} compact />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Card ────────────────────────────────────────────────────────────────

function EditCard({ item, onSave, onCancel, members = [] }: {
  item: TodoItem;
  onSave: (id: number, patch: Partial<TodoItem>) => Promise<void>;
  onCancel: () => void;
  members?: Member[];
}) {
  const [title,      setTitle]     = useState(item.title);
  const [desc,       setDesc]      = useState(item.description ?? '');
  const [pri,        setPri]       = useState<Priority>(item.priority);
  const [status,     setStatus]    = useState<Status>(item.status);
  const [dueDate,    setDueDate]   = useState(splitDueDate(item.due_date).date);
  const [dueTime,    setDueTime]   = useState(splitDueDate(item.due_date).time);
  const [cat,        setCat]       = useState(item.category ?? '');
  const [assignedTo, setAssignedTo]= useState(item.assigned_to ?? '');
  const [saving,     setSaving]    = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(item.id, {
      title: title.trim(),
      description: desc.trim() || null,
      priority: pri,
      status,
      due_date: combineDueDate(dueDate, dueTime),
      category: cat.trim() || null,
      assigned_to: assignedTo || null,
    });
    setSaving(false);
    onCancel();
  };

  return (
    <div className="rounded-xl border border-brand/50 bg-gray-900 shadow-lg overflow-hidden">
      <div className={clsx('h-0.5', PRIORITY_META[pri].bar)} />
      <div className="p-3 space-y-2.5">
        <input
          autoFocus
          className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 font-medium focus:outline-none focus:border-brand/60"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목 *"
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <textarea
          className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-brand/60 resize-none"
          rows={2}
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="설명 (선택)"
        />

        {/* 상태 */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">상태</p>
          <div className="flex rounded-lg border border-gray-700/80 overflow-hidden bg-gray-800/40 text-xs">
            {(['todo','in_progress','done'] as Status[]).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={clsx('flex-1 py-1.5 transition-all',
                  status === s
                    ? s === 'done' ? 'bg-emerald-600/30 text-emerald-400'
                      : s === 'in_progress' ? 'bg-amber-600/30 text-amber-400'
                      : 'bg-brand/20 text-brand'
                    : 'text-gray-500 hover:text-gray-300')}>
                {s === 'todo' ? '할 일' : s === 'in_progress' ? '진행 중' : '완료'}
              </button>
            ))}
          </div>
        </div>

        {/* 우선순위 */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">우선순위</p>
          <div className="flex rounded-lg border border-gray-700/80 overflow-hidden bg-gray-800/40 text-xs">
            {(['high','medium','low'] as Priority[]).map(p => (
              <button key={p} onClick={() => setPri(p)}
                className={clsx('flex-1 flex items-center justify-center gap-1 py-1.5 transition-all',
                  pri === p ? `${PRIORITY_META[p].bg} ${PRIORITY_META[p].color}` : 'text-gray-500 hover:text-gray-300')}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_META[p].dot)} />
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* 마감일 */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">마감일</p>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg pl-6 pr-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand/60" />
            </div>
            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
              disabled={!dueDate}
              className="w-24 bg-gray-800/60 border border-gray-700/80 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand/60 disabled:opacity-30 disabled:cursor-not-allowed" />
          </div>
        </div>

        {/* 카테고리 */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">카테고리</p>
          <div className="relative">
            <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
            <input value={cat} onChange={e => setCat(e.target.value)}
              className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand/60"
              placeholder="예: 개발" />
          </div>
        </div>

        {/* 담당자 */}
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">담당자</p>
          <div className="relative">
            <UserCircle2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-gray-800/60 border border-gray-700/80 rounded-lg pl-6 pr-7 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand/60 appearance-none">
              <option value="">담당자 없음</option>
              {members.map(m => (
                <option key={m.username} value={m.username}>
                  {m.display_name ? `${m.display_name} (@${m.username})` : m.username}
                  {m.phone ? `  ·  ${m.phone}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-0.5">
          <button onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700/80 text-xs text-gray-400 hover:text-gray-200 transition-all">
            <X className="w-3 h-3" /> 취소
          </button>
          <button onClick={save} disabled={saving || !title.trim()}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 disabled:opacity-40 transition-all">
            <Save className="w-3 h-3" /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export default function TodoBoard() {
  const [items,     setItems]     = useState<TodoItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [members,     setMembers]     = useState<Member[]>([]);
  const [commentOpen, setCommentOpen] = useState<Set<number>>(new Set());
  const [dateFilter,setDateFilter]= useState(() => new Date().toISOString().slice(0, 10)); // 기본: 오늘

  // 빠른 추가
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPri,   setQuickPri]   = useState<Priority>('medium');
  const [quickDue,   setQuickDue]   = useState('');
  const [quickTime,  setQuickTime]  = useState('');
  const [quickCat,   setQuickCat]   = useState('');
  const quickRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/todos', { headers: getAuthHeaders() });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    authApi.members().then(setMembers).catch(() => {});
  }, []);

  // 날짜 필터
  const filteredItems = dateFilter
    ? items.filter(i => i.due_date && isSameDay(parseISO(i.due_date), parseISO(dateFilter)))
    : items;

  const columnItems: Record<Status, TodoItem[]> = {
    todo:        filteredItems.filter(i => i.status === 'todo'),
    in_progress: filteredItems.filter(i => i.status === 'in_progress'),
    done:        filteredItems.filter(i => i.status === 'done'),
  };

  const activeItem = activeId
    ? items.find(i => String(i.id) === activeId) ?? null
    : null;

  // API
  const apiPatch = async (id: number, patch: Partial<TodoItem>) => {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setItems(prev => prev.map(i => i.id === id ? updated : i));
  };

  const apiDelete = async (id: number) => {
    if (!await confirm('이 할 일을 삭제하시겠습니까?')) return;
    await fetch(`/api/todos/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setItems(prev => prev.filter(i => i.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const quickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        title,
        priority: quickPri,
        due_date: combineDueDate(quickDue || dateFilter, quickTime),
        category: quickCat.trim() || null,
      }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setItems(prev => [created, ...prev]);
    setQuickTitle(''); setQuickDue(''); setQuickTime(''); setQuickCat('');
    quickRef.current?.focus();
  };

  // DnD
  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const item         = active.data.current?.item as TodoItem | undefined;
    const targetStatus = over.data.current?.status as Status | undefined;
    if (!item || !targetStatus || item.status === targetStatus) return;
    // 낙관적 업데이트
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: targetStatus } : i));
    apiPatch(item.id, { status: targetStatus });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-950">

      {/* ── 빠른 추가 ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-gray-800/80">
        <div className="flex gap-2 max-w-3xl">
          <div className={clsx('w-[3px] rounded-full self-stretch flex-shrink-0 transition-colors', PRIORITY_META[quickPri].bar)} />
          <input
            ref={quickRef}
            className="flex-1 bg-gray-800/60 border border-gray-700/80 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand/60 transition-all"
            placeholder="새 할 일 입력 후 Enter…"
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && quickAdd()}
          />
          <button onClick={quickAdd} disabled={!quickTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2.5 flex-wrap max-w-3xl">
          {/* 우선순위 */}
          <div className="flex rounded-lg border border-gray-700/80 overflow-hidden bg-gray-800/40">
            {(['high','medium','low'] as Priority[]).map(p => (
              <button key={p} onClick={() => setQuickPri(p)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-all',
                  quickPri === p ? `${PRIORITY_META[p].color} bg-gray-700/80` : 'text-gray-500 hover:text-gray-300',
                )}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_META[p].dot)} />
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
          {/* 마감일 */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input type="date" value={quickDue} onChange={e => setQuickDue(e.target.value)}
                className="bg-gray-800/60 border border-gray-700/80 rounded-lg pl-8 pr-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand/60 w-36" />
            </div>
            <input type="time" value={quickTime} onChange={e => setQuickTime(e.target.value)}
              disabled={!quickDue && !dateFilter}
              className="bg-gray-800/60 border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand/60 w-24 disabled:opacity-30 disabled:cursor-not-allowed" />
          </div>
          {/* 카테고리 */}
          <div className="relative">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
            <input value={quickCat} onChange={e => setQuickCat(e.target.value)}
              className="bg-gray-800/60 border border-gray-700/80 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand/60 w-28"
              placeholder="카테고리" />
          </div>
          {/* 날짜 필터 선택 시 자동 적용 안내 */}
          {dateFilter && !quickDue && (
            <span className="text-[11px] text-brand/70 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(dateFilter), 'M월 d일')} 마감으로 추가됩니다
            </span>
          )}
        </div>
      </div>

      {/* ── 날짜 필터 스트립 ───────────────────────────────────────────────── */}
      <DateStrip selected={dateFilter} onSelect={setDateFilter} items={items} />

      {/* ── 칸반 보드 ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            <p className="text-sm text-gray-500">불러오는 중…</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden px-4 sm:px-6 py-4 min-h-0">
            {(['todo', 'in_progress', 'done'] as Status[]).map(status => (
              <KanbanColumn
                key={status}
                status={status}
                items={columnItems[status]}
                editingId={editingId}
                onEdit={(id) => setEditingId(id === -1 ? null : id)}
                onDelete={apiDelete}
                onPatch={apiPatch}
                onCycleStatus={(item) => apiPatch(item.id, {
                  status: { todo: 'in_progress', in_progress: 'done', done: 'todo' }[item.status] as Status
                })}
                activeId={activeId}
                members={members}
                commentOpen={commentOpen}
                onToggleComment={(id) => setCommentOpen(s => {
                  const n = new Set(s);
                  n.has(id) ? n.delete(id) : n.add(id);
                  return n;
                })}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeItem && (
              <div className="rotate-1 scale-105 shadow-2xl shadow-black/40 opacity-95">
                <CardContent item={activeItem} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
