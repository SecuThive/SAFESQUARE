'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthHeaders } from '@/lib/api';
import {
  Plus, Search, X, Pencil, Trash2, Upload, FileText,
  Building2, Package, Tag, Sparkles, Loader2,
  BookOpen, Wrench, Settings, Layers, HelpCircle,
  ChevronRight, FolderOpen, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

// ── 타입 ─────────────────────────────────────────────────────

type GuideType = 'install' | 'config' | 'operation' | 'troubleshooting' | 'other';

interface VendorGuide {
  id:            number;
  vendor_name:   string;
  solution_name: string;
  title:         string;
  guide_type:    GuideType;
  content:       string | null;
  file_path:     string | null;
  file_name:     string | null;
  tags:          string[];
  created_at:    string;
  updated_at:    string;
}

// ── 가이드 유형 메타 ─────────────────────────────────────────

const TYPE_META: Record<GuideType, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  install:        { label: '설치·구축',   icon: Package,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/25'    },
  config:         { label: '설정·구성',   icon: Settings,     color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25'  },
  operation:      { label: '운영',        icon: Layers,       color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  troubleshooting:{ label: '트러블슈팅',  icon: Wrench,       color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/25'  },
  other:          { label: '기타',        icon: HelpCircle,   color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/25'    },
};

// ── 날짜 포매터 ───────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── 가이드 유형 뱃지 ─────────────────────────────────────────

function TypeBadge({ type }: { type: GuideType }) {
  const m = TYPE_META[type];
  const Icon = m.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border', m.color, m.bg, m.border)}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

// ── Markdown 간단 렌더러 ─────────────────────────────────────

function ContentPreview({ content }: { content: string | null }) {
  if (!content) return <p className="text-xs text-gray-600 italic">내용 없음</p>;
  const lines = content.split('\n').slice(0, 6);
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.startsWith('## ') || line.startsWith('# '))
          return <p key={i} className="text-xs font-semibold text-gray-300">{line.replace(/^#+\s*/, '')}</p>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} className="text-xs text-gray-500 ml-2">· {line.slice(2)}</p>;
        if (line.trim() === '') return null;
        return <p key={i} className="text-xs text-gray-500 leading-relaxed truncate">{line}</p>;
      })}
      {content.split('\n').length > 6 && <p className="text-[10px] text-gray-700">…</p>}
    </div>
  );
}

// ── 모달 ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  vendor_name:   '',
  solution_name: '',
  title:         '',
  guide_type:    'install' as GuideType,
  content:       '',
  tags:          '',
};

interface ModalProps {
  initial:   VendorGuide | null;
  onClose:   () => void;
  onSaved:   (g: VendorGuide) => void;
}

function GuideModal({ initial, onClose, onSaved }: ModalProps) {
  const isEdit = !!initial;
  const [mode,      setMode]      = useState<'text' | 'pdf'>('text');
  const [form,      setForm]      = useState(
    initial
      ? { vendor_name: initial.vendor_name, solution_name: initial.solution_name,
          title: initial.title, guide_type: initial.guide_type,
          content: initial.content ?? '', tags: initial.tags.join(', ') }
      : { ...EMPTY_FORM }
  );
  const [file,      setFile]      = useState<File | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [err,       setErr]       = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // AI 가독성 개선
  async function handleEnhance() {
    const content = form.content.trim();
    if (!content) return;
    setEnhancing(true);
    setForm(f => ({ ...f, content: '' }));
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/vendor-guides/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('AI 개선 실패');
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const { token: tok } = JSON.parse(raw);
            if (tok) setForm(f => ({ ...f, content: f.content + tok }));
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI 개선 실패');
      setForm(f => ({ ...f, content }));
    } finally {
      setEnhancing(false);
    }
  }

  // 텍스트 저장
  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendor_name.trim())   return setErr('벤더사명을 입력해주세요');
    if (!form.solution_name.trim()) return setErr('솔루션명을 입력해주세요');
    if (!form.title.trim())         return setErr('제목을 입력해주세요');
    setSaving(true); setErr('');
    try {
      const url    = isEdit ? `/api/vendor-guides/${initial!.id}` : '/api/vendor-guides';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          vendor_name:   form.vendor_name.trim(),
          solution_name: form.solution_name.trim(),
          title:         form.title.trim(),
          guide_type:    form.guide_type,
          content:       form.content.trim() || null,
          tags:          form.tags.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? '저장 실패'); }
      onSaved(await res.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  // PDF 저장
  async function submitPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!form.vendor_name.trim())   return setErr('벤더사명을 입력해주세요');
    if (!form.solution_name.trim()) return setErr('솔루션명을 입력해주세요');
    if (!form.title.trim())         return setErr('제목을 입력해주세요');
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('vendor_name',   form.vendor_name.trim());
      fd.append('solution_name', form.solution_name.trim());
      fd.append('title',         form.title.trim());
      fd.append('guide_type',    form.guide_type);
      fd.append('tags',          form.tags.trim());
      fd.append('file',          file);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/vendor-guides/upload-pdf', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? 'PDF 업로드 실패'); }
      onSaved(await res.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'PDF 업로드 실패');
    } finally {
      setSaving(false);
    }
  }

  const inputCls  = 'w-full bg-transparent border-b border-gray-700/60 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition-colors';
  const labelCls  = 'block text-xs font-medium text-gray-400 mb-1.5';
  const selectCls = 'w-full bg-[#0d1117] border border-gray-700/60 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/60 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'oklch(0.08 0.005 240 / 0.75)' }}
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-cyan-400 rounded-full" style={{ boxShadow: '0 0 8px rgba(34,211,238,0.6)' }} />
            <div>
              <div className="text-[11px] text-cyan-500/60 tracking-wider mb-0.5">
                {isEdit ? `수정 · #${initial!.id}` : '새 가이드'}
              </div>
              <div className="text-base font-semibold text-gray-100">
                {isEdit ? '벤더 가이드 수정' : '벤더 가이드 등록'}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 px-2.5 py-1.5 rounded transition-colors">
            <X className="w-3.5 h-3.5" /> 닫기
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 신규일 때 모드 선택 */}
          {!isEdit && (
            <div className="flex gap-2">
              {(['text', 'pdf'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm transition-colors',
                    mode === m ? 'border-cyan-500/40 bg-cyan-500/8 text-cyan-300' : 'border-gray-700/60 text-gray-500 hover:border-gray-600',
                  )}>
                  {m === 'text' ? <><FileText className="w-4 h-4" /> 직접 입력</> : <><Upload className="w-4 h-4" /> PDF 업로드</>}
                </button>
              ))}
            </div>
          )}

          {/* 공통 필드 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>벤더사 *</label>
              <input value={form.vendor_name} onChange={set('vendor_name')}
                placeholder="예) Cisco, Palo Alto, 체크포인트" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>솔루션명 *</label>
              <input value={form.solution_name} onChange={set('solution_name')}
                placeholder="예) Firepower IPS, Cortex XDR" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>가이드 제목 *</label>
              <input value={form.title} onChange={set('title')}
                placeholder="예) 초기 구축 가이드 v1.0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>가이드 유형</label>
              <select value={form.guide_type} onChange={set('guide_type')} className={selectCls}>
                {(Object.entries(TYPE_META) as [GuideType, (typeof TYPE_META)[GuideType]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 텍스트 모드 */}
          {(mode === 'text' || isEdit) && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls.replace(' mb-1.5', '')}>내용 (Markdown 지원)</label>
                  <button type="button"
                    disabled={!form.content.trim() || enhancing}
                    onClick={handleEnhance}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    {enhancing
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> 개선 중...</>
                      : <><Sparkles className="w-3 h-3" /> AI 가독성 개선</>}
                  </button>
                </div>
                <textarea value={form.content} onChange={set('content')} rows={12}
                  placeholder={'## 개요\n\n## 구축 전 준비사항\n\n## 설치 절차\n\n1. ...\n2. ...'}
                  className={clsx(inputCls, 'resize-y font-mono text-xs leading-relaxed')} />
              </div>

              <div>
                <label className={labelCls}>태그 (쉼표 구분, 선택)</label>
                <input value={form.tags} onChange={set('tags')}
                  placeholder="예) 방화벽, IPS, 네트워크보안" className={inputCls} />
              </div>

              {err && (
                <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 rounded"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {err}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2"
                style={{ borderTop: '1px solid var(--border-soft)' }}>
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700 rounded transition-colors">
                  취소
                </button>
                <button onClick={submitText} disabled={saving} className="btn btn-primary disabled:opacity-30">
                  {saving ? '저장 중...' : isEdit ? '수정 완료' : '저장'}
                </button>
              </div>
            </>
          )}

          {/* PDF 모드 */}
          {mode === 'pdf' && !isEdit && (
            <>
              <div>
                <label className={labelCls}>PDF 파일</label>
                <div className="border-2 border-dashed border-gray-700/60 rounded-xl p-8 text-center hover:border-cyan-500/30 transition-colors">
                  <input type="file" accept=".pdf" id="vg-pdf"
                    onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
                  <label htmlFor="vg-pdf" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    {file ? (
                      <>
                        <p className="text-sm text-cyan-400">{file.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500">PDF 파일을 선택하세요</p>
                        <p className="text-xs text-gray-700 mt-1">클릭하거나 드래그하여 업로드</p>
                      </>
                    )}
                  </label>
                </div>
                <p className="text-[11px] text-gray-700 mt-1.5">✨ PDF 텍스트를 자동 추출하여 가이드를 생성합니다</p>
              </div>

              <div>
                <label className={labelCls}>태그 (쉼표 구분, 선택)</label>
                <input value={form.tags} onChange={set('tags')}
                  placeholder="예) 방화벽, IPS, 네트워크보안" className={inputCls} />
              </div>

              {err && (
                <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 rounded"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {err}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2"
                style={{ borderTop: '1px solid var(--border-soft)' }}>
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700 rounded transition-colors">
                  취소
                </button>
                <button onClick={submitPdf} disabled={saving || !file} className="btn btn-primary disabled:opacity-30">
                  {saving ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 상세 패널 ─────────────────────────────────────────────────

function DetailPanel({ guide, onEdit, onDelete, onClose }: {
  guide: VendorGuide;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const lines = (guide.content ?? '').split('\n');
  const elements: React.ReactNode[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;

  const flushCode = (key: string) => {
    if (!codeBuffer.length) return;
    elements.push(
      <pre key={key}
        className="bg-black/40 border border-gray-800 rounded p-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre my-2">
        {codeBuffer.join('\n')}
      </pre>
    );
    codeBuffer = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCode) { flushCode(`c${i}`); inCode = false; } else { inCode = true; }
      return;
    }
    if (inCode) { codeBuffer.push(line); return; }
    if (/^\d+\./.test(line)) {
      const text = line.replace(/^\d+\.\s*/, '');
      elements.push(
        <div key={i} className="flex gap-3 items-start py-1">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold text-cyan-400 flex items-center justify-center mt-0.5">
            {elements.filter(e => (e as any)?.props?.className?.includes('rounded-full')).length + 1}
          </span>
          <span className="text-sm text-gray-200 leading-relaxed flex-1">{text}</span>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 items-start py-0.5 ml-4">
          <span className="flex-shrink-0 w-1 h-1 rounded-full bg-gray-500 mt-2" />
          <span className="text-sm text-gray-300 leading-relaxed">{line.slice(2)}</span>
        </div>
      );
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="text-sm font-semibold text-gray-200 mt-4 mb-1">{line.slice(3)}</p>);
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="text-base font-bold text-gray-100 mt-4 mb-1">{line.slice(2)}</p>);
    } else if (line.startsWith('### ')) {
      elements.push(<p key={i} className="text-sm font-semibold text-gray-300 mt-3 mb-1">{line.slice(4)}</p>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-sm text-gray-300 leading-relaxed py-0.5">{line}</p>);
    }
  });
  if (inCode) flushCode('ce');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TypeBadge type={guide.guide_type} />
            {guide.file_name && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 border border-gray-700/50 px-1.5 py-0.5 rounded">
                <FileText className="w-3 h-3" /> PDF
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-gray-100 leading-snug">{guide.title}</h2>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-gray-600" />{guide.vendor_name}</span>
            <span className="text-gray-700">/</span>
            <span className="flex items-center gap-1"><Package className="w-3 h-3 text-gray-600" />{guide.solution_name}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-16 md:pb-4">
        {guide.content
          ? <div className="space-y-0.5">{elements}</div>
          : <p className="text-sm text-gray-600 italic">내용이 없습니다.</p>
        }
        {guide.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
            {guide.tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                <Tag className="w-2.5 h-2.5" />{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span className="text-[11px] text-gray-700">{fmtDate(guide.updated_at)}</span>
        <div className="flex gap-2">
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 px-2.5 py-1.5 rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> 삭제
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-cyan-500 border border-cyan-500/25 hover:border-cyan-400/50 hover:bg-cyan-500/8 px-2.5 py-1.5 rounded transition-colors">
            <Pencil className="w-3.5 h-3.5" /> 수정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function VendorGuidesPage() {
  const [guides,        setGuides]        = useState<VendorGuide[]>([]);
  const [vendors,       setVendors]       = useState<string[]>([]);
  const [selectedVendor,setSelectedVendor]= useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<VendorGuide | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<VendorGuide | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [gRes, vRes] = await Promise.all([
        fetch('/api/vendor-guides', { headers: getAuthHeaders() }),
        fetch('/api/vendor-guides/vendors', { headers: getAuthHeaders() }),
      ]);
      setGuides(gRes.ok ? await gRes.json() : []);
      setVendors(vRes.ok ? await vRes.json() : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleDelete(id: number) {
    if (!await confirm('가이드를 삭제하시겠습니까?')) return;
    await fetch(`/api/vendor-guides/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setGuides(prev => prev.filter(g => g.id !== id));
    setVendors(prev => {
      const remaining = guides.filter(g => g.id !== id);
      return [...new Set(remaining.map(g => g.vendor_name))].sort();
    });
    if (selectedGuide?.id === id) setSelectedGuide(null);
  }

  function handleSaved(g: VendorGuide) {
    setGuides(prev => {
      const idx = prev.findIndex(x => x.id === g.id);
      return idx >= 0 ? prev.map(x => x.id === g.id ? g : x) : [g, ...prev];
    });
    setVendors(prev => prev.includes(g.vendor_name) ? prev : [...prev, g.vendor_name].sort());
    setShowModal(false);
    setEditTarget(null);
    setSelectedGuide(g);
  }

  // 필터링
  const filtered = guides.filter(g => {
    if (selectedVendor && g.vendor_name !== selectedVendor) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        g.title.toLowerCase().includes(q) ||
        g.vendor_name.toLowerCase().includes(q) ||
        g.solution_name.toLowerCase().includes(q) ||
        g.content?.toLowerCase().includes(q) ||
        g.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // 벤더별 그룹핑
  const grouped = filtered.reduce<Record<string, VendorGuide[]>>((acc, g) => {
    (acc[g.vendor_name] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />

      <div className="flex-1 flex min-w-0 overflow-hidden">

        {/* ── 왼쪽: 벤더 필터 패널 ─────────────────────────── */}
        <aside className="hidden md:flex w-56 flex-shrink-0 flex-col overflow-hidden"
          style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-soft)' }}>

          {/* 상단 헤더 */}
          <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <div className="flex items-center gap-2 mb-0.5">
              <FolderOpen className="w-4 h-4 text-cyan-500/70" />
              <span className="text-xs font-semibold text-gray-300 tracking-wide">벤더 가이드</span>
            </div>
            <p className="text-[10px] text-gray-600 ml-6">솔루션 구축·운영 가이드</p>
          </div>

          {/* 벤더 목록 */}
          <nav className="flex-1 overflow-y-auto py-2">
            <button
              onClick={() => setSelectedVendor(null)}
              className={clsx(
                'w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors',
                !selectedVendor
                  ? 'text-cyan-300 bg-cyan-500/8'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]',
              )}>
              <Layers className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left">전체 보기</span>
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full',
                !selectedVendor ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-600')}>
                {guides.length}
              </span>
            </button>

            {vendors.length > 0 && (
              <div className="mx-4 my-2 border-t border-gray-800/60" />
            )}

            {vendors.map(v => {
              const count = guides.filter(g => g.vendor_name === v).length;
              const isActive = selectedVendor === v;
              return (
                <button key={v}
                  onClick={() => setSelectedVendor(isActive ? null : v)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors',
                    isActive
                      ? 'text-cyan-300 bg-cyan-500/8'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]',
                  )}>
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
                  <span className="flex-1 text-left truncate">{v}</span>
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0',
                    isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-600')}>
                    {count}
                  </span>
                </button>
              );
            })}

            {vendors.length === 0 && !loading && (
              <p className="text-[11px] text-gray-700 text-center mt-8 px-4">
                등록된 벤더사가 없습니다
              </p>
            )}
          </nav>

          {/* 등록 버튼 */}
          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => { setEditTarget(null); setShowModal(true); }}
              className="btn btn-primary w-full flex items-center justify-center gap-1.5 py-2 text-xs">
              <Plus className="w-3.5 h-3.5" /> 가이드 등록
            </button>
          </div>
        </aside>

        {/* ── 가운데: 가이드 목록 ── 모바일: 선택 시 숨김 */}
        <div className={clsx(
          'flex flex-col overflow-hidden',
          selectedGuide
            ? 'hidden md:flex md:w-80 md:flex-shrink-0'
            : 'flex flex-1',
        )}>

          {/* 검색 바 */}
          <div className="flex-shrink-0 px-4 py-3"
            style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-raised)' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="제목, 벤더사, 솔루션, 내용 검색..."
                className="w-full pl-8 pr-8 py-2 text-xs bg-transparent border border-gray-700/50 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-gray-600">
                {selectedVendor ? <><span className="text-cyan-500/70">{selectedVendor}</span> · </> : ''}
                {filtered.length}개
              </p>
            </div>
          </div>

          {/* 가이드 카드 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 pb-16 md:pb-3">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <FolderOpen className="w-10 h-10 text-gray-700" />
                <p className="text-sm text-gray-600">
                  {search || selectedVendor ? '검색 결과가 없습니다' : '등록된 가이드가 없습니다'}
                </p>
                {!search && !selectedVendor && (
                  <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 border border-cyan-500/25 px-3 py-1.5 rounded-lg hover:bg-cyan-500/8 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> 첫 가이드 등록
                  </button>
                )}
              </div>
            ) : (
              Object.entries(grouped).map(([vendor, items]) => (
                <div key={vendor}>
                  {/* 벤더 그룹 헤더 */}
                  {!selectedVendor && (
                    <div className="flex items-center gap-2 px-1 mb-2">
                      <Building2 className="w-3 h-3 text-gray-600" />
                      <span className="text-xs font-semibold text-gray-400">{vendor}</span>
                      <span className="text-[10px] text-gray-700 bg-gray-800 px-1.5 py-0.5 rounded-full">{items.length}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {items.map(g => {
                      const isActive = selectedGuide?.id === g.id;
                      return (
                        <button key={g.id} onClick={() => setSelectedGuide(isActive ? null : g)}
                          className={clsx(
                            'w-full text-left rounded-lg p-3 transition-colors border',
                            isActive
                              ? 'border-cyan-500/30 bg-cyan-500/5'
                              : 'border-gray-800/60 hover:border-gray-700/80 hover:bg-white/[0.02]',
                          )}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <TypeBadge type={g.guide_type} />
                            {g.file_name && <FileText className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />}
                          </div>
                          <p className="text-sm font-medium text-gray-200 leading-snug mb-1 line-clamp-2">{g.title}</p>
                          <p className="text-[11px] text-gray-600 mb-2">{g.solution_name}</p>
                          <ContentPreview content={g.content} />
                          {g.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {g.tags.slice(0, 3).map(t => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-600">{t}</span>
                              ))}
                              {g.tags.length > 3 && <span className="text-[10px] text-gray-700">+{g.tags.length - 3}</span>}
                            </div>
                          )}
                          <p className="text-[10px] text-gray-700 mt-2">{fmtDate(g.updated_at)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── 오른쪽: 상세 패널 ──────────────────────────────── */}
        {selectedGuide && (
          <div className="flex-1 overflow-hidden"
            style={{ borderLeft: '1px solid var(--border-soft)' }}>
            <DetailPanel
              guide={selectedGuide}
              onEdit={() => { setEditTarget(selectedGuide); setShowModal(true); }}
              onDelete={() => handleDelete(selectedGuide.id)}
              onClose={() => setSelectedGuide(null)}
            />
          </div>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <GuideModal
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
