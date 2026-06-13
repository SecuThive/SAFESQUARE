'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { sshServersApi } from '@/lib/api';
import type { SshServer, SshServerPayload } from '@/lib/api';
import {
  Server, Plus, Pencil, Trash2, Check, X,
  Wifi, WifiOff, Loader2, Search, Key, KeyRound,
  Eye, EyeOff, Tag, Terminal, RefreshCw, Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';

const TerminalModal = dynamic(() => import('./TerminalModal'), { ssr: false });

/* ── 유틸 ──────────────────────────────────────────────────── */
function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function sshCommand(s: SshServer) {
  return s.port === 22
    ? `ssh ${s.username}@${s.host}`
    : `ssh -p ${s.port} ${s.username}@${s.host}`;
}

/* ── 연결 상태 배지 ─────────────────────────────────────────── */
function StatusBadge({ ok, tested }: { ok: boolean | null; tested: string | null }) {
  if (ok === null || !tested) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-700/50 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        미확인
      </span>
    );
  }
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400">
      <Wifi className="w-2.5 h-2.5" />
      연결됨
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/15 text-red-400">
      <WifiOff className="w-2.5 h-2.5" />
      실패
    </span>
  );
}

/* ── 서버 카드 ──────────────────────────────────────────────── */
function ServerCard({
  server, onEdit, onDelete, onTest, onTerminal, testing,
}: {
  server: SshServer;
  onEdit: (s: SshServer) => void;
  onDelete: (s: SshServer) => void;
  onTest: (id: number) => void;
  onTerminal: (s: SshServer) => void;
  testing: number | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(sshCommand(server));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="bg-surface-raised border border-gray-800/70 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-700/80 transition-colors group">
      {/* 상단: 이름 + 상태 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
            <Server className="w-3.5 h-3.5 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate leading-tight">{server.name}</p>
            <p className="text-[11px] text-gray-500 truncate font-mono mt-0.5">
              {server.username}@{server.host}:{server.port}
            </p>
          </div>
        </div>
        <StatusBadge ok={server.last_test_ok} tested={server.last_tested_at} />
      </div>

      {/* 인증 방식 */}
      <div className="flex items-center gap-1.5">
        {server.auth_type === 'key' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-400">
            <Key className="w-2.5 h-2.5" /> SSH Key
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400">
            <KeyRound className="w-2.5 h-2.5" /> Password
          </span>
        )}
        {server.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-gray-700/60 text-gray-400">
            {tag}
          </span>
        ))}
      </div>

      {/* 메모 */}
      {server.notes && (
        <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">{server.notes}</p>
      )}

      {/* 마지막 테스트 시각 */}
      {server.last_tested_at && (
        <p className="text-[10px] text-gray-700 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {formatDistanceToNow(new Date(server.last_tested_at), { addSuffix: true, locale: ko })} 테스트
        </p>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-800/60">
        {/* SSH 터미널 접속 — 메인 액션 */}
        <button
          onClick={() => onTerminal(server)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                     bg-brand/10 border border-brand/30 text-brand
                     hover:bg-brand/20 hover:border-brand/50 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          터미널 접속
        </button>

        <div className="flex items-center gap-1.5">
          {/* SSH 명령어 복사 */}
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs
                       bg-gray-800/40 border border-gray-700/50 text-gray-400
                       hover:bg-gray-700/50 hover:text-gray-200 transition-colors"
            title={sshCommand(server)}
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Terminal className="w-3 h-3" />}
            {copied ? '복사됨' : '명령어'}
          </button>

          {/* 연결 테스트 */}
          <button
            onClick={() => onTest(server.id)}
            disabled={testing === server.id}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs
                       bg-gray-800/40 border border-gray-700/50 text-gray-400
                       hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors
                       disabled:opacity-50"
          >
            {testing === server.id
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            포트 확인
          </button>

          {/* 편집 */}
          <button
            onClick={() => onEdit(server)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700/40 transition-colors"
          ><Pencil className="w-3.5 h-3.5" /></button>

          {/* 삭제 */}
          <button
            onClick={() => onDelete(server)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

/* ── 서버 모달 ──────────────────────────────────────────────── */
const EMPTY: SshServerPayload = {
  name: '', host: '', port: 22, username: '',
  auth_type: 'password', password: '', private_key: '', tags: [], notes: '',
};

function ServerModal({
  server, onClose, onSave,
}: {
  server: SshServer | null;
  onClose: () => void;
  onSave: (data: SshServerPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<SshServerPayload>(EMPTY);
  const [tagInput, setTagInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!server) { setForm(EMPTY); return; }
    setForm({
      name: server.name, host: server.host, port: server.port,
      username: server.username, auth_type: server.auth_type,
      tags: [...server.tags], notes: server.notes ?? '',
      password: '', private_key: '',
    });
    // 편집 시 기존 시크릿 로드
    setLoadingSecrets(true);
    sshServersApi.getSecrets(server.id)
      .then(s => {
        setForm(prev => ({
          ...prev,
          password:    s.password    ?? '',
          private_key: s.private_key ?? '',
        }));
      })
      .catch(() => {})
      .finally(() => setLoadingSecrets(false));
  }, [server]);

  const set = (k: keyof SshServerPayload, v: unknown) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => set('tags', form.tags.filter(x => x !== t));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      setError('이름, 호스트, 사용자명은 필수입니다');
      return;
    }
    setSaving(true); setError('');
    try { await onSave(form); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : '저장 실패'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-raised border border-gray-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-gray-100">
              {server ? '서버 편집' : '서버 추가'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* 기본 정보 */}
          <div className="space-y-3">
            <div>
              <label className="label text-[11px] mb-1">별칭 *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="운영 웹서버" className="input w-full" required />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label text-[11px] mb-1">호스트 *</label>
                <input value={form.host} onChange={e => set('host', e.target.value)}
                  placeholder="192.168.0.1" className="input w-full font-mono" required />
              </div>
              <div className="w-24">
                <label className="label text-[11px] mb-1">포트</label>
                <input type="number" value={form.port} onChange={e => set('port', Number(e.target.value))}
                  min={1} max={65535} className="input w-full font-mono text-center" />
              </div>
            </div>

            <div>
              <label className="label text-[11px] mb-1">사용자명 *</label>
              <input value={form.username} onChange={e => set('username', e.target.value)}
                placeholder="ubuntu" className="input w-full font-mono" required />
            </div>
          </div>

          {/* 인증 */}
          <div className="space-y-3">
            <div>
              <label className="label text-[11px] mb-1">인증 방식</label>
              <div className="flex gap-2">
                {(['password', 'key'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => set('auth_type', t)}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs border transition-colors',
                      form.auth_type === t
                        ? 'bg-brand/15 border-brand/50 text-brand'
                        : 'border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-300',
                    )}>
                    {t === 'key' ? <Key className="w-3 h-3" /> : <KeyRound className="w-3 h-3" />}
                    {t === 'key' ? 'SSH Key' : 'Password'}
                  </button>
                ))}
              </div>
            </div>

            {loadingSecrets ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 py-2">
                <Loader2 className="w-3 h-3 animate-spin" /> 인증 정보 로드 중...
              </div>
            ) : form.auth_type === 'password' ? (
              <div>
                <label className="label text-[11px] mb-1">비밀번호</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={form.password ?? ''}
                    onChange={e => set('password', e.target.value)}
                    placeholder="비밀번호"
                    className="input w-full pr-8 font-mono"
                  />
                  <button type="button" onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="label text-[11px] mb-1">SSH Private Key</label>
                <textarea
                  value={form.private_key ?? ''}
                  onChange={e => set('private_key', e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  rows={5}
                  className="input w-full font-mono text-[11px] resize-none leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* 태그 */}
          <div>
            <label className="label text-[11px] mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> 태그
            </label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {form.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700/60 text-xs text-gray-300">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-gray-600 hover:text-red-400">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="태그 입력 후 Enter"
                className="input flex-1 text-xs"
              />
              <button type="button" onClick={addTag}
                className="px-3 rounded-lg border border-gray-700/60 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors">
                추가
              </button>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="label text-[11px] mb-1">메모</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="서버 용도, 특이사항 등"
              rows={2}
              className="input w-full resize-none text-xs leading-relaxed"
            />
          </div>
        </form>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-800/60">
          <button type="button" onClick={onClose}
            className="btn btn-ghost text-xs px-4">취소</button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="btn btn-primary text-xs px-5 gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function SshServersPage() {
  const [servers,  setServers]  = useState<SshServer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [testing,  setTesting]  = useState<number | null>(null);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [editTarget,     setEditTarget]     = useState<SshServer | null | 'new'>('new' as never);
  const [showModal,      setShowModal]      = useState(false);
  const [terminalServer, setTerminalServer] = useState<SshServer | null>(null);
  const [toast,          setToast]          = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setServers(await sshServersApi.list()); }
    catch { setError('서버 목록 로드 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditTarget(null); setShowModal(true); };
  const openEdit = (s: SshServer) => { setEditTarget(s); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleSave = async (data: SshServerPayload) => {
    if (editTarget) {
      const updated = await sshServersApi.update((editTarget as SshServer).id, data);
      setServers(prev => prev.map(s => s.id === updated.id ? updated : s));
      showToast('서버 정보가 업데이트되었습니다');
    } else {
      const created = await sshServersApi.create(data);
      setServers(prev => [...prev, created]);
      showToast('서버가 추가되었습니다');
    }
    closeModal();
  };

  const handleDelete = async (s: SshServer) => {
    if (!await confirm(`"${s.name}" 서버를 삭제하시겠습니까?`, { danger: true, confirmLabel: '삭제' })) return;
    await sshServersApi.delete(s.id);
    setServers(prev => prev.filter(x => x.id !== s.id));
    showToast('서버가 삭제되었습니다');
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const res = await sshServersApi.test(id);
      showToast(res.message);
      setServers(prev => prev.map(s =>
        s.id === id
          ? { ...s, last_test_ok: res.ok, last_tested_at: new Date().toISOString() }
          : s,
      ));
    } catch {
      showToast('연결 테스트 실패');
    } finally {
      setTesting(null);
    }
  };

  // 전체 태그 목록
  const allTags = Array.from(new Set(servers.flatMap(s => s.tags))).sort();

  // 필터링
  const filtered = servers.filter(s => {
    const q = search.toLowerCase();
    if (q && !s.name.toLowerCase().includes(q) && !s.host.toLowerCase().includes(q) && !s.username.toLowerCase().includes(q)) return false;
    if (tagFilter && !s.tags.includes(tagFilter)) return false;
    return true;
  });

  // 요약 통계
  const totalOk   = servers.filter(s => s.last_test_ok === true).length;
  const totalFail = servers.filter(s => s.last_test_ok === false).length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface/50">
      <div className="max-w-[1200px] mx-auto px-8 py-7">

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-100 tracking-tight">SSH 서버 관리</h1>
            <p className="text-sm text-gray-500 mt-1">서버 접속 정보를 안전하게 관리하고 연결을 테스트하세요.</p>
          </div>
          <button onClick={openNew} className="btn btn-primary gap-1.5 rounded-[9px] flex-shrink-0">
            <Plus className="w-4 h-4" />
            서버 추가
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: '전체 서버', value: servers.length, color: 'text-gray-200', icon: Server },
            { label: '연결 성공', value: totalOk,        color: 'text-emerald-400', icon: Wifi },
            { label: '연결 실패', value: totalFail,      color: 'text-red-400',   icon: WifiOff },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-surface-raised border border-gray-800/70 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon className={clsx('w-5 h-5 flex-shrink-0', color)} />
              <div>
                <p className="text-[11px] text-gray-500">{label}</p>
                <p className={clsx('text-2xl font-bold tabular-nums', color)}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 오류 */}
        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-xl text-sm text-red-400 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* 필터 툴바 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 호스트, 사용자 검색..."
              className="input pl-8 w-full text-xs"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setTagFilter('')}
                className={clsx('px-2.5 py-1 rounded-lg text-xs border transition-colors',
                  tagFilter === '' ? 'border-brand/50 bg-brand/10 text-brand' : 'border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-300')}
              >전체</button>
              {allTags.map(tag => (
                <button key={tag}
                  onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                  className={clsx('px-2.5 py-1 rounded-lg text-xs border transition-colors',
                    tagFilter === tag ? 'border-brand/50 bg-brand/10 text-brand' : 'border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-300')}
                >{tag}</button>
              ))}
            </div>
          )}
        </div>

        {/* 서버 그리드 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 bg-surface-raised border border-gray-800/70 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-xl bg-gray-800/60 flex items-center justify-center mb-3">
              <Server className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">
              {search || tagFilter ? '검색 결과가 없습니다' : '등록된 서버가 없습니다'}
            </p>
            {!search && !tagFilter && (
              <button onClick={openNew} className="mt-3 text-xs text-brand hover:underline">
                첫 번째 서버 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(s => (
              <ServerCard
                key={s.id}
                server={s}
                onEdit={openEdit}
                onDelete={handleDelete}
                onTest={handleTest}
                onTerminal={setTerminalServer}
                testing={testing}
              />
            ))}
          </div>
        )}
      </div>

      {/* 서버 추가/편집 모달 */}
      {showModal && (
        <ServerModal
          server={editTarget as SshServer | null}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {/* SSH 터미널 모달 */}
      {terminalServer && (
        <TerminalModal
          initialServer={terminalServer}
          servers={servers}
          onClose={() => setTerminalServer(null)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-800 border border-gray-700/80 rounded-xl text-sm text-gray-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
