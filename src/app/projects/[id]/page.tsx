'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAppStore } from '@/store';
import { projectsApi } from '@/lib/api';
import type { Project, ActiveTab } from '@/lib/types';
import GuidesTab from '@/components/guides/GuideList';
import ChatContainer from '@/components/chat/ChatContainer';
import ServerList from '@/components/servers/ServerList';
import LogsViewer from '@/components/logs/LogsViewer';
import SolutionManager from '@/components/solutions/SolutionManager';
import TaskManager from '@/components/tasks/TaskManager';
import DocsHub from '@/components/docs/DocsHub';
import InspectionHistory from '@/components/inspections/InspectionHistory';
import IncidentList from '@/components/incidents/IncidentList';
import FileManager from '@/components/files/FileManager';
import MailManager from '@/components/mails/MailManager';
import PartnerManager from '@/components/partners/PartnerManager';
import WeeklyReportManager from '@/components/weekly-reports/WeeklyReportManager';
import WBSGenerator from '@/components/wbs/WBSGenerator';
import InquiryManager from '@/components/inquiries/InquiryManager';
import {
  BookOpen, MessageSquare, Server, FileText, Package, CalendarCheck,
  ClipboardList, ClipboardCheck, AlertOctagon, Paperclip, Mail, Building2,
  Activity, Archive, CheckCircle2, Pencil, ChevronDown, BarChart2, GitBranch,
  MessageCircleQuestion,
} from 'lucide-react';
import clsx from 'clsx';
import ProjectModal from '@/components/projects/ProjectModal';

// ── 탭 정의 ─────────────────────────────────────────────────

const ALL_TABS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'solutions',   label: '솔루션',   icon: Package        },
  { id: 'tasks',       label: '일정',     icon: CalendarCheck  },
  { id: 'wbs',         label: 'WBS',      icon: GitBranch      },
  { id: 'incidents',   label: '장애이력', icon: AlertOctagon   },
  { id: 'guides',      label: '가이드',   icon: BookOpen       },
  { id: 'docs',        label: '문서',     icon: ClipboardList  },
  { id: 'inspections', label: '점검',     icon: ClipboardCheck },
  { id: 'chat',        label: 'AI 채팅',  icon: MessageSquare  },
  { id: 'servers',     label: '서버',     icon: Server         },
  { id: 'logs',        label: '로그',     icon: FileText       },
  { id: 'files',       label: '파일',     icon: Paperclip      },
  { id: 'mails',          label: '메일함',   icon: Mail                  },
  { id: 'partners',       label: '파트너사', icon: Building2             },
  { id: 'weekly_reports', label: '주간보고', icon: BarChart2             },
  { id: 'inquiries',      label: '고객문의', icon: MessageCircleQuestion },
];

// 고정 탭 6개 + 나머지 더보기
const PINNED_COUNT = 6;
const PINNED_TABS   = ALL_TABS.slice(0, PINNED_COUNT);
const OVERFLOW_TABS = ALL_TABS.slice(PINNED_COUNT);

// ── 상태 메타 ─────────────────────────────────────────────

