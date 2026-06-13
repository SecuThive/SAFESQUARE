'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { mailsApi, gmailApi, getAuthMeta, getAuthHeaders, type ProjectMail, type MailAttachment, type GmailStatus } from '@/lib/api';
import MailBody from '@/components/mails/MailBody';
import Sidebar from '@/components/layout/Sidebar';
import {
  Mail, MailOpen, RefreshCw, Inbox,
  X, User, AtSign, Clock, FileText, ChevronRight, ChevronLeft,
  Trash2, Tag, CheckCheck, FolderOpen, Paperclip, Download,
  Search, Filter, SlidersHorizontal, Send, UserPlus,
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';
import TableSkeleton from '@/components/ui/TableSkeleton';
import MailDraftPanel from '@/components/mails/MailDraftPanel';

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  inquiry:   { label: '문의',  color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  complaint: { label: '민원',  color: 'text-red-400',    bg: 'bg-red-500/10'    },
  approval:  { label: '승인',  color: 'text-green-400',  bg: 'bg-green-500/10'  },
  report:    { label: '보고',  color: 'text-purple-400', bg: 'bg-purple-500/10' },
  other:     { label: '기타',  color: 'text-gray-400',   bg: 'bg-gray-700/40'   },
};

function formatDate(iso: string) {
  return format(parseISO(iso), 'yyyy.MM.dd HH:mm', { locale: ko });
}

type TabType = 'all' | 'unassigned' | 'assigned' | 'outbox';
type DateFilter = 'all' | 'today' | 'week' | 'month';

const CATEGORIES = [
  { id: 'inquiry',   label: '문의',  color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  { id: 'complaint', label: '민원',  color: 'text-red-400',    bg: 'bg-red-500/10'    },
  { id: 'approval',  label: '승인',  color: 'text-green-400',  bg: 'bg-green-500/10'  },
  { id: 'report',    label: '보고',  color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'other',     label: '기타',  color: 'text-gray-400',   bg: 'bg-gray-700/40'   },
];

export default function MailsPage() {
  const router = useRouter();
  const { projects } = useAppStore();

  useEffect(() => {
    if (!getAuthMeta()) { router.replace('/login'); }
  }, [router]);

  const [gmailStatus,     setGmailStatus]     = useState<GmailStatus | null>(null);
  const [mails,           setMails]           = useState<ProjectMail[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [syncing,         setSyncing]         = useState(false);
  const [selected,        setSelected]        = useState<ProjectMail | null>(null);
  const [tab,             setTab]             = useState<TabType>('all');
  const [connectingGmail, setConnectingGmail] = useState(false);

  // 검색 & 필터
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('all');
  const [filterRead,  setFilterRead]  = useState<'all' | 'unread' | 'read'>('all');
  const [filterDate,  setFilterDate]  = useState<DateFilter>('all');
  const [showFilter,  setShowFilter]  = useState(false);

  const loadStatus = useCallback(async () => {
    try { setGmailStatus(await gmailApi.status()); } catch { /* ignore */ }
  }, []);

  const loadMails = useCallback(async () => {
    setLoading(true);
    try {
      const opts: Parameters<typeof mailsApi.list>[0] = {};
      if (tab === 'unassigned') opts.unassigned = true;
      const data = await mailsApi.list(opts);
      setMails(tab === 'assigned' ? data.filter(m => m.project_id !== null) : data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { loadMails(); }, [loadMails]);

  /* OAuth 콜백 파라미터 처리 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      loadStatus();
      window.history.replaceState({}, '', '/mails');
    }
    if (params.get('error') === '1') {
      alert('Gmail 연동에 실패했습니다. 다시 시도해 주세요.');
      window.history.replaceState({}, '', '/mails');
    }
  }, [loadStatus]);

  const connectGmail = async () => {
    setConnectingGmail(true);
    try {
      const { url } = await gmailApi.getAuthUrl();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setConnectingGmail(false);
    }
  };

  const syncGmail = async () => {
    if (!gmailStatus?.connected || syncing) return;
    setSyncing(true);
    try {
      const res = await gmailApi.sync(100);
      await loadStatus();
      await loadMails();
      alert(`동기화 완료: ${res.synced}개 새 메일, 총 ${res.total}개 확인`);
    } catch (e: any) {
      alert('동기화 실패: ' + (e?.message ?? '알 수 없는 오류'));
    } finally {
      setSyncing(false);
    }
  };

  const disconnectGmail = async () => {
    if (!await confirm('Gmail 연동을 해제하시겠습니까?', { title: 'Gmail 연결 해제', danger: true, confirmLabel: '연결 해제' })) return;
    await gmailApi.disconnect();
    setGmailStatus({ connected: false, email: null, last_sync: null });
  };

  const assignProject = async (mailId: number, projectId: number | null) => {
    try {
      const updated = await mailsApi.update(mailId, { project_id: projectId });
      setMails(prev => prev.map(m => m.id === updated.id ? updated : m));
      if (selected?.id === mailId) setSelected(updated);
    } catch (e) { console.error(e); }
  };

  const markRead = async (mail: ProjectMail, read: boolean) => {
    const updated = await mailsApi.update(mail.id, { is_read: read });
    setMails(prev => prev.map(m => m.id === updated.id ? updated : m));
    if (selected?.id === mail.id) setSelected(updated);
  };

  const remove = async (id: number) => {
    if (!await confirm('이 메일을 삭제하시겠습니까?')) return;
    await mailsApi.delete(id);
    setMails(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const select = async (mail: ProjectMail) => {
    setSelected(mail);
    if (!mail.is_read) await markRead(mail, true);
  };

  const unreadCount     = mails.filter(m => !m.is_read).length;
  const unassignedCount = mails.filter(m => m.project_id === null).length;

  const filteredMails = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return mails.filter(m => {
      if (q) {
        const hit = m.subject.toLowerCase().includes(q)
          || m.from_email.toLowerCase().includes(q)
          || (m.from_name ?? '').toLowerCase().includes(q)
          || m.body.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filterCat !== 'all' && m.category !== filterCat) return false;
      if (filterRead === 'unread' && m.is_read)  return false;
      if (filterRead === 'read'   && !m.is_read) return false;
      if (filterDate !== 'all') {
        const d = new Date(m.received_at);
        if (filterDate === 'today') {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (filterDate === 'week') {
          const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
          if (d < weekAgo) return false;
        } else if (filterDate === 'month') {
          const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
          if (d < monthAgo) return false;
        }
      }
      return true;
    });
  }, [mails, search, filterCat, filterRead, filterDate]);

  const hasFilter = search || filterCat !== 'all' || filterRead !== 'all' || filterDate !== 'all';

  const clearFilters = () => {
    setSearch(''); setFilterCat('all'); setFilterRead('all'); setFilterDate('all');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-gray-100">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 페이지 헤더 */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-surface-raised flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand" />
              메일함
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Gmail에서 수신된 메일을 프로젝트별로 분류하세요</p>
          </div>
          {gmailStatus?.connected && (
            <button
              onClick={syncGmail}
              disabled={syncing}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0',
                syncing ? 'bg-surface text-gray-500 cursor-wait' : 'bg-brand/10 text-brand hover:bg-brand/20',
              )}
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', syncing && 'animate-spin')} />
              {syncing ? '동기화 중...' : '동기화'}
            </button>
          )}
        </div>

        {/* 메인 콘텐츠: 목록 + 상세 */}
        <div className="flex flex-1 overflow-hidden">

          {/* 보낼 메일 탭이면 전체를 MailDraftPanel로 대체 */}
          {tab === 'outbox' ? (
            <>
              {/* 좌측: 탭 바 */}
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* 탭 헤더 (outbox 포함 전체) */}
                <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-1 bg-surface-raised flex-shrink-0">
                  {([
                    { id: 'all',        label: '전체',   count: mails.length,    icon: null },
                    { id: 'unassigned', label: '미배정', count: unassignedCount,  icon: null },
                    { id: 'assigned',   label: '배정됨', count: null,             icon: null },
                    { id: 'outbox',     label: '보낼 메일', count: null,          icon: Send },
                  ] as { id: TabType; label: string; count: number | null; icon: any }[]).map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); if (t.id !== 'outbox') setSelected(null); }}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        tab === t.id
                          ? 'bg-brand/10 text-brand'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                      )}
                    >
                      {t.icon && <t.icon className="w-3 h-3" />}
                      {t.label}
                    </button>
                  ))}
                </div>
                <MailDraftPanel projects={projects} />
              </div>
            </>
          ) : (

          /* 수신 메일 탭 (기존 구조) */
          <>

          {/* 좌측 목록 패널 - 모바일: 메일 선택 시 숨김 */}
          <div className={clsx(
            'flex flex-col border-r border-gray-800 bg-surface-raised',
            selected
              ? 'hidden md:flex md:w-80 md:flex-shrink-0'
              : 'flex flex-1 max-w-full md:max-w-lg flex-shrink-0',
          )}>
            {/* 탭 */}
            <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-1">
              {([
                { id: 'all',        label: '전체',      count: mails.length    },
                { id: 'unassigned', label: '미배정',    count: unassignedCount },
                { id: 'assigned',   label: '배정됨',    count: null            },
                { id: 'outbox',     label: '보낼 메일', count: null            },
              ] as { id: TabType; label: string; count: number | null }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    tab === t.id
                      ? 'bg-brand/10 text-brand'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                    t.id === 'outbox' && 'border-l border-gray-700/60 ml-1 pl-3',
                  )}
                >
                  {t.id === 'outbox' && <Send className="w-3 h-3" />}
                  {t.label}
                  {t.count !== null && t.count > 0 && (
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      t.id === 'unassigned' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400',
                    )}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}

              {unreadCount > 0 && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-brand text-white font-bold">
                  {unreadCount} 미열람
                </span>
              )}
            </div>

            {/* 검색 + 필터 */}
            <div className="px-3 py-2 border-b border-gray-800 space-y-2">
              {/* 검색창 */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="제목, 발신자, 본문 검색..."
                    className="w-full bg-surface-overlay border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilter(v => !v)}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors flex-shrink-0',
                    showFilter || (filterCat !== 'all' || filterRead !== 'all' || filterDate !== 'all')
                      ? 'bg-brand/10 text-brand'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                  )}
                  title="필터"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 필터 패널 */}
              {showFilter && (
                <div className="space-y-2 pt-1">
                  {/* 카테고리 */}
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterCat('all')}
                      className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        filterCat === 'all' ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-300 bg-surface-overlay')}
                    >전체</button>
                    {CATEGORIES.map(c => (
                      <button key={c.id} onClick={() => setFilterCat(c.id)}
                        className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                          filterCat === c.id ? `${c.bg} ${c.color}` : 'text-gray-500 hover:text-gray-300 bg-surface-overlay')}
                      >{c.label}</button>
                    ))}
                  </div>
                  {/* 읽음 / 날짜 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-1">
                      {([['all','전체'],['unread','미열람'],['read','열람']] as const).map(([v,l]) => (
                        <button key={v} onClick={() => setFilterRead(v)}
                          className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            filterRead === v ? 'bg-surface text-gray-200 ring-1 ring-gray-600' : 'text-gray-500 hover:text-gray-300 bg-surface-overlay')}
                        >{l}</button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {([['all','기간 전체'],['today','오늘'],['week','1주'],['month','1개월']] as const).map(([v,l]) => (
                        <button key={v} onClick={() => setFilterDate(v)}
                          className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            filterDate === v ? 'bg-surface text-gray-200 ring-1 ring-gray-600' : 'text-gray-500 hover:text-gray-300 bg-surface-overlay')}
                        >{l}</button>
                      ))}
                    </div>
                  </div>
                  {hasFilter && (
                    <button onClick={clearFilters} className="text-[10px] text-brand hover:underline">
                      필터 초기화
                    </button>
                  )}
                </div>
              )}

              {/* 결과 수 */}
              {(hasFilter || search) && (
                <p className="text-[10px] text-gray-600">
                  {filteredMails.length}개 결과 / 전체 {mails.length}개
                </p>
              )}
            </div>

            {/* 메일 목록 */}
            <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
              {loading ? (
                <TableSkeleton rows={6} rowHeight="h-16" className="space-y-px p-2" />
              ) : filteredMails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                  <Inbox className="w-9 h-9 text-gray-700 mb-2" />
                  <p className="text-sm text-gray-500">
                    {hasFilter || search ? '검색 결과가 없습니다' : tab === 'unassigned' ? '미배정 메일이 없습니다' : '메일이 없습니다'}
                  </p>
                  {(hasFilter || search) && (
                    <button onClick={clearFilters} className="mt-2 text-xs text-brand hover:underline">필터 초기화</button>
                  )}
                  {!gmailStatus?.connected && !hasFilter && !search && (
                    <button onClick={connectGmail} className="mt-3 text-xs text-brand hover:underline">
                      Gmail 연결 →
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {filteredMails.map(mail => {
                    const cat  = CATEGORY_META[mail.category] ?? CATEGORY_META.other;
                    const proj = projects.find(p => p.id === mail.project_id);
                    const active = selected?.id === mail.id;
                    return (
                      <div
                        key={mail.id}
                        onClick={() => select(mail)}
                        className={clsx(
                          'px-4 py-3 cursor-pointer transition-colors',
                          active
                            ? 'bg-brand/5 border-l-2 border-brand'
                            : 'hover:bg-surface-overlay border-l-2 border-transparent',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-1 flex-shrink-0">
                            {mail.is_read
                              ? <MailOpen className="w-3.5 h-3.5 text-gray-600" />
                              : <div className="w-2 h-2 rounded-full bg-brand mt-0.5" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', cat.bg, cat.color)}>
                                {cat.label}
                              </span>
                              {mail.project_id === null && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">미배정</span>
                              )}
                              <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">
                                {formatDate(mail.received_at)}
                              </span>
                            </div>
                            <p className={clsx(
                              'text-sm truncate',
                              mail.is_read ? 'text-gray-400 font-normal' : 'text-gray-100 font-semibold',
                            )}>
                              {mail.subject}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-xs text-gray-500 truncate flex-1">
                                {mail.from_name ? `${mail.from_name} <${mail.from_email}>` : mail.from_email}
                              </p>
                              {proj && (
                                <span className="text-[10px] text-gray-600 flex-shrink-0 flex items-center gap-0.5">
                                  <FolderOpen className="w-3 h-3" />
                                  {proj.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 우측 상세 패널 */}
          {selected ? (
            <MailDetail
              mail={selected}
              projects={projects}
              onClose={() => setSelected(null)}
              onDelete={() => remove(selected.id)}
              onToggleRead={() => markRead(selected, !selected.is_read)}
              onAssign={projectId => assignProject(selected.id, projectId)}
              onNoteUpdate={async (note) => {
                const updated = await mailsApi.update(selected.id, { note });
                setSelected(updated);
                setMails(prev => prev.map(m => m.id === updated.id ? updated : m));
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-surface">
              <div className="text-center">
                <Mail className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">메일을 선택하면 상세 내용이 표시됩니다</p>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 상세 뷰 ── */
function MailDetail({ mail, projects, onClose, onDelete, onToggleRead, onAssign, onNoteUpdate }: {
  mail: ProjectMail;
  projects: { id: number; name: string }[];
  onClose: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
  onAssign: (projectId: number | null) => void;
  onNoteUpdate: (note: string) => Promise<void>;
}) {
  const [note,            setNote]            = useState(mail.note ?? '');
  const [savingNote,      setSavingNote]      = useState(false);
  const [showAssign,      setShowAssign]      = useState(false);
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [contactForm,     setContactForm]     = useState({ name: '', role: '', phone: '', department: '', notes: '' });
  const [savingContact,   setSavingContact]   = useState(false);
  const [contactSaved,    setContactSaved]    = useState(false);
  const cat = CATEGORY_META[mail.category] ?? CATEGORY_META.other;
  const assignedProject = projects.find(p => p.id === mail.project_id);

  const openSaveContact = () => {
    setContactForm({
      name:       mail.from_name ?? '',
      role:       '',
      phone:      '',
      department: '',
      notes:      '',
    });
    setShowSaveContact(true);
  };

  const handleSaveContact = async () => {
    setSavingContact(true);
    try {
      const res = await fetch(`/api/mails/${mail.id}/save-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(contactForm),
      });
      if (res.status === 409) {
        const err = await res.json();
        alert(`이미 등록된 담당자입니다: ${err.detail?.contact_name ?? ''} (${mail.from_email})`);
        setShowSaveContact(false);
        return;
      }
      if (!res.ok) throw new Error('저장 실패');
      setContactSaved(true);
      setShowSaveContact(false);
    } catch {
      alert('담당자 저장에 실패했습니다.');
    } finally {
      setSavingContact(false);
    }
  };

  useEffect(() => {
    setNote(mail.note ?? '');
    setContactSaved(false);
  }, [mail.id]);

  const handleNoteSave = async () => {
    setSavingNote(true);
    try { await onNoteUpdate(note); } finally { setSavingNote(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface relative">
      {/* 툴바 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-surface-raised flex-shrink-0">
        <button onClick={onClose} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs md:hidden">목록</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={onToggleRead}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-surface-overlay transition-colors"
        >
          {mail.is_read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
          {mail.is_read ? '미열람' : '열람'}
        </button>
        <button
          onClick={openSaveContact}
          disabled={contactSaved}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors',
            contactSaved
              ? 'text-green-400 bg-green-500/10 cursor-default'
              : 'text-gray-400 hover:text-brand hover:bg-brand/10',
          )}
          title="발신자를 담당자로 저장"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {contactSaved ? '저장됨' : '담당자 저장'}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>

      {/* 담당자 저장 모달 */}
      {showSaveContact && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowSaveContact(false)}>
          <div className="bg-surface-raised border border-gray-700 rounded-2xl shadow-2xl w-96 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand" />
                담당자로 저장
              </h3>
              <button onClick={() => setShowSaveContact(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 이메일 (수정 불가) */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">이메일</label>
              <div className="px-3 py-2 rounded-lg bg-surface border border-gray-700 text-xs text-gray-400">{mail.from_email}</div>
            </div>

            {/* 이름 */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">이름 <span className="text-brand">*</span></label>
              <input
                type="text"
                value={contactForm.name}
                onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand transition-colors"
                placeholder="담당자 이름"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">직책</label>
                <input
                  type="text"
                  value={contactForm.role}
                  onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand transition-colors"
                  placeholder="직책"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">부서</label>
                <input
                  type="text"
                  value={contactForm.department}
                  onChange={e => setContactForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand transition-colors"
                  placeholder="부서"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">전화번호</label>
              <input
                type="text"
                value={contactForm.phone}
                onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand transition-colors"
                placeholder="전화번호"
              />
            </div>

            {assignedProject && (
              <p className="text-[11px] text-gray-500 mb-4">
                프로젝트: <span className="text-gray-300">{assignedProject.name}</span>에 자동 배정됩니다
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveContact(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-surface-overlay transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveContact}
                disabled={savingContact || !contactForm.name.trim()}
                className="px-4 py-1.5 rounded-lg text-xs bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
              >
                {savingContact ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메일 헤더 */}
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', cat.bg, cat.color)}>
            {cat.label}
          </span>
          {!mail.is_read && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">미열람</span>
          )}
        </div>
        <h2 className="text-base font-semibold text-gray-100 leading-snug mb-3">{mail.subject}</h2>
        <div className="space-y-1 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{mail.from_name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <AtSign className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{mail.from_email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatDate(mail.received_at)}</span>
          </div>
        </div>

        {/* 프로젝트 배정 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setShowAssign(v => !v)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors w-full',
              assignedProject
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20',
            )}
          >
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left truncate">
              {assignedProject ? assignedProject.name : '프로젝트 미배정 — 클릭하여 배정'}
            </span>
            <Tag className="w-3.5 h-3.5 flex-shrink-0" />
          </button>

          {showAssign && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-raised border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden max-h-52 overflow-y-auto">
              <button
                onClick={() => { onAssign(null); setShowAssign(false); }}
                className="w-full px-4 py-2 text-xs text-left hover:bg-surface-overlay text-gray-400 transition-colors"
              >
                배정 해제
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onAssign(p.id); setShowAssign(false); }}
                  className={clsx(
                    'w-full px-4 py-2 text-xs text-left hover:bg-surface-overlay transition-colors flex items-center gap-2',
                    mail.project_id === p.id ? 'text-brand font-medium' : 'text-gray-300',
                  )}
                >
                  <FolderOpen className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{p.name}</span>
                  {mail.project_id === p.id && <CheckCheck className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 본문 + 메모 */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5 pb-16 md:pb-5">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">본문</p>
          <MailBody body={mail.body} subject={mail.subject} />
        </div>

        {/* 첨부파일 */}
        {mail.attachments?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                첨부파일 ({mail.attachments.length})
              </p>
            </div>
            <div className="space-y-1.5">
              {mail.attachments.map((att: MailAttachment) => (
                <a
                  key={att.id}
                  href={`/api/gmail/attachments/${att.id}`}
                  download={att.original_name}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-overlay border border-gray-800 hover:border-gray-600 transition-colors group"
                >
                  <Paperclip className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-300 truncate">{att.original_name}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    {att.file_size < 1024
                      ? `${att.file_size}B`
                      : att.file_size < 1024 * 1024
                      ? `${(att.file_size / 1024).toFixed(1)}KB`
                      : `${(att.file_size / 1024 / 1024).toFixed(1)}MB`}
                  </span>
                  <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-brand transition-colors flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">내부 메모</p>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="팀 내부용 메모를 입력하세요..."
            className="textarea w-full text-sm"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleNoteSave}
              disabled={savingNote || note === (mail.note ?? '')}
              className="px-3 py-1 text-xs rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
            >
              {savingNote ? '저장 중...' : '메모 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
