'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { workMethodsApi, WorkMethod, WorkMethodStep } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import {
  Plus, Pencil, Trash2, Search, X, Check, Loader2,
  ChevronDown, ChevronUp, ListChecks, Tag,
  BookOpen, Sparkles, RefreshCw, AlertCircle,
  Share2, Copy, Link, Link2Off, Terminal, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/* ── 타입 ────────────────────────────────────────────────────────────── */
interface ModalState { open: boolean; method: WorkMethod | null; }

/* ── 상수 ───────────────────────────────────────────────────────────── */
const PRESET_CATEGORIES = ['개발', '배포', '보안', '장애대응', '문서화', '테스트', '운영'];

function tagsToString(tags: string[]): string { return tags.join(', '); }

/* ── 코드블록 ────────────────────────────────────────────────────────── */
function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCopy(text));
  } else {
    execCopy(text);
  }
}

function execCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try { document.execCommand('copy'); } catch { /* ignore */ }
  document.body.removeChild(el);
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={{ background: 'oklch(0.09 0.010 250)', border: '1px solid oklch(0.20 0.010 240)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: 'oklch(0.12 0.010 248)', borderBottom: '1px solid oklch(0.18 0.010 242)' }}
      >
        <div className="flex items-center gap-1.5 text-gray-600">
          <Terminal className="w-3 h-3" />
          <span className="text-[10px] font-medium">스크립트</span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all"
          style={{ color: copied ? 'oklch(0.76 0.16 142)' : 'var(--text-muted)' }}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre
        className="px-3 py-2.5 overflow-x-auto leading-relaxed"
        style={{ color: 'oklch(0.78 0.040 215)', fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {code}
      </pre>
    </div>
  );
}

/* ── 스텝 에디터 ─────────────────────────────────────────────────────── */
function StepsEditor({ steps, onChange }: { steps: WorkMethodStep[]; onChange: (s: WorkMethodStep[]) => void }) {
  const [openScript, setOpenScript] = useState<Set<number>>(new Set());

  function addStep() {
    onChange([...steps, { order: steps.length + 1, content: '', script: '' }]);
    setOpenScript(prev => new Set([...prev, steps.length]));
  }
  function updateStep(idx: number, patch: Partial<WorkMethodStep>) {
    onChange(steps.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function removeStep(idx: number) {
    onChange(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }
  function moveStep(idx: number, dir: -1 | 1) {
    const t = idx + dir;
    if (t < 0 || t >= steps.length) return;
    const next = [...steps];
    [next[idx], next[t]] = [next[t], next[idx]];
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
  }
  function toggleScript(idx: number) {
    setOpenScript(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={idx} className="rounded-lg overflow-hidden" style={{ border: '1px solid oklch(0.22 0.010 238)' }}>
          {/* 단계 헤더 */}
          <div className="flex items-start gap-2 px-3 py-2" style={{ background: 'oklch(0.15 0.010 244)' }}>
            <div className="flex flex-col gap-0.5 pt-1.5 flex-shrink-0">
              <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <span className="flex-shrink-0 w-5 h-5 mt-1.5 flex items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: 'oklch(0.22 0.014 232)', color: 'var(--accent)' }}>
              {idx + 1}
            </span>
            <textarea
              value={step.content}
              onChange={e => updateStep(idx, { content: e.target.value })}
              rows={2}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-sm resize-none"
              style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'var(--text-primary)' }}
              placeholder={`${idx + 1}단계 내용...`}
            />
            <div className="flex items-center gap-1 pt-1 flex-shrink-0">
              <button type="button" onClick={() => toggleScript(idx)}
                className={clsx('flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-all',
                  openScript.has(idx) ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300')}
                title="스크립트 편집"
                style={openScript.has(idx) ? { background: 'oklch(0.84 0.16 82 / 0.12)', border: '1px solid oklch(0.62 0.12 82 / 0.25)' }
                  : { background: 'oklch(0.17 0.010 244)' }}>
                <Terminal className="w-3 h-3" />
                <span>스크립트</span>
              </button>
              <button type="button" onClick={() => removeStep(idx)}
                className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* 스크립트 편집 영역 */}
          {openScript.has(idx) && (
            <div className="px-3 pb-3 pt-2" style={{ background: 'oklch(0.11 0.010 248)', borderTop: '1px solid oklch(0.18 0.010 242)' }}>
              <textarea
                value={step.script ?? ''}
                onChange={e => updateStep(idx, { script: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 rounded-lg text-xs resize-y"
                style={{
                  background: 'oklch(0.09 0.010 250)',
                  border: '1px solid oklch(0.22 0.010 238)',
                  color: 'oklch(0.78 0.040 215)',
                  fontFamily: 'ui-monospace, monospace',
                }}
                placeholder="# 이 단계에서 실행할 스크립트를 입력하세요&#10;# 예: shell 명령어, SQL, Python 코드 등"
              />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addStep}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
        style={{ background: 'oklch(0.16 0.010 242)', border: '1px dashed oklch(0.30 0.012 234)', color: 'var(--text-muted)' }}>
        <Plus className="w-3 h-3" />
        단계 추가
      </button>
    </div>
  );
}

/* ── 카테고리 칩 ─────────────────────────────────────────────────────── */
function CategoryChips({ value, categories, onChange }: { value: string; categories: string[]; onChange: (v: string) => void }) {
  const all = [...new Set([...PRESET_CATEGORIES, ...categories])];
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {all.map(c => (
          <button key={c} type="button" onClick={() => onChange(value === c ? '' : c)}
            className="px-2.5 py-1 rounded-full text-xs transition-all"
            style={value === c
              ? { background: 'oklch(0.76 0.16 196 / 0.20)', border: '1px solid oklch(0.55 0.12 196 / 0.40)', color: 'var(--accent)' }
              : { background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'oklch(0.55 0.010 230)' }}>
            {c}
          </button>
        ))}
      </div>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'var(--text-primary)' }}
        placeholder="직접 입력 또는 위에서 선택" />
    </>
  );
}

/* ── 공유 모달 ───────────────────────────────────────────────────────── */
function ShareModal({ method, onClose, onUpdate }: { method: WorkMethod; onClose: () => void; onUpdate: (m: WorkMethod) => void }) {
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  const shareUrl = method.share_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/work-methods/share/${method.share_token}`
    : null;

  async function handleGenerate() {
    setLoading(true);
    try {
      const { share_token } = await workMethodsApi.createShare(method.id);
      onUpdate({ ...method, share_token });
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    const ok = await confirm('공유 링크를 삭제하면 해당 링크로 접근할 수 없게 됩니다. 삭제할까요?');
    if (!ok) return;
    setLoading(true);
    try {
      await workMethodsApi.revokeShare(method.id);
      onUpdate({ ...method, share_token: null });
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text: string) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.focus();
    el.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(el);
  }

  function handleCopy() {
    if (!shareUrl) return;
    copyText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'oklch(0.13 0.010 246)', border: '1px solid oklch(0.22 0.010 238)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}>
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold text-gray-200">작업 방법 공유</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            공유 링크를 생성하면 <strong className="text-gray-400">로그인 없이</strong> 누구나 이 작업 방법을 볼 수 있습니다.
            링크는 언제든지 삭제할 수 있습니다.
          </p>

          {shareUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.26 0.012 234)' }}>
                <Link className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                <span className="flex-1 text-xs text-gray-400 truncate font-mono">{shareUrl}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.30)', color: 'var(--accent)' }}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '복사됨!' : '링크 복사'}
                </button>
                <button onClick={handleRevoke} disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  style={{ background: 'oklch(0.18 0.010 242)', border: '1px solid oklch(0.26 0.010 236)', color: 'oklch(0.65 0.12 25)' }}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                  링크 삭제
                </button>
              </div>
            </div>
          ) : (
            <button onClick={handleGenerate} disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.30)', color: 'var(--accent)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
              공유 링크 생성
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 작업 방법 모달 ──────────────────────────────────────────────────── */
function MethodModal({ method, categories, onClose, onSave }: {
  method: WorkMethod | null; categories: string[]; onClose: () => void; onSave: (m: WorkMethod) => void;
}) {
  const [title,       setTitle]       = useState(method?.title ?? '');
  const [category,    setCategory]    = useState(method?.category ?? '');
  const [description, setDescription] = useState(method?.description ?? '');
  const [steps,       setSteps]       = useState<WorkMethodStep[]>(method?.steps ?? []);
  const [tags,        setTags]        = useState(method ? tagsToString(method.tags) : '');
  const [saving,      setSaving]      = useState(false);

  const [aiRequest,   setAiRequest]   = useState('');
  const [aiStreaming, setAiStreaming]  = useState(false);
  const [aiPreview,   setAiPreview]   = useState('');
  const [aiError,     setAiError]     = useState('');
  const [aiDone,      setAiDone]      = useState(false);

  const titleRef   = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function handleAiGenerate() {
    if (!aiRequest.trim()) { aiInputRef.current?.focus(); return; }
    setAiStreaming(true); setAiPreview(''); setAiError(''); setAiDone(false);
    try {
      const res = await workMethodsApi.aiGenerate(aiRequest.trim(), category.trim() || undefined);
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: { title?: string; description?: string; steps?: WorkMethodStep[] } | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'token') setAiPreview(prev => prev + evt.content);
            else if (evt.type === 'done') finalResult = evt.result;
          } catch { /* ignore */ }
        }
      }
      if (finalResult) {
        if (finalResult.title)         setTitle(finalResult.title);
        if (finalResult.description)   setDescription(finalResult.description);
        if (finalResult.steps?.length) setSteps(finalResult.steps);
        setAiPreview(''); setAiDone(true);
      } else {
        setAiError('AI 응답을 파싱하지 못했습니다. 직접 수정해 주세요.');
      }
    } catch {
      setAiError('AI 생성 중 오류가 발생했습니다.');
    } finally {
      setAiStreaming(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = { title: title.trim(), category: category.trim() || null, description: description.trim(), steps, tags: tags.trim() || null };
      const saved = method ? await workMethodsApi.update(method.id, payload) : await workMethodsApi.create(payload);
      onSave(saved);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'oklch(0.13 0.010 246)', border: '1px solid oklch(0.22 0.010 238)' }}>

        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}>
          <h2 className="text-sm font-semibold text-gray-200">{method ? '작업 방법 수정' : '새 작업 방법 추가'}</h2>
          <button onClick={onClose} className="p-1 text-gray-600 hover:text-gray-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* ── AI 생성 ── */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'oklch(0.76 0.16 196 / 0.05)', border: '1px solid oklch(0.55 0.12 196 / 0.20)' }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>AI 자동 생성</span>
              <span className="text-[10px] text-gray-600 ml-1">— 카테고리 선택 후 원하는 작업 방법을 입력하세요</span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">카테고리</label>
              <CategoryChips value={category} categories={categories} onChange={setCategory} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">어떤 작업 방법이 필요하신가요?</label>
              <div className="flex gap-2">
                <textarea ref={aiInputRef} value={aiRequest} onChange={e => setAiRequest(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAiGenerate(); } }}
                  rows={2} disabled={aiStreaming}
                  className="flex-1 px-3 py-2 rounded-lg text-sm resize-none disabled:opacity-50"
                  style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.26 0.012 234)', color: 'var(--text-primary)' }}
                  placeholder={`예) 서버 장애 초기 대응 절차${category ? ` (${category})` : ''}\n⌘+Enter로 생성`} />
                <button type="button" onClick={handleAiGenerate} disabled={aiStreaming || !aiRequest.trim()}
                  className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                  style={{ background: aiStreaming ? 'oklch(0.76 0.16 196 / 0.08)' : 'oklch(0.76 0.16 196 / 0.15)', border: '1px solid oklch(0.55 0.12 196 / 0.35)', color: 'var(--accent)', minWidth: 64 }}>
                  {aiStreaming ? <><Loader2 className="w-4 h-4 animate-spin" /><span>생성 중</span></> : <><Sparkles className="w-4 h-4" /><span>생성</span></>}
                </button>
              </div>
            </div>

            {aiStreaming && aiPreview && (
              <div className="rounded-lg px-3 py-2 text-xs font-mono leading-relaxed max-h-28 overflow-y-auto"
                style={{ background: 'oklch(0.11 0.010 248)', border: '1px solid oklch(0.22 0.010 236)', color: 'oklch(0.65 0.010 230)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {aiPreview}<span className="inline-block w-1.5 h-3.5 bg-current align-middle ml-0.5 animate-pulse" />
              </div>
            )}
            {aiError && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{aiError}
              </div>
            )}
            {aiDone && !aiStreaming && (
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <Check className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                아래 내용이 자동 채워졌습니다. 필요하면 수정하세요.
                <button type="button" onClick={() => { setAiRequest(''); setTitle(''); setDescription(''); setSteps([]); setAiDone(false); }}
                  className="ml-auto flex items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors">
                  <RefreshCw className="w-3 h-3" /> 초기화
                </button>
              </div>
            )}
          </div>

          {/* ── 수동 폼 ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">제목 *</label>
              <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'var(--text-primary)' }}
                placeholder="작업 방법 이름" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">설명</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'var(--text-primary)' }}
                placeholder="이 작업 방법에 대한 간략한 설명" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">작업 단계</label>
              <StepsEditor steps={steps} onChange={setSteps} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">태그</label>
              <input value={tags} onChange={e => setTags(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'var(--text-primary)' }}
                placeholder="쉼표로 구분 (예: 긴급, 반복작업)" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-colors"
                style={{ background: 'oklch(0.18 0.010 242)', border: '1px solid oklch(0.26 0.010 236)' }}>
                취소
              </button>
              <button type="submit" disabled={saving || !title.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'oklch(0.76 0.16 196 / 0.15)', border: '1px solid oklch(0.55 0.12 196 / 0.35)', color: 'var(--accent)' }}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── 카드 ────────────────────────────────────────────────────────────── */
function MethodCard({ method, onEdit, onDelete, onShare, onUpdate }: {
  method: WorkMethod;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onUpdate: (m: WorkMethod) => void;
}) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  function toggleStep(idx: number) {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  const hasAnyScript = method.steps.some(s => s.script?.trim());

  return (
    <div className="rounded-xl overflow-hidden flex flex-col transition-all"
      style={{ background: 'oklch(0.13 0.010 246)', border: '1px solid oklch(0.20 0.010 240)' }}>

      {/* 카드 헤더 */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.25)' }}>
          <ListChecks className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-200 truncate">{method.title}</h3>
            {method.category && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                style={{ background: 'oklch(0.22 0.014 232)', color: 'var(--accent)', border: '1px solid oklch(0.32 0.012 228 / 0.40)' }}>
                {method.category}
              </span>
            )}
            {method.share_token && (
              <span className="px-2 py-0.5 rounded-full text-[10px] flex-shrink-0 flex items-center gap-1"
                style={{ background: 'oklch(0.22 0.14 142 / 0.15)', color: 'oklch(0.76 0.16 142)', border: '1px solid oklch(0.55 0.12 142 / 0.25)' }}>
                <Link className="w-2.5 h-2.5" /> 공유 중
              </span>
            )}
          </div>
          {method.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{method.description}</p>}
          {method.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Tag className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
              {method.tags.map(t => <span key={t} className="text-[10px] text-gray-600">{t}</span>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onShare} title="공유"
            className="p-1.5 transition-colors rounded-md hover:bg-white/5"
            style={{ color: method.share_token ? 'oklch(0.76 0.16 142)' : 'oklch(0.45 0.010 230)' }}>
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit} title="수정"
            className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors rounded-md hover:bg-white/5">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} title="삭제"
            className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 단계 목록 */}
      {method.steps.length > 0 && (
        <div className="flex-1" style={{ borderTop: '1px solid oklch(0.17 0.010 240)' }}>
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600">{method.steps.length}단계</span>
            {hasAnyScript && (
              <span className="flex items-center gap-1 text-[10px]"
                style={{ color: 'oklch(0.70 0.10 82)' }}>
                <Terminal className="w-2.5 h-2.5" /> 스크립트 포함
              </span>
            )}
          </div>
          <div className="space-y-px px-2 pb-2">
            {method.steps.map((step, idx) => {
              const isOpen = expandedSteps.has(idx);
              const hasScript = Boolean(step.script?.trim());
              return (
                <div key={idx} className="rounded-lg overflow-hidden"
                  style={{ background: isOpen ? 'oklch(0.12 0.010 248)' : 'transparent', border: `1px solid ${isOpen ? 'oklch(0.22 0.010 238)' : 'transparent'}` }}>
                  <button
                    onClick={() => toggleStep(idx)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all group"
                    style={{ background: isOpen ? 'oklch(0.15 0.010 244)' : 'oklch(0.15 0.010 244 / 0)', }}
                    onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'oklch(0.15 0.010 244)'; }}
                    onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'oklch(0.15 0.010 244 / 0)'; }}
                  >
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: 'oklch(0.20 0.014 232)', color: 'var(--accent)' }}>
                      {step.order}
                    </span>
                    <span className="flex-1 text-xs text-gray-400 leading-relaxed text-left">{step.content}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hasScript && (
                        <span className="w-4 h-4 flex items-center justify-center rounded"
                          style={{ background: 'oklch(0.84 0.16 82 / 0.12)', color: 'oklch(0.84 0.16 82)' }}>
                          <Terminal className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <ChevronRight className={clsx('w-3.5 h-3.5 text-gray-600 transition-transform', isOpen && 'rotate-90')} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 space-y-2">
                      {step.script?.trim() ? (
                        <CodeBlock code={step.script} />
                      ) : (
                        <p className="text-[11px] text-gray-600 italic">이 단계에 등록된 스크립트가 없습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="px-4 py-2" style={{ borderTop: '1px solid oklch(0.17 0.010 240)' }}>
        <span className="text-[10px] text-gray-600">
          {format(new Date(method.updated_at), 'yyyy.MM.dd HH:mm', { locale: ko })} 수정
        </span>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────────────────── */
export default function WorkMethodsPage() {
  const [methods,    setMethods]    = useState<WorkMethod[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('');
  const [modal,      setModal]      = useState<ModalState>({ open: false, method: null });
  const [shareTarget, setShareTarget] = useState<WorkMethod | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ms, cats] = await Promise.all([
        workMethodsApi.list({ category: catFilter || undefined, search: search || undefined }),
        workMethodsApi.categories(),
      ]);
      setMethods(ms);
      setCategories(cats);
    } finally { setLoading(false); }
  }, [catFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    const ok = await confirm('이 작업 방법을 삭제할까요?');
    if (!ok) return;
    await workMethodsApi.delete(id);
    setMethods(prev => prev.filter(m => m.id !== id));
  }

  function handleSave(saved: WorkMethod) {
    setMethods(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      return idx >= 0 ? prev.map(m => m.id === saved.id ? saved : m) : [saved, ...prev];
    });
    setModal({ open: false, method: null });
    workMethodsApi.categories().then(setCategories).catch(() => {});
  }

  function handleMethodUpdate(updated: WorkMethod) {
    setMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
    setShareTarget(updated);
  }

  const allCategories = [...new Set([...PRESET_CATEGORIES, ...categories])];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* 헤더 */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.25)' }}>
              <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-200">작업 방법 관리</h1>
              <p className="text-[11px] text-gray-600">반복 작업의 절차와 방법을 체계적으로 관리</p>
            </div>
          </div>
          <button onClick={() => setModal({ open: true, method: null })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'oklch(0.76 0.16 196 / 0.12)', border: '1px solid oklch(0.55 0.12 196 / 0.30)', color: 'var(--accent)' }}>
            <Plus className="w-4 h-4" />
            새 작업 방법
          </button>
        </header>

        {/* 필터 바 */}
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 flex-wrap"
          style={{ borderBottom: '1px solid oklch(0.18 0.010 240)' }}>
          <div className="relative flex items-center" style={{ minWidth: 200 }}>
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs w-full"
              style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.24 0.010 236)', color: 'var(--text-primary)' }}
              placeholder="제목 또는 설명 검색..." />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 text-gray-600 hover:text-gray-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setCatFilter('')}
              className="px-2.5 py-1 rounded-full text-xs transition-all"
              style={!catFilter
                ? { background: 'oklch(0.76 0.16 196 / 0.18)', border: '1px solid oklch(0.55 0.12 196 / 0.35)', color: 'var(--accent)' }
                : { background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.22 0.010 236)', color: 'oklch(0.50 0.010 230)' }}>
              전체
            </button>
            {allCategories.map(c => (
              <button key={c} onClick={() => setCatFilter(prev => prev === c ? '' : c)}
                className="px-2.5 py-1 rounded-full text-xs transition-all"
                style={catFilter === c
                  ? { background: 'oklch(0.76 0.16 196 / 0.18)', border: '1px solid oklch(0.55 0.12 196 / 0.35)', color: 'var(--accent)' }
                  : { background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.22 0.010 236)', color: 'oklch(0.50 0.010 230)' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            </div>
          ) : methods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'oklch(0.16 0.010 242)', border: '1px solid oklch(0.22 0.010 236)' }}>
                <BookOpen className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-sm text-gray-500">
                {search || catFilter ? '검색 결과가 없습니다' : '아직 등록된 작업 방법이 없습니다'}
              </p>
              {!search && !catFilter && (
                <button onClick={() => setModal({ open: true, method: null })}
                  className="mt-3 text-xs transition-colors" style={{ color: 'var(--accent)' }}>
                  첫 번째 작업 방법 추가하기 →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {methods.map(m => (
                <MethodCard
                  key={m.id}
                  method={m}
                  onEdit={() => setModal({ open: true, method: m })}
                  onDelete={() => handleDelete(m.id)}
                  onShare={() => setShareTarget(m)}
                  onUpdate={handleMethodUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {modal.open && (
        <MethodModal
          method={modal.method}
          categories={categories}
          onClose={() => setModal({ open: false, method: null })}
          onSave={handleSave}
        />
      )}

      {shareTarget && (
        <ShareModal
          method={shareTarget}
          onClose={() => setShareTarget(null)}
          onUpdate={handleMethodUpdate}
        />
      )}
    </div>
  );
}
