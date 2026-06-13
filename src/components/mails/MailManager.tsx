'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { mailsApi, type ProjectMail, type MailAttachment } from '@/lib/api';
import MailBody from './MailBody';
import {
  Mail, MailOpen, Plus, Trash2, Edit2, X, Clock,
  User, AtSign, FileText, Paperclip, Download, Search, SlidersHorizontal,
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';
import TableSkeleton from '@/components/ui/TableSkeleton';

/* ── 카테고리 메타 (oklch) ── */
const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  inquiry:   { label: '문의',  color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.12)', border: 'oklch(0.55 0.14 218 / 0.30)', glow: 'oklch(0.68 0.18 218 / 0.20)' },
  complaint: { label: '민원',  color: 'oklch(0.70 0.20 22)',  bg: 'oklch(0.70 0.20 22 / 0.12)',  border: 'oklch(0.55 0.14 22 / 0.30)',  glow: 'oklch(0.70 0.20 22 / 0.20)'  },
  approval:  { label: '승인',  color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.30)', glow: 'oklch(0.76 0.16 152 / 0.20)' },
  report:    { label: '보고',  color: 'oklch(0.74 0.16 300)', bg: 'oklch(0.74 0.16 300 / 0.12)', border: 'oklch(0.58 0.12 300 / 0.30)', glow: 'oklch(0.74 0.16 300 / 0.20)' },
  other:     { label: '기타',  color: 'oklch(0.60 0.01 245)', bg: 'oklch(0.20 0.010 240 / 0.60)', border: 'oklch(0.30 0.010 240 / 0.40)', glow: 'oklch(0.60 0.01 245 / 0.10)' },
};

const CATEGORIES = Object.entries(CATEGORY_META).map(([id, m]) => ({ id, ...m }));

/* 발신자 이니셜 아바타 색상 */
const AVATAR_COLORS = [
  { color: 'oklch(0.72 0.18 218)', bg: 'oklch(0.68 0.18 218 / 0.18)', border: 'oklch(0.55 0.14 218 / 0.35)' },
  { color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.76 0.16 152 / 0.18)', border: 'oklch(0.58 0.12 152 / 0.35)' },
  { color: 'oklch(0.74 0.16 300)', bg: 'oklch(0.74 0.16 300 / 0.18)', border: 'oklch(0.58 0.12 300 / 0.35)' },
  { color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.84 0.16 82 / 0.18)',  border: 'oklch(0.62 0.12 82 / 0.35)'  },
  { color: 'oklch(0.76 0.16 196)', bg: 'oklch(0.76 0.16 196 / 0.18)', border: 'oklch(0.58 0.12 196 / 0.35)' },
];

function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface Props { projectId: number }

function formatDate(iso: string) {
  return format(parseISO(iso), 'yyyy.MM.dd HH:mm', { locale: ko });
}

