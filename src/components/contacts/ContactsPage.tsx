'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import {
  Plus, Search, Trash2, Edit2, X, Phone, Mail, Copy, Check,
  User, FolderOpen, Download, Upload, ImagePlus, ScanLine, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { getAuthHeaders, projectsApi } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import TableSkeleton from '@/components/ui/TableSkeleton';
import type { Project } from '@/lib/types';

interface Contact {
  id:          number;
  project_id:  number | null;
  name:        string;
  role:        string | null;
  phone:       string | null;
  email:       string | null;
  department:  string | null;
  notes:       string | null;
  card_image:  string | null;
  created_at:  string;
  updated_at:  string;
}

type FormData = Omit<Contact, 'id' | 'card_image' | 'created_at' | 'updated_at'>;

const EMPTY_FORM: FormData = {
  project_id: null, name: '', role: '', phone: '', email: '', department: '', notes: '',
};

/* ─── API ────────────────────────────────────────────────────────────────── */

const BASE = '/api/contacts';

async function apiList(): Promise<Contact[]> {
  const res = await fetch(BASE, { headers: getAuthHeaders() });
  return res.ok ? res.json() : [];
}
async function apiCreate(data: FormData): Promise<Contact> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? '저장 실패');
  return res.json();
}
async function apiUpdate(id: number, data: Partial<FormData>): Promise<Contact> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? '저장 실패');
  return res.json();
}
async function apiDelete(id: number) {
  await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
}
async function apiImportCSV(file: File): Promise<Contact[]> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? 'CSV 가져오기 실패');
  return res.json();
}
async function apiUploadCardImage(id: number, file: File): Promise<Contact> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/${id}/card-image`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error('이미지 업로드 실패');
  return res.json();
}

/* ─── 색상 아바타 ─────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-violet-600', 'bg-blue-600', 'bg-emerald-600',
  'bg-amber-600',  'bg-rose-600', 'bg-cyan-600', 'bg-fuchsia-600',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ─── 클립보드 복사 버튼 ──────────────────────────────────────────────────── */

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.preventDefault();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }
  return (
    <button
      onClick={copy}
      className="ml-1.5 p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
      title="복사"
    >
      {copied
        ? <Check className="w-3 h-3 text-emerald-400" />
        : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ─── CSV 내보내기 ────────────────────────────────────────────────────────── */

function exportCSV(contacts: Contact[], projects: Project[]) {
  const projectName = (id: number | null) =>
    id === null ? '' : (projects.find(p => p.id === id)?.name ?? String(id));

  const header = ['name', 'role', 'phone', 'email', 'department', 'notes', 'project_id', 'project_name'];
  const rows = contacts.map(c => [
    c.name,
    c.role ?? '',
    c.phone ?? '',
    c.email ?? '',
    c.department ?? '',
    c.notes ?? '',
    c.project_id ?? '',
    projectName(c.project_id),
  ]);

  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

export default function ContactsPage() {
  const [contacts,     setContacts]     = useState<Contact[]>([]);
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [selectedPid,  setSelectedPid]  = useState<number | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState<Contact | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [showSidebar,  setShowSidebar]  = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([apiList(), projectsApi.list()])
      .then(([cs, ps]) => { setContacts(cs); setProjects(ps); })
      .finally(() => setLoading(false));
  }, []);

  const projectName = (id: number | null) => {
    if (id === null) return '프로젝트 없음';
    return projects.find(p => p.id === id)?.name ?? `프로젝트 #${id}`;
  };

  const countByProject = (pid: number | null) =>
    contacts.filter(c => pid === null ? c.project_id === null : c.project_id === pid).length;

  const unassignedCount = contacts.filter(c => c.project_id === null).length;

  const visible = contacts.filter(c => {
    if (selectedPid === -1 && c.project_id !== null) return false;
    if (selectedPid !== null && selectedPid !== -1 && c.project_id !== selectedPid) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.name, c.role, c.phone, c.email, c.department, c.notes]
      .some(v => v?.toLowerCase().includes(q));
  });

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(c: Contact) { setEditing(c); setShowForm(true); }

  async function handleSave(data: FormData, cardImageFile?: File) {
    if (editing) {
      let updated = await apiUpdate(editing.id, data);
      if (cardImageFile) {
        updated = await apiUploadCardImage(updated.id, cardImageFile);
      }
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
    } else {
      let created = await apiCreate(data);
      if (cardImageFile) {
        created = await apiUploadCardImage(created.id, cardImageFile);
      }
      setContacts(prev => [...prev, created]);
      setSelectedPid(created.project_id ?? -1);
    }
    setShowForm(false);
  }

  async function handleDelete(id: number) {
    if (!await confirm('이 담당자를 삭제하시겠습니까?')) return;
    await apiDelete(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const imported = await apiImportCSV(file);
      setContacts(prev => [...prev, ...imported]);
      alert(`${imported.length}명의 담당자를 가져왔습니다.`);
    } catch (err: any) {
      alert(err.message ?? 'CSV 가져오기 실패');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="h-full flex overflow-hidden">

      {/* ── 모바일 사이드바 백드롭 ── */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* ── 좌측: 프로젝트 패널 ────────────────────────────────────────────── */}
      <aside className={clsx(
        'flex-shrink-0 border-r border-gray-800 flex flex-col bg-surface-raised',
        'fixed inset-y-0 left-0 z-30 w-56 transition-transform duration-200 md:relative md:translate-x-0 md:z-auto',
        showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        <div className="px-3 py-3 border-b border-gray-800">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">프로젝트</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-1.5">
          <button
            onClick={() => setSelectedPid(null)}
            className={clsx(
              'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors rounded-md mx-1',
              selectedPid === null
                ? 'bg-brand/15 text-brand font-medium'
                : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200',
            )}
            style={{ width: 'calc(100% - 8px)' }}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              전체
            </span>
            <span className="text-[11px] opacity-60">{contacts.length}</span>
          </button>

          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPid(p.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors rounded-md mx-1',
                selectedPid === p.id
                  ? 'bg-brand/15 text-brand font-medium'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200',
              )}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{p.name}</span>
              </span>
              {countByProject(p.id) > 0 && (
                <span className="text-[11px] opacity-60 flex-shrink-0 ml-1">
                  {countByProject(p.id)}
                </span>
              )}
            </button>
          ))}

          {unassignedCount > 0 && (
            <>
              <div className="mx-3 my-1.5 border-t border-gray-800/60" />
              <button
                onClick={() => setSelectedPid(-1)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors rounded-md mx-1',
                  selectedPid === -1
                    ? 'bg-brand/15 text-brand font-medium'
                    : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-300',
                )}
                style={{ width: 'calc(100% - 8px)' }}
              >
                <span className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  프로젝트 없음
                </span>
                <span className="text-[11px] opacity-60">{unassignedCount}</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-2">
          <button onClick={openCreate} className="w-full btn-primary text-xs flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> 담당자 추가
          </button>
          <button
            onClick={() => setShowSidebar(false)}
            className="w-full md:hidden btn-ghost text-xs"
          >
            닫기
          </button>
        </div>
      </aside>

      {/* ── 우측: 담당자 목록 ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* 검색 + 툴바 */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-gray-800">
          {/* 모바일: 프로젝트 패널 토글 */}
          <button
            onClick={() => setShowSidebar(true)}
            className="md:hidden flex-shrink-0 p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            title="프로젝트 필터"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 연락처, 소속 검색…"
              className="input text-sm pl-8 py-1.5 w-full"
            />
          </div>

          {/* CSV 가져오기 */}
          <input
            ref={importRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5"
            title="CSV 파일로 담당자 일괄 등록"
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? '가져오는 중…' : 'CSV 가져오기'}
          </button>

          {/* CSV 내보내기 */}
          <button
            onClick={() => exportCSV(visible, projects)}
            disabled={visible.length === 0}
            className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5"
            title="현재 목록을 CSV로 내보내기"
          >
            <Download className="w-3.5 h-3.5" />
            내보내기
          </button>

          <span className="text-xs text-gray-600 ml-auto">
            {selectedPid !== null && (
              <span className="mr-2 text-gray-500 font-medium">
                {selectedPid === -1 ? '프로젝트 없음' : projectName(selectedPid)}
              </span>
            )}
            {visible.length}명
          </span>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={5} rowHeight="h-12" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full pb-16 text-center">
              <User className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">
                {search ? '검색 결과가 없습니다' : '등록된 담당자가 없습니다'}
              </p>
              <button onClick={openCreate} className="btn-primary mt-4 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> 첫 담당자 추가
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-800 bg-surface-raised">
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-[30%]">이름 / 소속</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-[18%]">전화번호</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-[28%]">이메일</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">메모</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={clsx(
                      'border-b border-gray-800/60 hover:bg-surface-raised/60 transition-colors group',
                      idx % 2 === 0 ? '' : 'bg-gray-900/20',
                    )}
                  >
                    {/* 이름 / 소속 */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {/* 명함 이미지 or 아바타 */}
                        {c.card_image ? (
                          <img
                            src={c.card_image}
                            alt={c.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-700"
                          />
                        ) : (
                          <div className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                            avatarColor(c.name),
                          )}>
                            {c.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-100 leading-tight">{c.name}</p>
                          {(c.department || c.role) && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {[c.department, c.role].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {(selectedPid === null || selectedPid === -1) && (
                            <p className="text-[10px] mt-0.5 truncate text-brand/70">
                              {projectName(c.project_id)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 전화번호 */}
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <div className="flex items-center gap-1 group/cell">
                          <a
                            href={`tel:${c.phone}`}
                            className="flex items-center gap-1.5 text-gray-300 hover:text-brand transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="tabular-nums text-sm">{c.phone}</span>
                          </a>
                          <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity">
                            <CopyBtn value={c.phone} />
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>

                    {/* 이메일 */}
                    <td className="px-4 py-3">
                      {c.email ? (
                        <div className="flex items-center gap-1 group/cell">
                          <a
                            href={`mailto:${c.email}`}
                            className="flex items-center gap-1.5 text-gray-300 hover:text-brand transition-colors min-w-0"
                          >
                            <Mail className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span className="truncate text-sm">{c.email}</span>
                          </a>
                          <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity">
                            <CopyBtn value={c.email} />
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>

                    {/* 메모 */}
                    <td className="px-4 py-3">
                      {c.notes
                        ? <span className="text-xs text-gray-500 line-clamp-1">{c.notes}</span>
                        : <span className="text-gray-700 text-xs">—</span>
                      }
                    </td>

                    {/* 액션 */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded text-gray-600 hover:text-brand hover:bg-brand/10 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 폼 패널 ────────────────────────────────────────────────────────── */}
      {showForm && (
        <ContactForm
          editing={editing}
          projects={projects}
          defaultProjectId={selectedPid ?? projects[0]?.id ?? 0}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

/* ─── 폼 패널 ────────────────────────────────────────────────────────────── */

function ContactForm({
  editing, projects, defaultProjectId, onSave, onClose,
}: {
  editing: Contact | null;
  projects: Project[];
  defaultProjectId: number;
  onSave: (data: FormData, cardImageFile?: File) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(() =>
    editing
      ? { project_id: editing.project_id, name: editing.name,
          role: editing.role ?? '', phone: editing.phone ?? '',
          email: editing.email ?? '', department: editing.department ?? '',
          notes: editing.notes ?? '' }
      : { ...EMPTY_FORM, project_id: defaultProjectId > 0 ? defaultProjectId : null }
  );
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardPreview,   setCardPreview]   = useState<string | null>(editing?.card_image ?? null);
  const [scanning,      setScanning]      = useState(false);
  const [scanNote,      setScanNote]      = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef  = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormData, v: string | number | null) =>
    setForm(f => ({ ...f, [k]: v }));

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCardImageFile(file);
    setCardPreview(URL.createObjectURL(file));
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 이미지 미리보기도 함께 설정
    setCardImageFile(file);
    setCardPreview(URL.createObjectURL(file));
    setScanning(true);
    setScanNote('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000); // 2분
      const res = await fetch('/api/partners/scan-card', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        name:       data.name       || prev.name,
        role:       data.role       || prev.role,
        phone:      data.phone      || prev.phone,
        email:      data.email      || prev.email,
        department: data.department || prev.department,
      }));
      setScanNote(data.company ? `소속 감지: ${data.company} — 내용을 확인하세요` : '인식 완료 — 내용을 확인하세요');
    } catch (err: any) {
      const msg = err?.message || '';
      setScanNote(msg ? `인식 실패: ${msg}` : '인식 실패 — 직접 입력해 주세요');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!form.name.trim()) { setError('이름은 필수입니다'); return; }
    setSaving(true); setError('');
    try {
      await onSave(
        {
          ...form,
          project_id: form.project_id ? Number(form.project_id) : null,
          role:       form.role       || null,
          phone:      form.phone      || null,
          email:      form.email      || null,
          department: form.department || null,
          notes:      form.notes      || null,
        } as FormData,
        cardImageFile ?? undefined,
      );
    } catch (err: any) {
      setError(err.message ?? '저장 실패');
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface-raised border-l border-gray-800 z-40 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">
            {editing ? '담당자 수정' : '담당자 추가'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* 명함 스캔 자동입력 */}
          <div>
            <label className="label">명함 이미지 <span className="text-gray-600 font-normal">(선택)</span></label>
            <div className="flex items-start gap-3">
              {/* 미리보기 */}
              {cardPreview ? (
                <img src={cardPreview} alt="명함"
                  className="w-16 h-16 rounded-lg object-cover border border-gray-700 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-dashed border-gray-700 flex items-center justify-center flex-shrink-0 bg-gray-900/40">
                  <ImagePlus className="w-5 h-5 text-gray-600" />
                </div>
              )}

              <div className="flex flex-col gap-1.5 flex-1">
                {/* 자동 인식 버튼 */}
                <input ref={scanInputRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => scanInputRef.current?.click()}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  {scanning
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />인식 중...</>
                    : <><ScanLine className="w-3.5 h-3.5" />명함으로 자동 입력</>
                  }
                </button>

                {/* 이미지만 저장 버튼 */}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <button type="button" onClick={() => imageInputRef.current?.click()}
                  className="btn-ghost text-xs px-3 py-1.5">
                  {cardPreview ? '이미지만 변경' : '이미지만 저장'}
                </button>

                {cardPreview && (
                  <button type="button"
                    onClick={() => { setCardPreview(null); setCardImageFile(null); }}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors text-left">
                    제거
                  </button>
                )}
              </div>
            </div>
            {scanNote && (
              <p className="mt-1.5 text-[11px] text-brand/80">{scanNote}</p>
            )}
          </div>

          <div>
            <label className="label">프로젝트 <span className="text-gray-600 font-normal">(선택)</span></label>
            <select
              value={form.project_id ?? ''}
              onChange={e => set('project_id', e.target.value === '' ? ('' as any) : Number(e.target.value))}
              className="select w-full"
            >
              <option value="">프로젝트 없음</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">이름 *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" required className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">소속 / 부서</label>
              <input value={form.department ?? ''} onChange={e => set('department', e.target.value)} placeholder="정보보안팀" className="input w-full" />
            </div>
            <div>
              <label className="label">직책 / 역할</label>
              <input value={form.role ?? ''} onChange={e => set('role', e.target.value)} placeholder="보안담당자" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="label">전화번호</label>
            <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" className="input w-full" />
          </div>
          <div>
            <label className="label">이메일</label>
            <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="example@company.com" className="input w-full" />
          </div>
          <div>
            <label className="label">메모 <span className="text-gray-600 font-normal">(선택)</span></label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="담당 업무, 특이사항 등" rows={3} className="textarea w-full" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-800 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
          <button onClick={() => handleSubmit()} disabled={saving} className="btn-primary flex-1">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </>
  );
}
