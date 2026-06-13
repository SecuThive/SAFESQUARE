'use client';

import { useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { projectsApi, reportsApi } from '@/lib/api';
import type { ReportData } from '@/lib/api';
import type { Project } from '@/lib/types';
import { Printer, Download, RefreshCw, AlertTriangle, CheckCircle, Clock, Server, Wrench } from 'lucide-react';
import clsx from 'clsx';

// ─────────────────────────────────────────────────────────────────────────────
// 상수 / 유틸
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<string, string> = {
  urgent: '긴급', high: '높음', medium: '보통', low: '낮음',
};

const WORK_TYPE_LABEL: Record<string, string> = {
  regular: '정기', emergency: '긴급', maintenance: '유지보수', training: '교육', other: '기타',
};

const SEV_LABEL: Record<string, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: '진행중',   color: 'text-emerald-400' },
  completed: { label: '완료',    color: 'text-blue-400'    },
  archived:  { label: '보관됨',  color: 'text-gray-500'    },
};

const OVERALL_OPTIONS = [
  { value: 'on_track',   label: '정상 진행중',   color: 'bg-emerald-600' },
  { value: 'at_risk',    label: '위험 요소 있음', color: 'bg-yellow-600'  },
  { value: 'delayed',    label: '지연',          color: 'bg-red-600'     },
  { value: 'completed',  label: '완료',           color: 'bg-blue-600'    },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function fmtDate(iso: string) {
  return iso.replace(/-/g, '.');
}

function progressColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-blue-500';
  if (pct >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ─────────────────────────────────────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  projectId:   number | '';
  periodFrom:  string;
  periodTo:    string;
  reporter:    string;
  phase:       string;
  progress:    number;
  overall:     string;
  summary:     string;
  issues:      string;
  nextSteps:   string;
  remarks:     string;
}

export default function ReportsPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormState>({
    projectId:  '',
    periodFrom: monthStart(),
    periodTo:   today(),
    reporter:   '',
    phase:      '',
    progress:   0,
    overall:    'on_track',
    summary:    '',
    issues:     '',
    nextSteps:  '',
    remarks:    '',
  });

  const [report, setReport]   = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(console.error);
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleLoad() {
    if (!form.projectId) { setError('프로젝트를 선택하세요'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await reportsApi.generate(
        Number(form.projectId),
        form.periodFrom,
        form.periodTo,
      );
      setReport(data);
      // auto-fill progress from task completion rate
      if (data.task_stats.total > 0) {
        const pct = Math.round((data.task_stats.completed_total / data.task_stats.total) * 100);
        set('progress', pct);
      }
    } catch (e: any) {
      setError(e.message ?? '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const selectedProject = projects.find(p => p.id === Number(form.projectId));
  const overallOption   = OVERALL_OPTIONS.find(o => o.value === form.overall)!;

  return (
    <>
      {/* ── 글로벌 프린트 CSS ────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: fixed !important;
            inset: 0 !important;
            background: white !important;
            padding: 32px 40px !important;
            font-size: 11pt !important;
            color: #111 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex h-screen overflow-hidden">
        <div className="no-print flex h-full">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
          {/* ── 모바일 탭 ── */}
          <div className="flex-shrink-0 flex md:hidden border-b border-gray-800 bg-surface-raised no-print">
            <button onClick={() => setMobileTab('form')}
              className={clsx('flex-1 py-2.5 text-xs font-medium transition-colors',
                mobileTab === 'form' ? 'text-brand border-b-2 border-brand' : 'text-gray-500')}>
              설정
            </button>
            <button onClick={() => setMobileTab('preview')}
              className={clsx('flex-1 py-2.5 text-xs font-medium transition-colors',
                mobileTab === 'preview' ? 'text-brand border-b-2 border-brand' : 'text-gray-500')}>
              미리보기
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden min-h-0">
          {/* ── 왼쪽 설정 패널 ────────────────────────────────── */}
          <aside className={clsx(
            'no-print border-r border-gray-800 bg-surface-raised flex-col overflow-y-auto',
            'w-full md:w-72 md:flex-shrink-0',
            mobileTab === 'form' ? 'flex' : 'hidden md:flex',
          )}>
            <div className="px-5 py-4 border-b border-gray-800">
              <h1 className="text-sm font-semibold text-gray-100">진행 보고서 생성기</h1>
              <p className="text-xs text-gray-500 mt-0.5">프로젝트 진행 현황 보고서</p>
            </div>

            <div className="flex-1 px-5 py-4 space-y-5">
              {/* 프로젝트 */}
              <Field label="프로젝트">
                <select
                  value={form.projectId}
                  onChange={e => set('projectId', Number(e.target.value) || '')}
                  className="input-select"
                >
                  <option value="">— 선택 —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>

              {/* 기간 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-400">보고 기간</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={form.periodFrom}
                    onChange={e => set('periodFrom', e.target.value)}
                    className="input-date flex-1" />
                  <span className="text-gray-600 text-xs">~</span>
                  <input type="date" value={form.periodTo}
                    onChange={e => set('periodTo', e.target.value)}
                    className="input-date flex-1" />
                </div>
              </div>

              {/* 데이터 로드 */}
              <button
                onClick={handleLoad}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                {loading ? '로딩 중...' : '데이터 불러오기'}
              </button>

              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <hr className="border-gray-800" />

              {/* 보고서 메타 */}
              <Field label="보고자">
                <input type="text" value={form.reporter}
                  onChange={e => set('reporter', e.target.value)}
                  placeholder="이름 / 팀명"
                  className="input-text" />
              </Field>

              <Field label="현재 단계">
                <input type="text" value={form.phase}
                  onChange={e => set('phase', e.target.value)}
                  placeholder="예: 구축 2단계, 운영 안정화..."
                  className="input-text" />
              </Field>

              {/* 진행률 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-400">
                  전체 진행률 <span className="text-gray-300 font-semibold">{form.progress}%</span>
                </label>
                <input type="range" min={0} max={100} value={form.progress}
                  onChange={e => set('progress', Number(e.target.value))}
                  className="w-full accent-emerald-500" />
              </div>

              {/* 전체 상태 */}
              <Field label="전체 상태">
                <select value={form.overall}
                  onChange={e => set('overall', e.target.value)}
                  className="input-select">
                  {OVERALL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <hr className="border-gray-800" />

              {/* 텍스트 필드들 */}
              <Field label="전체 요약">
                <textarea rows={3} value={form.summary}
                  onChange={e => set('summary', e.target.value)}
                  placeholder="이번 기간 주요 진행 내용..."
                  className="input-textarea" />
              </Field>

              <Field label="주요 이슈">
                <textarea rows={3} value={form.issues}
                  onChange={e => set('issues', e.target.value)}
                  placeholder="현재 이슈 또는 리스크..."
                  className="input-textarea" />
              </Field>

              <Field label="다음 단계">
                <textarea rows={3} value={form.nextSteps}
                  onChange={e => set('nextSteps', e.target.value)}
                  placeholder="다음 기간 계획..."
                  className="input-textarea" />
              </Field>

              <Field label="특이사항">
                <textarea rows={2} value={form.remarks}
                  onChange={e => set('remarks', e.target.value)}
                  placeholder="기타 특이사항..."
                  className="input-textarea" />
              </Field>
            </div>

            {/* 인쇄 버튼 */}
            <div className="px-5 py-4 border-t border-gray-800">
              <button
                onClick={handlePrint}
                disabled={!report}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-100 text-sm font-medium rounded-lg py-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                인쇄 / PDF 저장
              </button>
            </div>
          </aside>

          {/* ── 오른쪽 미리보기 ───────────────────────────────── */}
          <main className={clsx(
            'flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8',
            mobileTab === 'preview' ? 'block' : 'hidden md:block',
          )}>
            {!report ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <p className="text-sm">프로젝트를 선택하고</p>
                  <p className="text-sm mt-1">「데이터 불러오기」를 클릭하세요</p>
                </div>
              </div>
            ) : (
              <div
                id="print-area"
                ref={printRef}
                className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden text-gray-800"
                style={{ fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" }}
              >
                {/* 헤더 */}
                <div className="bg-gray-900 text-white px-10 py-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Progress Report</p>
                      <h1 className="text-2xl font-bold">{report.project.name}</h1>
                      {report.project.client_name && (
                        <p className="text-sm text-gray-400 mt-1">{report.project.client_name}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-400 space-y-1">
                      <p>보고 기간: {fmtDate(report.period.from)} ~ {fmtDate(report.period.to)}</p>
                      <p>보고일: {fmtDate(today())}</p>
                      {form.reporter && <p>보고자: {form.reporter}</p>}
                    </div>
                  </div>

                  {/* 진행률 바 */}
                  <div className="mt-6">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>{form.phase || '전체 진행률'}</span>
                      <span className="font-semibold text-white">{form.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className={clsx('h-2.5 rounded-full transition-all', progressColor(form.progress))}
                        style={{ width: `${form.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* 상태 배지 */}
                  <div className="mt-4">
                    <span className={clsx('inline-block px-3 py-1 rounded-full text-xs font-semibold text-white', overallOption.color)}>
                      {overallOption.label}
                    </span>
                  </div>
                </div>

                <div className="px-10 py-8 space-y-8">

                  {/* 1. 핵심 지표 */}
                  <section>
                    <SectionTitle>핵심 지표</SectionTitle>
                    <div className="grid grid-cols-4 gap-4">
                      <StatCard
                        icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                        label="완료 태스크"
                        value={`${report.task_stats.completed_total} / ${report.task_stats.total}`}
                      />
                      <StatCard
                        icon={<Clock className="w-5 h-5 text-blue-500" />}
                        label="진행 중"
                        value={String(report.task_stats.ongoing)}
                      />
                      <StatCard
                        icon={<Wrench className="w-5 h-5 text-yellow-500" />}
                        label="총 작업 시간"
                        value={`${report.total_work_hours}h`}
                      />
                      <StatCard
                        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                        label="미해결 장애"
                        value={String(report.open_incidents.length)}
                      />
                    </div>
                  </section>

                  {/* 2. 요약 */}
                  {form.summary && (
                    <section>
                      <SectionTitle>전체 요약</SectionTitle>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {form.summary}
                      </div>
                    </section>
                  )}

                  {/* 3. 완료 태스크 */}
                  {report.completed_tasks.length > 0 && (
                    <section>
                      <SectionTitle>완료된 작업 ({report.completed_tasks.length}건)</SectionTitle>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <Th>제목</Th>
                            <Th w="80px">유형</Th>
                            <Th w="64px">우선순위</Th>
                            <Th w="100px">완료일</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.completed_tasks.map(t => (
                            <tr key={t.id} className="border-b border-gray-100">
                              <Td>{t.title}</Td>
                              <Td>{t.type}</Td>
                              <Td>{PRIORITY_LABEL[t.priority] ?? t.priority}</Td>
                              <Td>{t.completed_at ? fmtDate(t.completed_at.slice(0, 10)) : '-'}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* 4. 진행 중 태스크 */}
                  {report.ongoing_tasks.length > 0 && (
                    <section>
                      <SectionTitle>진행 중인 작업 ({report.ongoing_tasks.length}건)</SectionTitle>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <Th>제목</Th>
                            <Th w="80px">유형</Th>
                            <Th w="64px">우선순위</Th>
                            <Th w="100px">마감일</Th>
                            <Th w="100px">담당자</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.ongoing_tasks.map(t => (
                            <tr key={t.id} className="border-b border-gray-100">
                              <Td>{t.title}</Td>
                              <Td>{t.type}</Td>
                              <Td>{PRIORITY_LABEL[t.priority] ?? t.priority}</Td>
                              <Td>{t.due_date ? fmtDate(t.due_date) : '-'}</Td>
                              <Td>{t.assigned_to ?? '-'}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* 5. 예정 태스크 */}
                  {report.upcoming_tasks.length > 0 && (
                    <section>
                      <SectionTitle>예정 작업 (최대 10건)</SectionTitle>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <Th>제목</Th>
                            <Th w="80px">유형</Th>
                            <Th w="64px">우선순위</Th>
                            <Th w="100px">마감일</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.upcoming_tasks.map(t => (
                            <tr key={t.id} className="border-b border-gray-100">
                              <Td>{t.title}</Td>
                              <Td>{t.type}</Td>
                              <Td>{PRIORITY_LABEL[t.priority] ?? t.priority}</Td>
                              <Td>{t.due_date ? fmtDate(t.due_date) : '-'}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* 6. 작업일지 요약 */}
                  {report.work_logs.length > 0 && (
                    <section>
                      <SectionTitle>작업일지 ({report.work_logs.length}건 / {report.total_work_hours}h)</SectionTitle>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <Th w="100px">날짜</Th>
                            <Th>제목</Th>
                            <Th w="80px">유형</Th>
                            <Th w="80px">담당자</Th>
                            <Th w="60px">시간</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.work_logs.map(wl => (
                            <tr key={wl.id} className="border-b border-gray-100">
                              <Td>{fmtDate(wl.work_date)}</Td>
                              <Td>
                                {wl.title}
                                {wl.issues && (
                                  <span className="block text-xs text-orange-500 mt-0.5">이슈: {wl.issues}</span>
                                )}
                              </Td>
                              <Td>{WORK_TYPE_LABEL[wl.work_type] ?? wl.work_type}</Td>
                              <Td>{wl.engineer ?? '-'}</Td>
                              <Td>{wl.hours ?? '-'}h</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* 7. 미해결 장애 */}
                  {report.open_incidents.length > 0 && (
                    <section>
                      <SectionTitle>미해결 장애 ({report.open_incidents.length}건)</SectionTitle>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <Th>제목</Th>
                            <Th w="80px">심각도</Th>
                            <Th w="100px">상태</Th>
                            <Th w="140px">발생일시</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.open_incidents.map(i => (
                            <tr key={i.id} className="border-b border-gray-100">
                              <Td>{i.title}</Td>
                              <Td className={clsx(
                                i.severity === 'critical' && 'text-red-600 font-semibold',
                                i.severity === 'high'     && 'text-orange-500',
                              )}>
                                {SEV_LABEL[i.severity] ?? i.severity}
                              </Td>
                              <Td>{i.status}</Td>
                              <Td>{fmtDate(i.occurred_at.slice(0, 10))}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* 8. 서버 현황 */}
                  {report.servers.length > 0 && (
                    <section>
                      <SectionTitle>서버 현황 ({report.servers.length}대)</SectionTitle>
                      <div className="grid grid-cols-3 gap-3">
                        {report.servers.map(s => (
                          <div key={s.id} className="border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
                            <Server className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{s.hostname}</p>
                              <p className="text-xs text-gray-400">{s.role ?? '-'}</p>
                            </div>
                            <span className={clsx(
                              'ml-auto text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                              s.status === 'online'   && 'bg-emerald-50 text-emerald-600',
                              s.status === 'offline'  && 'bg-red-50 text-red-600',
                              s.status === 'degraded' && 'bg-yellow-50 text-yellow-600',
                              !['online','offline','degraded'].includes(s.status) && 'bg-gray-100 text-gray-500',
                            )}>
                              {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 9. 이슈 */}
                  {form.issues && (
                    <section>
                      <SectionTitle>주요 이슈 및 리스크</SectionTitle>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {form.issues}
                      </div>
                    </section>
                  )}

                  {/* 10. 다음 단계 */}
                  {form.nextSteps && (
                    <section>
                      <SectionTitle>다음 단계 계획</SectionTitle>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {form.nextSteps}
                      </div>
                    </section>
                  )}

                  {/* 11. 특이사항 */}
                  {form.remarks && (
                    <section>
                      <SectionTitle>특이사항</SectionTitle>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {form.remarks}
                      </div>
                    </section>
                  )}

                  {/* 푸터 */}
                  <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 flex justify-between">
                    <span>SAFESQUARE Internal Platform</span>
                    <span>Generated: {fmtDate(today())}</span>
                  </div>
                </div>
              </div>
            )}
          </main>
          </div>
        </div>
      </div>

      {/* ── input 공통 스타일 (Tailwind arbitrary) ─────────────── */}
      <style>{`
        .input-text, .input-select, .input-date, .input-textarea {
          width: 100%;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          color: #f3f4f6;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-text:focus, .input-select:focus, .input-date:focus, .input-textarea:focus {
          border-color: #10b981;
        }
        .input-select { appearance: none; }
        .input-textarea { resize: vertical; }
        .input-date::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 작은 헬퍼 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-gray-900 border-b-2 border-gray-200 pb-1 mb-3 uppercase tracking-wide">
      {children}
    </h2>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return (
    <th
      className="text-left text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-200"
      style={w ? { width: w, minWidth: w } : undefined}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={clsx('px-3 py-2 text-gray-700 text-sm', className)}>
      {children}
    </td>
  );
}
