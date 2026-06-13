'use client';

import { useState } from 'react';
import type { Project } from '@/lib/types';
import { FileText, Printer, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

interface Props {
  project?: Project;  // 프로젝트 탭 내에서 사용할 때만 전달
}

type RiskLevel = 'high' | 'medium' | 'low';
type WorkType = 'install' | 'upgrade' | 'maintenance' | 'incident' | 'other';

interface WSLData {
  // 독립 모드용 프로젝트 정보
  projectName:     string;
  clientName:      string;
  // 문서 정보
  docNumber:       string;
  createdAt:       string;
  workTitle:       string;
  workType:        WorkType;
  workDate:        string;
  workTime:        string;
  workDuration:    string;
  workLocation:    string;
  assignee:        string;
  contact:         string;
  purpose:         string;
  scope:           string;
  steps:           string[];
  affectedSystems: string;
  downtime:        string;
  affectedUsers:   string;
  riskLevel:       RiskLevel;
  riskFactors:     string;
  riskMitigation:  string;
  rollback:        string;
  prerequisites:   string;
  notes:           string;
  author:          string;
  reviewer:        string;
  approver:        string;
}

const WORK_TYPE_LABEL: Record<WorkType, string> = {
  install:     '신규 설치',
  upgrade:     '업그레이드',
  maintenance: '유지보수',
  incident:    '장애 대응',
  other:       '기타',
};

const RISK_LABEL: Record<RiskLevel, { label: string; color: string }> = {
  high:   { label: '상 (HIGH)',    color: 'text-red-400' },
  medium: { label: '중 (MEDIUM)', color: 'text-yellow-400' },
  low:    { label: '하 (LOW)',    color: 'text-green-400' },
};

function makeDocNumber(projectId?: number) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const prefix = projectId ? projectId : 'NEW';
  return `WSL-${prefix}-${y}${m}${day}-001`;
}

