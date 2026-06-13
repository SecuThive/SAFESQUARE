'use client';

import { useEffect, useState, FormEvent } from 'react';
import { incidentsApi } from '@/lib/api';
import type { Incident, IncidentSeverity, IncidentStatus } from '@/lib/types';
import { Plus, X, Edit2, Trash2, ChevronDown, AlertOctagon, BookPlus, Sparkles, ChevronRight, BookOpen, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { guidesApi } from '@/lib/api';
import { confirm } from '@/lib/confirm';

/* ── 메타 ── */
const SEV_META: Record<IncidentSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: '심각', color: 'text-red-300',    bg: 'bg-red-900/30',    border: 'border-red-700/50' },
  high:     { label: '높음', color: 'text-orange-300', bg: 'bg-orange-900/20', border: 'border-orange-700/40' },
  medium:   { label: '중간', color: 'text-yellow-300', bg: 'bg-yellow-900/20', border: 'border-yellow-700/30' },
  low:      { label: '낮음', color: 'text-blue-300',   bg: 'bg-blue-900/20',   border: 'border-blue-700/30' },
};

const STATUS_META: Record<IncidentStatus, { label: string; color: string; bg: string }> = {
  open:          { label: '발생',     color: 'text-red-400',    bg: 'bg-red-900/20'    },
  investigating: { label: '조사 중',  color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
  resolved:      { label: '해결됨',   color: 'text-green-400',  bg: 'bg-green-900/20'  },
  closed:        { label: '종료',     color: 'text-gray-400',   bg: 'bg-gray-700/30'   },
};

const toLocal = (dt: string) => {
  const d = new Date(dt);
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

interface Props { projectId: number; }

/* ═══════════════════════════════════════════════════════ */
export default function IncidentList({ projectId }: Props) {
  const [incidents,     setIncidents]     = useState<Incident[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState<Incident | null>(null);
  const [expanded,      setExpanded]      = useState<number | null>(null);
  const [saveGuideFor,  setSaveGuideFor]  = useState<Incident | null>(null);

  useEffect(() => {
    incidentsApi.list(projectId)
      .then(setIncidents)
      .finally(() => setLoading(false));
  }, [projectId]);

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(inc: Incident) { setEditing(inc); setShowModal(true); }

  async function handleSave(data: any) {
    if (editing) {
      const updated = await incidentsApi.update(editing.id, data);
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } else {
      const created = await incidentsApi.create({ ...data, project_id: projectId });
      setIncidents((prev) => [created, ...prev]);
    }
    setShowModal(false);
  }

  async function handleDelete(id: number) {
    if (!await confirm('이 장애 이력을 삭제하시겠습니까?')) return;
    await incidentsApi.delete(id);
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    if (expanded === id) setExpanded(null);
  }

  const open    = incidents.filter((i) => ['open', 'investigating'].includes(i.status)).length;
  const critical = incidents.filter((i) => i.severity === 'critical' && i.status !== 'closed').length;

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200">장애 이력</h2>
          {open > 0 && (
            <span className="text-xs font-medium text-red-400 bg-red-900/20 px-2 py-0.5 rounded-full">
              미처리 {open}건
            </span>
          )}
          {critical > 0 && (
            <span className="text-xs font-medium text-red-300 bg-red-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" /> 심각 {critical}건
            </span>
          )}
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> 장애 등록
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-raised border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertOctagon className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">등록된 장애 이력이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => {
            const sev = SEV_META[inc.severity as IncidentSeverity] ?? SEV_META.medium;
            const st  = STATUS_META[inc.status as IncidentStatus]  ?? STATUS_META.open;
            const isOpen = expanded === inc.id;

            return (
              <div
                key={inc.id}
                className={clsx(
                  'bg-surface-raised border rounded-xl overflow-hidden transition-colors',
                  sev.border,
                )}
              >
                {/* 행 */}
                <div
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-800/20 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : inc.id)}
                >
                  {/* 심각도 */}
                  <span className={clsx('text-xs font-bold px-2 py-0.5 rounded flex-shrink-0', sev.bg, sev.color)}>
                    {sev.label}
                  </span>

                  {/* 제목 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{inc.title}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {format(new Date(inc.occurred_at), 'yyyy.MM.dd HH:mm')}
                      {inc.resolved_at && (
                        <span className="ml-2">
                          → {format(new Date(inc.resolved_at), 'yyyy.MM.dd HH:mm')}
                          {' '}
                          <span className="text-green-600">
                            ({formatDistanceToNow(new Date(inc.occurred_at), { addSuffix: false, locale: ko })} 후 해결)
                          </span>
                        </span>
                      )}
                    </p>
                  </div>

                  {/* 상태 */}
                  <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', st.bg, st.color)}>
                    {st.label}
                  </span>

                  {/* 액션 */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(inc)} className="p-1.5 rounded text-gray-600 hover:text-brand hover:bg-brand/10 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(inc.id)} className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronDown className={clsx('w-4 h-4 text-gray-600 transition-transform', isOpen && 'rotate-180')} />
                  </div>
                </div>

                {/* 상세 */}
                {isOpen && (
                  <div className="border-t border-gray-800/60 px-5 py-4 space-y-3 bg-surface/40">
                    <Detail label="장애 내용" content={inc.description} />
                    {inc.root_cause && <Detail label="원인 분석" content={inc.root_cause} color="text-orange-400" />}
                    {inc.resolution && <Detail label="해결 방법" content={inc.resolution} color="text-green-400" />}
                    {(inc.root_cause || inc.resolution) && (
                      <div className="pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSaveGuideFor(inc); }}
                          className="flex items-center gap-1.5 text-xs text-brand hover:underline"
                        >
                          <BookPlus className="w-3.5 h-3.5" />
                          트러블슈팅 가이드로 저장
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <IncidentModal
          editing={editing}
          projectId={projectId}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
      {saveGuideFor && (
        <SaveAsGuideModal
          incident={saveGuideFor}
          projectId={projectId}
          onClose={() => setSaveGuideFor(null)}
        />
      )}
    </div>
  );
}

/* ── 상세 섹션 ── */
function Detail({ label, content, color }: { label: string; content: string; color?: string }) {
  return (
    <div>
      <p className={clsx('text-xs font-semibold mb-1', color ?? 'text-gray-500')}>{label}</p>
      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

/* ── 장애 등록/수정 모달 ── */
function IncidentModal({
  editing, projectId, onSave, onClose,
}: {
  editing:   Incident | null;
  projectId: number;
  onSave:    (data: any) => Promise<void>;
  onClose:   () => void;
}) {
  const [mode, setMode] = useState<'manual' | 'ai'>(editing ? 'manual' : 'ai');
  const [form, setForm] = useState({
    title:       editing?.title       ?? '',
    occurred_at: editing ? toLocal(editing.occurred_at) : nowLocal(),
    resolved_at: editing?.resolved_at ? toLocal(editing.resolved_at) : '',
    severity:    editing?.severity    ?? 'medium',
    status:      editing?.status      ?? 'open',
    description: editing?.description ?? '',
    root_cause:  editing?.root_cause  ?? '',
    resolution:  editing?.resolution  ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // AI 분석 상태
  const [rawText,       setRawText]       = useState('');
  const [analyzing,     setAnalyzing]     = useState(false);
  const [aiPhase,       setAiPhase]       = useState('');
  const [aiGuides,      setAiGuides]      = useState<any[]>([]);
  const [aiPastIncs,    setAiPastIncs]    = useState<any[]>([]);
  const [recommendation,setRecommendation]= useState('');
  const [analyzed,      setAnalyzed]      = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleStatusChange = (v: string) => {
    setForm((f) => ({
      ...f,
      status: v as IncidentStatus,
      resolved_at: !f.resolved_at && ['resolved', 'closed'].includes(v) ? nowLocal() : f.resolved_at,
    }));
  };

  async function handleAnalyze() {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    setAnalyzed(false);
    setRecommendation('');
    setAiGuides([]);
    setAiPastIncs([]);
    setAiPhase('시작 중…');

    try {
      const res = await incidentsApi.aiAnalyze(rawText, projectId);
      if (!res.body) throw new Error('스트림 없음');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.phase === 'extracting' || event.phase === 'searching' || event.phase === 'recommending') {
              setAiPhase(event.message);
            } else if (event.phase === 'structure') {
              const d = event.data;
              setForm(f => ({
                ...f,
                title:       d.title       || f.title,
                description: d.description || f.description,
                root_cause:  d.root_cause  || f.root_cause,
                severity:    d.severity    || f.severity,
                status:      d.status      || f.status,
              }));
            } else if (event.phase === 'context') {
              setAiGuides(event.guides   ?? []);
              setAiPastIncs(event.past_incidents ?? []);
            } else if (event.phase === 'token') {
              setRecommendation(prev => prev + event.content);
            } else if (event.phase === 'done') {
              setAiPhase('');
              setAnalyzed(true);
            } else if (event.phase === 'error') {
              setError(event.message);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message ?? '분석 실패');
    } finally {
      setAnalyzing(false);
    }
  }

  function applyRecommendation() {
    if (recommendation) setForm(f => ({ ...f, resolution: recommendation }));
    setMode('manual');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        title:       form.title,
        occurred_at: new Date(form.occurred_at).toISOString(),
        resolved_at: form.resolved_at ? new Date(form.resolved_at).toISOString() : null,
        severity:    form.severity,
        status:      form.status,
        description: form.description,
        root_cause:  form.root_cause  || null,
        resolution:  form.resolution  || null,
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
        className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-100">
              {editing ? '장애 이력 수정' : '장애 등록'}
            </h2>
            {!editing && (
              <div className="flex bg-surface border border-gray-700 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setMode('ai')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    mode === 'ai' ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-300',
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  AI 분석
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    mode === 'manual' ? 'bg-surface-raised text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-300',
                  )}
                >
                  직접 입력
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── 왼쪽: 폼 ── */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* AI 입력 영역 */}
              {mode === 'ai' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-brand/5 border border-brand/20">
                    <Sparkles className="w-4 h-4 text-brand flex-shrink-0" />
                    <p className="text-xs text-gray-400">
                      장애 상황을 자유롭게 작성하면 AI가 자동으로 구조화하고 해결방법을 추천합니다.
                    </p>
                  </div>
                  <div>
                    <label className="label">장애 상황 자유 입력</label>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder={"예) 오후 2시쯤 고객사에서 OTP 인증이 안 된다고 연락 옴.\n서버 접속해서 로그 보니까 DB connection refused 에러 계속 뜨고 있었음.\n서비스 재시작했더니 일단 됨. 근데 왜 났는지 모르겠음."}
                      rows={5}
                      className="textarea w-full text-sm"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing || !rawText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-xl hover:bg-brand/90 disabled:opacity-50 transition-all w-full justify-center"
                  >
                    {analyzing ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {aiPhase || '분석 중…'}
                      </>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" />AI 분석 시작</>
                    )}
                  </button>

                  {analyzed && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-xs text-green-400">분석 완료 — 아래 필드가 자동 채워졌습니다. 수정 후 저장하세요.</p>
                    </div>
                  )}

                  {analyzed && <div className="border-t border-gray-800 pt-3" />}
                </div>
              )}

              {/* 공통 폼 필드 (항상 표시) */}
              {(mode === 'manual' || analyzed) && (
                <>
                  <div>
                    <label className="label">장애 제목 *</label>
                    <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
                      placeholder="예: DB 연결 장애" required className="input w-full" autoFocus={mode === 'manual'} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">심각도</label>
                      <select value={form.severity} onChange={(e) => set('severity', e.target.value)} className="select w-full">
                        {Object.entries(SEV_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">상태</label>
                      <select value={form.status} onChange={(e) => handleStatusChange(e.target.value)} className="select w-full">
                        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">발생 시각 *</label>
                      <input type="datetime-local" value={form.occurred_at} onChange={(e) => set('occurred_at', e.target.value)} required className="input w-full" />
                    </div>
                    <div>
                      <label className="label">해결 시각 <span className="text-gray-600 font-normal">(선택)</span></label>
                      <input type="datetime-local" value={form.resolved_at} onChange={(e) => set('resolved_at', e.target.value)} className="input w-full" />
                    </div>
                  </div>

                  <div>
                    <label className="label">장애 내용 *</label>
                    <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                      placeholder="발생한 증상, 영향 범위" required rows={3} className="textarea w-full" />
                  </div>

                  <div>
                    <label className="label">원인 분석 <span className="text-gray-600 font-normal">(선택)</span></label>
                    <textarea value={form.root_cause} onChange={(e) => set('root_cause', e.target.value)}
                      placeholder="근본 원인" rows={2} className="textarea w-full" />
                  </div>

                  <div>
                    <label className="label">
                      해결 방법
                      <span className="text-gray-600 font-normal ml-1">(선택)</span>
                      {recommendation && mode === 'ai' && (
                        <button type="button" onClick={applyRecommendation}
                          className="ml-2 text-brand text-[11px] hover:underline">
                          AI 추천 내용 적용 →
                        </button>
                      )}
                    </label>
                    <textarea value={form.resolution} onChange={(e) => set('resolution', e.target.value)}
                      placeholder="조치 내용 및 재발 방지 대책" rows={2} className="textarea w-full" />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="flex gap-2 px-6 pb-5 pt-3 border-t border-gray-800 flex-shrink-0">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
              <button
                type="submit"
                disabled={saving || (mode === 'ai' && !analyzed)}
                className="btn-primary flex-1"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>

          {/* ── 오른쪽: AI 분석 결과 패널 ── */}
          {(aiGuides.length > 0 || recommendation || analyzing) && (
            <div className="w-80 flex-shrink-0 border-l border-gray-800 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
                <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand" />
                  AI 분석 결과
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 관련 가이드 */}
                {aiGuides.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> 관련 가이드
                    </p>
                    <div className="space-y-2">
                      {aiGuides.map((g, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-surface border border-gray-800">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-gray-300 font-medium leading-snug">{g.title}</p>
                            <span className="text-[10px] text-brand flex-shrink-0 font-mono">
                              {Math.round((g.similarity ?? 0) * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 mt-1">{g.type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 유사 과거 장애 */}
                {aiPastIncs.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 유사 과거 장애
                    </p>
                    <div className="space-y-2">
                      {aiPastIncs.map((inc, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-surface border border-gray-800">
                          <p className="text-xs text-gray-300 font-medium leading-snug">{inc.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5">{inc.occurred_at}</p>
                          {inc.resolution && (
                            <p className="text-[11px] text-green-500/80 mt-1 line-clamp-2">{inc.resolution}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 해결방법 추천 스트리밍 */}
                {(recommendation || analyzing) && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3" /> 해결방법 추천
                      {analyzing && !recommendation && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                      )}
                    </p>
                    <div className="prose-dark text-xs leading-relaxed text-gray-300 whitespace-pre-wrap bg-surface border border-gray-800 rounded-lg p-3">
                      {recommendation}
                      {analyzing && <span className="inline-block w-1.5 h-3.5 bg-brand animate-pulse ml-0.5 align-middle" />}
                    </div>
                    {recommendation && !analyzing && (
                      <button
                        type="button"
                        onClick={applyRecommendation}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-brand border border-brand/30 rounded-lg hover:bg-brand/10 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                        해결방법 필드에 적용
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 장애 → 트러블슈팅 가이드 저장 모달 ── */
function SaveAsGuideModal({
  incident, projectId, onClose,
}: {
  incident: Incident;
  projectId: number;
  onClose: () => void;
}) {
  const defaultContent = [
    '## 장애 개요',
    incident.description,
    '',
    incident.root_cause ? `## 원인 분석\n${incident.root_cause}` : '',
    incident.resolution ? `## 해결 방법\n${incident.resolution}` : '',
    '',
    '## 발생 정보',
    `- 발생: ${format(new Date(incident.occurred_at), 'yyyy.MM.dd HH:mm')}`,
    incident.resolved_at ? `- 해결: ${format(new Date(incident.resolved_at), 'yyyy.MM.dd HH:mm')}` : '',
    `- 심각도: ${SEV_META[incident.severity as IncidentSeverity]?.label ?? incident.severity}`,
  ].filter((l) => l !== '').join('\n');

  const [title,   setTitle]   = useState(`[장애대응] ${incident.title}`);
  const [content, setContent] = useState(defaultContent);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave() {
    if (!title.trim()) { setError('제목을 입력하세요'); return; }
    setSaving(true);
    setError('');
    try {
      await guidesApi.create({ project_id: projectId, title, content, type: 'troubleshooting' });
      onClose();
    } catch (e: any) {
      setError(e.message ?? '저장에 실패했습니다');
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
          <div>
            <h2 className="text-base font-semibold text-gray-100">트러블슈팅 가이드로 저장</h2>
            <p className="text-xs text-gray-500 mt-0.5">장애 해결 내용을 가이드 탭에 저장합니다</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="label">가이드 제목</label>
            <input
              className="input w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">내용 <span className="text-gray-600 font-normal">(Markdown 편집 가능)</span></label>
            <textarea
              className="textarea w-full font-mono text-xs"
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="btn-ghost flex-1">취소</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            <BookPlus className="w-4 h-4" />
            {saving ? '저장 중...' : '가이드 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
