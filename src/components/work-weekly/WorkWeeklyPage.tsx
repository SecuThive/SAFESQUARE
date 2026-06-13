'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { workWeeklyApi, getAuthMeta } from '@/lib/api';
import type { WorkWeeklyReport, WorkWeeklyItem, WorkItemCategory, WorkItemStatus } from '@/lib/types';
import {
  Plus, Trash2, Send,
  CheckCircle2, Clock, ListTodo, XCircle, Loader2,
  CalendarDays, BarChart2, ChevronDown, ChevronLeft, ChevronRight,
  Briefcase, Settings, HeadphonesIcon, GraduationCap, Users, MoreHorizontal,
  FileDown, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import { format, parseISO, getISOWeek, getYear } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── 메타 ─────────────────────────────────────────────────── */

const CATEGORY_META: Record<WorkItemCategory, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  project:   { label: '프로젝트', icon: Briefcase,       color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', border: 'oklch(0.55 0.14 218 / 0.30)' },
  operation: { label: '운영',     icon: Settings,        color: 'oklch(0.76 0.16 196)', bg: 'oklch(0.76 0.16 196 / 0.12)', border: 'oklch(0.55 0.12 196 / 0.30)' },
  support:   { label: '지원',     icon: HeadphonesIcon,  color: 'oklch(0.74 0.16 300)', bg: 'oklch(0.74 0.16 300 / 0.12)', border: 'oklch(0.58 0.12 300 / 0.30)' },
  education: { label: '교육',     icon: GraduationCap,   color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.30)' },
  meeting:   { label: '회의',     icon: Users,           color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.84 0.16 82 / 0.12)',  border: 'oklch(0.62 0.12 82 / 0.30)'  },
  other:     { label: '기타',     icon: MoreHorizontal,  color: 'oklch(0.55 0.01 245)', bg: 'oklch(0.20 0.010 240 / 0.60)', border: 'oklch(0.28 0.010 238)'       },
};

const STATUS_META: Record<WorkItemStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  completed:   { label: '완료',   icon: CheckCircle2, color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.30)' },
  in_progress: { label: '진행중', icon: Clock,        color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', border: 'oklch(0.55 0.14 218 / 0.30)' },
  planned:     { label: '예정',   icon: ListTodo,     color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.84 0.16 82 / 0.12)',  border: 'oklch(0.62 0.12 82 / 0.30)'  },
  cancelled:   { label: '취소',   icon: XCircle,      color: 'oklch(0.50 0.01 245)', bg: 'oklch(0.20 0.010 240 / 0.50)', border: 'oklch(0.26 0.010 236)'       },
};

const REPORT_STATUS_META = {
  draft:     { label: '작성중', color: 'oklch(0.60 0.01 245)', bg: 'oklch(0.22 0.010 240 / 0.70)', border: 'oklch(0.28 0.010 238)' },
  submitted: { label: '제출완료', color: 'oklch(0.76 0.16 196)', bg: 'oklch(0.76 0.16 196 / 0.12)', border: 'oklch(0.55 0.12 196 / 0.30)' },
};

function fmtWeekRange(start: string, end: string) {
  return `${format(parseISO(start), 'M월 d일', { locale: ko })} ~ ${format(parseISO(end), 'M월 d일', { locale: ko })}`;
}

function fmtWeekRangeFull(start: string, end: string) {
  return `${format(parseISO(start), 'M월 d일(EEE)', { locale: ko })} ~ ${format(parseISO(end), 'M월 d일(EEE)', { locale: ko })}`;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function getCurrentYearWeek() {
  const now = new Date();
  return { year: getYear(now), week: getISOWeek(now) };
}

function weekToDateRange(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function getISOWeeksInYear(year: number): number {
  return getISOWeek(new Date(year, 11, 28));
}

/* ══════════════════════════════════════════════════════════════ */
export default function WorkWeeklyPage() {
  const meta = getAuthMeta();
  const { year: cYear, week: cWeek } = getCurrentYearWeek();

  const [reports,  setReports]  = useState<WorkWeeklyReport[]>([]);
  const [selected, setSelected] = useState<WorkWeeklyReport | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [newYear,  setNewYear]  = useState(cYear);
  const [newWeek,  setNewWeek]  = useState(cWeek);
  const [showNew,  setShowNew]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workWeeklyApi.list();
      setReports(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePrevWeek = () => {
    if (newWeek > 1) {
      setNewWeek(w => w - 1);
    } else {
      const prevYear = newYear - 1;
      setNewYear(prevYear);
      setNewWeek(getISOWeeksInYear(prevYear));
    }
  };

  const handleNextWeek = () => {
    const maxWeek = getISOWeeksInYear(newYear);
    if (newWeek < maxWeek) {
      setNewWeek(w => w + 1);
    } else {
      setNewYear(y => y + 1);
      setNewWeek(1);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const report = await workWeeklyApi.create({ year: newYear, week_number: newWeek });
      setReports(prev => [report, ...prev]);
      setSelected(report);
      setShowNew(false);
      toast.success('주간업무 보고서가 생성되었습니다.');
    } catch (e: any) {
      toast.error(e.message ?? '생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm('이 주간업무 보고서를 삭제하시겠습니까?')) return;
    await workWeeklyApi.delete(id);
    setReports(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('삭제되었습니다.');
  };

  const handleUpdate = (updated: WorkWeeklyReport) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelected(updated);
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'oklch(0.14 0.010 245)' }}>

      {/* ── 좌측 사이드바 ── */}
      <div
        className="flex flex-col w-64 flex-shrink-0"
        style={{
          borderRight: '1px solid oklch(0.20 0.010 240)',
          background: 'linear-gradient(180deg, oklch(0.17 0.010 243) 0%, oklch(0.15 0.010 245) 100%)',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.30)', color: 'var(--accent)' }}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>주간업무</span>
          </div>
          <button
            onClick={() => { setShowNew(v => !v); }}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--text-faint)' }}
            title="새 보고서"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 새 보고서 인라인 폼 */}
        {showNew && (() => {
          const { start, end } = weekToDateRange(newYear, newWeek);
          const preview = `${format(start, 'M월 d일(EEE)', { locale: ko })} ~ ${format(end, 'M월 d일(EEE)', { locale: ko })}`;
          return (
            <div
              className="px-3 py-3 space-y-2.5 flex-shrink-0"
              style={{ borderBottom: '1px solid oklch(0.20 0.010 240)', background: 'oklch(0.14 0.010 245)' }}
            >
              {/* 연도 선택 */}
              <select
                className="select text-xs py-1 w-full"
                value={newYear}
                onChange={e => setNewYear(Number(e.target.value))}
              >
                {[cYear - 1, cYear, cYear + 1].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>

              {/* 주차 탐색 */}
              <div
                className="flex items-center gap-1 rounded-lg overflow-hidden"
                style={{ border: '1px solid oklch(0.24 0.010 240)', background: 'oklch(0.16 0.010 244)' }}
              >
                <button
                  onClick={handlePrevWeek}
                  className="p-2 transition-all flex-shrink-0"
                  style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 text-center py-1.5">
                  <div className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{newWeek}주차</div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--accent)' }}>{preview}</div>
                </div>
                <button
                  onClick={handleNextWeek}
                  className="p-2 transition-all flex-shrink-0"
                  style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn btn-primary w-full text-xs"
                style={{ height: 30 }}
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                이 주차로 생성
              </button>
            </div>
          );
        })()}

        {/* 보고서 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'oklch(0.76 0.16 196 / 0.10)', border: '1px solid oklch(0.55 0.12 196 / 0.25)', boxShadow: '0 0 14px oklch(0.76 0.16 196 / 0.10)' }}
              >
                <BarChart2 className="w-5 h-5" style={{ color: 'oklch(0.76 0.16 196 / 0.50)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>보고서가 없습니다</p>
                <button onClick={() => setShowNew(true)} className="text-[11px] mt-1" style={{ color: 'var(--accent)' }}>
                  첫 주간보고 작성 →
                </button>
              </div>
            </div>
          ) : (
            reports.map(r => {
              const rs = REPORT_STATUS_META[r.status];
              const active = selected?.id === r.id;
              const done = r.items.filter(i => !i.is_next_week && i.status === 'completed').length;
              const total = r.items.filter(i => !i.is_next_week).length;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full px-3 py-2.5 text-left transition-all duration-150 relative"
                  style={{
                    borderBottom: '1px solid oklch(0.18 0.010 242 / 0.70)',
                    background: active ? 'linear-gradient(90deg, oklch(0.76 0.16 196 / 0.07) 0%, transparent 100%)' : 'transparent',
                    borderLeft: active ? '2px solid oklch(0.76 0.16 196)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0.010 241 / 0.60)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                      {r.year}년 {r.week_number}주차
                    </span>
                    <span
                      className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}
                    >
                      {rs.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold truncate mb-0.5" style={{ color: 'var(--text-dim)' }}>
                    {r.title || '주간업무 보고'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                    {fmtWeekRange(r.week_start, r.week_end)}
                  </p>
                  {total > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.010 240)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, background: 'oklch(0.76 0.16 196)', boxShadow: '0 0 4px oklch(0.76 0.16 196 / 0.40)' }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{done}/{total}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── 우측 상세 ── */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ReportEditor
            key={selected.id}
            report={selected}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'oklch(0.76 0.16 196 / 0.08)', border: '1px solid oklch(0.55 0.12 196 / 0.20)', boxShadow: '0 0 24px oklch(0.76 0.16 196 / 0.08)' }}
              >
                <BarChart2 className="w-7 h-7" style={{ color: 'oklch(0.76 0.16 196 / 0.50)' }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>주간업무 보고서를 선택하거나</p>
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>새로 작성하세요</p>
              <button onClick={() => setShowNew(true)} className="btn btn-primary mt-5" style={{ paddingLeft: 20, paddingRight: 20 }}>
                <Plus className="w-3.5 h-3.5" /> 새 주간보고
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 보고서 에디터 ──────────────────────────────────────────── */
function ReportEditor({ report: init, onUpdate, onDelete }: {
  report: WorkWeeklyReport;
  onUpdate: (r: WorkWeeklyReport) => void;
  onDelete: () => void;
}) {
  const [report,  setReport]  = useState<WorkWeeklyReport>({ ...init, items: [...init.items] });
  const [title,   setTitle]   = useState(init.title   ?? '');
  const [summary, setSummary] = useState(init.summary ?? '');
  const [note,    setNote]    = useState(init.note    ?? '');
  const titleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePrint = () => {
    const printReport = { ...report, title: title || null, summary: summary || null, note: note || null };
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    w.document.write(generatePrintHTML(printReport));
    w.document.close();
  };

  useEffect(() => {
    setReport({ ...init, items: [...init.items] });
    setTitle(init.title   ?? '');
    setSummary(init.summary ?? '');
    setNote(init.note   ?? '');
  }, [init.id]);

  const makeFieldSaver = (field: string, timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, delay = 1000) =>
    (v: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const updated = await workWeeklyApi.update(report.id, { [field]: v || null });
        onUpdate(updated);
      }, delay);
    };

  const handleTitleChange   = (v: string) => { setTitle(v);   makeFieldSaver('title',   titleTimer,   800)(v); };
  const handleSummaryChange = (v: string) => { setSummary(v); makeFieldSaver('summary', summaryTimer)(v); };
  const handleNoteChange    = (v: string) => { setNote(v);    makeFieldSaver('note',    noteTimer)(v); };

  const [aiLoading, setAiLoading] = useState(false);

  const handleAiParse = async () => {
    if (!summary.trim()) { toast.error('이번 주 종합 내용을 먼저 입력하세요.'); return; }
    setAiLoading(true);
    try {
      const result = await workWeeklyApi.aiParse(report.id, summary);
      const newItems: WorkWeeklyItem[] = [];
      const twCount = report.items.filter(i => !i.is_next_week).length;
      const nwCount = report.items.filter(i =>  i.is_next_week).length;

      for (let i = 0; i < result.this_week.length; i++) {
        const { project_name, sub_items, ...rest } = result.this_week[i] as typeof result.this_week[0] & { sub_items?: string[] };
        const item = await workWeeklyApi.addItem(report.id, {
          ...rest,
          project_name: project_name ?? undefined,
          sub_items: sub_items ?? [],
          is_next_week: false,
          sort_order: twCount + i,
        });
        newItems.push(item);
      }
      for (let i = 0; i < result.next_week.length; i++) {
        const { project_name, sub_items, ...rest } = result.next_week[i] as typeof result.next_week[0] & { sub_items?: string[] };
        const item = await workWeeklyApi.addItem(report.id, {
          ...rest,
          project_name: project_name ?? undefined,
          sub_items: sub_items ?? [],
          status: 'planned',
          progress: 0,
          is_next_week: true,
          sort_order: nwCount + i,
        });
        newItems.push(item);
      }

      const updated = { ...report, items: [...report.items, ...newItems] };
      setReport(updated);
      onUpdate(updated);
      toast.success(`이번 주 ${result.this_week.length}건, 다음 주 ${result.next_week.length}건이 추가되었습니다.`);
    } catch (e: any) {
      toast.error(e.message ?? 'AI 파싱 실패');
    } finally {
      setAiLoading(false);
    }
  };

  /* 제출 */
  const handleSubmit = async () => {
    if (!await confirm('주간업무를 제출하시겠습니까? 제출 후에도 수정할 수 있습니다.', { danger: false, title: '주간업무 제출', confirmLabel: '제출' })) return;
    const updated = await workWeeklyApi.update(report.id, { status: 'submitted' });
    setReport(prev => ({ ...prev, status: 'submitted' }));
    onUpdate(updated);
    toast.success('주간업무가 제출되었습니다.');
  };

  /* 항목 추가 */
  const addItem = async (isNextWeek = false) => {
    const item = await workWeeklyApi.addItem(report.id, {
      content: '',
      is_next_week: isNextWeek,
      sort_order: report.items.filter(i => i.is_next_week === isNextWeek).length,
    });
    setReport(prev => ({ ...prev, items: [...prev.items, item] }));
    onUpdate({ ...report, items: [...report.items, item] });
  };

  /* 항목 업데이트 */
  const updateItem = async (itemId: number, data: Parameters<typeof workWeeklyApi.updateItem>[2]) => {
    const updated = await workWeeklyApi.updateItem(report.id, itemId, data);
    const newItems = report.items.map(i => i.id === itemId ? updated : i);
    setReport(prev => ({ ...prev, items: newItems }));
    onUpdate({ ...report, items: newItems });
  };

  /* 항목 삭제 */
  const deleteItem = async (itemId: number) => {
    await workWeeklyApi.deleteItem(report.id, itemId);
    const newItems = report.items.filter(i => i.id !== itemId);
    setReport(prev => ({ ...prev, items: newItems }));
    onUpdate({ ...report, items: newItems });
  };

  const thisWeekItems = report.items.filter(i => !i.is_next_week);
  const nextWeekItems = report.items.filter(i => i.is_next_week);
  const rs = REPORT_STATUS_META[report.status];
  const doneCount = thisWeekItems.filter(i => i.status === 'completed').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 툴바 */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 gap-4"
        style={{ borderBottom: '1px solid oklch(0.20 0.010 240)', background: 'oklch(0.16 0.010 244)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.30)' }}
          >
            <BarChart2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
              {title || `${report.year}년 ${report.week_number}주차 주간업무`}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
              {report.year}년 {report.week_number}주차
            </p>
          </div>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}
          >
            {rs.label}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 진행률 */}
          {thisWeekItems.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.010 240)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.round((doneCount / thisWeekItems.length) * 100)}%`,
                    background: 'oklch(0.76 0.16 196)',
                    boxShadow: '0 0 6px oklch(0.76 0.16 196 / 0.40)',
                  }}
                />
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {doneCount}/{thisWeekItems.length} 완료
              </span>
            </div>
          )}

          {report.status === 'draft' && (
            <button onClick={handleSubmit} className="btn btn-primary" style={{ height: 30, paddingLeft: 12, paddingRight: 12, fontSize: 11 }}>
              <Send className="w-3 h-3" /> 제출
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'oklch(0.76 0.16 196)', border: '1px solid oklch(0.55 0.12 196 / 0.30)', background: 'oklch(0.76 0.16 196 / 0.07)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.14)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.07)'; }}
            title="PDF로 저장 / 인쇄"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 22)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.70 0.20 22 / 0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">

          {/* ── 보고서 제목 ── */}
          <div>
            <input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder={`${report.year}년 ${report.week_number}주차 주간업무 보고`}
              className="w-full bg-transparent text-xl font-bold outline-none placeholder:font-normal"
              style={{ color: title ? 'var(--text)' : 'oklch(0.38 0.010 240)', caretColor: 'var(--accent)' }}
            />
            <div className="mt-2 h-px" style={{ background: 'linear-gradient(90deg, oklch(0.76 0.16 196 / 0.40) 0%, oklch(0.22 0.010 240 / 0.30) 60%, transparent 100%)' }} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
              <CalendarDays className="w-3 h-3 inline mr-1" />
              {fmtWeekRangeFull(report.week_start, report.week_end)}
              {report.author && <span className="ml-2">· {report.author_name ?? report.author}</span>}
              {report.department && <span className="ml-2">· {report.department}</span>}
            </p>
          </div>

          {/* ── 이번 주 종합 / AI 정리 ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ background: 'oklch(0.74 0.16 300)', boxShadow: '0 0 8px oklch(0.74 0.16 300 / 0.40)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>이번 주 종합</h2>
              <button
                onClick={handleAiParse}
                disabled={aiLoading || !summary.trim()}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={{ color: 'oklch(0.74 0.16 300)', border: '1px solid oklch(0.58 0.12 300 / 0.30)', background: 'oklch(0.74 0.16 300 / 0.07)' }}
                onMouseEnter={e => { if (!aiLoading && summary.trim()) (e.currentTarget as HTMLElement).style.background = 'oklch(0.74 0.16 300 / 0.14)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.74 0.16 300 / 0.07)'; }}
                title="입력한 내용을 AI가 분석하여 이번 주 업무와 다음 주 계획에 자동으로 추가합니다"
              >
                {aiLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> 분석 중...</>
                  : <><Sparkles className="w-3 h-3" /> AI로 업무 정리</>
                }
              </button>
            </div>
            <textarea
              value={summary}
              onChange={e => handleSummaryChange(e.target.value)}
              rows={4}
              placeholder="이번 주 진행한 업무와 다음 주 계획을 자유롭게 작성하면 AI가 자동으로 항목을 정리해 드립니다.&#10;예) A 프로젝트 API 연동 완료, B 서버 점검 진행중 70%, 다음 주 C 배포 예정..."
              className="textarea w-full text-sm resize-y leading-relaxed"
              style={{ minHeight: 100 }}
            />
            {summary.trim() && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                <Sparkles className="w-3 h-3 inline mr-1" style={{ color: 'oklch(0.74 0.16 300 / 0.60)' }} />
                작성 후 &quot;AI로 업무 정리&quot; 버튼을 누르면 이번 주 업무와 다음 주 계획에 자동으로 추가됩니다.
              </p>
            )}
          </section>

          {/* ── 이번 주 업무 ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: 'oklch(0.76 0.16 196)', boxShadow: '0 0 8px oklch(0.76 0.16 196 / 0.50)' }}
                />
                <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>이번 주 업무</h2>
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  ({thisWeekItems.length}건)
                </span>
              </div>
              <button
                onClick={() => addItem(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{ color: 'var(--accent)', border: '1px solid oklch(0.55 0.12 196 / 0.30)', background: 'oklch(0.76 0.16 196 / 0.07)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.14)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.07)'; }}
              >
                <Plus className="w-3 h-3" /> 업무 추가
              </button>
            </div>

            <div className="space-y-2">
              {thisWeekItems.map(item => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  onUpdate={data => updateItem(item.id, data)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
              <QuickAddRow
                accent="oklch(0.76 0.16 196)"
                placeholder="업무 내용 입력 후 Enter..."
                onAdd={async (content) => {
                  const item = await workWeeklyApi.addItem(report.id, { content, is_next_week: false, sort_order: thisWeekItems.length });
                  const updated = { ...report, items: [...report.items, item] };
                  setReport(updated); onUpdate(updated);
                }}
              />
            </div>
          </section>

          {/* ── 다음 주 계획 ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: 'oklch(0.84 0.16 82)', boxShadow: '0 0 8px oklch(0.84 0.16 82 / 0.40)' }}
                />
                <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>다음 주 계획</h2>
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>({nextWeekItems.length}건)</span>
              </div>
              <button
                onClick={() => addItem(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{ color: 'oklch(0.84 0.16 82)', border: '1px solid oklch(0.62 0.12 82 / 0.30)', background: 'oklch(0.84 0.16 82 / 0.07)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.84 0.16 82 / 0.14)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.84 0.16 82 / 0.07)'; }}
              >
                <Plus className="w-3 h-3" /> 계획 추가
              </button>
            </div>

            <div className="space-y-2">
              {nextWeekItems.map(item => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  isNextWeek
                  onUpdate={data => updateItem(item.id, data)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
              <QuickAddRow
                accent="oklch(0.84 0.16 82)"
                placeholder="다음 주 계획 입력 후 Enter..."
                onAdd={async (content) => {
                  const item = await workWeeklyApi.addItem(report.id, { content, is_next_week: true, sort_order: nextWeekItems.length });
                  const updated = { ...report, items: [...report.items, item] };
                  setReport(updated); onUpdate(updated);
                }}
              />
            </div>
          </section>

          {/* ── 특이사항 / 종합 의견 ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-1 h-5 rounded-full"
                style={{ background: 'oklch(0.70 0.20 22)', boxShadow: '0 0 8px oklch(0.70 0.20 22 / 0.40)' }}
              />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>특이사항 / 종합 의견</h2>
            </div>
            <textarea
              value={note}
              onChange={e => handleNoteChange(e.target.value)}
              rows={4}
              placeholder="이슈, 건의사항, 종합 의견을 자유롭게 작성하세요..."
              className="textarea w-full text-sm resize-y"
              style={{ minHeight: 100 }}
            />
          </section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

/* ── 업무 항목 행 ─────────────────────────────────────────── */
function WorkItemRow({ item, isNextWeek = false, onUpdate, onDelete }: {
  item: WorkWeeklyItem;
  isNextWeek?: boolean;
  onUpdate: (data: Parameters<typeof workWeeklyApi.updateItem>[2]) => void;
  onDelete: () => void;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [subItems,  setSubItems]  = useState<string[]>(item.sub_items ?? []);
  const subInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const subTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSubItems(item.sub_items ?? []); }, [item.id]);

  const saveSubItems = (items: string[]) => {
    if (subTimer.current) clearTimeout(subTimer.current);
    subTimer.current = setTimeout(() => onUpdate({ sub_items: items }), 600);
  };

  const updateSub = (idx: number, val: string) => {
    const next = subItems.map((s, i) => i === idx ? val : s);
    setSubItems(next);
    saveSubItems(next);
  };

  const addSub = () => {
    const next = [...subItems, ''];
    setSubItems(next);
    saveSubItems(next);
    setTimeout(() => subInputRefs.current[next.length - 1]?.focus(), 30);
  };

  const removeSub = (idx: number) => {
    const next = subItems.filter((_, i) => i !== idx);
    setSubItems(next);
    saveSubItems(next);
  };

  const handleSubKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') { e.preventDefault(); addSub(); }
    if (e.key === 'Backspace' && subItems[idx] === '') {
      e.preventDefault();
      removeSub(idx);
      setTimeout(() => subInputRefs.current[idx - 1]?.focus(), 30);
    }
  };

  const cat = CATEGORY_META[item.category];
  const sm  = STATUS_META[item.status];
  const CatIcon  = cat.icon;
  const StatIcon = sm.icon;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-150"
      style={{ background: 'oklch(0.16 0.010 244)', border: '1px solid oklch(0.22 0.010 240)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.28 0.010 238)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.22 0.010 240)'; }}
    >
      {/* 메인 행 */}
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        {/* 카테고리 아이콘 */}
        <div
          className="p-1.5 rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color }}
        >
          <CatIcon className="w-3 h-3" />
        </div>

        {/* 제목 + 세부항목 */}
        <div className="flex-1 min-w-0">
          {/* 고객사 / 내부업무 */}
          <textarea
            value={item.content}
            rows={1}
            onChange={e => { onUpdate({ content: e.target.value }); autoResize(e.target); }}
            onFocus={e => autoResize(e.target)}
            placeholder="고객사 또는 내부업무"
            className="w-full bg-transparent text-sm font-semibold outline-none resize-none overflow-hidden leading-relaxed"
            style={{ color: item.content ? 'var(--text-dim)' : 'var(--text-faint)', minHeight: '1.5rem' }}
          />

          {/* 세부 항목 목록 */}
          {subItems.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {subItems.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-1.5 group">
                  <span className="text-[11px] flex-shrink-0 select-none" style={{ color: 'var(--text-faint)' }}>─</span>
                  <input
                    ref={el => { subInputRefs.current[idx] = el; }}
                    value={sub}
                    onChange={e => updateSub(idx, e.target.value)}
                    onKeyDown={e => handleSubKeyDown(e, idx)}
                    placeholder="업무 내용..."
                    className="flex-1 bg-transparent text-xs outline-none min-w-0"
                    style={{ color: sub ? 'var(--text-faint)' : 'oklch(0.32 0.010 240)' }}
                  />
                  <button
                    onClick={() => removeSub(idx)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] px-1 rounded transition-all flex-shrink-0"
                    style={{ color: 'oklch(0.55 0.01 245)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 22)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.55 0.01 245)'; }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* 업무 추가 버튼 */}
          <button
            onClick={addSub}
            className="mt-1.5 flex items-center gap-1 text-[11px] transition-all"
            style={{ color: 'oklch(0.38 0.010 240)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = cat.color; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.38 0.010 240)'; }}
          >
            <Plus className="w-2.5 h-2.5" /> 업무 추가
          </button>
        </div>

        {/* 우측 컨트롤 */}
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {/* 상태 */}
          {!isNextWeek && (
            <div className="flex items-center gap-1">
              <StatIcon className="w-3 h-3 flex-shrink-0" style={{ color: sm.color }} />
              <select
                value={item.status}
                onChange={e => onUpdate({ status: e.target.value as WorkItemStatus })}
                className="bg-transparent text-[11px] outline-none cursor-pointer"
                style={{ color: sm.color }}
              >
                {(Object.keys(STATUS_META) as WorkItemStatus[]).map(k => (
                  <option key={k} value={k}>{STATUS_META[k].label}</option>
                ))}
              </select>
            </div>
          )}

          {/* 진행률 */}
          {!isNextWeek && item.status === 'in_progress' && (
            <div className="flex items-center gap-1 w-16">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.010 240)' }}>
                <div className="h-full rounded-full" style={{ width: `${item.progress}%`, background: 'oklch(0.72 0.18 218)' }} />
              </div>
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{item.progress}%</span>
            </div>
          )}

          {/* 펼치기 */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
            title="상세 설정"
          >
            <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>

          {/* 삭제 */}
          <button
            onClick={onDelete}
            className="p-1 rounded transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 22)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.70 0.20 22 / 0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 상세 펼침 (카테고리·프로젝트·진행률·비고) */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-2 space-y-3"
          style={{ borderTop: '1px solid oklch(0.20 0.010 240)', background: 'oklch(0.14 0.010 245)' }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label mb-1">카테고리</label>
              <select
                className="select text-xs"
                value={item.category}
                onChange={e => onUpdate({ category: e.target.value as WorkItemCategory })}
              >
                {(Object.keys(CATEGORY_META) as WorkItemCategory[]).map(k => (
                  <option key={k} value={k}>{CATEGORY_META[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">프로젝트/업무명</label>
              <input
                className="input text-xs"
                value={item.project_name ?? ''}
                onChange={e => onUpdate({ project_name: e.target.value || undefined })}
                placeholder="선택사항"
              />
            </div>
            {!isNextWeek && (
              <div>
                <label className="label mb-1">진행률 {item.progress}%</label>
                <input
                  type="range" min={0} max={100} step={5}
                  value={item.progress}
                  onChange={e => onUpdate({ progress: Number(e.target.value) })}
                  className="w-full accent-[oklch(0.76_0.16_196)] h-1.5 mt-2"
                />
              </div>
            )}
          </div>
          <div>
            <label className="label mb-1">비고</label>
            <textarea
              className="textarea w-full text-xs leading-relaxed"
              rows={3}
              value={item.note ?? ''}
              onChange={e => onUpdate({ note: e.target.value || undefined })}
              placeholder="참고사항, 이슈 등..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 빠른 추가 행 ────────────────────────────────────────── */
function QuickAddRow({ accent = 'oklch(0.76 0.16 196)', placeholder, onAdd }: {
  accent?: string;
  placeholder: string;
  onAdd: (content: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = async () => {
    const v = value.trim();
    if (!v) return;
    setAdding(true);
    try { await onAdd(v); setValue(''); }
    finally { setAdding(false); }
  };

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
      style={{ border: `1px dashed ${accent.replace(')', ' / 0.22)')}`, background: `${accent.replace(')', ' / 0.03)')}` }}
    >
      {adding
        ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: accent }} />
        : <Plus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
      }
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        disabled={adding}
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: 'var(--text-dim)', caretColor: accent }}
      />
    </div>
  );
}

/* ── 빈 섹션 ─────────────────────────────────────────────── */
function EmptySection({ label, onAdd, accent = 'oklch(0.76 0.16 196)' }: {
  label: string; onAdd: () => void; accent?: string;
}) {
  return (
    <button
      onClick={onAdd}
      className="w-full flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed transition-all"
      style={{ borderColor: `${accent.split(')')[0]} / 0.20)`.replace('oklch(', 'oklch('), color: 'var(--text-faint)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent.split(')')[0]} / 0.35)`.replace('oklch(', 'oklch('); (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${accent.split(')')[0]} / 0.20)`.replace('oklch(', 'oklch('); (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  );
}

/* ── PDF 프린트 HTML 생성 ────────────────────────────────── */
const CAT_LABEL: Record<string, string> = {
  project: '프로젝트', operation: '운영', support: '지원',
  education: '교육', meeting: '회의', other: '기타',
};
const STAT_LABEL: Record<string, string> = {
  completed: '완료', in_progress: '진행중', planned: '예정', cancelled: '취소',
};
const STAT_COLOR: Record<string, string> = {
  completed: '#2e7d32', in_progress: '#1565c0', planned: '#e65100', cancelled: '#9e9e9e',
};
const STAT_BG: Record<string, string> = {
  completed: '#e8f5e9', in_progress: '#e3f2fd', planned: '#fff3e0', cancelled: '#f5f5f5',
};

function generatePrintHTML(report: WorkWeeklyReport): string {
  const thisWeek = report.items.filter(i => !i.is_next_week);
  const nextWeek = report.items.filter(i => i.is_next_week);
  const done = thisWeek.filter(i => i.status === 'completed').length;

  const itemRow = (item: WorkWeeklyItem, idx: number, showStatus: boolean) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="width:28px;text-align:center;color:#8a9ab0;font-size:9pt">${idx + 1}</td>
      <td style="width:60px">
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:600;background:#f0f4f8;color:#4a5a6a">
          ${CAT_LABEL[item.category] ?? item.category}
        </span>
      </td>
      ${item.project_name ? `<td style="width:90px;font-size:9pt;color:#4a5a6a">${esc(item.project_name)}</td>` : `<td style="width:90px;color:#ccc;font-size:9pt">-</td>`}
      <td style="font-size:9.5pt;color:#1a2a3a;line-height:1.55">
        <strong>${esc(item.content)}</strong>
        ${item.sub_items && item.sub_items.filter(s => s.trim()).length > 0
          ? `<ul style="margin:4px 0 0 4px;padding:0;list-style:none">${item.sub_items.filter(s => s.trim()).map(s => `<li style="font-size:8.5pt;color:#4a5a6a;margin:2px 0">─ ${esc(s)}</li>`).join('')}</ul>`
          : ''}
        ${item.note ? `<div style="margin-top:4px;font-size:8.5pt;color:#5a6a7a;line-height:1.5;white-space:pre-wrap">${esc(item.note)}</div>` : ''}
      </td>
      ${showStatus ? `
      <td style="width:54px;text-align:center">
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700;background:${STAT_BG[item.status]};color:${STAT_COLOR[item.status]}">
          ${STAT_LABEL[item.status] ?? item.status}
        </span>
      </td>
      <td style="width:70px">
        <div style="display:flex;align-items:center;gap:4px">
          <div style="flex:1;height:6px;background:#e0e8f0;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${item.progress}%;background:#1a6abf;border-radius:3px"></div>
          </div>
          <span style="font-size:8pt;color:#6a7a8a;min-width:24px">${item.progress}%</span>
        </div>
      </td>` : '<td style="width:54px"></td><td style="width:70px"></td>'}
    </tr>`;

  const tableSection = (title: string, accent: string, items: WorkWeeklyItem[], showStatus: boolean) => `
    <div class="section">
      <div class="section-title" style="border-left-color:${accent}">${title}
        <span style="float:right;font-size:8pt;font-weight:400;color:#6a7a8a">${items.length}건</span>
      </div>
      ${items.length === 0
        ? `<div style="padding:12px;text-align:center;color:#bbb;font-size:9pt;border:1px dashed #e0e8f0;border-radius:4px">항목이 없습니다.</div>`
        : `<table>
            <thead>
              <tr>
                <th style="width:28px">#</th>
                <th style="width:60px">구분</th>
                <th style="width:90px">프로젝트</th>
                <th>고객사 / 업무내용</th>
                ${showStatus ? '<th style="width:54px">상태</th><th style="width:70px">진행률</th>' : '<th style="width:54px"></th><th style="width:70px"></th>'}
              </tr>
            </thead>
            <tbody>${items.map((it, i) => itemRow(it, i, showStatus)).join('')}</tbody>
          </table>`}
    </div>`;

  const totalPct = thisWeek.length > 0 ? Math.round((done / thisWeek.length) * 100) : 0;
  const now = new Date();

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>주간업무보고서 ${report.year}년 ${report.week_number}주차</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif; font-size: 10pt; color: #1a1a2e; background: white; }
    .report { max-width: 100%; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #1a3a5c; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left .title { font-size: 18pt; font-weight: 800; color: #1a3a5c; letter-spacing: -0.5px; }
    .header-left .subtitle { font-size: 10pt; color: #5a6a7a; margin-top: 3px; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; padding: 10px 12px; background: #f5f8fc; border-radius: 6px; border: 1px solid #e0e8f0; }
    .meta-item .meta-label { font-size: 7.5pt; color: #8a9ab0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-item .meta-value { font-size: 10pt; color: #2a3a4a; font-weight: 600; margin-top: 2px; }
    .progress-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 8px 12px; background: #e8f4fd; border-radius: 6px; border: 1px solid #b3d9f5; }
    .progress-summary .prog-label { font-size: 9pt; color: #1565c0; font-weight: 600; white-space: nowrap; }
    .progress-summary .prog-track { flex: 1; height: 8px; background: #c0d8ee; border-radius: 4px; overflow: hidden; }
    .progress-summary .prog-fill { height: 100%; background: #1a6abf; border-radius: 4px; }
    .progress-summary .prog-text { font-size: 9pt; font-weight: 700; color: #1a3a5c; white-space: nowrap; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 10.5pt; font-weight: 700; color: #1a3a5c; padding: 5px 10px; background: #eef3f9; border-left: 4px solid #1a6abf; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a3a5c; color: white; padding: 5px 8px; text-align: left; font-size: 8.5pt; font-weight: 600; }
    td { padding: 7px 8px; border-bottom: 1px solid #eaf0f8; font-size: 9pt; vertical-align: top; }
    .notes-box { background: #fffde7; border: 1px solid #f0e060; border-radius: 6px; padding: 12px; min-height: 56px; font-size: 9.5pt; line-height: 1.65; white-space: pre-wrap; color: #3a3a2a; }
    .empty-notes { color: #bbb; font-style: italic; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e8f0; text-align: right; font-size: 8pt; color: #9aabb0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="report">
  <div class="header">
    <div class="header-left">
      <div class="title">${report.title ? esc(report.title) : '주간업무'}</div>
      <div class="subtitle">${report.year}년 제${report.week_number}주차 &nbsp;·&nbsp; ${fmtWeekRangeFull(report.week_start, report.week_end)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">작성자</div><div class="meta-value">${esc(report.author_name ?? report.author)}</div></div>
    <div class="meta-item"><div class="meta-label">부서</div><div class="meta-value">${esc(report.department ?? '-')}</div></div>
    <div class="meta-item"><div class="meta-label">기간</div><div class="meta-value">${fmtWeekRange(report.week_start, report.week_end)}</div></div>
    <div class="meta-item"><div class="meta-label">이번 주 업무</div><div class="meta-value">${thisWeek.length}건 (완료 ${done}건)</div></div>
  </div>

  ${report.summary ? `
  <div class="section">
    <div class="section-title" style="border-left-color:#7b1fa2">이번 주 종합</div>
    <div style="padding:10px 12px;background:#fdf4ff;border:1px solid #e1bee7;border-radius:4px;font-size:9.5pt;line-height:1.65;white-space:pre-wrap;color:#3a1a4a">${esc(report.summary)}</div>
  </div>` : ''}

  ${thisWeek.length > 0 ? `
  <div class="progress-summary">
    <span class="prog-label">이번 주 완료율</span>
    <div class="prog-track"><div class="prog-fill" style="width:${totalPct}%"></div></div>
    <span class="prog-text">${done} / ${thisWeek.length} &nbsp; ${totalPct}%</span>
  </div>` : ''}

  ${tableSection('이번 주 업무', '#1a6abf', thisWeek, true)}
  ${tableSection('다음 주 계획', '#e65100', nextWeek, false)}

  <div class="section">
    <div class="section-title" style="border-left-color:#c62828">특이사항 / 종합 의견</div>
    <div class="notes-box ${!report.note ? 'empty-notes' : ''}">
      ${report.note ? esc(report.note) : '특이사항 없음'}
    </div>
  </div>

  <div class="footer">
    ${report.year}년 ${report.week_number}주차 주간업무 &nbsp;·&nbsp; ${esc(report.author_name ?? report.author)} &nbsp;·&nbsp; 출력일시: ${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}
  </div>
</div>
<style>.print-btn{position:fixed;top:16px;right:16px;padding:8px 16px;background:#1a3a5c;color:#fff;border:none;border-radius:6px;font-size:10pt;cursor:pointer;font-family:inherit}@media print{.print-btn{display:none}}</style>
<button class="print-btn" onclick="window.print()">🖨 인쇄 / PDF 저장</button>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
