'use client';

import { useState, useEffect } from 'react';
import { Printer, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import type { Project } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type MeetingType =
  | 'weekly' | 'monthly' | 'kickoff' | 'review'
  | 'closing' | 'special' | 'emergency' | 'other'
  | 'regular'; // legacy

interface Attendee {
  id: string;
  name: string;
  organization: string;
  role: string;
}

interface AgendaItem {
  id: string;
  title: string;
  content: string;
  result: string;
  assignee: string;
  dueDate: string;
}

interface MinutesData {
  docNumber:        string;
  version:          string;
  createdAt:        string;
  projectName:      string;
  clientName:       string;
  meetingTitle:     string;
  meetingType:      MeetingType;
  meetingTypeOther: string;
  meetingDate:      string;
  meetingStartTime: string;
  meetingEndTime:   string;
  location:         string;
  organizer:        string;
  recorder:         string;
  attendees:        Attendee[];
  agendaItems:      AgendaItem[];
  decisions:        string;
  nextMeetingDate:  string;
  nextMeetingTopic: string;
  notes:            string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  weekly:    '주간회의',
  monthly:   '월간회의',
  kickoff:   '착수회의',
  review:    '검토회의',
  closing:   '완료회의',
  special:   '임시회의',
  emergency: '긴급회의',
  other:     '기타',
  regular:   '정기회의',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2, 9); }

function makeDocNumber() {
  const d = new Date();
  return `MOM-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-001`;
}

function mkAttendee(): Attendee {
  return { id: makeId(), name: '', organization: '', role: '' };
}

