'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppStore } from '@/store';
import { projectsApi, mailsApi, clearAuth, getAuthMeta, getAuthHeaders } from '@/lib/api';
import {
  Plus, FolderOpen, Settings, LogOut, Users,
  LayoutDashboard, BookMarked, ClipboardList, NotebookPen, CheckSquare, Menu, X, ContactRound, Mail, Building2, ClipboardCopy,
  ChevronRight, ChevronLeft, MessageSquare, Briefcase, Wrench, ShieldCheck, KeyRound, AlertTriangle, PackageSearch, Search,
  BookHeart, Bell, FolderKanban, Archive, Server, BarChart2, MessageCircleQuestion, BookOpen, Terminal, Bot,
} from 'lucide-react';
import clsx from 'clsx';
import ProjectModal from '@/components/projects/ProjectModal';
import SettingsModal from '@/components/settings/SettingsModal';
import UserManagementModal from '@/components/admin/UserManagementModal';
import ProfileModal from '@/components/ui/ProfileModal';
import UserBadge from '@/components/ui/UserBadge';
import type { Project } from '@/lib/types';
import GlobalSearch from '@/components/search/GlobalSearch';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import SystemMonitor from '@/components/layout/SystemMonitor';

/* ── 전체 내비 구조 ───────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    id: 'comm', label: '커뮤니케이션', icon: MessageSquare,
    items: [
      { href: '/mails',    label: '메일함',   icon: Mail         },
      { href: '/contacts', label: '담당자',   icon: ContactRound },
      { href: '/partners', label: '파트너사', icon: Building2    },
    ],
  },
  {
    id: 'work', label: '업무', icon: Briefcase,
    items: [
      { href: '/weekly-work',     label: '주간업무',    icon: BarChart2              },
      { href: '/worklogs',        label: '작업일지',    icon: BookMarked             },
      { href: '/wbs',             label: 'WBS',         icon: ClipboardList          },
      { href: '/minutes',         label: '회의록',      icon: NotebookPen            },
      { href: '/todos',           label: '할 일',       icon: CheckSquare            },
      { href: '/inquiries',       label: '고객문의',    icon: MessageCircleQuestion  },
      { href: '/otp-licenses',    label: 'OTP 라이센스', icon: KeyRound              },
      { href: '/troubleshooting',   label: '장애조치',      icon: AlertTriangle      },
      { href: '/vendor-guides',     label: '벤더 가이드',   icon: PackageSearch      },
      { href: '/script-generator',  label: '스크립트 생성기', icon: Terminal          },
    ],
  },
  {
    id: 'tools', label: '도구', icon: Wrench,
    items: [
      { href: '/clips', label: '클립보드', icon: ClipboardCopy },
      { href: '/tools', label: '보안 도구', icon: ShieldCheck   },
    ],
  },
  {
    id: 'personal', label: '개인', icon: BookHeart,
    items: [
      { href: '/personal-projects', label: '개인 프로젝트', icon: FolderKanban },
      { href: '/diary',             label: '일일 다이어리', icon: BookHeart    },
      { href: '/documents',         label: '문서함',        icon: Archive      },
      { href: '/ssh-servers',       label: 'SSH 서버',      icon: Server       },
      { href: '/work-methods',      label: '작업 방법 관리', icon: BookOpen     },
      { href: '/ai-company',        label: 'AI 회사',       icon: Bot          },
    ],
  },
] as const;

/* ── 아이콘 버튼 (접힌 상태) ─────────────────────────────────── */
function IconBtn({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number | null;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 mx-auto',
        active
          ? 'sidebar-active-item'
          : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300',
      )}
    >
      <Icon className="w-4 h-4" />
      {badge != null && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-glow-yellow" />
      )}
    </button>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────── */