const STATUS_META = {
  active:    { label: '운영 중',  icon: Activity,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  completed: { label: '완료',    icon: CheckCircle2,  color: 'text-brand',       bg: 'bg-brand/10',       border: 'border-brand/25',       dot: 'bg-brand'       },
  archived:  { label: '보관',    icon: Archive,       color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/25',    dot: 'bg-gray-500'    },
};

// ── 날짜 포매터 ───────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProjectPage() {
  const params    = useParams();
  const projectId = Number(params.id);

  const { projects, setProjects, selectedProjectId, setSelectedProject, activeTab, setActiveTab } = useAppStore();
  const [project,      setProject]     = useState<Project | null>(null);
  const [showEdit,     setShowEdit]    = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // 더보기 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      projectsApi.list().then(setProjects).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (projectId && selectedProjectId !== projectId) {
      setSelectedProject(projectId);
    }
    const found = projects.find((p) => p.id === projectId);
    if (found) {
      setProject(found);
    } else if (projectId) {
      projectsApi.list()
        .then((list) => {
          setProjects(list);
          setProject(list.find((p) => p.id === projectId) ?? null);
        })
        .catch(console.error);
    }
  }, [projectId, projects]);

  // ── 로딩 ─────────────────────────────────────────────────
  if (!project) {
    return (
      <div className="flex h-screen bg-surface">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            <p className="text-xs text-gray-600">프로젝트 로딩 중...</p>
          </div>
        </main>
      </div>
    );
  }

  const sm = STATUS_META[project.status] ?? STATUS_META.archived;
  const StatusIcon = sm.icon;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* ── 프로젝트 헤더 ──────────────────────────────── */}
        <header
          className="flex-shrink-0"
          style={{
            background: 'linear-gradient(180deg, #181b26 0%, #13161f 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* 상단 정보 행 */}
          <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4">
            <div className="flex items-start justify-between gap-3">

              {/* 왼쪽: 프로젝트 정보 */}
              <div className="flex items-start gap-4 min-w-0">
                {/* 아이콘 */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{
                    background: 'rgba(79,142,247,0.12)',
                    border: '1px solid rgba(79,142,247,0.25)',
                    color: '#4f8ef7',
                    boxShadow: '0 0 16px rgba(79,142,247,0.1)',
                  }}
                >
                  {project.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  {/* 고객사 + 상태 */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {project.client_name && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(168,85,247,0.08)',
                          border: '1px solid rgba(168,85,247,0.2)',
                          color: '#c084fc',
                        }}
                      >
                        <Building2 className="w-3 h-3" />
                        {project.client_name}
                      </span>
                    )}
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border',
                        sm.color, sm.bg, sm.border,
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full', sm.dot)} />
                      {sm.label}
                    </span>
                  </div>

                  {/* 프로젝트명 */}
                  <h1 className="text-xl font-bold text-gray-100 leading-tight truncate">
                    {project.name}
                  </h1>

                  {/* 설명 */}
                  {project.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-1">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>

              {/* 오른쪽: 수정 버튼 */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  프로젝트 수정
                </button>
              </div>
            </div>
          </div>

          {/* ── 탭 네비게이션 ──────────────────────────── */}
          <nav className="flex items-center px-2 md:px-4">
            {/* 고정 탭 (가로 스크롤 가능) */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {PINNED_TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={clsx(
                    'relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors rounded-t-lg',
                    isActive
                      ? 'text-brand'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]',
                  )}
                >
                  <Icon className={clsx('w-3.5 h-3.5 flex-shrink-0', isActive && 'text-brand')} />
                  {label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ background: '#4f8ef7', boxShadow: '0 0 6px rgba(79,142,247,0.8)' }}
                    />
                  )}
                </button>
              );
            })}
            </div>

            {/* 더보기 드롭다운 (overflow 컨테이너 바깥에 위치) */}
            <div ref={overflowRef} className="relative flex-shrink-0">
              {(() => {
                const activeOverflow = OVERFLOW_TABS.find(t => t.id === activeTab);
                const isOverflowActive = !!activeOverflow;
                return (
                  <button
                    onClick={() => setOverflowOpen(v => !v)}
                    className={clsx(
                      'relative flex items-center gap-1 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors rounded-t-lg',
                      isOverflowActive
                        ? 'text-brand'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]',
                    )}
                  >
                    {activeOverflow ? (
                      <>
                        <activeOverflow.icon className="w-3.5 h-3.5 flex-shrink-0 text-brand" />
                        {activeOverflow.label}
                      </>
                    ) : (
                      '더보기'
                    )}
                    <ChevronDown className={clsx('w-3 h-3 transition-transform', overflowOpen && 'rotate-180')} />
                    {isOverflowActive && (
                      <span
                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                        style={{ background: '#4f8ef7', boxShadow: '0 0 6px rgba(79,142,247,0.8)' }}
                      />
                    )}
                  </button>
                );
              })()}

              {overflowOpen && (
                <div
                  className="absolute top-full left-0 mt-1 py-1 rounded-xl z-50 shadow-2xl min-w-[140px]"
                  style={{
                    background: '#0f1623',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {OVERFLOW_TABS.map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveTab(id); setOverflowOpen(false); }}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left',
                          isActive
                            ? 'text-brand bg-brand/10'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]',
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </header>

        {/* ── 탭 콘텐츠 ──────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'solutions'   && <SolutionManager   projectId={projectId} />}
          {activeTab === 'tasks'       && <TaskManager       projectId={projectId} />}
          {activeTab === 'wbs'         && <WBSGenerator      project={project} projectId={projectId} />}
          {activeTab === 'incidents'   && <IncidentList      projectId={projectId} />}
          {activeTab === 'guides'      && <GuidesTab         projectId={projectId} />}
          {activeTab === 'docs'        && <DocsHub           project={project}     />}
          {activeTab === 'inspections' && <InspectionHistory project={project}     />}
          {activeTab === 'chat'        && <ChatContainer     projectId={projectId} />}
          {activeTab === 'servers'     && <ServerList        projectId={projectId} />}
          {activeTab === 'logs'        && <LogsViewer        projectId={projectId} />}
          {activeTab === 'files'       && <FileManager       projectId={projectId} />}
          {activeTab === 'mails'          && <MailManager          projectId={projectId} />}
          {activeTab === 'partners'       && <PartnerManager       projectId={projectId} />}
          {activeTab === 'weekly_reports' && <WeeklyReportManager  projectId={projectId} />}
          {activeTab === 'inquiries'      && <InquiryManager       projectId={projectId} />}
        </div>
      </div>

      {/* 프로젝트 수정 모달 */}
      {showEdit && (
        <ProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSave={(saved) => {
            setProject(saved);
            setProjects(projects.map(p => p.id === saved.id ? saved : p));
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}