function mkAgenda(): AgendaItem {
  return { id: makeId(), title: '', content: '', result: '', assignee: '', dueDate: '' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MinutesGenerator({
  project,
  initialData,
}: {
  project?: Project;
  initialData?: MinutesData;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [data, setData] = useState<MinutesData>(initialData ?? {
    docNumber:        makeDocNumber(),
    version:          '1.0',
    createdAt:        today,
    projectName:      project?.name ?? '',
    clientName:       project?.client_name ?? '',
    meetingTitle:     '',
    meetingType:      'regular',
    meetingTypeOther: '',
    meetingDate:      today,
    meetingStartTime: '10:00',
    meetingEndTime:   '11:00',
    location:         '',
    organizer:        '',
    recorder:         '',
    attendees: [mkAttendee(), mkAttendee()],
    agendaItems: [mkAgenda()],
    decisions:        '',
    nextMeetingDate:  '',
    nextMeetingTopic: '',
    notes:            '',
  });

  const set = <K extends keyof MinutesData>(k: K, v: MinutesData[K]) =>
    setData(p => ({ ...p, [k]: v }));

  const setAttendee = (id: string, f: keyof Attendee, v: string) =>
    setData(p => ({ ...p, attendees: p.attendees.map(a => a.id === id ? { ...a, [f]: v } : a) }));

  const setAgenda = (id: string, f: keyof AgendaItem, v: string) =>
    setData(p => ({ ...p, agendaItems: p.agendaItems.map(a => a.id === id ? { ...a, [f]: v } : a) }));

  const addAttendee  = () => setData(p => ({ ...p, attendees:   [...p.attendees,   mkAttendee()] }));
  const addAgenda    = () => setData(p => ({ ...p, agendaItems: [...p.agendaItems, mkAgenda()] }));

  const removeAttendee = (id: string) =>
    setData(p => ({ ...p, attendees: p.attendees.filter(a => a.id !== id) }));
  const removeAgenda = (id: string) =>
    setData(p => ({ ...p, agendaItems: p.agendaItems.filter(a => a.id !== id) }));

  // 인쇄 시 A4 맞춤 zoom
  useEffect(() => {
    const A4_H = Math.round(297 * 96 / 25.4);
    const before = () => {
      document.querySelectorAll<HTMLElement>('.print-page').forEach(el => {
        el.style.zoom = '';
        const scaleX = el.scrollWidth  > el.clientWidth ? el.clientWidth / el.scrollWidth  : 1;
        const scaleY = el.scrollHeight > A4_H           ? A4_H           / el.scrollHeight : 1;
        const scale  = Math.min(scaleX, scaleY);
        if (scale < 1) el.style.zoom = String(scale);
      });
    };
    const after = () =>
      document.querySelectorAll<HTMLElement>('.print-page').forEach(el => { el.style.zoom = ''; });
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 편집 폼 (좌) ─────────────────────────────────────────────────── */}
      <div className="w-[460px] flex-shrink-0 flex flex-col border-r border-gray-800 bg-surface-raised no-print">
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">회의록 작성</h2>
            <p className="text-xs text-gray-500 mt-0.5">{data.docNumber}</p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
            <Printer className="w-3.5 h-3.5" /> 인쇄 / PDF
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 프로젝트 정보 (독립 모드) */}
          {!project && (
            <FS title="프로젝트 정보">
              <FL label="프로젝트명">
                <input className="input text-xs" value={data.projectName}
                  onChange={e => set('projectName', e.target.value)} placeholder="예: OTP 서버 이중화 구축" />
              </FL>
              <FL label="고객사">
                <input className="input text-xs" value={data.clientName}
                  onChange={e => set('clientName', e.target.value)} placeholder="예: (주)예시회사" />
              </FL>
            </FS>
          )}

          {/* 문서 정보 */}
          <FS title="문서 정보">
            <div className="grid grid-cols-2 gap-2">
              <FL label="문서번호">
                <input className="input text-xs" value={data.docNumber}
                  onChange={e => set('docNumber', e.target.value)} />
              </FL>
              <FL label="버전">
                <input className="input text-xs" value={data.version}
                  onChange={e => set('version', e.target.value)} placeholder="1.0" />
              </FL>
            </div>
            <FL label="작성일">
              <input className="input text-xs" type="date" value={data.createdAt}
                onChange={e => set('createdAt', e.target.value)} />
            </FL>
          </FS>

          {/* 회의 정보 */}
          <FS title="회의 정보">
            <FL label="회의명">
              <input className="input text-xs" value={data.meetingTitle}
                onChange={e => set('meetingTitle', e.target.value)} placeholder="예: OTP 서버 구축 착수 회의" />
            </FL>
            <FL label="회의 유형">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(MEETING_TYPE_LABEL) as [MeetingType, string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="meetingType" value={v}
                      checked={data.meetingType === v}
                      onChange={() => set('meetingType', v)}
                      className="accent-brand" />
                    <span className="text-xs text-gray-300">{l}</span>
                  </label>
                ))}
              </div>
              {data.meetingType === 'other' && (
                <input className="input text-xs mt-1" value={data.meetingTypeOther}
                  onChange={e => set('meetingTypeOther', e.target.value)} placeholder="회의 유형 직접 입력" />
              )}
            </FL>
            <FL label="회의 일자">
              <input className="input text-xs" type="date" value={data.meetingDate}
                onChange={e => set('meetingDate', e.target.value)} />
            </FL>
            <div className="grid grid-cols-2 gap-2">
              <FL label="시작 시간">
                <input className="input text-xs" type="time" value={data.meetingStartTime}
                  onChange={e => set('meetingStartTime', e.target.value)} />
              </FL>
              <FL label="종료 시간">
                <input className="input text-xs" type="time" value={data.meetingEndTime}
                  onChange={e => set('meetingEndTime', e.target.value)} />
              </FL>
            </div>
            <FL label="회의 장소">
              <input className="input text-xs" value={data.location}
                onChange={e => set('location', e.target.value)} placeholder="예: 고객사 회의실 / 온라인(Zoom)" />
            </FL>
            <div className="grid grid-cols-2 gap-2">
              <FL label="주관자">
                <input className="input text-xs" value={data.organizer}
                  onChange={e => set('organizer', e.target.value)} />
              </FL>
              <FL label="기록자">
                <input className="input text-xs" value={data.recorder}
                  onChange={e => set('recorder', e.target.value)} />
              </FL>
            </div>
          </FS>

          {/* 참석자 */}
          <FS title="참석자">
            <div className="space-y-1.5">
              {data.attendees.map(a => (
                <div key={a.id} className="flex gap-1.5 items-center">
                  <input className="input text-xs flex-1" value={a.name}
                    onChange={e => setAttendee(a.id, 'name', e.target.value)} placeholder="이름" />
                  <input className="input text-xs flex-1" value={a.organization}
                    onChange={e => setAttendee(a.id, 'organization', e.target.value)} placeholder="소속" />
                  <input className="input text-xs w-20" value={a.role}
                    onChange={e => setAttendee(a.id, 'role', e.target.value)} placeholder="역할" />
                  <button onClick={() => removeAttendee(a.id)}
                    className="p-1 text-gray-600 hover:text-red-400 flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addAttendee}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-700 text-xs text-gray-400 hover:border-brand hover:text-brand transition-colors">
              <Plus className="w-3 h-3" /> 참석자 추가
            </button>
          </FS>

          {/* 안건 */}
          <FS title="안건">
            <div className="space-y-3">
              {data.agendaItems.map((item, idx) => (
                <div key={item.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-brand flex-shrink-0">안건 {idx + 1}</span>
                    <input className="input text-xs flex-1" value={item.title}
                      onChange={e => setAgenda(item.id, 'title', e.target.value)} placeholder="안건 제목" />
                    <button onClick={() => removeAgenda(item.id)}
                      className="p-1 text-gray-600 hover:text-red-400 flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <FL label="내용">
                    <textarea className="textarea text-xs" rows={2} value={item.content}
                      onChange={e => setAgenda(item.id, 'content', e.target.value)} placeholder="안건 내용 및 논의 사항" />
                  </FL>
                  <FL label="처리 결과">
                    <textarea className="textarea text-xs" rows={2} value={item.result}
                      onChange={e => setAgenda(item.id, 'result', e.target.value)} placeholder="회의 결과 및 결정 내용" />
                  </FL>
                  <div className="grid grid-cols-2 gap-2">
                    <FL label="담당자">
                      <input className="input text-xs" value={item.assignee}
                        onChange={e => setAgenda(item.id, 'assignee', e.target.value)} placeholder="담당자" />
                    </FL>
                    <FL label="완료 기한">
                      <input className="input text-xs" type="date" value={item.dueDate}
                        onChange={e => setAgenda(item.id, 'dueDate', e.target.value)} />
                    </FL>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addAgenda}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-700 text-xs text-gray-400 hover:border-brand hover:text-brand transition-colors">
              <Plus className="w-3 h-3" /> 안건 추가
            </button>
          </FS>

          {/* 결정사항 및 다음 일정 */}
          <FS title="결정사항 및 다음 회의">
            <FL label="종합 결정사항">
              <textarea className="textarea text-xs" rows={3} value={data.decisions}
                onChange={e => set('decisions', e.target.value)} placeholder="회의에서 최종 결정된 사항을 정리해주세요" />
            </FL>
            <div className="grid grid-cols-2 gap-2">
              <FL label="다음 회의 일정">
                <input className="input text-xs" type="date" value={data.nextMeetingDate}
                  onChange={e => set('nextMeetingDate', e.target.value)} />
              </FL>
              <FL label="다음 회의 주제">
                <input className="input text-xs" value={data.nextMeetingTopic}
                  onChange={e => set('nextMeetingTopic', e.target.value)} placeholder="예: 중간 검수" />
              </FL>
            </div>
            <FL label="특이사항 / 기타">
              <textarea className="textarea text-xs" rows={2} value={data.notes}
                onChange={e => set('notes', e.target.value)} />
            </FL>
          </FS>
        </div>
      </div>

      {/* ── 미리보기 (우) ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-200 p-6" id="doc-preview">
        <MinutesPreview data={data} />
      </div>
    </div>
  );
}

// ─── 인쇄 미리보기 ────────────────────────────────────────────────────────────

function MinutesPreview({ data }: { data: MinutesData }) {
  const meetingTypeLabel =
    data.meetingType === 'other'
      ? data.meetingTypeOther || '기타'
      : MEETING_TYPE_LABEL[data.meetingType];

  return (
    <div className="print-page bg-white shadow-lg w-[210mm] mx-auto p-[12mm] text-gray-900 text-[11px] leading-snug">
      {/* 제목 */}
      <div className="text-center mb-5">
        <h1 className="text-[18px] font-bold tracking-wider">회 의 록</h1>
        <p className="text-xs text-gray-500 mt-1">Meeting Minutes</p>
      </div>

      {/* 회의 기본 정보 */}
      <table className="w-full border-collapse text-xs mb-3">
        <tbody>
          <tr>
            <TH>회 의 명</TH>
            <td className="border border-gray-400 px-2 py-1 font-semibold" colSpan={3}>
              {data.meetingTitle}
            </td>
          </tr>
          <tr>
            <TH>프로젝트</TH>
            <td className="border border-gray-400 px-2 py-1">{data.projectName}</td>
            <TH>고 객 사</TH>
            <td className="border border-gray-400 px-2 py-1">{data.clientName}</td>
          </tr>
          <tr>
            <TH>회의 유형</TH>
            <td className="border border-gray-400 px-2 py-1">{meetingTypeLabel}</td>
            <TH>회의 장소</TH>
            <td className="border border-gray-400 px-2 py-1">{data.location}</td>
          </tr>
          <tr>
            <TH>회의 일시</TH>
            <td className="border border-gray-400 px-2 py-1">
              {data.meetingDate}
              {data.meetingStartTime && ` ${data.meetingStartTime}`}
              {data.meetingEndTime   && ` ~ ${data.meetingEndTime}`}
            </td>
            <TH>문서번호</TH>
            <td className="border border-gray-400 px-2 py-1">{data.docNumber} (v{data.version})</td>
          </tr>
          <tr>
            <TH>주 관 자</TH>
            <td className="border border-gray-400 px-2 py-1">{data.organizer}</td>
            <TH>기 록 자</TH>
            <td className="border border-gray-400 px-2 py-1">{data.recorder}</td>
          </tr>
        </tbody>
      </table>

      {/* 참석자 */}
      {data.attendees.length > 0 && (
        <table className="w-full border-collapse text-xs mb-3">
          <thead>
            <tr>
              <TH colSpan={4}>참 석 자</TH>
            </tr>
            <tr>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold w-8">No.</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold">이름</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold">소속</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold">역할</th>
            </tr>
          </thead>
          <tbody>
            {data.attendees.map((a, idx) => (
              <tr key={a.id}>
                <td className="border border-gray-400 px-2 py-0.5 text-center">{idx + 1}</td>
                <td className="border border-gray-400 px-2 py-0.5">{a.name}</td>
                <td className="border border-gray-400 px-2 py-0.5">{a.organization}</td>
                <td className="border border-gray-400 px-2 py-0.5">{a.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 안건 */}
      {data.agendaItems.length > 0 && (
        <table className="w-full border-collapse text-xs mb-3">
          <thead>
            <tr><TH colSpan={5}>안 건</TH></tr>
            <tr>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold w-8">No.</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold w-24">안건 제목</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold">내용 및 논의</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold">처리 결과</th>
              <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold w-20">담당/기한</th>
            </tr>
          </thead>
          <tbody>
            {data.agendaItems.map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-gray-400 px-2 py-1 text-center align-top">{idx + 1}</td>
                <td className="border border-gray-400 px-2 py-1 font-semibold align-top">{item.title}</td>
                <td className="border border-gray-400 px-2 py-1 align-top whitespace-pre-wrap">{item.content}</td>
                <td className="border border-gray-400 px-2 py-1 align-top whitespace-pre-wrap">{item.result}</td>
                <td className="border border-gray-400 px-2 py-1 align-top text-center">
                  {item.assignee && <div>{item.assignee}</div>}
                  {item.dueDate  && <div className="text-gray-500">{item.dueDate}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 결정사항 */}
      {data.decisions && (
        <table className="w-full border-collapse text-xs mb-3">
          <tbody>
            <tr><TH colSpan={2}>종합 결정사항</TH></tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2 whitespace-pre-wrap leading-relaxed" colSpan={2}>
                {data.decisions}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* 다음 회의 / 특이사항 */}
      {(data.nextMeetingDate || data.nextMeetingTopic || data.notes) && (
        <table className="w-full border-collapse text-xs mb-3">
          <tbody>
            {(data.nextMeetingDate || data.nextMeetingTopic) && (
              <tr>
                <TH>다음 회의</TH>
                <td className="border border-gray-400 px-2 py-1" colSpan={3}>
                  {data.nextMeetingDate && <span className="mr-3">{data.nextMeetingDate}</span>}
                  {data.nextMeetingTopic}
                </td>
              </tr>
            )}
            {data.notes && (
              <tr>
                <TH>특이사항</TH>
                <td className="border border-gray-400 px-2 py-1 whitespace-pre-wrap" colSpan={3}>
                  {data.notes}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* 서명란 */}
      <table className="w-full border-collapse text-xs mt-4">
        <tbody>
          <tr>
            <TH>작 성 일</TH>
            <td className="border border-gray-400 px-2 py-1">{data.createdAt}</td>
            <TH>주 관 자</TH>
            <td className="border border-gray-400 px-2 py-4">{data.organizer}</td>
            <TH>기 록 자</TH>
            <td className="border border-gray-400 px-2 py-4">{data.recorder}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── 공통 소형 컴포넌트 ───────────────────────────────────────────────────────

function TH({ children, colSpan }: { children?: React.ReactNode; colSpan?: number }) {
  return (
    <th
      colSpan={colSpan}
      style={{ backgroundColor: '#dce6f1' }}
      className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap"
    >
      {children}
    </th>
  );
}

function FS({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-gray-800">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
