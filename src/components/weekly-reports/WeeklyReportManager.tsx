'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { weeklyReportsApi, getAuthMeta } from '@/lib/api';
import type { WeeklyReport, WeeklyReportHealth } from '@/lib/types';
import {
  Plus, ChevronLeft, Trash2, Send, FileEdit, Activity,
  AlertTriangle, CheckCircle2, CalendarDays, User, Users,
  Loader2, ClipboardList, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import { format, parseISO, getISOWeek, getYear } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── 상수 ── */
const HEALTH_META: Record<WeeklyReportHealth, { label: string; color: string; bg: string; border: string; glow: string; icon: React.ElementType }> = {
  good:     { label: '정상',    color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.30)', glow: 'oklch(0.76 0.16 152 / 0.20)', icon: CheckCircle2  },
  caution:  { label: '주의',    color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.84 0.16 82 / 0.12)',  border: 'oklch(0.62 0.12 82 / 0.30)',  glow: 'oklch(0.84 0.16 82 / 0.20)',  icon: AlertTriangle  },
  critical: { label: '위험',    color: 'oklch(0.70 0.20 22)',  bg: 'oklch(0.70 0.20 22 / 0.12)',  border: 'oklch(0.55 0.14 22 / 0.30)',  glow: 'oklch(0.70 0.20 22 / 0.20)',  icon: AlertTriangle  },
};

const STATUS_META = {
  draft:     { label: '초안',   color: 'oklch(0.60 0.01 245)', bg: 'oklch(0.22 0.010 240 / 0.60)', border: 'oklch(0.28 0.010 238)' },
  published: { label: '발행',   color: 'oklch(0.76 0.16 196)', bg: 'oklch(0.76 0.16 196 / 0.12)', border: 'oklch(0.55 0.12 196 / 0.30)' },
};

const SECTIONS = [
  { key: 'summary',          label: '이번 주 요약',     placeholder: '이번 주 주요 활동과 진행 상황을 요약해주세요.' },
  { key: 'completed_work',   label: '완료 업무',         placeholder: '이번 주 완료한 업무를 작성해주세요.' },
  { key: 'in_progress_work', label: '진행 중 업무',      placeholder: '현재 진행 중인 업무를 작성해주세요.' },
  { key: 'issues',           label: '이슈 / 문제점',     placeholder: '발생한 이슈나 문제점을 작성해주세요.' },
  { key: 'next_week_plan',   label: '다음 주 계획',      placeholder: '다음 주 예정된 업무 계획을 작성해주세요.' },
  { key: 'risk_notes',       label: '리스크 / 특이사항', placeholder: '주의가 필요한 리스크나 특이사항을 작성해주세요.' },
] as const;

function isoWeekToDisplay(year: number, week: number, start: string, end: string) {
  const s = format(parseISO(start), 'MM/dd', { locale: ko });
  const e = format(parseISO(end),   'MM/dd', { locale: ko });
  return `${year}년 ${week}주차 (${s} ~ ${e})`;
}

function getCurrentYearWeek() {
  const now = new Date();
  return { year: getYear(now), week: getISOWeek(now) };
}

interface Props { projectId: number }

/* ══════════════════════════════════════════════════════════════ */
export default function WeeklyReportManager({ projectId }: Props) {
  const [reports,  setReports]  = useState<WeeklyReport[]>([]);
  const [selected, setSelected] = useState<WeeklyReport | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await weeklyReportsApi.list(projectId);
      setReports(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!await confirm('이 주간보고를 삭제하시겠습니까?')) return;
    await weeklyReportsApi.delete(id);
    setReports(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('주간보고가 삭제되었습니다.');
  };

  const handleSaved = (report: WeeklyReport) => {
    setReports(prev => {
      const idx = prev.findIndex(r => r.id === report.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = report;
        return next;
      }
      return [report, ...prev];
    });
    setSelected(report);
    setShowNew(false);
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── 좌측 목록 패널 ── */}
      <div
        className="flex flex-col flex-shrink-0 w-72"
        style={{
          borderRight: '1px solid oklch(0.20 0.010 240)',
          background: 'linear-gradient(180deg, oklch(0.17 0.010 243) 0%, oklch(0.15 0.010 245) 100%)',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                background: 'oklch(0.76 0.16 196 / 0.12)',
                border: '1px solid oklch(0.55 0.12 196 / 0.30)',
                color: 'var(--accent)',
              }}
            >
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>주간보고</span>
            {reports.length > 0 && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'oklch(0.22 0.010 240)',
                  color: 'var(--text-faint)',
                  border: '1px solid oklch(0.28 0.010 238)',
                }}
              >
                {reports.length}
              </span>
            )}
          </div>
          <button
            onClick={() => { setShowNew(true); setSelected(null); }}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--text-faint)' }}
            title="새 주간보고"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'oklch(0.76 0.16 196 / 0.10)',
                  border: '1px solid oklch(0.55 0.12 196 / 0.25)',
                  boxShadow: '0 0 16px oklch(0.76 0.16 196 / 0.10)',
                }}
              >
                <ClipboardList className="w-5 h-5" style={{ color: 'oklch(0.76 0.16 196 / 0.50)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>보고서 없음</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="text-xs mt-1 transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  첫 주간보고 작성 →
                </button>
              </div>
            </div>
          ) : (
            reports.map(r => {
              const health = HEALTH_META[r.project_health];
              const HealthIcon = health.icon;
              const status = STATUS_META[r.status];
              const active = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelected(r); setShowNew(false); }}
                  className="w-full px-4 py-3 text-left transition-all duration-150 relative"
                  style={{
                    borderBottom: '1px solid oklch(0.18 0.010 242 / 0.70)',
                    background: active
                      ? 'linear-gradient(90deg, oklch(0.76 0.16 196 / 0.07) 0%, transparent 100%)'
                      : 'transparent',
                    borderLeft: active ? '2px solid oklch(0.76 0.16 196)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0.010 241 / 0.60)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  {active && (
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, oklch(0.76 0.16 196 / 0.05) 0%, transparent 60%)' }} />
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    {/* 헬스 아이콘 */}
                    <div
                      className="p-1 rounded-md flex-shrink-0"
                      style={{ background: health.bg, border: `1px solid ${health.border}`, color: health.color }}
                    >
                      <HealthIcon className="w-2.5 h-2.5" />
                    </div>

                    <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-dim)' }}>
                      {r.year}년 {r.week_number}주차
                    </span>

                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="text-[11px] truncate pl-7" style={{ color: 'var(--text-faint)' }}>
                    {r.title ?? `${r.year}년 ${r.week_number}주차 주간보고`}
                  </p>

                  <div className="flex items-center gap-1 mt-1 pl-7">
                    <CalendarDays className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                      {format(parseISO(r.week_start), 'MM/dd', { locale: ko })} ~ {format(parseISO(r.week_end), 'MM/dd', { locale: ko })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── 우측 패널 ── */}
      <div className="flex-1 overflow-hidden" style={{ background: 'oklch(0.14 0.010 245)' }}>
        {showNew ? (
          <NewReportForm
            projectId={projectId}
            onCancel={() => setShowNew(false)}
            onSaved={handleSaved}
          />
        ) : selected ? (
          <ReportDetail
            key={selected.id}
            report={selected}
            onSaved={handleSaved}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'oklch(0.76 0.16 196 / 0.08)',
                  border: '1px solid oklch(0.55 0.12 196 / 0.20)',
                  boxShadow: '0 0 24px oklch(0.76 0.16 196 / 0.08)',
                }}
              >
                <ClipboardList className="w-7 h-7" style={{ color: 'oklch(0.76 0.16 196 / 0.50)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>보고서를 선택하거나 새로 작성하세요</p>
              <button
                onClick={() => setShowNew(true)}
                className="btn btn-primary mt-4"
                style={{ paddingLeft: 16, paddingRight: 16 }}
              >
                <Plus className="w-3.5 h-3.5" /> 새 주간보고
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 새 보고서 생성 폼 ── */
function NewReportForm({ projectId, onCancel, onSaved }: {
  projectId: number;
  onCancel: () => void;
  onSaved: (r: WeeklyReport) => void;
}) {
  const { year: cYear, week: cWeek } = getCurrentYearWeek();
  const [year,   setYear]   = useState(cYear);
  const [week,   setWeek]   = useState(cWeek);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const meta = getAuthMeta();

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const report = await weeklyReportsApi.create({
        project_id: projectId,
        year,
        week_number: week,
        written_by: meta?.username ?? '',
      });
      onSaved(report);
      toast.success('주간보고가 생성되었습니다.');
    } catch (e: any) {
      setError(e.message ?? '생성 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{
          borderBottom: '1px solid oklch(0.20 0.010 240)',
          background: 'oklch(0.16 0.010 244)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>새 주간보고</h2>
        </div>
      </div>

      <div className="p-8 max-w-md mx-auto w-full">
        {/* 주차 선택 */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'oklch(0.16 0.010 244)',
            border: '1px solid oklch(0.22 0.010 240)',
          }}
        >
          {/* top accent */}
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, oklch(0.76 0.16 196), transparent)', opacity: 0.6 }} />

          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'oklch(0.76 0.16 196 / 0.12)',
                  border: '1px solid oklch(0.55 0.12 196 / 0.30)',
                  boxShadow: '0 0 12px oklch(0.76 0.16 196 / 0.15)',
                  color: 'var(--accent)',
                }}
              >
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>보고 주차 선택</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>보고서를 작성할 연도와 주차를 선택하세요</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">연도</label>
                <select
                  className="select"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                >
                  {[cYear - 1, cYear, cYear + 1].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">주차</label>
                <select
                  className="select"
                  value={week}
                  onChange={e => setWeek(Number(e.target.value))}
                >
                  {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>{w}주차</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 미리보기 */}
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{
                background: 'oklch(0.14 0.010 245)',
                border: '1px solid oklch(0.22 0.010 240)',
                color: 'var(--text-dim)',
              }}
            >
              <span style={{ color: 'var(--text-faint)' }}>생성될 보고서: </span>
              <span className="font-semibold">{year}년 {week}주차 주간보고</span>
            </div>

            {error && (
              <div
                className="px-4 py-2.5 rounded-xl text-xs"
                style={{
                  background: 'oklch(0.70 0.20 22 / 0.10)',
                  border: '1px solid oklch(0.55 0.14 22 / 0.30)',
                  color: 'oklch(0.70 0.20 22)',
                }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onCancel} className="btn btn-ghost flex-1">취소</button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary flex-1">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {saving ? '생성 중...' : '보고서 생성'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 보고서 상세 / 편집 ── */
function ReportDetail({ report: initial, onSaved, onDelete }: {
  report: WeeklyReport;
  onSaved: (r: WeeklyReport) => void;
  onDelete: () => void;
}) {
  const [form,    setForm]    = useState({ ...initial });
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setForm({ ...initial }); setDirty(false); }, [initial.id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setDirty(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => autoSave({ ...form, [k]: v }), 1500);
  };

  const autoSave = async (data: typeof form) => {
    try {
      const updated = await weeklyReportsApi.update(data.id, {
        title:            data.title ?? undefined,
        project_health:   data.project_health,
        summary:          data.summary ?? undefined,
        completed_work:   data.completed_work ?? undefined,
        in_progress_work: data.in_progress_work ?? undefined,
        issues:           data.issues ?? undefined,
        next_week_plan:   data.next_week_plan ?? undefined,
        risk_notes:       data.risk_notes ?? undefined,
        written_by:       data.written_by ?? undefined,
        reviewed_by:      data.reviewed_by ?? undefined,
      });
      onSaved(updated);
      setDirty(false);
    } catch { /* ignore auto-save errors */ }
  };

  const handleSave = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaving(true);
    try {
      const updated = await weeklyReportsApi.update(form.id, {
        title:            form.title ?? undefined,
        project_health:   form.project_health,
        summary:          form.summary ?? undefined,
        completed_work:   form.completed_work ?? undefined,
        in_progress_work: form.in_progress_work ?? undefined,
        issues:           form.issues ?? undefined,
        next_week_plan:   form.next_week_plan ?? undefined,
        risk_notes:       form.risk_notes ?? undefined,
        written_by:       form.written_by ?? undefined,
        reviewed_by:      form.reviewed_by ?? undefined,
      });
      onSaved(updated);
      setDirty(false);
      toast.success('저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!await confirm('이 보고서를 발행하시겠습니까? 발행 후에도 수정할 수 있습니다.', { danger: false, title: '발행 확인', confirmLabel: '발행' })) return;
    const updated = await weeklyReportsApi.update(form.id, { status: 'published' });
    setForm(p => ({ ...p, status: 'published' }));
    onSaved(updated);
    toast.success('발행되었습니다.');
  };

  const health = HEALTH_META[form.project_health as WeeklyReportHealth];
  const HealthIcon = health.icon;
  const status = STATUS_META[form.status as keyof typeof STATUS_META];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 툴바 */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 gap-3"
        style={{
          borderBottom: '1px solid oklch(0.20 0.010 240)',
          background: 'oklch(0.16 0.010 244)',
        }}
      >
        {/* 주차 + 상태 */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-1.5 rounded-lg flex-shrink-0"
            style={{ background: health.bg, border: `1px solid ${health.border}`, boxShadow: `0 0 10px ${health.glow}`, color: health.color }}
          >
            <HealthIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>
              {isoWeekToDisplay(form.year, form.week_number, form.week_start, form.week_end)}
            </p>
          </div>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
          >
            {status.label}
          </span>
          {dirty && (
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
              저장 대기 중...
            </span>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn btn-ghost"
            style={{ height: 30, paddingLeft: 12, paddingRight: 12, fontSize: 11 }}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileEdit className="w-3 h-3" />}
            저장
          </button>
          {form.status === 'draft' && (
            <button
              onClick={handlePublish}
              className="btn btn-primary"
              style={{ height: 30, paddingLeft: 12, paddingRight: 12, fontSize: 11 }}
            >
              <Send className="w-3 h-3" /> 발행
            </button>
          )}
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

      {/* 본문 편집 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* 제목 */}
          <input
            value={form.title ?? ''}
            onChange={e => set('title', e.target.value)}
            placeholder={`${form.year}년 ${form.week_number}주차 주간보고`}
            className="w-full bg-transparent text-2xl font-bold outline-none placeholder:opacity-30 border-b pb-3 transition-colors"
            style={{
              color: 'var(--text)',
              borderColor: 'oklch(0.22 0.010 240)',
            }}
            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.55 0.12 196 / 0.50)'; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.22 0.010 240)'; }}
          />

          {/* 메타 행 */}
          <div
            className="grid grid-cols-2 gap-3 p-4 rounded-xl"
            style={{
              background: 'oklch(0.16 0.010 244)',
              border: '1px solid oklch(0.22 0.010 240)',
            }}
          >
            {/* 프로젝트 상태 */}
            <div>
              <label className="label mb-2">프로젝트 건강도</label>
              <div className="flex gap-2">
                {(Object.entries(HEALTH_META) as [WeeklyReportHealth, typeof HEALTH_META[WeeklyReportHealth]][]).map(([k, m]) => {
                  const Icon = m.icon;
                  const active = form.project_health === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set('project_health', k)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? m.bg : 'transparent',
                        color: active ? m.color : 'var(--text-faint)',
                        border: `1px solid ${active ? m.border : 'oklch(0.24 0.010 238)'}`,
                        boxShadow: active ? `0 0 8px ${m.glow}` : 'none',
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 작성자 / 검토자 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                <input
                  value={form.written_by ?? ''}
                  onChange={e => set('written_by', e.target.value)}
                  placeholder="작성자"
                  className="flex-1 bg-transparent text-xs outline-none border-b transition-colors"
                  style={{ color: 'var(--text-dim)', borderColor: 'oklch(0.22 0.010 240)' }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.55 0.12 196 / 0.50)'; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.22 0.010 240)'; }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                <input
                  value={form.reviewed_by ?? ''}
                  onChange={e => set('reviewed_by', e.target.value)}
                  placeholder="검토자"
                  className="flex-1 bg-transparent text-xs outline-none border-b transition-colors"
                  style={{ color: 'var(--text-dim)', borderColor: 'oklch(0.22 0.010 240)' }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.55 0.12 196 / 0.50)'; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.22 0.010 240)'; }}
                />
              </div>
            </div>
          </div>

          {/* 섹션 편집 */}
          {SECTIONS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-1 h-4 rounded-full"
                  style={{ background: 'oklch(0.76 0.16 196)', boxShadow: '0 0 6px oklch(0.76 0.16 196 / 0.40)' }}
                />
                <label className="text-xs font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-dim)' }}>
                  {label}
                </label>
              </div>
              <textarea
                value={(form[key as keyof typeof form] as string | null) ?? ''}
                onChange={e => set(key as keyof typeof form, e.target.value as any)}
                placeholder={placeholder}
                rows={4}
                className="textarea w-full text-sm resize-y"
                style={{ minHeight: 80 }}
              />
            </div>
          ))}

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