/* ═══════════════════════════════════════════════════════════ */
export default function MailManager({ projectId }: Props) {
  const [mails,       setMails]       = useState<ProjectMail[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<ProjectMail | null>(null);
  const [filterCat,   setFilterCat]   = useState('all');
  const [filterRead,  setFilterRead]  = useState<'all' | 'unread' | 'read'>('all');
  const [search,      setSearch]      = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [editMail,    setEditMail]    = useState<ProjectMail | null>(null);
  const [showFilter,  setShowFilter]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mailsApi.list({ project_id: projectId });
      setMails(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  const filteredMails = useMemo(() => {
    const q = search.trim().toLowerCase();
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
      return true;
    });
  }, [mails, search, filterCat, filterRead]);

  const hasFilter = search || filterCat !== 'all' || filterRead !== 'all';

  useEffect(() => { load(); }, [load]);

  const markRead = async (mail: ProjectMail, read: boolean) => {
    await mailsApi.update(mail.id, { is_read: read });
    setMails(prev => prev.map(m => m.id === mail.id ? { ...m, is_read: read } : m));
    if (selected?.id === mail.id) setSelected({ ...mail, is_read: read });
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

  const unreadCount = mails.filter(m => !m.is_read).length;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── 좌측 목록 패널 ── */}
      <div
        className={clsx(
          'flex flex-col flex-shrink-0',
          selected ? 'w-80' : 'flex-1 max-w-md',
        )}
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
              <Mail className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>수신 메일함</h2>
            {unreadCount > 0 && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'oklch(0.76 0.16 196)',
                  color: 'oklch(0.10 0.015 245)',
                  boxShadow: '0 0 8px oklch(0.76 0.16 196 / 0.40)',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowFilter(v => !v)}
              className="p-1.5 rounded-md transition-all"
              style={{
                color: showFilter || hasFilter ? 'var(--accent)' : 'var(--text-faint)',
                background: showFilter || hasFilter ? 'oklch(0.76 0.16 196 / 0.10)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!showFilter && !hasFilter) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                  (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240)';
                }
              }}
              onMouseLeave={e => {
                if (!showFilter && !hasFilter) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setEditMail(null); setShowModal(true); }}
              className="p-1.5 rounded-md transition-all"
              style={{ color: 'var(--text-faint)' }}
              title="메일 추가"
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div
          className="px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
        >
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: 'var(--text-faint)' }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="제목, 발신자, 본문 검색..."
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs transition-all outline-none"
              style={{
                background: 'oklch(0.14 0.010 245)',
                border: '1px solid oklch(0.22 0.010 240)',
                color: 'var(--text)',
              }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.55 0.12 196 / 0.60)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px oklch(0.76 0.16 196 / 0.08)'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.22 0.010 240)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 필터 패널 */}
          {showFilter && (
            <div className="mt-2.5 space-y-2">
              {/* 카테고리 탭 */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => setFilterCat('all')}
                  className="relative px-2.5 py-1 text-[10px] font-semibold transition-all rounded-t-md"
                  style={{
                    color: filterCat === 'all' ? 'var(--accent)' : 'var(--text-faint)',
                    borderBottom: filterCat === 'all'
                      ? '2px solid oklch(0.76 0.16 196)'
                      : '2px solid transparent',
                  }}
                >
                  전체
                </button>
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCat(c.id)}
                    className="relative px-2.5 py-1 text-[10px] font-semibold transition-all rounded-t-md"
                    style={{
                      color: filterCat === c.id ? c.color : 'var(--text-faint)',
                      borderBottom: filterCat === c.id
                        ? `2px solid ${c.color}`
                        : '2px solid transparent',
                    }}
                  >
                    {c.label}
                    {filterCat === c.id && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ boxShadow: `0 0 6px ${c.glow}` }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* 열람 상태 */}
              <div className="flex gap-1">
                {([['all','전체'],['unread','미열람'],['read','열람']] as const).map(([v,l]) => (
                  <button
                    key={v}
                    onClick={() => setFilterRead(v)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                    style={{
                      background: filterRead === v ? 'oklch(0.22 0.010 240)' : 'transparent',
                      color: filterRead === v ? 'var(--text-dim)' : 'var(--text-faint)',
                      border: `1px solid ${filterRead === v ? 'oklch(0.28 0.010 238)' : 'transparent'}`,
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {hasFilter && (
                <button
                  onClick={() => { setSearch(''); setFilterCat('all'); setFilterRead('all'); }}
                  className="text-[10px] transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  필터 초기화
                </button>
              )}
            </div>
          )}

          {hasFilter && (
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
              {filteredMails.length}개 결과 / 전체 {mails.length}개
            </p>
          )}
        </div>

        {/* 메일 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <TableSkeleton rows={5} rowHeight="h-16" className="space-y-px p-2" />
          ) : filteredMails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'oklch(0.76 0.16 196 / 0.10)',
                  border: '1px solid oklch(0.55 0.12 196 / 0.25)',
                  boxShadow: '0 0 16px oklch(0.76 0.16 196 / 0.10)',
                }}
              >
                <Mail className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>
                  {hasFilter ? '검색 결과가 없습니다' : '메일이 없습니다'}
                </p>
                {hasFilter ? (
                  <button
                    onClick={() => { setSearch(''); setFilterCat('all'); setFilterRead('all'); }}
                    className="text-xs mt-1 transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    필터 초기화
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditMail(null); setShowModal(true); }}
                    className="text-xs mt-1 transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    첫 메일 추가 →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {filteredMails.map(mail => {
                const cat    = CATEGORY_META[mail.category] ?? CATEGORY_META.other;
                const active = selected?.id === mail.id;
                const sender = mail.from_name ?? mail.from_email;
                const initials = sender.slice(0, 2).toUpperCase();
                const av = avatarColor(mail.from_email);

                return (
                  <button
                    key={mail.id}
                    onClick={() => select(mail)}
                    className="w-full px-4 py-3 text-left transition-all duration-150 relative"
                    style={{
                      borderBottom: '1px solid oklch(0.18 0.010 242 / 0.70)',
                      background: active
                        ? `linear-gradient(90deg, oklch(0.76 0.16 196 / 0.07) 0%, transparent 100%)`
                        : 'transparent',
                      borderLeft: active ? '2px solid oklch(0.76 0.16 196)' : '2px solid transparent',
                      transform: 'translateX(0)',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'oklch(0.18 0.010 241 / 0.60)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    {active && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, oklch(0.76 0.16 196 / 0.05) 0%, transparent 60%)',
                        }}
                      />
                    )}
                    <div className="flex items-start gap-3">
                      {/* 아바타 */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                        style={{
                          background: av.bg,
                          border: `1px solid ${av.border}`,
                          color: av.color,
                        }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* 카테고리 + 날짜 */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{
                              background: cat.bg,
                              color: cat.color,
                              border: `1px solid ${cat.border}`,
                            }}
                          >
                            {cat.label}
                          </span>
                          {!mail.is_read && (
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background: 'oklch(0.76 0.16 196)',
                                boxShadow: '0 0 4px oklch(0.76 0.16 196 / 0.60)',
                              }}
                            />
                          )}
                          <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
                            {formatDate(mail.received_at)}
                          </span>
                        </div>

                        {/* 제목 */}
                        <p
                          className="text-xs truncate"
                          style={{
                            color: mail.is_read ? 'var(--text-muted)' : 'var(--text)',
                            fontWeight: mail.is_read ? 400 : 600,
                          }}
                        >
                          {mail.subject}
                        </p>

                        {/* 발신자 */}
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>
                          {mail.from_name ? `${mail.from_name} <${mail.from_email}>` : mail.from_email}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 우측 상세 패널 ── */}
      {selected ? (
        <MailDetail
          mail={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditMail(selected); setShowModal(true); }}
          onDelete={() => remove(selected.id)}
          onToggleRead={() => markRead(selected, !selected.is_read)}
          onNoteUpdate={async (note) => {
            const updated = await mailsApi.update(selected.id, { note });
            setSelected(updated);
            setMails(prev => prev.map(m => m.id === updated.id ? updated : m));
          }}
        />
      ) : (
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: 'oklch(0.14 0.010 245)' }}
        >
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'oklch(0.76 0.16 196 / 0.08)',
                border: '1px solid oklch(0.55 0.12 196 / 0.20)',
                boxShadow: '0 0 24px oklch(0.76 0.16 196 / 0.08)',
              }}
            >
              <Mail className="w-7 h-7" style={{ color: 'oklch(0.76 0.16 196 / 0.50)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>메일을 선택하세요</p>
          </div>
        </div>
      )}

      {/* ── 작성/편집 모달 ── */}
      {showModal && (
        <MailModal
          mail={editMail}
          onClose={() => { setShowModal(false); setEditMail(null); }}
          onSuccess={async () => {
            setShowModal(false);
            setEditMail(null);
            await load();
          }}
          projectId={projectId}
        />
      )}
    </div>
  );
}

