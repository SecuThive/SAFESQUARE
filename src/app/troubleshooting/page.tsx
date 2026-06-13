'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthHeaders } from '@/lib/api';
import {
  Plus, Search, X, Pencil, Trash2,
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  ChevronRight, Tag, Building2, Package, Wrench,
  Shield, Wifi, Database, Gauge, Settings, HelpCircle,
  Sparkles, Loader2,
} from 'lucide-react';
import clsx from 'clsx';

// ── 타입 ─────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Category = 'auth' | 'network' | 'db' | 'performance' | 'install' | 'config' | 'other';

interface Guide {
  id:            number;
  partner_name:  string;
  solution_name: string;
  category:      Category;
  severity:      Severity;
  symptom:       string;
  cause:         string | null;
  steps:         string;
  tags:          string[];
  created_at:    string;
  updated_at:    string;
}

// ── 메타 ─────────────────────────────────────────────────────

const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  critical: { label: '긴급',   color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: AlertCircle   },
  high:     { label: '높음',   color: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertTriangle },
  medium:   { label: '중간',   color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: Info          },
  low:      { label: '낮음',   color: 'text-emerald-300',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',icon: CheckCircle2  },
};

const CATEGORY_META: Record<Category, { label: string; icon: React.ElementType; color: string }> = {
  auth:        { label: '인증/권한',  icon: Shield,      color: 'text-purple-400' },
  network:     { label: '네트워크',  icon: Wifi,        color: 'text-cyan-400'   },
  db:          { label: '데이터베이스', icon: Database,  color: 'text-blue-400'  },
  performance: { label: '성능',      icon: Gauge,       color: 'text-yellow-400' },
  install:     { label: '설치/배포', icon: Package,     color: 'text-green-400'  },
  config:      { label: '설정',      icon: Settings,    color: 'text-gray-400'   },
  other:       { label: '기타',      icon: HelpCircle,  color: 'text-gray-500'   },
};

// ── 배지 컴포넌트 ─────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const m = SEVERITY_META[severity];
  const Icon = m.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border', m.color, m.bg, m.border)}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const m = CATEGORY_META[category];
  const Icon = m.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs', m.color)}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

// ── 조치 절차 렌더러 (번호 목록 + 코드블록 지원) ─────────────

function StepsRenderer({ steps }: { steps: string }) {
  const lines = steps.split('\n');
  const elements: React.ReactNode[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;
  let listNum = 0;

  const flushCode = (key: string) => {
    if (codeBuffer.length === 0) return;
    elements.push(
      <pre
        key={key}
        className="bg-black/40 border border-gray-800 rounded p-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre my-2"
      >
        {codeBuffer.join('\n')}
      </pre>
    );
    codeBuffer = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCode) { flushCode(`code-${i}`); inCode = false; }
      else         { inCode = true; }
      return;
    }
    if (inCode) { codeBuffer.push(line); return; }

    if (/^\d+\./.test(line)) {
      listNum++;
      const text = line.replace(/^\d+\.\s*/, '');
      elements.push(
        <div key={i} className="flex gap-3 items-start py-1">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold text-cyan-400 flex items-center justify-center mt-0.5">
            {listNum}
          </span>
          <span className="text-sm text-gray-200 leading-relaxed flex-1">{text}</span>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.slice(2);
      elements.push(
        <div key={i} className="flex gap-2 items-start py-0.5 ml-4">
          <span className="flex-shrink-0 w-1 h-1 rounded-full bg-gray-500 mt-2" />
          <span className="text-sm text-gray-300 leading-relaxed">{text}</span>
        </div>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <p key={i} className="text-sm font-semibold text-gray-300 mt-3 mb-1">{line.slice(3)}</p>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-300 leading-relaxed py-0.5">{line}</p>
      );
    }
  });
  if (inCode) flushCode('code-end');

  return <div className="space-y-0.5">{elements}</div>;
}

// ── 모달 ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  partner_name:  '',
  solution_name: '',
  category:      'other' as Category,
  severity:      'medium' as Severity,
  symptom:       '',
  cause:         '',
  steps:         '',
  tags:          '',
};

