'use client';

import { useEffect, useState, useCallback } from 'react';
import { partnersApi } from '@/lib/api';
import type { Partner, ProjectPartnerItem, ProjectPartnerRole } from '@/lib/types';
import {
  Building2, Plus, Trash2, X, Phone, Mail, Star, User, Link2,
  MailOpen, ChevronDown, ChevronRight, Inbox,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

function formatDate(iso: string) {
  return format(parseISO(iso), 'MM.dd HH:mm', { locale: ko });
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  prime:   { label: '주계약',   color: 'text-brand',        bg: 'bg-brand/10'       },
  sub:     { label: '하청',     color: 'text-blue-400',     bg: 'bg-blue-500/10'    },
  vendor:  { label: '벤더',     color: 'text-purple-400',   bg: 'bg-purple-500/10'  },
  support: { label: '지원',     color: 'text-green-400',    bg: 'bg-green-500/10'   },
  other:   { label: '기타',     color: 'text-gray-400',     bg: 'bg-gray-700/40'    },
};

interface PartnerMailItem {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  category: string | null;
  is_read: boolean;
}

interface Props { projectId: number }

export default function PartnerManager({ projectId }: Props) {
  const [items,      setItems]      = useState<ProjectPartnerItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await partnersApi.listProjectPartners(projectId));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    if (!await confirm('파트너사 연결을 해제하시겠습니까?', { title: '연결 해제', danger: true, confirmLabel: '해제' })) return;
    await partnersApi.removeFromProject(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-semibold text-gray-200">연결된 파트너사</h3>
          <span className="text-[10px] text-gray-600">{items.length}개</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
        >
          <Link2 className="w-3.5 h-3.5" /> 파트너사 연결
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-700 rounded-xl">
          <Building2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500">연결된 파트너사가 없습니다</p>
          <button onClick={() => setShowModal(true)}
            className="mt-2 text-xs text-brand hover:underline">파트너사 연결 →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map(item => (
            <PartnerCard key={item.id} item={item} projectId={projectId} onRemove={remove} />
          ))}
        </div>
      )}

      {showModal && (
        <LinkPartnerModal
          projectId={projectId}
          linkedIds={items.map(i => i.partner_id)}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

/* ── 파트너사 카드 (메일 포함) ── */
function PartnerCard({ item, projectId, onRemove }: {
  item: ProjectPartnerItem;
  projectId: number;
  onRemove: (id: number) => void;
}) {
  const role    = ROLE_META[item.role ?? 'other'] ?? ROLE_META.other;
  const primary = item.partner.contacts?.find(c => c.is_primary) ?? item.partner.contacts?.[0];

  const [mailOpen,   setMailOpen]   = useState(false);
  const [mails,      setMails]      = useState<PartnerMailItem[]>([]);
  const [mailLoading,setMailLoading]= useState(false);
  const [mailLoaded, setMailLoaded] = useState(false);

  const toggleMails = async () => {
    if (!mailOpen && !mailLoaded) {
      setMailLoading(true);
      try {
        const result = await partnersApi.getMails(item.partner_id, projectId);
        setMails(result);
        setMailLoaded(true);
      } catch { /* ignore */ }
      finally { setMailLoading(false); }
    }
    setMailOpen(prev => !prev);
  };

  return (
    <div className="rounded-xl bg-surface-overlay border border-gray-800 hover:border-gray-600 transition-colors">
      {/* 헤더 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">{item.partner.name}</p>
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', role.bg, role.color)}>
                {role.label}
              </span>
            </div>
          </div>
          <button onClick={() => onRemove(item.id)}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {primary && (
          <div className="border-t border-gray-800 pt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <User className="w-3 h-3 text-gray-600" />
              <span>{primary.name}</span>
              {primary.is_primary && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
              {primary.role && <span className="text-gray-600">· {primary.role}</span>}
            </div>
            {primary.phone && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone className="w-3 h-3" />{primary.phone}
              </div>
            )}
            {primary.email && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Mail className="w-3 h-3" />{primary.email}
              </div>
            )}
          </div>
        )}

        {item.notes && (
          <p className="mt-2 text-xs text-gray-600 border-t border-gray-800 pt-2">{item.notes}</p>
        )}
      </div>

      {/* 관련 메일 토글 */}
      <button
        onClick={toggleMails}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 border-t border-gray-800 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface transition-colors"
      >
        {mailOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <MailOpen className="w-3.5 h-3.5" />
        <span>관련 메일</span>
        {mailLoaded && (
          <span className="ml-1 text-[10px] text-gray-600">({mails.length})</span>
        )}
      </button>

      {mailOpen && (
        <div className="border-t border-gray-800">
          {mailLoading ? (
            <p className="px-4 py-3 text-xs text-gray-500">불러오는 중...</p>
          ) : mails.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6 text-gray-600">
              <Inbox className="w-5 h-5" />
              <p className="text-xs">관련 메일이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60 max-h-64 overflow-y-auto">
              {mails.map(m => (
                <div key={m.id} className="flex items-start gap-2 px-4 py-2.5 hover:bg-surface transition-colors">
                  <div className={clsx('mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0', m.is_read ? 'bg-transparent' : 'bg-brand')} />
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-xs truncate', m.is_read ? 'text-gray-400' : 'text-gray-200 font-medium')}>
                      {m.subject || '(제목 없음)'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-600 truncate">{m.from_name || m.from_email}</span>
                      <span className="text-[10px] text-gray-700 flex-shrink-0">{formatDate(m.received_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 파트너사 연결 모달 ── */
function LinkPartnerModal({ projectId, linkedIds, onClose, onSuccess }: {
  projectId: number;
  linkedIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [partners,  setPartners]  = useState<Partner[]>([]);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<number | null>(null);
  const [role,      setRole]      = useState<ProjectPartnerRole>('other');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    partnersApi.list().then(setPartners).catch(console.error);
  }, []);

  const available = partners.filter(p =>
    !linkedIds.includes(p.id) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await partnersApi.addToProject({ project_id: projectId, partner_id: selected, role, notes: notes || undefined });
      onSuccess();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-gray-100">파트너사 연결</h3>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 검색 */}
          <div>
            <label className="label">파트너사 선택 *</label>
            <input
              className="input mb-2"
              placeholder="파트너사 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-lg divide-y divide-gray-800">
              {available.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">
                  {linkedIds.length > 0 && available.length === 0 ? '연결 가능한 파트너사가 없습니다' : '파트너사를 먼저 등록해주세요'}
                </p>
              ) : available.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={clsx(
                    'w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2',
                    selected === p.id ? 'bg-brand/10 text-brand' : 'text-gray-300 hover:bg-surface-overlay',
                  )}
                >
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 역할 */}
          <div>
            <label className="label">역할</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value as ProjectPartnerRole)}>
              {Object.entries(ROLE_META).map(([id, m]) => (
                <option key={id} value={id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">메모</label>
            <textarea className="textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="이 프로젝트에서의 역할 설명" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving || !selected} className="btn-primary flex-1">
              {saving ? '연결 중...' : '연결'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
