'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit2, X, Save, CalendarDays, Printer } from 'lucide-react';
import MinutesGenerator from './MinutesGenerator';
import { format } from 'date-fns';
import clsx from 'clsx';
import { getAuthHeaders } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import UserBadge from '@/components/ui/UserBadge';
import CommentSection from '@/components/ui/CommentSection';

// ─── Types ────────────────────────────────────────────────────────────────────

type MeetingType =
  | 'weekly' | 'monthly' | 'kickoff' | 'review'
  | 'closing' | 'special' | 'emergency' | 'other';

interface Attendee   { id: string; name: string; organization: string; role: string; }
interface AgendaItem { id: string; title: string; content: string; result: string; assignee: string; dueDate: string; }

interface MinutesData {
  projectName: string; clientName: string;
  docNumber: string; version: string; createdAt: string;
  meetingTitle: string; meetingTypeOther: string;
  meetingDate: string; meetingStartTime: string; meetingEndTime: string;
  location: string; organizer: string; recorder: string;
  attendees: Attendee[]; agendaItems: AgendaItem[];
  decisions: string; nextMeetingDate: string; nextMeetingTopic: string; notes: string;
}

interface MinutesSummary {
  id: number;
  title: string;
  meeting_date: string;
  meeting_type: MeetingType;
  project_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MinutesFull extends MinutesSummary { data: MinutesData; }

// ─── Constants ────────────────────────────────────────────────────────────────

const MEETING_TYPES: { value: MeetingType; label: string; color: string }[] = [
  { value: 'weekly',    label: '주간회의',   color: 'bg-blue-900/40 text-blue-300'   },
  { value: 'monthly',   label: '월간회의',   color: 'bg-indigo-900/40 text-indigo-300' },
  { value: 'kickoff',   label: '착수회의',   color: 'bg-green-900/40 text-green-300'  },
  { value: 'review',    label: '검토회의',   color: 'bg-cyan-900/40 text-cyan-300'    },
  { value: 'closing',   label: '완료회의',   color: 'bg-purple-900/40 text-purple-300'},
  { value: 'special',   label: '임시회의',   color: 'bg-yellow-900/40 text-yellow-300'},
  { value: 'emergency', label: '긴급회의',   color: 'bg-red-900/40 text-red-300'      },
  { value: 'other',     label: '기타',       color: 'bg-gray-700 text-gray-300'       },
];

function typeInfo(t: MeetingType) {
  return MEETING_TYPES.find(m => m.value === t) ?? MEETING_TYPES[MEETING_TYPES.length - 1];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId()   { return Math.random().toString(36).slice(2, 9); }
function mkDocNum() {
  const d = new Date();
  return `MOM-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-001`;
}
function mkAttendee(): Attendee   { return { id: makeId(), name:'', organization:'', role:'' }; }
function mkAgenda():  AgendaItem  { return { id: makeId(), title:'', content:'', result:'', assignee:'', dueDate:'' }; }

function initData(): MinutesData {
  const today = format(new Date(), 'yyyy-MM-dd');
  return {
    projectName:'', clientName:'', docNumber: mkDocNum(), version:'1.0', createdAt: today,
    meetingTitle:'', meetingTypeOther:'',
    meetingDate: today, meetingStartTime:'10:00', meetingEndTime:'11:00',
    location:'', organizer:'', recorder:'',
    attendees: [mkAttendee(), mkAttendee()],
    agendaItems: [mkAgenda()],
    decisions:'', nextMeetingDate:'', nextMeetingTopic:'', notes:'',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MinutesList() {
  const [list,       setList]       = useState<MinutesSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [activeType, setActiveType] = useState<MeetingType | 'all'>('all');
  const [current,    setCurrent]    = useState<MinutesFull | null>(null);
  const [mode,       setMode]       = useState<'idle' | 'view' | 'new' | 'edit'>('idle');
  const [form,       setForm]       = useState<MinutesData>(initData);
  const [formType,   setFormType]   = useState<MeetingType>('weekly');
  const [saving,     setSaving]     = useState(false);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);
  const [showList,   setShowList]   = useState(true); // 모바일: 목록/뷰어 전환

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/minutes', { headers: getAuthHeaders() });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openMinutes = async (id: number) => {
    try {
      const res  = await fetch(`/api/minutes/${id}`, { headers: getAuthHeaders() });
      const full: MinutesFull = await res.json();
      setCurrent(full);
      setMode('view');
      setShowList(false); // 모바일에서 뷰어로 전환
    } catch { /* ignore */ }
  };

  const startNew = (presetType?: MeetingType) => {
    setCurrent(null);
    setForm(initData());
    setFormType(presetType ?? (activeType !== 'all' ? activeType : 'weekly'));
    setMode('new');
    setSaveErr(null);
    setShowList(false); // 모바일에서 에디터로 전환
  };

  const startEdit = () => {
    if (!current) return;
    setForm(current.data);
    setFormType(current.meeting_type);
    setMode('edit');
    setSaveErr(null);
  };

  const cancelEdit = () => {
    if (mode === 'new') { setMode('idle'); setCurrent(null); }
    else setMode('view');
    setSaveErr(null);
  };

  const save = async () => {
    setSaving(true); setSaveErr(null);
    try {
      const title = form.meetingTitle || '(제목 없음)';
      const body  = JSON.stringify({
        title,
        meeting_date: form.meetingDate,
        meeting_type: formType,
        data: form,
      });
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };

      if (mode === 'new') {
        const res = await fetch('/api/minutes', { method: 'POST', headers, body });
        if (!res.ok) throw new Error((await res.json()).detail ?? '저장 실패');
        const created: MinutesSummary = await res.json();
        await load();
        await openMinutes(created.id);
      } else if (mode === 'edit' && current) {
        const res = await fetch(`/api/minutes/${current.id}`, { method: 'PATCH', headers, body });
        if (!res.ok) throw new Error((await res.json()).detail ?? '저장 실패');
        await load();
        await openMinutes(current.id);
      }
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteMinutes = async (id: number) => {
    if (!await confirm('이 회의록을 삭제할까요?')) return;
    await fetch(`/api/minutes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setList(prev => prev.filter(r => r.id !== id));
    if (current?.id === id) { setCurrent(null); setMode('idle'); }
  };

  // 필터 적용
  const filtered = list.filter(r => {
    const matchType   = activeType === 'all' || r.meeting_type === activeType;
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // 타입별 카운트
  const countAll = list.length;
  const countByType = (t: MeetingType) => list.filter(r => r.meeting_type === t).length;

  // form helpers
  const set = <K extends keyof MinutesData>(k: K, v: MinutesData[K]) =>
    setForm(p => ({ ...p, [k]: v }));
  const setAttendee = (id: string, f: keyof Attendee, v: string) =>
    setForm(p => ({ ...p, attendees: p.attendees.map(a => a.id === id ? { ...a, [f]: v } : a) }));
  const setAgenda = (id: string, f: keyof AgendaItem, v: string) =>
    setForm(p => ({ ...p, agendaItems: p.agendaItems.map(a => a.id === id ? { ...a, [f]: v } : a) }));

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 목록 패널 ─────────────────────────────────────────────────────── */}
      <div className={clsx(
        'flex-shrink-0 flex flex-col border-r border-gray-800 bg-surface-raised',
        'w-full md:w-72',
        showList ? 'flex' : 'hidden md:flex',
      )}>

        {/* 검색 + 새 회의록 */}
        <div className="px-3 py-2.5 border-b border-gray-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input className="input text-xs pl-8 py-1.5" placeholder="검색…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => startNew()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 카테고리 탭 */}
        <div className="border-b border-gray-800 overflow-x-auto flex-shrink-0">
          <div className="flex px-2 py-1.5 gap-1 min-w-max">
            <button
              onClick={() => setActiveType('all')}
              className={clsx(
                'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                activeType === 'all'
                  ? 'bg-brand/20 text-brand'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
              )}>
              전체 <span className="ml-0.5 opacity-60">{countAll}</span>
            </button>
            {MEETING_TYPES.map(({ value, label }) => {
              const cnt = countByType(value);
              return (
                <button key={value}
                  onClick={() => setActiveType(value)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                    activeType === value
                      ? 'bg-brand/20 text-brand'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                  )}>
                  {label}
                  {cnt > 0 && <span className="ml-0.5 opacity-60">{cnt}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-8">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-600">
              <CalendarDays className="w-8 h-8 opacity-30" />
              <p className="text-xs">
                {search ? '검색 결과 없음' : '회의록이 없습니다'}
              </p>
              <button onClick={() => startNew(activeType !== 'all' ? activeType : undefined)}
                className="text-xs text-brand hover:underline">
                + 새 회의록 작성
              </button>
            </div>
          ) : (
            <div className="py-1">
              {filtered.map(r => {
                const info = typeInfo(r.meeting_type);
                return (
                  <div key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openMinutes(r.id)}
                    onKeyDown={e => e.key === 'Enter' && openMinutes(r.id)}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 border-b border-gray-800/50 transition-colors group cursor-pointer',
                      current?.id === r.id
                        ? 'bg-brand/10 border-l-2 border-l-brand'
                        : 'hover:bg-surface-overlay',
                    )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={clsx(
                          'text-xs font-medium leading-snug truncate',
                          current?.id === r.id ? 'text-brand' : 'text-gray-200',
                        )}>
                          {r.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={clsx('text-[9px] px-1.5 py-0.5 rounded font-semibold', info.color)}>
                            {info.label}
                          </span>
                          <span className="text-[10px] text-gray-500">{r.meeting_date}</span>
                          {r.created_by && (
                            <UserBadge username={r.created_by} size="xs" />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteMinutes(r.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 flex-shrink-0 transition-opacity mt-0.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 상세 / 편집 패널 ──────────────────────────────────────────────── */}
      <div className={clsx(
        'flex-1 overflow-y-auto bg-surface',
        showList ? 'hidden md:block' : 'block',
      )}>
        {/* 모바일: 목록으로 돌아가기 */}
        {!showList && (
          <button
            onClick={() => setShowList(true)}
            className="md:hidden flex items-center gap-2 px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 border-b border-gray-800 w-full bg-surface-raised"
          >
            <span className="text-base leading-none">←</span> 목록으로
          </button>
        )}
        {mode === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-600">
            <CalendarDays className="w-10 h-10 opacity-30" />
            <p className="text-sm">회의록을 선택하거나 새로 작성하세요</p>
            {/* 종류별 빠른 생성 버튼 */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {MEETING_TYPES.map(({ value, label, color }) => (
                <button key={value} onClick={() => startNew(value)}
                  className={clsx(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent hover:border-gray-700 transition-colors',
                    color,
                  )}>
                  <Plus className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'view' && current && (
          <ViewPanel
            data={current.data}
            meetingType={current.meeting_type}
            minutesId={current.id}
            onEdit={startEdit}
            onDelete={() => deleteMinutes(current.id)}
          />
        )}

        {(mode === 'new' || mode === 'edit') && (
          <EditPanel
            data={form}
            meetingType={formType}
            onTypeChange={setFormType}
            set={set}
            setAttendee={setAttendee}
            setAgenda={setAgenda}
            addAttendee={() => setForm(p => ({ ...p, attendees: [...p.attendees, mkAttendee()] }))}
            addAgenda={() => setForm(p => ({ ...p, agendaItems: [...p.agendaItems, mkAgenda()] }))}
            removeAttendee={id => setForm(p => ({ ...p, attendees: p.attendees.filter(a => a.id !== id) }))}
            removeAgenda={id => setForm(p => ({ ...p, agendaItems: p.agendaItems.filter(a => a.id !== id) }))}
            onSave={save}
            onCancel={cancelEdit}
            saving={saving}
            error={saveErr}
            isNew={mode === 'new'}
          />
        )}
      </div>
    </div>
  );
}

// ─── View panel ───────────────────────────────────────────────────────────────

function ViewPanel({ data, meetingType, minutesId, onEdit, onDelete }: {
  data: MinutesData;
  meetingType: MeetingType;
  minutesId: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showDocModal, setShowDocModal] = useState(false);
  const info = typeInfo(meetingType);
  const typeLabel = meetingType === 'other' && data.meetingTypeOther
    ? data.meetingTypeOther : info.label;

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={clsx('text-[10px] px-2 py-0.5 rounded font-semibold', info.color)}>
              {typeLabel}
            </span>
            {data.projectName && <span className="text-[10px] text-gray-500">{data.projectName}</span>}
          </div>
          <h1 className="text-xl font-bold text-gray-100">{data.meetingTitle || '(제목 없음)'}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {data.meetingDate}
            {data.meetingStartTime && ` · ${data.meetingStartTime}`}
            {data.meetingEndTime   && ` ~ ${data.meetingEndTime}`}
            {data.location         && ` · ${data.location}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowDocModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-purple-500 hover:text-purple-400 transition-colors">
            <Printer className="w-3.5 h-3.5" /> 문서 출력
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-brand hover:text-brand transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> 수정
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> 삭제
          </button>
        </div>
      </div>

      {/* 문서 출력 모달 */}
      {showDocModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-stretch justify-stretch no-print"
          onClick={() => setShowDocModal(false)}
        >
          <div
            className="relative w-full h-full flex flex-col bg-surface overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0 no-print">
              <span className="text-sm font-semibold text-gray-200">문서 출력 — {data.meetingTitle || '회의록'}</span>
              <button
                onClick={() => setShowDocModal(false)}
                className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MinutesGenerator initialData={{ ...data, meetingType } as any} />
            </div>
          </div>
        </div>
      )}


      <Section title="기본 정보">
        <InfoGrid>
          <InfoItem label="문서번호">{data.docNumber} (v{data.version})</InfoItem>
          <InfoItem label="작성일">{data.createdAt}</InfoItem>
          {data.clientName && <InfoItem label="고객사">{data.clientName}</InfoItem>}
          <InfoItem label="주관자">{data.organizer || '-'}</InfoItem>
          <InfoItem label="기록자">{data.recorder  || '-'}</InfoItem>
        </InfoGrid>
      </Section>

      {data.attendees.some(a => a.name) && (
        <Section title={`참석자 (${data.attendees.filter(a => a.name).length}명)`}>
          <div className="flex flex-wrap gap-2">
            {data.attendees.filter(a => a.name).map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-overlay border border-gray-800">
                <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0">
                  {a.name[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-200">{a.name}</p>
                  {(a.organization || a.role) && (
                    <p className="text-[10px] text-gray-500">{[a.organization, a.role].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.agendaItems.some(a => a.title) && (
        <Section title="안건">
          <div className="space-y-4">
            {data.agendaItems.filter(a => a.title).map((item, idx) => (
              <div key={item.id} className="border border-gray-800 rounded-xl p-4 space-y-3 bg-surface-raised">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand/20 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-200">{item.title}</h3>
                </div>
                {item.content && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">내용</p>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                  </div>
                )}
                {item.result && (
                  <div className="bg-green-900/10 border border-green-900/30 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-green-400 mb-1 uppercase tracking-wider">처리 결과</p>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{item.result}</p>
                  </div>
                )}
                {(item.assignee || item.dueDate) && (
                  <div className="flex gap-4 text-xs text-gray-500">
                    {item.assignee && <span>담당: <span className="text-gray-300">{item.assignee}</span></span>}
                    {item.dueDate  && <span>기한: <span className="text-gray-300">{item.dueDate}</span></span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.decisions && (
        <Section title="종합 결정사항">
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-surface-raised border border-gray-800 rounded-xl p-4">
            {data.decisions}
          </p>
        </Section>
      )}

      {(data.nextMeetingDate || data.nextMeetingTopic || data.notes) && (
        <Section title="다음 회의 / 기타">
          <InfoGrid>
            {data.nextMeetingDate  && <InfoItem label="다음 회의 일정">{data.nextMeetingDate}</InfoItem>}
            {data.nextMeetingTopic && <InfoItem label="다음 회의 주제">{data.nextMeetingTopic}</InfoItem>}
          </InfoGrid>
          {data.notes && <p className="mt-3 text-xs text-gray-400 whitespace-pre-wrap">{data.notes}</p>}
        </Section>
      )}

      {/* 댓글 */}
      <Section title="댓글">
        <CommentSection entityType="minutes" entityId={minutesId} />
      </Section>
    </div>
  );
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

function EditPanel({ data, meetingType, onTypeChange, set, setAttendee, setAgenda,
  addAttendee, addAgenda, removeAttendee, removeAgenda,
  onSave, onCancel, saving, error, isNew }: {
  data: MinutesData;
  meetingType: MeetingType;
  onTypeChange: (t: MeetingType) => void;
  set: <K extends keyof MinutesData>(k: K, v: MinutesData[K]) => void;
  setAttendee: (id: string, f: keyof Attendee, v: string) => void;
  setAgenda: (id: string, f: keyof AgendaItem, v: string) => void;
  addAttendee: () => void;
  addAgenda: () => void;
  removeAttendee: (id: string) => void;
  removeAgenda: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isNew: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-200">
          {isNew ? '새 회의록 작성' : '회의록 수정'}
        </h2>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <X className="w-3.5 h-3.5" /> 취소
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors">
            <Save className="w-3.5 h-3.5" /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* 회의 종류 선택 */}
      <ESection title="회의 종류 *">
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map(({ value, label, color }) => (
            <button key={value}
              onClick={() => onTypeChange(value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors',
                meetingType === value
                  ? `${color} border-current`
                  : 'border-transparent bg-surface-overlay text-gray-400 hover:text-gray-200 hover:bg-surface-raised',
              )}>
              {label}
            </button>
          ))}
        </div>
        {meetingType === 'other' && (
          <input className="input text-sm mt-2" value={data.meetingTypeOther}
            onChange={e => set('meetingTypeOther', e.target.value)} placeholder="회의 종류 직접 입력" />
        )}
      </ESection>

      {/* 회의 정보 */}
      <ESection title="회의 정보">
        <EFL label="회의명 *">
          <input className="input text-sm" value={data.meetingTitle}
            onChange={e => set('meetingTitle', e.target.value)} placeholder="예: 4월 4주차 주간회의" />
        </EFL>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EFL label="프로젝트명">
            <input className="input text-sm" value={data.projectName}
              onChange={e => set('projectName', e.target.value)} />
          </EFL>
          <EFL label="고객사">
            <input className="input text-sm" value={data.clientName}
              onChange={e => set('clientName', e.target.value)} />
          </EFL>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <EFL label="회의 일자">
            <input className="input text-sm" type="date" value={data.meetingDate}
              onChange={e => set('meetingDate', e.target.value)} />
          </EFL>
          <EFL label="시작 시간">
            <input className="input text-sm" type="time" value={data.meetingStartTime}
              onChange={e => set('meetingStartTime', e.target.value)} />
          </EFL>
          <EFL label="종료 시간">
            <input className="input text-sm" type="time" value={data.meetingEndTime}
              onChange={e => set('meetingEndTime', e.target.value)} />
          </EFL>
        </div>
        <EFL label="회의 장소">
          <input className="input text-sm" value={data.location}
            onChange={e => set('location', e.target.value)} placeholder="예: 고객사 회의실 / 온라인(Zoom)" />
        </EFL>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EFL label="주관자"><input className="input text-sm" value={data.organizer} onChange={e=>set('organizer',e.target.value)} /></EFL>
          <EFL label="기록자"><input className="input text-sm" value={data.recorder}  onChange={e=>set('recorder',e.target.value)}  /></EFL>
        </div>
      </ESection>

      {/* 참석자 */}
      <ESection title="참석자">
        <div className="space-y-2">
          {data.attendees.map(a => (
            <div key={a.id} className="grid grid-cols-2 sm:flex gap-2 items-center">
              <input className="input text-sm col-span-2 sm:flex-1" value={a.name}         onChange={e=>setAttendee(a.id,'name',e.target.value)}         placeholder="이름" />
              <input className="input text-sm sm:flex-1"            value={a.organization} onChange={e=>setAttendee(a.id,'organization',e.target.value)} placeholder="소속" />
              <div className="flex gap-1 items-center">
                <input className="input text-sm flex-1 sm:w-24"    value={a.role}         onChange={e=>setAttendee(a.id,'role',e.target.value)}         placeholder="역할" />
                <button onClick={()=>removeAttendee(a.id)} className="p-1.5 text-gray-600 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addAttendee}
          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-700 text-xs text-gray-400 hover:border-brand hover:text-brand transition-colors">
          <Plus className="w-3.5 h-3.5" /> 참석자 추가
        </button>
      </ESection>

      {/* 안건 */}
      <ESection title="안건">
        <div className="space-y-4">
          {data.agendaItems.map((item, idx) => (
            <div key={item.id} className="border border-gray-800 rounded-xl p-4 space-y-3 bg-surface-raised">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand/20 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx+1}</span>
                <input className="input text-sm flex-1" value={item.title} onChange={e=>setAgenda(item.id,'title',e.target.value)} placeholder="안건 제목" />
                <button onClick={()=>removeAgenda(item.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
              <EFL label="내용">
                <textarea className="textarea text-sm" rows={3} value={item.content} onChange={e=>setAgenda(item.id,'content',e.target.value)} placeholder="안건 내용 및 논의 사항" />
              </EFL>
              <EFL label="처리 결과">
                <textarea className="textarea text-sm" rows={2} value={item.result} onChange={e=>setAgenda(item.id,'result',e.target.value)} placeholder="회의 결과 및 결정 내용" />
              </EFL>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EFL label="담당자"><input className="input text-sm" value={item.assignee} onChange={e=>setAgenda(item.id,'assignee',e.target.value)} /></EFL>
                <EFL label="완료 기한"><input className="input text-sm" type="date" value={item.dueDate} onChange={e=>setAgenda(item.id,'dueDate',e.target.value)} /></EFL>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addAgenda}
          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-700 text-xs text-gray-400 hover:border-brand hover:text-brand transition-colors">
          <Plus className="w-3.5 h-3.5" /> 안건 추가
        </button>
      </ESection>

      {/* 결정사항 */}
      <ESection title="결정사항 및 다음 회의">
        <EFL label="종합 결정사항">
          <textarea className="textarea text-sm" rows={4} value={data.decisions}
            onChange={e=>set('decisions',e.target.value)} placeholder="회의에서 최종 결정된 사항을 정리해주세요" />
        </EFL>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EFL label="다음 회의 일정"><input className="input text-sm" type="date" value={data.nextMeetingDate} onChange={e=>set('nextMeetingDate',e.target.value)} /></EFL>
          <EFL label="다음 회의 주제"><input className="input text-sm" value={data.nextMeetingTopic} onChange={e=>set('nextMeetingTopic',e.target.value)} /></EFL>
        </div>
        <EFL label="특이사항 / 기타">
          <textarea className="textarea text-sm" rows={2} value={data.notes} onChange={e=>set('notes',e.target.value)} />
        </EFL>
      </ESection>

      {/* 문서 정보 */}
      <ESection title="문서 정보">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <EFL label="문서번호"><input className="input text-sm" value={data.docNumber} onChange={e=>set('docNumber',e.target.value)} /></EFL>
          <EFL label="버전"><input className="input text-sm" value={data.version} onChange={e=>set('version',e.target.value)} /></EFL>
          <EFL label="작성일"><input className="input text-sm" type="date" value={data.createdAt} onChange={e=>set('createdAt',e.target.value)} /></EFL>
        </div>
      </ESection>

      <div className="pb-8" />
    </div>
  );
}

// ─── 소형 공통 컴포넌트 ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-800">{title}</h2>
      {children}
    </div>
  );
}
function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>;
}
function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-200">{children}</p>
    </div>
  );
}
function ESection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-800">{title}</h2>
      {children}
    </div>
  );
}
function EFL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