interface ModalProps {
  initial:  Guide | null;
  onClose:  () => void;
  onSaved:  (g: Guide) => void;
}

function GuideModal({ initial, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState(
    initial
      ? {
          partner_name:  initial.partner_name,
          solution_name: initial.solution_name,
          category:      initial.category,
          severity:      initial.severity,
          symptom:       initial.symptom,
          cause:         initial.cause ?? '',
          steps:         initial.steps,
          tags:          initial.tags.join(', '),
        }
      : { ...EMPTY_FORM }
  );
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');
  const [enhancing, setEnhancing] = useState<'symptom' | 'cause' | 'steps' | null>(null);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  async function enhance(field: 'symptom' | 'cause' | 'steps') {
    const content = form[field].trim();
    if (!content) return;
    setEnhancing(field);
    setForm(f => ({ ...f, [field]: '' }));
    try {
      const res = await fetch('/api/troubleshooting/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ field, content }),
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
            const { token } = JSON.parse(raw);
            if (token) setForm(f => ({ ...f, [field]: f[field] + token }));
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI 개선 실패');
      setForm(f => ({ ...f, [field]: content }));
    } finally {
      setEnhancing(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partner_name.trim())  return setErr('파트너사명을 입력해주세요');
    if (!form.solution_name.trim()) return setErr('솔루션명을 입력해주세요');
    if (!form.symptom.trim())       return setErr('증상을 입력해주세요');
    if (!form.steps.trim())         return setErr('조치 절차를 입력해주세요');

    setSaving(true); setErr('');
    try {
      const url    = initial ? `/api/troubleshooting/${initial.id}` : '/api/troubleshooting';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          partner_name:  form.partner_name.trim(),
          solution_name: form.solution_name.trim(),
          category:      form.category,
          severity:      form.severity,
          symptom:       form.symptom.trim(),
          cause:         form.cause.trim() || null,
          steps:         form.steps.trim(),
          tags:          form.tags.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? '저장 실패');
      }
      onSaved(await res.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5';
  const inputCls = 'w-full bg-transparent border-b border-gray-700/60 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition-colors';
  const selectCls = 'w-full bg-[#0d1117] border border-gray-700/60 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/60 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'oklch(0.08 0.005 240 / 0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-cyan-400 rounded-full" style={{ boxShadow: '0 0 8px rgba(34,211,238,0.6)' }} />
            <div>
              <div className="text-[11px] text-cyan-500/60 tracking-wider mb-0.5">
                {initial ? `수정 · #${initial.id}` : '새 가이드'}
              </div>
              <div className="text-base font-semibold text-gray-100">
                {initial ? '장애조치 가이드 수정' : '장애조치 가이드 등록'}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 px-2.5 py-1.5 rounded transition-colors">
            <X className="w-3.5 h-3.5" /> 닫기
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">

          {/* 파트너사 / 솔루션 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>파트너사 *</label>
              <input value={form.partner_name} onChange={set('partner_name')}
                placeholder="예) 이니텍, 키아나" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>솔루션명 *</label>
              <input value={form.solution_name} onChange={set('solution_name')}
                placeholder="예) INISAFE OTP" className={inputCls} />
            </div>
          </div>

          {/* 카테고리 / 심각도 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>카테고리</label>
              <select value={form.category} onChange={set('category')} className={selectCls}>
                {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>심각도</label>
              <select value={form.severity} onChange={set('severity')} className={selectCls}>
                {(Object.entries(SEVERITY_META) as [Severity, typeof SEVERITY_META[Severity]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 증상 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-400">증상 / 오류 내용 *</label>
              <button
                type="button"
                disabled={!form.symptom.trim() || enhancing !== null}
                onClick={() => enhance('symptom')}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {enhancing === 'symptom'
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> 개선 중...</>
                  : <><Sparkles className="w-3 h-3" /> AI 가독성 개선</>}
              </button>
            </div>
            <textarea value={form.symptom} onChange={set('symptom')} rows={2}
              placeholder="예) 로그인 후 OTP 인증 화면에서 '인증 실패' 오류 반복 발생"
              className={clsx(inputCls, 'resize-none')} />
          </div>

          {/* 원인 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-400">원인 분석 (선택)</label>
              <button
                type="button"
                disabled={!form.cause.trim() || enhancing !== null}
                onClick={() => enhance('cause')}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {enhancing === 'cause'
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> 개선 중...</>
                  : <><Sparkles className="w-3 h-3" /> AI 가독성 개선</>}
              </button>
            </div>
            <textarea value={form.cause} onChange={set('cause')} rows={2}
              placeholder="예) OTP 서버와 클라이언트 시간 동기화 오차 30초 초과"
              className={clsx(inputCls, 'resize-none')} />
          </div>

          {/* 조치 절차 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-400">
                조치 절차 *
                <span className="ml-2 text-gray-600 font-normal">
                  (번호 목록: "1. 내용", 코드: ```코드```, 소제목: ## 제목)
                </span>
              </label>
              <button
                type="button"
                disabled={!form.steps.trim() || enhancing !== null}
                onClick={() => enhance('steps')}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                {enhancing === 'steps'
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> 개선 중...</>
                  : <><Sparkles className="w-3 h-3" /> AI 가독성 개선</>}
              </button>
            </div>
            <textarea value={form.steps} onChange={set('steps')} rows={8}
              placeholder={`1. NTP 서버 동기화 상태 확인\n\`\`\`\ntimedatectl status\n\`\`\`\n2. OTP 서버 시간 강제 동기화\n3. 서비스 재시작 후 재확인`}
              className={clsx(inputCls, 'resize-y font-mono text-xs leading-relaxed')} />
          </div>

          {/* 태그 */}
          <div>
            <label className={labelCls}>태그 (쉼표 구분, 선택)</label>
            <input value={form.tags} onChange={set('tags')}
              placeholder="예) OTP, 시간동기화, NTP"
              className={inputCls} />
          </div>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 rounded"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {err}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700 rounded transition-colors">
              취소
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-30">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 상세 패널 ─────────────────────────────────────────────────

function DetailPanel({
  guide, onEdit, onDelete, onClose,
}: {
  guide: Guide;
  onEdit:   () => void;
  onDelete: () => void;
  onClose:  () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="flex items-start justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={guide.severity} />
            <CategoryBadge category={guide.category} />
          </div>
          <h2 className="text-base font-semibold text-gray-100 leading-snug">{guide.symptom}</h2>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-16 md:pb-4">

        {/* 파트너사 / 솔루션 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Building2 className="w-3.5 h-3.5 text-gray-600" />
            <span className="font-medium">{guide.partner_name}</span>
          </div>
          <span className="text-gray-700">/</span>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Package className="w-3.5 h-3.5 text-gray-600" />
            <span>{guide.solution_name}</span>
          </div>
        </div>

        {/* 원인 */}
        {guide.cause && (
          <div className="rounded-lg px-4 py-3"
            style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="text-xs font-medium text-amber-400/80 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> 원인 분석
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{guide.cause}</p>
          </div>
        )}

        {/* 조치 절차 */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400/70 mb-3">
            <Wrench className="w-3 h-3" /> 조치 절차
          </div>
          <StepsRenderer steps={guide.steps} />
        </div>

        {/* 태그 */}
        {guide.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2"
            style={{ borderTop: '1px solid var(--border-soft)' }}>
            <Tag className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            {guide.tags.map(t => (
              <span key={t}
                className="text-xs text-gray-500 bg-gray-800/60 border border-gray-700/40 px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* 날짜 */}
        <div className="text-xs text-gray-700 pt-1">
          마지막 수정: {new Date(guide.updated_at).toLocaleString('ko-KR')}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2 px-5 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-cyan-400 rounded border border-cyan-500/25 hover:bg-cyan-500/8 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> 수정
        </button>
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-red-400 rounded border border-red-500/25 hover:bg-red-500/8 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function TroubleshootingPage() {
  const [guides,     setGuides]     = useState<Guide[]>([]);
  const [partners,   setPartners]   = useState<string[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterPartner,  setFilterPartner]  = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [selected,   setSelected]   = useState<Guide | null>(null);
  const [modal,      setModal]      = useState<'new' | Guide | null>(null);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)          params.set('search', search);
      if (filterPartner)   params.set('partner', filterPartner);
      if (filterCategory)  params.set('category', filterCategory);
      if (filterSeverity)  params.set('severity', filterSeverity);

      const [gRes, pRes] = await Promise.all([
        fetch(`/api/troubleshooting?${params}`, { headers: getAuthHeaders() }).then(r => r.json()),
        fetch('/api/troubleshooting/partners',  { headers: getAuthHeaders() }).then(r => r.json()),
      ]);
      setGuides(Array.isArray(gRes) ? gRes : []);
      setPartners(Array.isArray(pRes) ? pRes : []);
    } finally {
      setLoading(false);
    }
  }, [search, filterPartner, filterCategory, filterSeverity]);

  useEffect(() => { load(); }, [load]);

  // 선택된 가이드가 목록에서 사라지면 해제
  useEffect(() => {
    if (selected && !guides.find(g => g.id === selected.id)) {
      setSelected(null);
    }
  }, [guides, selected]);

  function handleSaved(g: Guide) {
    setGuides(prev => {
      const idx = prev.findIndex(r => r.id === g.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = g; return next; }
      return [...prev, g];
    });
    setSelected(g);
    setModal(null);
    // 파트너 목록 갱신
    if (!partners.includes(g.partner_name)) {
      setPartners(prev => [...prev, g.partner_name].sort());
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/troubleshooting/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setGuides(prev => prev.filter(g => g.id !== id));
    setDeleteId(null);
  }

  // 파트너사별 그룹화
  const grouped = guides.reduce<Record<string, Guide[]>>((acc, g) => {
    if (!acc[g.partner_name]) acc[g.partner_name] = [];
    acc[g.partner_name].push(g);
    return acc;
  }, {});

  const hasFilters = search || filterPartner || filterCategory || filterSeverity;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">

        {/* ── 좌측 목록 패널 ── */}
        <div
          className={clsx(
            'flex flex-col transition-all duration-200',
            selected
              ? 'hidden md:flex md:w-[420px] md:flex-shrink-0'
              : 'flex flex-1'
          )}
          style={{ borderRight: selected ? '1px solid var(--border-soft)' : 'none' }}
        >
          {/* 헤더 */}
          <div className="relative px-6 pt-8 pb-4">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
              <span>SafeSquare</span><span>/</span><span>업무</span><span>/</span>
              <span className="text-cyan-500/70">장애조치</span>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-100 tracking-tight mb-1">장애조치 가이드</h1>
                <p className="text-sm text-gray-500">파트너사 솔루션별 장애 증상 및 조치 방법</p>
              </div>
              <button
                onClick={() => setModal('new')}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> 가이드 등록
              </button>
            </div>
          </div>

          {/* 필터 영역 */}
          <div className="relative px-6 pb-4 space-y-2">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="증상, 솔루션, 파트너사 검색"
                className="w-full pl-9 pr-8 py-2 text-sm placeholder-gray-600 text-gray-300 bg-transparent rounded transition-all focus:outline-none"
                style={{ border: `1px solid ${search ? 'var(--accent-border)' : 'var(--border-soft)'}` }}
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 필터 셀렉트들 */}
            <div className="grid grid-cols-3 gap-2">
              <select
                value={filterPartner} onChange={e => setFilterPartner(e.target.value)}
                className="text-xs text-gray-400 bg-transparent rounded px-2 py-1.5 focus:outline-none transition-colors"
                style={{ border: '1px solid var(--border-soft)' }}
              >
                <option value="">전체 파트너사</option>
                {partners.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="text-xs text-gray-400 bg-transparent rounded px-2 py-1.5 focus:outline-none"
                style={{ border: '1px solid var(--border-soft)' }}
              >
                <option value="">전체 카테고리</option>
                {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
                className="text-xs text-gray-400 bg-transparent rounded px-2 py-1.5 focus:outline-none"
                style={{ border: '1px solid var(--border-soft)' }}
              >
                <option value="">전체 심각도</option>
                {(Object.entries(SEVERITY_META) as [Severity, typeof SEVERITY_META[Severity]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* 활성 필터 뱃지 */}
            {hasFilters && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-600">필터:</span>
                {search && <FilterChip label={`"${search}"`} onRemove={() => setSearch('')} />}
                {filterPartner  && <FilterChip label={filterPartner}  onRemove={() => setFilterPartner('')} />}
                {filterCategory && <FilterChip label={CATEGORY_META[filterCategory as Category]?.label} onRemove={() => setFilterCategory('')} />}
                {filterSeverity && <FilterChip label={SEVERITY_META[filterSeverity as Severity]?.label} onRemove={() => setFilterSeverity('')} />}
              </div>
            )}
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto px-3 pb-16 md:pb-4">
            {loading ? (
              <div className="space-y-2 px-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.02)' }} />
                ))}
              </div>
            ) : guides.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Wrench className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-sm text-gray-500 mb-1">등록된 가이드 없음</p>
                <p className="text-xs text-gray-600">
                  {hasFilters ? '조건에 맞는 결과가 없습니다' : '가이드 등록 버튼으로 첫 항목을 추가하세요'}
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([partnerName, items]) => (
                <div key={partnerName} className="mb-4">
                  {/* 파트너사 헤더 */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{partnerName}</span>
                    <span className="text-xs text-gray-700">({items.length})</span>
                  </div>

                  {/* 가이드 카드 */}
                  <div className="space-y-1">
                    {items.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setSelected(g.id === selected?.id ? null : g)}
                        className={clsx(
                          'w-full text-left px-3 py-3 rounded-lg transition-all',
                          selected?.id === g.id
                            ? 'bg-cyan-500/8 border border-cyan-500/20'
                            : 'hover:bg-white/[0.03] border border-transparent hover:border-gray-700/40'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <SeverityBadge severity={g.severity} />
                            <CategoryBadge category={g.category} />
                          </div>
                          <ChevronRight className={clsx(
                            'w-4 h-4 flex-shrink-0 mt-0.5 transition-transform',
                            selected?.id === g.id ? 'text-cyan-400 rotate-90' : 'text-gray-700'
                          )} />
                        </div>
                        <p className="text-sm text-gray-200 leading-snug line-clamp-2">{g.symptom}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-500">{g.solution_name}</span>
                          {g.tags.length > 0 && (
                            <>
                              <span className="text-gray-700">·</span>
                              <span className="text-xs text-gray-600 truncate">{g.tags.slice(0, 2).join(', ')}</span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 하단 카운터 */}
          {!loading && guides.length > 0 && (
            <div className="px-6 py-2.5 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border-soft)' }}>
              <span className="text-xs text-gray-600">총 {guides.length}건</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-600">실시간</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 우측 상세 패널 ── */}
        {selected && (
          <div className="flex-1 relative overflow-hidden">
            <DetailPanel
              guide={selected}
              onEdit={() => setModal(selected)}
              onDelete={() => setDeleteId(selected.id)}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </main>

      {/* 모달 */}
      {modal && (
        <GuideModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* 삭제 확인 */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(0.08 0.005 240 / 0.75)' }}>
          <div className="relative w-full max-w-sm p-6 rounded-lg"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--danger)' }}>
            <div className="text-xs text-red-500/70 mb-3">삭제 확인</div>
            <div className="text-base font-semibold text-gray-200 mb-1">가이드 삭제</div>
            <div className="text-sm text-gray-500 mb-6">이 작업은 되돌릴 수 없습니다.</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700 rounded transition-colors">
                취소
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-medium text-red-300 rounded transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-800/60 border border-gray-700/40 px-2 py-0.5 rounded">
      {label}
      <button onClick={onRemove} className="text-gray-600 hover:text-gray-300">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