/* ── 상세 뷰 ── */
function MailDetail({ mail, onClose, onEdit, onDelete, onToggleRead, onNoteUpdate }: {
  mail: ProjectMail;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
  onNoteUpdate: (note: string) => Promise<void>;
}) {
  const [note,       setNote]       = useState(mail.note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const cat = CATEGORY_META[mail.category] ?? CATEGORY_META.other;

  useEffect(() => { setNote(mail.note ?? ''); }, [mail.id, mail.note]);

  const handleNoteSave = async () => {
    setSavingNote(true);
    try { await onNoteUpdate(note); } finally { setSavingNote(false); }
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'oklch(0.14 0.010 245)' }}
    >
      {/* 상단 툴바 */}
      <div
        className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid oklch(0.20 0.010 240)',
          background: 'oklch(0.16 0.010 244)',
        }}
      >
        <button
          onClick={onClose}
          className="p-1 rounded-md transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={onToggleRead}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.20 0.010 240)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {mail.is_read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
          {mail.is_read ? '미열람' : '열람'}
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.76 0.16 196 / 0.10)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Edit2 className="w-3.5 h-3.5" /> 편집
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.70 0.20 22)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.70 0.20 22 / 0.10)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>

      {/* 메일 헤더 */}
      <div
        className="px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{
              background: cat.bg,
              color: cat.color,
              border: `1px solid ${cat.border}`,
              boxShadow: `0 0 8px ${cat.glow}`,
            }}
          >
            {cat.label}
          </span>
          {!mail.is_read && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{
                background: 'oklch(0.76 0.16 196 / 0.12)',
                color: 'var(--accent)',
                border: '1px solid oklch(0.55 0.12 196 / 0.30)',
              }}
            >
              미열람
            </span>
          )}
        </div>
        <h2 className="text-base font-semibold leading-snug mb-3" style={{ color: 'var(--text)' }}>
          {mail.subject}
        </h2>
        <div className="space-y-1.5">
          {[
            { Icon: User,  value: mail.from_name ?? '—' },
            { Icon: AtSign, value: mail.from_email },
            { Icon: Clock,  value: formatDate(mail.received_at) },
          ].map(({ Icon, value }) => (
            <div key={value} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-faint)' }}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 본문 + 메모 */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* 본문 */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.06em] mb-2"
            style={{ color: 'var(--text-faint)' }}
          >
            본문
          </p>
          <MailBody body={mail.body} subject={mail.subject} />
        </div>

        {/* 첨부파일 */}
        {mail.attachments?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
              <p
                className="text-[10px] font-bold uppercase tracking-[0.06em]"
                style={{ color: 'var(--text-faint)' }}
              >
                첨부파일 ({mail.attachments.length})
              </p>
            </div>
            <div className="space-y-1.5">
              {mail.attachments.map((att: MailAttachment) => (
                <a
                  key={att.id}
                  href={`/api/gmail/attachments/${att.id}`}
                  download={att.original_name}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all group"
                  style={{
                    background: 'oklch(0.17 0.010 243)',
                    border: '1px solid oklch(0.22 0.010 240)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.28 0.010 238)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.22 0.010 240)'; }}
                >
                  <Paperclip className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-dim)' }}>{att.original_name}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
                    {att.file_size < 1024
                      ? `${att.file_size}B`
                      : att.file_size < 1024 * 1024
                      ? `${(att.file_size / 1024).toFixed(1)}KB`
                      : `${(att.file_size / 1024 / 1024).toFixed(1)}MB`}
                  </span>
                  <Download
                    className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 내부 메모 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-faint)' }}>
              내부 메모
            </p>
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
              className="btn btn-primary"
              style={{ height: 32, paddingLeft: 14, paddingRight: 14, fontSize: 12 }}
            >
              {savingNote ? '저장 중...' : '메모 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 작성/편집 모달 ── */
function MailModal({ mail, projectId, onClose, onSuccess }: {
  mail: ProjectMail | null;
  projectId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!mail;
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    from_email:  mail?.from_email  ?? '',
    from_name:   mail?.from_name   ?? '',
    subject:     mail?.subject     ?? '',
    body:        mail?.body        ?? '',
    received_at: mail?.received_at ? mail.received_at.slice(0, 16) : localNow,
    category:    mail?.category    ?? 'other',
    note:        mail?.note        ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.from_email.trim() || !form.subject.trim()) return;
    setSaving(true);
    try {
      const payload = {
        from_email:  form.from_email.trim(),
        from_name:   form.from_name.trim() || undefined,
        subject:     form.subject.trim(),
        body:        form.body,
        received_at: new Date(form.received_at).toISOString(),
        category:    form.category,
        note:        form.note || undefined,
      };
      if (isEdit) {
        await mailsApi.update(mail!.id, payload);
      } else {
        await mailsApi.create(projectId, payload);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'oklch(0.06 0.006 245 / 0.80)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: 'linear-gradient(180deg, oklch(0.20 0.010 240) 0%, oklch(0.18 0.010 242) 100%)',
          border: '1px solid oklch(0.28 0.010 238)',
          borderRadius: 16,
          boxShadow: [
            '0 32px 80px rgba(0,0,0,0.65)',
            '0 0 0 1px rgba(255,255,255,0.05)',
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          ].join(', '),
          animation: 'modalIn 0.20s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 accent 라인 */}
        <div
          className="h-px w-full flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, oklch(0.76 0.16 196) 50%, transparent 100%)',
            opacity: 0.6,
          }}
        />

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(0.22 0.010 240)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'oklch(0.76 0.16 196 / 0.12)',
                border: '1px solid oklch(0.55 0.12 196 / 0.30)',
                boxShadow: '0 0 12px oklch(0.76 0.16 196 / 0.15)',
                color: 'var(--accent)',
              }}
            >
              <Mail className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {isEdit ? '메일 편집' : '메일 추가'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.24 0.010 236)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">발신자 이메일 *</label>
              <input className="input" type="email" value={form.from_email} onChange={e => set('from_email', e.target.value)} placeholder="sender@example.com" required autoFocus />
            </div>
            <div>
              <label className="label">발신자 이름</label>
              <input className="input" value={form.from_name} onChange={e => set('from_name', e.target.value)} placeholder="홍길동" />
            </div>
          </div>

          <div>
            <label className="label">제목 *</label>
            <input className="input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="메일 제목" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">수신 일시 *</label>
              <input className="input" type="datetime-local" value={form.received_at} onChange={e => set('received_at', e.target.value)} required />
            </div>
            <div>
              <label className="label">분류</label>
              <select className="select" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">본문</label>
            <textarea className="textarea" rows={5} value={form.body} onChange={e => set('body', e.target.value)} placeholder="메일 본문을 붙여넣으세요..." />
          </div>

          <div>
            <label className="label">내부 메모</label>
            <textarea className="textarea" rows={2} value={form.note} onChange={e => set('note', e.target.value)} placeholder="팀 내부용 메모 (선택)" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? '저장 중...' : isEdit ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
