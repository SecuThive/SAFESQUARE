'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, Edit2, Trash2, BookOpen, ChevronRight, ClipboardList, Upload, FileText, Loader2, Mail, Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';
import { getAuthHeaders, gmailApi, type GmailStatus } from '@/lib/api';
import { confirm } from '@/lib/confirm';

/* ── 타입 ── */
interface Solution {
  id: number; name: string; description: string | null; guide_count: number;
}
interface Template {
  id: number; name: string; description: string | null; item_count: number;
}
interface TemplateItem {
  id?: number; category: string; item: string; order: number;
}

type Tab = 'solutions' | 'inspection' | 'gmail';

interface Props { onClose: () => void; }

/* ════════════════════════════════════════════════════════════ */
export default function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('solutions');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">설정</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-800 px-6">
          {([
            { id: 'solutions',  label: '솔루션 관리',  icon: BookOpen      },
            { id: 'inspection', label: '점검 템플릿',   icon: ClipboardList },
            { id: 'gmail',      label: 'Gmail 연동',   icon: Mail          },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'solutions'  && <SolutionsSection onClose={onClose} />}
          {tab === 'inspection' && <InspectionSection />}
          {tab === 'gmail'      && <GmailSection />}
        </div>
      </div>
    </div>
  );
}

/* ── 솔루션 관리 섹션 ── */
function SolutionsSection({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [solutions,        setSolutions]        = useState<Solution[]>([]);
  const [showSolutionModal, setShowSolutionModal] = useState(false);
  const [editingSolution,   setEditingSolution]   = useState<Solution | null>(null);
  const [loading,           setLoading]           = useState(true);

  useEffect(() => { loadSolutions(); }, []);

  const loadSolutions = async () => {
    try {
      const res  = await fetch('/api/solutions', { headers: getAuthHeaders() });
      const data = await res.json();
      setSolutions(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const deleteSolution = async (id: number) => {
    if (!await confirm('이 솔루션을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/solutions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
    loadSolutions();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">솔루션 관리</h3>
          <p className="text-xs text-gray-500 mt-0.5">가이드 템플릿 솔루션을 관리합니다</p>
        </div>
        <button onClick={() => { setEditingSolution(null); setShowSolutionModal(true); }} className="btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" /> 새 솔루션
        </button>
      </div>
      {loading ? <p className="text-xs text-gray-600 py-4 text-center">불러오는 중...</p>
        : solutions.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-xl">
            <p className="text-sm text-gray-500 mb-3">등록된 솔루션이 없습니다</p>
            <button onClick={() => { setEditingSolution(null); setShowSolutionModal(true); }} className="btn-primary text-xs">
              <Plus className="w-3.5 h-3.5" /> 첫 솔루션 추가
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {solutions.map((sol) => (
              <div key={sol.id} className="flex items-center justify-between bg-surface-overlay border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{sol.name}</p>
                  {sol.description && <p className="text-xs text-gray-500 truncate mt-0.5">{sol.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  <button onClick={() => { onClose(); router.push(`/settings/solutions/${sol.id}/guides`); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-brand hover:bg-brand/10 rounded transition-colors">
                    <BookOpen className="w-3.5 h-3.5" /><span>{sol.guide_count}</span><ChevronRight className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setEditingSolution(sol); setShowSolutionModal(true); }}
                    className="p-1.5 text-gray-500 hover:text-brand hover:bg-brand/10 rounded transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteSolution(sol.id)}
                    className="p-1.5 text-gray-500 hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {showSolutionModal && (
        <SolutionFormModal
          solution={editingSolution}
          onClose={() => setShowSolutionModal(false)}
          onSuccess={() => { setShowSolutionModal(false); loadSolutions(); }}
        />
      )}
    </>
  );
}

/* ── 점검 템플릿 섹션 ── */
function InspectionSection() {
  const [templates,      setTemplates]      = useState<Template[]>([]);
  const [showModal,      setShowModal]      = useState(false);
  const [editingTmpl,   setEditingTmpl]    = useState<Template | null>(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const res  = await fetch('/api/inspection-templates', { headers: getAuthHeaders() });
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const deleteTemplate = async (id: number) => {
    if (!await confirm('이 템플릿을 삭제하시겠습니까?')) return;
    await fetch(`/api/inspection-templates/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    loadTemplates();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">점검 템플릿</h3>
          <p className="text-xs text-gray-500 mt-0.5">점검보고서 항목 템플릿을 관리합니다</p>
        </div>
        <button onClick={() => { setEditingTmpl(null); setShowModal(true); }} className="btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" /> 새 템플릿
        </button>
      </div>

      {loading ? <p className="text-xs text-gray-600 py-4 text-center">불러오는 중...</p>
        : templates.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-xl">
            <ClipboardList className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-1">등록된 템플릿이 없습니다</p>
            <p className="text-xs text-gray-600 mb-3">템플릿을 만들면 점검보고서 작성 시 불러올 수 있습니다</p>
            <button onClick={() => { setEditingTmpl(null); setShowModal(true); }} className="btn-primary text-xs">
              <Plus className="w-3.5 h-3.5" /> 첫 템플릿 만들기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-surface-overlay border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.description ? <span className="truncate">{t.description} · </span> : null}
                    <span>항목 {t.item_count}개</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  <button onClick={() => { setEditingTmpl(t); setShowModal(true); }}
                    className="p-1.5 text-gray-500 hover:text-brand hover:bg-brand/10 rounded transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTemplate(t.id)}
                    className="p-1.5 text-gray-500 hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {showModal && (
        <TemplateFormModal
          template={editingTmpl}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadTemplates(); }}
        />
      )}
    </>
  );
}

/* ── Gmail 연동 섹션 ── */
function GmailSection() {
  const [status,      setStatus]      = useState<GmailStatus | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [connecting,  setConnecting]  = useState(false);
  const [syncing,     setSyncing]     = useState(false);

  useEffect(() => {
    gmailApi.status()
      .then(setStatus)
      .catch(() => setStatus({ connected: false, email: null, last_sync: null }))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const { url } = await gmailApi.getAuthUrl();
      window.location.href = url;
    } catch { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!await confirm('Gmail 연동을 해제하시겠습니까?', { title: 'Gmail 연결 해제', danger: true, confirmLabel: '연결 해제' })) return;
    await gmailApi.disconnect();
    setStatus({ connected: false, email: null, last_sync: null });
  };

  const sync = async () => {
    if (!status?.connected || syncing) return;
    setSyncing(true);
    try {
      const res = await gmailApi.sync(100);
      alert(`동기화 완료: ${res.synced}개 새 메일, 총 ${res.total}개 확인`);
      const updated = await gmailApi.status();
      setStatus(updated);
    } catch { alert('동기화 중 오류가 발생했습니다.'); }
    finally { setSyncing(false); }
  };

  if (loading) {
    return <p className="text-xs text-gray-500 py-4 text-center">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">Gmail 연동</h3>
        <p className="text-xs text-gray-500 mt-0.5">Gmail 계정을 연결하여 메일을 자동으로 동기화합니다</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-surface-overlay p-5 space-y-4">
        {/* 상태 표시 */}
        <div className="flex items-center gap-3">
          {status?.connected
            ? <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Wifi className="w-4 h-4 text-green-400" />
              </div>
            : <div className="w-9 h-9 rounded-full bg-gray-700/40 flex items-center justify-center flex-shrink-0">
                <WifiOff className="w-4 h-4 text-gray-500" />
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200">
              {status?.connected ? '연결됨' : '연결되지 않음'}
            </p>
            {status?.connected
              ? <p className="text-xs text-gray-500 truncate">{status.email}</p>
              : <p className="text-xs text-gray-600">Gmail 계정을 연결하세요</p>
            }
          </div>
        </div>

        {/* 마지막 동기화 */}
        {status?.connected && status.last_sync && (
          <div className="text-xs text-gray-600 pl-12">
            마지막 동기화: {new Date(status.last_sync).toLocaleString('ko-KR')}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          {status?.connected ? (
            <>
              <button
                onClick={sync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '동기화 중...' : '지금 동기화'}
              </button>
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                연동 해제
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {connecting ? '연결 중...' : 'Gmail 계정 연결'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 솔루션 폼 모달 ── */
function SolutionFormModal({ solution, onClose, onSuccess }: { solution: Solution | null; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: solution?.name ?? '', description: solution?.description ?? '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = solution ? `/api/solutions/${solution.id}` : '/api/solutions';
      const res = await fetch(url, { method: solution ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(form) });
      if (!res.ok) { alert((await res.json()).detail); return; }
      onSuccess();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-100">{solution ? '솔루션 수정' : '새 솔루션'}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">솔루션 이름 *</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: GrippinTower OTP" autoFocus /></div>
          <div><label className="label">설명</label>
            <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── 점검 템플릿 폼 모달 ── */
function TemplateFormModal({ template, onClose, onSuccess }: { template: Template | null; onClose: () => void; onSuccess: () => void }) {
  const [name,         setName]         = useState(template?.name ?? '');
  const [description,  setDescription]  = useState(template?.description ?? '');
  const [items,        setItems]        = useState<TemplateItem[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [loadingItems, setLoadingItems] = useState(!!template);
  const [parsing,      setParsing]      = useState(false);
  const [pdfFile,      setPdfFile]      = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!template) {
      setItems([
        { category: '서비스', item: 'OTP 인증 서비스 정상 동작', order: 0 },
        { category: '서비스', item: '관리자 콘솔 접속', order: 1 },
        { category: 'DB',    item: 'DB 연결 상태 및 복제 동기화', order: 2 },
        { category: '서버',  item: 'CPU / 메모리 사용률', order: 3 },
        { category: '보안',  item: '로그인 실패 이상 징후', order: 4 },
        { category: '백업',  item: '백업 파일 생성 여부', order: 5 },
      ]);
      return;
    }
    fetch(`/api/inspection-templates/${template.id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoadingItems(false));
  }, [template]);

  const addItem    = () => setItems((p) => [...p, { category: '', item: '', order: p.length }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const setItem    = (i: number, field: keyof TemplateItem, v: string) =>
    setItems((p) => { const n = [...p]; (n[i] as any)[field] = v; return n; });

  const handlePdfUpload = async (file: File) => {
    setPdfFile(file);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/inspection-templates/parse-pdf', { method: 'POST', headers: getAuthHeaders(), body: fd });
      if (!res.ok) { alert((await res.json()).detail); return; }
      const data = await res.json();
      const parsed: TemplateItem[] = (data.items ?? []).map((it: any, idx: number) => ({
        category: it.category ?? '기타',
        item:     it.item ?? '',
        order:    idx,
      }));
      setItems(parsed);
      // 파일명에서 템플릿 이름 자동 채움
      if (!name) setName(file.name.replace(/\.pdf$/i, '').replace(/_/g, ' '));
    } catch { alert('PDF 파싱 중 오류가 발생했습니다'); }
    finally { setParsing(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name, description: description || null, items: items.map((it, idx) => ({ ...it, order: idx })) };
      const url    = template ? `/api/inspection-templates/${template.id}` : '/api/inspection-templates';
      const method = template ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(payload) });
      if (!res.ok) { alert((await res.json()).detail); return; }
      onSuccess();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-surface-raised border border-gray-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-gray-100">{template ? '템플릿 수정' : '새 점검 템플릿'}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* 이름/설명 */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">템플릿 이름 *</label>
                <input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: GrippinTower OTP 점검표" autoFocus /></div>
              <div><label className="label">설명</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="용도 설명" /></div>
            </div>

            {/* PDF 업로드 영역 */}
            <div>
              <label className="label">PDF 점검표 업로드 <span className="text-gray-600 font-normal">(선택 — 항목 자동 추출)</span></label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }}
              />
              <div
                onClick={() => !parsing && fileInputRef.current?.click()}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                  parsing ? 'border-brand/40 bg-brand/5 cursor-wait' : 'border-gray-700 hover:border-brand/50 hover:bg-brand/5'
                }`}
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-5 h-5 text-brand animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-sm text-brand font-medium">PDF 분석 중...</p>
                      <p className="text-xs text-gray-500 mt-0.5">AI가 점검 항목을 추출하고 있습니다</p>
                    </div>
                  </>
                ) : pdfFile ? (
                  <>
                    <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{pdfFile.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">클릭하여 다른 파일로 교체</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-400">PDF 파일을 클릭하여 업로드</p>
                      <p className="text-xs text-gray-600 mt-0.5">업로드하면 AI가 점검 항목을 자동으로 추출합니다</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 점검 항목 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  점검 항목
                  {items.length > 0 && <span className="ml-1.5 text-xs text-gray-500 font-normal">{items.length}개</span>}
                </label>
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-brand hover:underline">
                  <Plus className="w-3 h-3" /> 항목 추가
                </button>
              </div>

              {loadingItems || parsing ? (
                <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">{parsing ? 'PDF에서 항목 추출 중...' : '불러오는 중...'}</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  <div className="grid grid-cols-[100px_1fr_32px] gap-2 px-1 mb-1">
                    <span className="text-[10px] text-gray-600 uppercase tracking-wide">분류</span>
                    <span className="text-[10px] text-gray-600 uppercase tracking-wide">점검 항목</span>
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className="grid grid-cols-[100px_1fr_32px] gap-2 items-center">
                      <input className="input text-xs" value={it.category} onChange={(e) => setItem(i, 'category', e.target.value)} placeholder="분류" />
                      <input className="input text-xs" value={it.item} onChange={(e) => setItem(i, 'item', e.target.value)} placeholder="점검 항목 내용" />
                      <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-600 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && !parsing && (
                    <div className="text-center py-6 border border-dashed border-gray-800 rounded-lg">
                      <p className="text-xs text-gray-600">PDF를 업로드하거나 직접 항목을 추가하세요</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 px-6 pb-6">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
            <button type="submit" disabled={saving || parsing} className="btn-primary flex-1">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