export default function WSLGenerator({ project }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const standalone = !project;
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  const [data, setData] = useState<WSLData>({
    projectName:     project?.name ?? '',
    clientName:      project?.client_name ?? '',
    docNumber:       makeDocNumber(project?.id),
    createdAt:       today,
    workTitle:       '',
    workType:        'install',
    workDate:        today,
    workTime:        '09:00',
    workDuration:    '',
    workLocation:    '',
    assignee:        '',
    contact:         '',
    purpose:         '',
    scope:           '',
    steps:           [''],
    affectedSystems: '',
    downtime:        '',
    affectedUsers:   '',
    riskLevel:       'medium',
    riskFactors:     '',
    riskMitigation:  '',
    rollback:        '',
    prerequisites:   '',
    notes:           '',
    author:          '',
    reviewer:        '',
    approver:        '',
  });

  const set = (field: keyof WSLData, value: any) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const setStep = (i: number, v: string) => {
    const next = [...data.steps];
    next[i] = v;
    set('steps', next);
  };
  const addStep    = () => set('steps', [...data.steps, '']);
  const removeStep = (i: number) => set('steps', data.steps.filter((_, idx) => idx !== i));

  const handlePrint = () => window.print();

  // 미리보기에 사용할 프로젝트 정보 (실제 or 수동 입력)
  const previewProject = project ?? {
    id: 0,
    name: data.projectName || '프로젝트명',
    client_name: data.clientName || '',
    description: '',
    status: 'active' as const,
    created_at: today,
    updated_at: today,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── 모바일 탭 ── */}
      <div className="flex-shrink-0 flex md:hidden border-b border-gray-800 bg-surface-raised">
        <button onClick={() => setMobileTab('form')}
          className={clsx('flex-1 py-2.5 text-xs font-medium transition-colors',
            mobileTab === 'form' ? 'text-brand border-b-2 border-brand' : 'text-gray-500')}>
          편집
        </button>
        <button onClick={() => setMobileTab('preview')}
          className={clsx('flex-1 py-2.5 text-xs font-medium transition-colors',
            mobileTab === 'preview' ? 'text-brand border-b-2 border-brand' : 'text-gray-500')}>
          미리보기
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
      {/* ── 편집 폼 ── */}
      <div className={clsx(
        'flex-col border-r border-gray-800 overflow-y-auto bg-surface-raised no-print',
        'w-full md:w-[480px] md:flex-shrink-0',
        mobileTab === 'form' ? 'flex' : 'hidden md:flex',
      )}>
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">작업 지시서 작성</h2>
            <p className="text-xs text-gray-500 mt-0.5">{data.docNumber}</p>
          </div>
          <button onClick={handlePrint} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" />
            인쇄 / PDF
          </button>
        </div>

        <div className="flex-1 p-5 space-y-6">
          {/* 프로젝트 정보 — 독립 모드일 때만 표시 */}
          {standalone && (
            <Section title="프로젝트 정보">
              <Field label="프로젝트명 *">
                <input
                  className="input text-xs"
                  value={data.projectName}
                  onChange={(e) => set('projectName', e.target.value)}
                  placeholder="예: GrippinTower OTP 구축"
                />
              </Field>
              <Field label="고객사">
                <input
                  className="input text-xs"
                  value={data.clientName}
                  onChange={(e) => set('clientName', e.target.value)}
                  placeholder="예: (주)그리핀타워"
                />
              </Field>
            </Section>
          )}

          {/* 기본 정보 */}
          <Section title="기본 정보">
            <Field label="문서 번호">
              <input className="input text-xs" value={data.docNumber} onChange={(e) => set('docNumber', e.target.value)} />
            </Field>
            <Field label="작성일">
              <input className="input text-xs" type="date" value={data.createdAt} onChange={(e) => set('createdAt', e.target.value)} />
            </Field>
            <Field label="작업명 *">
              <input className="input text-xs" value={data.workTitle} onChange={(e) => set('workTitle', e.target.value)} placeholder="예: OTP 서버 이중화 구성" />
            </Field>
            <Field label="작업 유형">
              <select className="select text-xs" value={data.workType} onChange={(e) => set('workType', e.target.value as WorkType)}>
                {(Object.entries(WORK_TYPE_LABEL) as [WorkType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="작업 일자">
                <input className="input text-xs" type="date" value={data.workDate} onChange={(e) => set('workDate', e.target.value)} />
              </Field>
              <Field label="시작 시간">
                <input className="input text-xs" type="time" value={data.workTime} onChange={(e) => set('workTime', e.target.value)} />
              </Field>
            </div>
            <Field label="예상 소요시간">
              <input className="input text-xs" value={data.workDuration} onChange={(e) => set('workDuration', e.target.value)} placeholder="예: 2시간" />
            </Field>
            <Field label="작업 장소">
              <input className="input text-xs" value={data.workLocation} onChange={(e) => set('workLocation', e.target.value)} placeholder="예: 고객사 서버실 / 원격" />
            </Field>
            <Field label="담당자">
              <input className="input text-xs" value={data.assignee} onChange={(e) => set('assignee', e.target.value)} placeholder="이름" />
            </Field>
            <Field label="연락처">
              <input className="input text-xs" value={data.contact} onChange={(e) => set('contact', e.target.value)} placeholder="010-0000-0000" />
            </Field>
          </Section>

          {/* 작업 내용 */}
          <Section title="작업 내용">
            <Field label="작업 목적">
              <textarea className="textarea text-xs" rows={3} value={data.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="이 작업을 수행하는 이유 및 목적" />
            </Field>
            <Field label="작업 범위">
              <textarea className="textarea text-xs" rows={2} value={data.scope} onChange={(e) => set('scope', e.target.value)} placeholder="예: OTP 인증 서버 2대, DB 서버 1대" />
            </Field>
            <div>
              <label className="label">작업 절차</label>
              <div className="space-y-2">
                {data.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 mt-2 w-5 flex-shrink-0">{i + 1}.</span>
                    <input
                      className="input text-xs flex-1"
                      value={step}
                      onChange={(e) => setStep(i, e.target.value)}
                      placeholder={`절차 ${i + 1}`}
                    />
                    {data.steps.length > 1 && (
                      <button onClick={() => removeStep(i)} className="mt-1.5 p-1 text-gray-600 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addStep} className="flex items-center gap-1 text-xs text-brand hover:underline mt-1">
                  <Plus className="w-3 h-3" /> 절차 추가
                </button>
              </div>
            </div>
          </Section>

          {/* 영향 범위 */}
          <Section title="영향 범위">
            <Field label="영향 시스템">
              <input className="input text-xs" value={data.affectedSystems} onChange={(e) => set('affectedSystems', e.target.value)} placeholder="예: OTP 인증 서비스, LDAP 연동" />
            </Field>
            <Field label="예상 다운타임">
              <input className="input text-xs" value={data.downtime} onChange={(e) => set('downtime', e.target.value)} placeholder="예: 없음 / 약 10분" />
            </Field>
            <Field label="영향 사용자">
              <input className="input text-xs" value={data.affectedUsers} onChange={(e) => set('affectedUsers', e.target.value)} placeholder="예: 전체 임직원 500명" />
            </Field>
          </Section>

          {/* 위험도 */}
          <Section title="위험도 및 대응">
            <Field label="위험 수준">
              <select className="select text-xs" value={data.riskLevel} onChange={(e) => set('riskLevel', e.target.value as RiskLevel)}>
                <option value="high">상 (HIGH)</option>
                <option value="medium">중 (MEDIUM)</option>
                <option value="low">하 (LOW)</option>
              </select>
            </Field>
            <Field label="위험 요소">
              <textarea className="textarea text-xs" rows={2} value={data.riskFactors} onChange={(e) => set('riskFactors', e.target.value)} placeholder="작업 중 발생 가능한 위험 요소" />
            </Field>
            <Field label="위험 대응 방안">
              <textarea className="textarea text-xs" rows={2} value={data.riskMitigation} onChange={(e) => set('riskMitigation', e.target.value)} placeholder="위험 발생 시 대응 방안" />
            </Field>
            <Field label="롤백 계획">
              <textarea className="textarea text-xs" rows={2} value={data.rollback} onChange={(e) => set('rollback', e.target.value)} placeholder="작업 실패 시 원복 절차" />
            </Field>
          </Section>

          {/* 기타 */}
          <Section title="사전 준비 및 비고">
            <Field label="사전 준비사항">
              <textarea className="textarea text-xs" rows={3} value={data.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} placeholder="작업 전 확인/준비해야 할 사항" />
            </Field>
            <Field label="비고">
              <textarea className="textarea text-xs" rows={2} value={data.notes} onChange={(e) => set('notes', e.target.value)} placeholder="기타 사항" />
            </Field>
          </Section>

          {/* 승인 */}
          <Section title="승인">
            <div className="grid grid-cols-3 gap-3">
              <Field label="작성자">
                <input className="input text-xs" value={data.author} onChange={(e) => set('author', e.target.value)} />
              </Field>
              <Field label="검토자">
                <input className="input text-xs" value={data.reviewer} onChange={(e) => set('reviewer', e.target.value)} />
              </Field>
              <Field label="승인자">
                <input className="input text-xs" value={data.approver} onChange={(e) => set('approver', e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      {/* ── 미리보기 ── */}
      <div className={clsx(
        'flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8',
        mobileTab === 'preview' ? 'block' : 'hidden md:block',
      )} id="wsl-preview">
        <WSLPreview data={data} project={previewProject} />
      </div>
      </div>

      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #wsl-preview {
            position: fixed; inset: 0;
            background: white;
            padding: 0;
            overflow: visible;
          }
          .wsl-doc {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ── 미리보기 문서 ── */
function WSLPreview({ data, project }: { data: WSLData; project: { name: string; client_name?: string | null } }) {
  const risk = RISK_LABEL[data.riskLevel];
  return (
    <div className="wsl-doc bg-white shadow-lg rounded-lg max-w-3xl mx-auto p-10 text-gray-900 text-sm leading-relaxed">
      {/* 헤더 */}
      <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-2xl font-bold tracking-wide">작 업 지 시 서</h1>
        <p className="text-xs text-gray-500 mt-1">Work Statement Letter</p>
      </div>

      {/* 문서 정보 */}
      <table className="w-full border-collapse mb-6 text-xs">
        <tbody>
          <tr>
            <DocTh>문서 번호</DocTh>
            <DocTd>{data.docNumber}</DocTd>
            <DocTh>작성일</DocTh>
            <DocTd>{data.createdAt}</DocTd>
          </tr>
          <tr>
            <DocTh>프로젝트</DocTh>
            <DocTd>{project.name}</DocTd>
            <DocTh>고객사</DocTh>
            <DocTd>{project.client_name || '-'}</DocTd>
          </tr>
          <tr>
            <DocTh>작업명</DocTh>
            <DocTd colSpan={3} className="font-semibold">{data.workTitle || '-'}</DocTd>
          </tr>
        </tbody>
      </table>

      {/* 작업 기본 정보 */}
      <DocSection title="1. 작업 기본 정보">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <DocTh>작업 유형</DocTh>
              <DocTd>{WORK_TYPE_LABEL[data.workType]}</DocTd>
              <DocTh>위험 수준</DocTh>
              <DocTd className={clsx('font-bold', risk.color)}>{risk.label}</DocTd>
            </tr>
            <tr>
              <DocTh>작업 일시</DocTh>
              <DocTd>{data.workDate} {data.workTime}</DocTd>
              <DocTh>소요시간</DocTh>
              <DocTd>{data.workDuration || '-'}</DocTd>
            </tr>
            <tr>
              <DocTh>작업 장소</DocTh>
              <DocTd>{data.workLocation || '-'}</DocTd>
              <DocTh>담당자</DocTh>
              <DocTd>{data.assignee || '-'} {data.contact && `(${data.contact})`}</DocTd>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection title="2. 작업 목적">
        <DocPara>{data.purpose}</DocPara>
      </DocSection>

      <DocSection title="3. 작업 범위">
        <DocPara>{data.scope}</DocPara>
      </DocSection>

      <DocSection title="4. 작업 절차">
        {data.steps.filter(Boolean).length === 0 ? (
          <DocPara>{''}</DocPara>
        ) : (
          <ol className="list-decimal list-inside space-y-1 text-xs pl-2">
            {data.steps.filter(Boolean).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </DocSection>

      <DocSection title="5. 영향 범위">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <DocTh>영향 시스템</DocTh>
              <DocTd colSpan={3}>{data.affectedSystems || '-'}</DocTd>
            </tr>
            <tr>
              <DocTh>예상 다운타임</DocTh>
              <DocTd>{data.downtime || '-'}</DocTd>
              <DocTh>영향 사용자</DocTh>
              <DocTd>{data.affectedUsers || '-'}</DocTd>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection title="6. 위험도 및 대응 방안">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <DocTh className="w-28">위험 요소</DocTh>
              <DocTd>{data.riskFactors || '-'}</DocTd>
            </tr>
            <tr>
              <DocTh>위험 대응</DocTh>
              <DocTd>{data.riskMitigation || '-'}</DocTd>
            </tr>
            <tr>
              <DocTh>롤백 계획</DocTh>
              <DocTd>{data.rollback || '-'}</DocTd>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection title="7. 사전 준비사항">
        <DocPara>{data.prerequisites}</DocPara>
      </DocSection>

      {data.notes && (
        <DocSection title="8. 비고">
          <DocPara>{data.notes}</DocPara>
        </DocSection>
      )}

      {/* 승인란 */}
      <div className="mt-8 border-t-2 border-gray-900 pt-4">
        <table className="w-full border-collapse text-xs text-center">
          <thead>
            <tr>
              <th className="border border-gray-400 bg-gray-100 py-2 font-semibold w-1/3">작성자</th>
              <th className="border border-gray-400 bg-gray-100 py-2 font-semibold w-1/3">검토자</th>
              <th className="border border-gray-400 bg-gray-100 py-2 font-semibold w-1/3">승인자</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 h-16 align-bottom pb-2">{data.author}</td>
              <td className="border border-gray-400 h-16 align-bottom pb-2">{data.reviewer}</td>
              <td className="border border-gray-400 h-16 align-bottom pb-2">{data.approver}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 text-gray-400">(서명)</td>
              <td className="border border-gray-400 py-1 text-gray-400">(서명)</td>
              <td className="border border-gray-400 py-1 text-gray-400">(서명)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-6">
        본 문서는 SafeSquare로 생성되었습니다 · {data.docNumber}
      </p>
    </div>
  );
}

/* ── 작은 유틸 컴포넌트들 ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-1 border-b border-gray-800">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-bold bg-gray-100 border border-gray-300 px-3 py-1.5 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function DocPara({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-gray-300 px-3 py-2 min-h-[40px] text-xs whitespace-pre-wrap">
      {children || <span className="text-gray-300">-</span>}
    </div>
  );
}

function DocTh({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <th colSpan={colSpan} className={clsx('border border-gray-300 bg-gray-100 px-3 py-1.5 text-left font-semibold w-28 whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

function DocTd({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx('border border-gray-300 px-3 py-1.5', className)}>
      {children}
    </td>
  );
}
