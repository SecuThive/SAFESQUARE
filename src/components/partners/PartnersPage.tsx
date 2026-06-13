'use client';

import { useEffect, useState, useCallback } from 'react';
import { partnersApi } from '@/lib/api';
import type { Partner, PartnerContact, PartnerBusinessType, PartnerContractType } from '@/lib/types';
import {
  Building2, Plus, Search, X, Phone, Mail, Globe, MapPin,
  User, Pencil, Trash2, Star, ChevronRight, UserPlus, Tag,
  MailOpen, ChevronDown, Inbox, ScanLine, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

function formatDate(iso: string) {
  return format(parseISO(iso), 'MM.dd HH:mm', { locale: ko });
}

interface PartnerMailItem {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  category: string | null;
  is_read: boolean;
}

const BUSINESS_META: Record<string, { label: string; color: string; bg: string }> = {
  security:    { label: '보안',    color: 'text-red-400',    bg: 'bg-red-500/10'    },
  network:     { label: '네트워크', color: 'text-blue-400',  bg: 'bg-blue-500/10'   },
  hardware:    { label: '하드웨어', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  software:    { label: '소프트웨어', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  cloud:       { label: '클라우드', color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
  consulting:  { label: '컨설팅',  color: 'text-green-400',  bg: 'bg-green-500/10'  },
  other:       { label: '기타',    color: 'text-gray-400',   bg: 'bg-gray-700/40'   },
};

const CONTRACT_META: Record<string, string> = {
  reseller:      '리셀러',
  oem:           'OEM',
  msp:           'MSP',
  subcontractor: '하청',
  vendor:        '벤더',
  other:         '기타',
};

export default function PartnersPage() {
  const [partners,  setPartners]  = useState<Partner[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterBiz, setFilterBiz] = useState('all');
  const [selected,  setSelected]  = useState<Partner | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Partner | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await partnersApi.list();
      setPartners(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 선택된 파트너 상세 갱신
  const refreshSelected = async (id: number) => {
    try {
      const detail = await partnersApi.get(id);
      setSelected(detail);
      setPartners(prev => prev.map(p => p.id === id ? { ...p, ...detail } : p));
    } catch { /* ignore */ }
  };

  const remove = async (id: number) => {
    if (!await confirm('파트너사를 삭제하시겠습니까?')) return;
    await partnersApi.delete(id);
    setPartners(prev => prev.filter(p => p.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = partners.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterBiz !== 'all' && p.business_type !== filterBiz) return false;
    return true;
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* 목록 패널 */}
      <div className={clsx(
        'flex flex-col border-r border-gray-800 bg-surface-raised flex-shrink-0',
        selected ? 'w-80' : 'flex-1 max-w-lg',
      )}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-gray-200">파트너사</h2>
            <span className="text-[10px] text-gray-600">{filtered.length}개</span>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-brand hover:bg-brand/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 검색 + 필터 */}
        <div className="px-3 py-2 border-b border-gray-800 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="파트너사 검색..."
              className="w-full bg-surface-overlay border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterBiz('all')}
              className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                filterBiz === 'all' ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-300 bg-surface-overlay')}
            >전체</button>
            {Object.entries(BUSINESS_META).map(([id, m]) => (
              <button key={id} onClick={() => setFilterBiz(id)}
                className={clsx('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                  filterBiz === id ? `${m.bg} ${m.color}` : 'text-gray-500 hover:text-gray-300 bg-surface-overlay')}
              >{m.label}</button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <Building2 className="w-9 h-9 text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">{search ? '검색 결과 없음' : '파트너사가 없습니다'}</p>
              <button onClick={() => { setEditTarget(null); setShowModal(true); }}
                className="mt-3 text-xs text-brand hover:underline">파트너사 추가 →</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {filtered.map(p => {
                const biz = BUSINESS_META[p.business_type ?? 'other'] ?? BUSINESS_META.other;
                const active = selected?.id === p.id;
                const pc = p.primary_contact;
                return (
                  <div
                    key={p.id}
                    onClick={() => refreshSelected(p.id)}
                    className={clsx(
                      'px-4 py-3 cursor-pointer transition-colors border-l-2',
                      active ? 'bg-brand/5 border-brand' : 'hover:bg-surface-overlay border-transparent',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Building2 className="w-4 h-4 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', biz.bg, biz.color)}>
                            {biz.label}
                          </span>
                          {p.contract_type && (
                            <span className="text-[10px] text-gray-600">{CONTRACT_META[p.contract_type] ?? p.contract_type}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-200 truncate">{p.name}</p>
                        {pc && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {pc.name}{pc.role ? ` · ${pc.role}` : ''}
                          </p>
                        )}
                        {(p.contact_count ?? 0) > 0 && (
                          <p className="text-[10px] text-gray-600 mt-0.5">담당자 {p.contact_count}명</p>
                        )}
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

      {/* 상세 패널 */}
      {selected ? (
        <PartnerDetail
          partner={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setShowModal(true); }}
          onDelete={() => remove(selected.id)}
          onRefresh={() => refreshSelected(selected.id)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-surface">
          <div className="text-center">
            <Building2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">파트너사를 선택하세요</p>
          </div>
        </div>
      )}

      {/* 생성/편집 모달 */}
      {showModal && (
        <PartnerModal
          partner={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSuccess={async () => {
            setShowModal(false);
            setEditTarget(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

/* ── 상세 패널 ── */
function PartnerDetail({ partner, onClose, onEdit, onDelete, onRefresh }: {
  partner: Partner;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [showContactModal, setShowContactModal] = useState(false);
  const [editContact, setEditContact] = useState<PartnerContact | null>(null);
  const [mails,       setMails]       = useState<PartnerMailItem[]>([]);
  const [mailLoading, setMailLoading] = useState(false);
  const [mailLoaded,  setMailLoaded]  = useState(false);
  const [mailOpen,    setMailOpen]    = useState(false);
  const biz = BUSINESS_META[partner.business_type ?? 'other'] ?? BUSINESS_META.other;

  // partner가 바뀌면 메일 상태 초기화
  useEffect(() => {
    setMails([]);
    setMailLoaded(false);
    setMailOpen(false);
  }, [partner.id]);

  const toggleMails = async () => {
    if (!mailOpen && !mailLoaded) {
      setMailLoading(true);
      try {
        const result = await partnersApi.getMails(partner.id);
        setMails(result);
        setMailLoaded(true);
      } catch { /* ignore */ }
      finally { setMailLoading(false); }
    }
    setMailOpen(prev => !prev);
  };

  const removeContact = async (contactId: number) => {
    if (!await confirm('담당자를 삭제하시겠습니까?')) return;
    await partnersApi.deleteContact(partner.id, contactId);
    onRefresh();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      {/* 툴바 */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 bg-surface-raised flex-shrink-0">
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> 편집
        </button>
        <button onClick={onDelete}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* 기본 정보 */}
        <div>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">{partner.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', biz.bg, biz.color)}>
                  {biz.label}
                </span>
                {partner.contract_type && (
                  <span className="text-[10px] text-gray-500 bg-surface-overlay px-1.5 py-0.5 rounded">
                    {CONTRACT_META[partner.contract_type] ?? partner.contract_type}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2 text-xs text-gray-500">
            {partner.website && (
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <a href={partner.website} target="_blank" rel="noopener noreferrer"
                  className="text-brand hover:underline truncate">{partner.website}</a>
              </div>
            )}
            {partner.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{partner.address}</span>
              </div>
            )}
            {partner.notes && (
              <p className="mt-2 text-gray-400 bg-surface-overlay rounded-lg p-3 text-xs leading-relaxed border border-gray-800 whitespace-pre-wrap">
                {partner.notes}
              </p>
            )}
          </div>
        </div>

        {/* 담당자 목록 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              담당자 ({partner.contacts?.length ?? 0})
            </h3>
            <button
              onClick={() => { setEditContact(null); setShowContactModal(true); }}
              className="flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <UserPlus className="w-3.5 h-3.5" /> 추가
            </button>
          </div>
          {(partner.contacts?.length ?? 0) === 0 ? (
            <p className="text-xs text-gray-600 italic">등록된 담당자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {partner.contacts.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-overlay border border-gray-800">
                  <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-medium text-gray-200">{c.name}</span>
                      {c.is_primary && (
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      )}
                      {c.role && <span className="text-[10px] text-gray-500">{c.role}</span>}
                    </div>
                    {c.department && <p className="text-[10px] text-gray-600 mb-1">{c.department}</p>}
                    <div className="space-y-0.5">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Phone className="w-3 h-3" />{c.phone}
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Mail className="w-3 h-3" />{c.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditContact(c); setShowContactModal(true); }}
                      className="p-1 text-gray-600 hover:text-brand transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeContact(c.id)}
                      className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 수신 메일 */}
        <div>
          <button
            onClick={toggleMails}
            className="w-full flex items-center gap-2 mb-3 group"
          >
            <div className="flex items-center gap-1.5 flex-1">
              {mailOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
              <MailOpen className="w-3.5 h-3.5 text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">수신 메일</h3>
              {mailLoaded && (
                <span className="text-[10px] text-gray-600">({mails.length})</span>
              )}
            </div>
          </button>

          {mailOpen && (
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              {mailLoading ? (
                <p className="px-4 py-4 text-xs text-gray-500 text-center">불러오는 중...</p>
              ) : mails.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-8 text-gray-600">
                  <Inbox className="w-6 h-6" />
                  <p className="text-xs">수신된 메일이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60 max-h-80 overflow-y-auto">
                  {mails.map(m => (
                    <div key={m.id} className="flex items-start gap-2.5 px-4 py-3 hover:bg-surface-overlay transition-colors">
                      <div className={clsx('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', m.is_read ? 'bg-transparent' : 'bg-brand')} />
                      <div className="min-w-0 flex-1">
                        <p className={clsx('text-xs truncate', m.is_read ? 'text-gray-400' : 'text-gray-200 font-medium')}>
                          {m.subject || '(제목 없음)'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500 truncate">{m.from_name || m.from_email}</span>
                          <span className="text-[10px] text-gray-600 flex-shrink-0">{formatDate(m.received_at)}</span>
                          {m.category && (
                            <span className="text-[10px] text-gray-700 bg-surface px-1 rounded flex-shrink-0">{m.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showContactModal && (
        <ContactModal
          contact={editContact}
          partnerId={partner.id}
          onClose={() => { setShowContactModal(false); setEditContact(null); }}
          onSuccess={() => { setShowContactModal(false); setEditContact(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ── 파트너사 생성/편집 모달 ── */
function PartnerModal({ partner, onClose, onSuccess }: {
  partner: Partner | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!partner;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:          partner?.name          ?? '',
    business_type: partner?.business_type ?? '',
    contract_type: partner?.contract_type ?? '',
    website:       partner?.website       ?? '',
    address:       partner?.address       ?? '',
    notes:         partner?.notes         ?? '',
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name:          form.name.trim(),
        business_type: (form.business_type || undefined) as import('@/lib/types').PartnerBusinessType | undefined,
        contract_type: (form.contract_type || undefined) as import('@/lib/types').PartnerContractType | undefined,
        website:       form.website.trim() || undefined,
        address:       form.address.trim() || undefined,
        notes:         form.notes.trim()   || undefined,
      };
      if (isEdit) await partnersApi.update(partner!.id, payload);
      else        await partnersApi.create(payload);
      onSuccess();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-gray-100">{isEdit ? '파트너사 편집' : '파트너사 추가'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">회사명 *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="파트너사명" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">업종</label>
              <select className="select" value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                <option value="">선택</option>
                {Object.entries(BUSINESS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">계약 형태</label>
              <select className="select" value={form.contract_type} onChange={e => set('contract_type', e.target.value)}>
                <option value="">선택</option>
                {Object.entries(CONTRACT_META).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">웹사이트</label>
            <input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label className="label">주소</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="회사 주소" />
          </div>
          <div>
            <label className="label">메모</label>
            <textarea className="textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="파트너사 관련 메모" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '저장 중...' : isEdit ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── 담당자 모달 ── */
function ContactModal({ contact, partnerId, onClose, onSuccess }: {
  contact: PartnerContact | null;
  partnerId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!contact;
  const [saving,    setSaving]    = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [scanNote,  setScanNote]  = useState('');
  const [form, setForm] = useState({
    name:       contact?.name       ?? '',
    role:       contact?.role       ?? '',
    phone:      contact?.phone      ?? '',
    email:      contact?.email      ?? '',
    department: contact?.department ?? '',
    is_primary: contact?.is_primary ?? false,
    notes:      contact?.notes      ?? '',
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanNote('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/partners/scan-card', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        name:       data.name       ?? prev.name,
        role:       data.role       ?? prev.role,
        phone:      data.phone      ?? prev.phone,
        email:      data.email      ?? prev.email,
        department: data.department ?? prev.department,
      }));
      setScanNote(data.company ? `소속: ${data.company}` : '인식 완료 — 내용을 확인하세요');
    } catch {
      setScanNote('인식에 실패했습니다. 직접 입력해 주세요.');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name:       form.name.trim(),
        role:       form.role.trim()       || undefined,
        phone:      form.phone.trim()      || undefined,
        email:      form.email.trim()      || undefined,
        department: form.department.trim() || undefined,
        is_primary: form.is_primary,
        notes:      form.notes.trim()      || undefined,
      };
      if (isEdit) await partnersApi.updateContact(partnerId, contact!.id, payload);
      else        await partnersApi.createContact(partnerId, payload);
      onSuccess();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-gray-100">{isEdit ? '담당자 편집' : '담당자 추가'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 명함 스캔 */}
          <label className={clsx(
            'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
            scanning ? 'border-brand/40 bg-brand/5' : 'border-gray-700 hover:border-brand/50 hover:bg-brand/5',
          )}>
            {scanning
              ? <><Loader2 className="w-4 h-4 text-brand animate-spin" /><span className="text-xs text-brand">명함 인식 중...</span></>
              : <><ScanLine className="w-4 h-4 text-gray-500" /><span className="text-xs text-gray-400">명함 사진으로 자동 입력</span></>
            }
            <input type="file" accept="image/*" className="hidden" disabled={scanning} onChange={handleScan} />
          </label>
          {scanNote && (
            <p className="text-[11px] text-brand/80 -mt-2 text-center">{scanNote}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">이름 *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" required autoFocus />
            </div>
            <div>
              <label className="label">직책</label>
              <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="팀장" />
            </div>
          </div>
          <div>
            <label className="label">부서</label>
            <input className="input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="영업팀" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">전화번호</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div>
              <label className="label">이메일</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="example@company.com" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)}
              className="w-4 h-4 rounded accent-brand" />
            <span className="text-sm text-gray-300">주담당자로 설정</span>
            <Star className="w-3.5 h-3.5 text-yellow-400" />
          </label>
          <div>
            <label className="label">메모</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '저장 중...' : isEdit ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