export default function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const {
    projects, setProjects, selectedProjectId, setSelectedProject,
    sidebarMobileOpen, setSidebarMobileOpen,
    sidebarCollapsed,  toggleSidebar,
  } = useAppStore();

  const [openGroups,   setOpenGroups]   = useState<Set<string>>(() => new Set());
  const [showModal,    setShowModal]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMgmt,       setShowUserMgmt]       = useState(false);
  const [showProfile,        setShowProfile]        = useState(false);
  const [authMeta,           setAuthMeta]           = useState<{ username: string; isAdmin: boolean } | null>(null);
  const [displayName,        setDisplayName]        = useState<string | null>(null);
  const [unassignedCount,    setUnassignedCount]    = useState(0);
  const [showSearch,         setShowSearch]         = useState(false);
  const [showNotifications,  setShowNotifications]  = useState(false);
  const [notificationCount,  setNotificationCount]  = useState(0);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setAuthMeta(getAuthMeta());
    projectsApi.list().then(setProjects).catch(console.error);
    const headers = getAuthHeaders();
    if (headers.Authorization) {
      fetch('/api/auth/me', { headers })
        .then(r => r.ok ? r.json() : null)
        .then(u => u && setDisplayName(u.display_name ?? null))
        .catch(() => {});
      mailsApi.list({ unassigned: true })
        .then(mails => setUnassignedCount(mails.length))
        .catch(() => {});
    }
  }, [setProjects]);

  function handleLogout() { clearAuth(); router.push('/login'); }
  function navigate(href: string) { setSidebarMobileOpen(false); router.push(href); }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (sidebarCollapsed) setOpenGroups(new Set());
  }, [sidebarCollapsed]);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Mobile bottom navigation bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch"
        style={{
          height: '4rem',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'oklch(0.12 0.010 246 / 0.95)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderTop: '1px solid oklch(0.24 0.010 238)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.40)',
        }}
      >
        {[
          { label: '홈', icon: LayoutDashboard, action: () => { setSelectedProject(null); navigate('/dashboard'); }, active: pathname === '/dashboard' },
          { label: '메일', icon: Mail, action: () => { setSelectedProject(null); navigate('/mails'); }, active: pathname === '/mails', badge: unassignedCount },
          { label: '검색', icon: Search, action: () => setShowSearch(true), active: false },
          { label: '알림', icon: Bell, action: () => setShowNotifications(v => !v), active: showNotifications, badge: notificationCount },
          { label: '더보기', icon: Menu, action: () => setSidebarMobileOpen(true), active: sidebarMobileOpen },
        ].map(({ label, icon: Icon, action, active, badge }) => (
          <button
            key={label}
            onClick={action}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-150 relative',
              active ? 'text-brand' : 'text-gray-500 hover:text-gray-300',
            )}
          >
            <span className="relative">
              <Icon className="w-5 h-5" />
              {badge != null && badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-glow-red">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col',
          'transform transition-all duration-200 ease-in-out',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0 lg:flex-shrink-0',
          sidebarCollapsed ? 'w-14' : 'w-64',
        )}
        style={{
          background: 'oklch(0.11 0.010 248)',
          backgroundImage: 'linear-gradient(180deg, oklch(0.13 0.010 246) 0%, oklch(0.10 0.010 250) 100%)',
          borderRight: '1px solid oklch(0.22 0.010 238)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div className={clsx(
          'flex items-center flex-shrink-0',
          sidebarCollapsed ? 'justify-center px-0 py-3.5' : 'justify-between px-3.5 py-3.5',
        )} style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}>
          {sidebarCollapsed ? (
            <button
              onClick={() => { setSelectedProject(null); navigate('/dashboard'); }}
              title="SAFESQUARE"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-white/5"
            >
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </button>
          ) : (
            <>
              <button
                onClick={() => { setSelectedProject(null); navigate('/dashboard'); }}
                className="flex items-center gap-2.5 group"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.76 0.16 196 / 0.20) 0%, oklch(0.68 0.18 220 / 0.12) 100%)',
                    border: '1px solid oklch(0.55 0.12 196 / 0.35)',
                    boxShadow: '0 0 12px oklch(0.76 0.16 196 / 0.12)',
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h1 className="text-xs font-black tracking-[0.16em] gradient-text" style={{ lineHeight: 1.2 }}>
                    SAFESQUARE
                  </h1>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>Security Ops Platform</p>
                </div>
              </button>
              <button
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors lg:hidden"
                onClick={() => setSidebarMobileOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* ── 접힌 내비 ─────────────────────────────────────────── */}
        {sidebarCollapsed ? (
          <div className="flex-1 overflow-y-auto py-3 space-y-0.5 scrollbar-none">
            <IconBtn icon={Search} label="검색 (⌘K)" onClick={() => setShowSearch(true)} />

            <div className="relative flex justify-center">
              <button
                ref={bellRef}
                onClick={() => setShowNotifications(v => !v)}
                title="알림"
                className={clsx(
                  'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150',
                  showNotifications ? 'sidebar-active-item' : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300',
                )}
              >
                <Bell className="w-4 h-4" />
              </button>
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </div>

            <IconBtn
              icon={LayoutDashboard}
              label="대시보드"
              active={pathname === '/dashboard'}
              onClick={() => { setSelectedProject(null); navigate('/dashboard'); }}
            />

            <div className="mx-auto w-6 my-2" style={{ height: 1, background: 'oklch(0.22 0.010 238)' }} />

            {NAV_GROUPS.map(group =>
              group.items.map(item => (
                <IconBtn
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={pathname === item.href}
                  badge={item.href === '/mails' ? unassignedCount : null}
                  onClick={() => { setSelectedProject(null); navigate(item.href); }}
                />
              ))
            )}

            <div className="mx-auto w-6 my-2" style={{ height: 1, background: 'oklch(0.22 0.010 238)' }} />

            {projects.slice(0, 8).map(project => (
              <button
                key={project.id}
                title={project.name}
                onClick={() => { setSelectedProject(project.id); navigate(`/projects/${project.id}`); }}
                className={clsx(
                  'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 mx-auto',
                  selectedProjectId === project.id
                    ? 'sidebar-active-item'
                    : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300',
                )}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            ))}

            <button
              title="새 프로젝트"
              onClick={() => setShowModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 hover:text-brand hover:bg-sidebar-hover transition-all duration-150 mx-auto"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ── 펼친 내비 ──────────────────────────────────────── */
          <>
            {/* 검색 트리거 + 알림 */}
            <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
              <button
                onClick={() => setShowSearch(true)}
                className="flex-1 flex items-center gap-2 px-2.5 h-7 rounded-lg text-xs transition-all group"
                style={{
                  background: 'oklch(0.16 0.010 242)',
                  border: '1px solid oklch(0.24 0.010 236)',
                  color: 'var(--text-faint)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.20)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.32 0.014 232)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.24 0.010 236)';
                }}
              >
                <Search className="w-3 h-3 flex-shrink-0" />
                <span className="flex-1 text-left">검색...</span>
                <kbd
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                  style={{
                    background: 'oklch(0.20 0.010 240)',
                    color: 'var(--text-muted)',
                    border: '1px solid oklch(0.28 0.010 234)',
                  }}
                >
                  ⌘K
                </kbd>
              </button>

              <div className="relative flex-shrink-0">
                <button
                  ref={bellRef}
                  onClick={() => setShowNotifications(v => !v)}
                  title="알림"
                  className={clsx(
                    'w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150',
                    showNotifications
                      ? 'text-brand'
                      : 'text-gray-500 hover:text-gray-300',
                  )}
                  style={{
                    background: showNotifications
                      ? 'oklch(0.76 0.16 196 / 0.12)'
                      : 'oklch(0.16 0.010 242)',
                    border: showNotifications
                      ? '1px solid oklch(0.55 0.12 196 / 0.35)'
                      : '1px solid oklch(0.24 0.010 236)',
                  }}
                >
                  <Bell className="w-3.5 h-3.5" />
                </button>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </div>
            </div>

            <div className="px-2 pt-0.5 pb-1 space-y-px">
              {/* 대시보드 */}
              <button
                onClick={() => { setSelectedProject(null); navigate('/dashboard'); }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  pathname === '/dashboard'
                    ? 'sidebar-active-item'
                    : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300'
                )}
              >
                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">대시보드</span>
              </button>

              {/* 그룹 목록 */}
              {(NAV_GROUPS as unknown as {
                id: string;
                label: string;
                icon: React.ElementType;
                items: { href: string; label: string; icon: React.ElementType }[];
              }[]).map(group => {
                const isOpen    = openGroups.has(group.id);
                const hasActive = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'));
                const toggle    = () => setOpenGroups(prev => {
                  const next = new Set(prev);
                  next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                  return next;
                });

                return (
                  <div key={group.id}>
                    <button
                      onClick={toggle}
                      className={clsx(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-[0.08em] transition-colors mt-3 mb-0.5',
                        hasActive && !isOpen
                          ? 'text-gray-400'
                          : 'text-gray-600 hover:text-gray-400'
                      )}
                    >
                      <group.icon className="w-3 h-3 flex-shrink-0" />
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronRight className={clsx(
                        'w-3 h-3 flex-shrink-0 transition-transform duration-200',
                        isOpen && 'rotate-90'
                      )} />
                    </button>

                    {isOpen && (
                      <div
                        className="mt-1 ml-3 pl-2.5 space-y-0.5"
                        style={{ borderLeft: '1px solid oklch(0.24 0.010 236)' }}
                      >
                        {group.items.map(({ href, label, icon: Icon }) => {
                          const badge = href === '/mails' && unassignedCount > 0 ? unassignedCount : null;
                          const isActive = pathname === href;
                          return (
                            <button
                              key={href}
                              onClick={() => { setSelectedProject(null); navigate(href); }}
                              className={clsx(
                                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-150',
                                isActive
                                  ? 'sidebar-active-item'
                                  : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300'
                              )}
                            >
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className={isActive ? 'font-medium' : ''}>{label}</span>
                              {badge != null && (
                                <span
                                  className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                  style={{
                                    background: 'oklch(0.84 0.16 82 / 0.15)',
                                    color: 'oklch(0.84 0.16 82)',
                                    border: '1px solid oklch(0.62 0.12 82 / 0.25)',
                                  }}
                                >
                                  {badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Projects */}
            <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
              <div className="px-3 mb-1.5 flex items-center justify-between">
                <h2
                  className="text-[10px] font-bold uppercase tracking-[0.10em]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  프로젝트
                </h2>
                <button
                  onClick={() => setShowModal(true)}
                  className="p-1 rounded-md transition-all hover:bg-white/5"
                  style={{ color: 'var(--text-faint)' }}
                  title="새 프로젝트"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5 px-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => { setSelectedProject(project.id); navigate(`/projects/${project.id}`); }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      selectedProjectId === project.id
                        ? 'sidebar-active-item'
                        : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-300'
                    )}
                  >
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
                {projects.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-600">프로젝트 없음</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* 시스템 모니터 */}
        <SystemMonitor collapsed={sidebarCollapsed} />

        {/* Bottom */}
        <div
          className={clsx('p-2 space-y-1')}
          style={{ borderTop: '1px solid oklch(0.20 0.010 240)' }}
        >
          {sidebarCollapsed ? (
            <>
              {authMeta?.isAdmin && (
                <IconBtn icon={Users} label="사용자 관리" onClick={() => setShowUserMgmt(true)} />
              )}
              <IconBtn icon={Settings} label="설정" onClick={() => setShowSettings(true)} />
              <button
                title={displayName || authMeta?.username || '프로필'}
                onClick={() => setShowProfile(true)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-sidebar-hover hover:text-gray-300 transition-all duration-150 mx-auto"
              >
                {authMeta && (
                  <UserBadge username={displayName || authMeta.username} size="sm" showName={false} />
                )}
              </button>
            </>
          ) : (
            <>
              {authMeta?.isAdmin && (
                <button
                  onClick={() => setShowUserMgmt(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-sidebar-hover hover:text-gray-300 transition-all duration-150"
                >
                  <Users className="w-3.5 h-3.5" />
                  사용자 관리
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-sidebar-hover hover:text-gray-300 transition-all duration-150"
              >
                <Settings className="w-3.5 h-3.5" />
                설정
              </button>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowProfile(true)}
                onKeyDown={e => e.key === 'Enter' && setShowProfile(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 group cursor-pointer"
                style={{ background: 'oklch(0.15 0.010 244)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0.010 241)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.15 0.010 244)'; }}
              >
                {authMeta && (
                  <UserBadge username={displayName || authMeta.username} size="sm" showName={false} />
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-gray-300 truncate">
                    {displayName || authMeta?.username}
                  </p>
                  {displayName && (
                    <p className="text-[10px] text-gray-600 truncate">@{authMeta?.username}</p>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleLogout(); }}
                  title="로그아웃"
                  className="p-1 rounded-md text-gray-600 hover:text-red-400 flex-shrink-0 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 데스크탑 접기/펼치기 탭 */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className={clsx(
            'hidden lg:flex absolute top-16 -right-3 z-50',
            'w-6 h-6 items-center justify-center rounded-full',
            'transition-all duration-150 shadow-lg',
          )}
          style={{
            background: 'oklch(0.20 0.010 240)',
            border: '1px solid oklch(0.30 0.012 234)',
            color: 'oklch(0.60 0.010 230)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'oklch(0.26 0.012 236)';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.80 0.010 225)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240)';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.60 0.010 230)';
          }}
        >
          <ChevronLeft className={clsx('w-3.5 h-3.5 transition-transform duration-200', sidebarCollapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* 전체 검색 */}
      <GlobalSearch open={showSearch} onClose={() => setShowSearch(false)} />

      {/* 알림 패널 */}
      <NotificationPanel
        anchorRef={bellRef}
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        onCountChange={setNotificationCount}
      />

      {/* 모달 */}
      {showSettings && <SettingsModal        onClose={() => setShowSettings(false)} />}
      {showUserMgmt && <UserManagementModal  onClose={() => setShowUserMgmt(false)} />}
      {showProfile  && (
        <ProfileModal
          onClose={() => {
            setShowProfile(false);
            import('@/lib/api').then(({ authApi }) => {
              authApi.me().then(u => setDisplayName(u.display_name ?? null)).catch(() => {});
            });
          }}
        />
      )}
      {showModal && (
        <ProjectModal
          project={null}
          onClose={() => setShowModal(false)}
          onSave={(saved: Project) => {
            setProjects([...projects, saved]);
            setShowModal(false);
            navigate(`/projects/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
