'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Terminal, Sparkles, Copy, Check, Download, Clock,
  Trash2, Loader2, RotateCcw, Save, FileCode, ChevronRight,
  BookOpen, X,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getAuthHeaders } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import Sidebar from '@/components/layout/Sidebar';

/* ── 언어 정의 ──────────────────────────────────────────────────── */
const LANGUAGES = [
  { id: 'bash',       label: 'Bash',       ext: 'sh',  color: 'text-emerald-400', chipActive: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300', chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-emerald-500/10 border-emerald-500/30' },
  { id: 'python',     label: 'Python',     ext: 'py',  color: 'text-blue-400',    chipActive: 'bg-blue-500/15 border-blue-500/50 text-blue-300',         chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-blue-500/10 border-blue-500/30' },
  { id: 'powershell', label: 'PowerShell', ext: 'ps1', color: 'text-sky-400',     chipActive: 'bg-sky-500/15 border-sky-500/50 text-sky-300',             chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-sky-500/10 border-sky-500/30' },
  { id: 'javascript', label: 'JavaScript', ext: 'js',  color: 'text-yellow-400',  chipActive: 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300',    chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-yellow-500/10 border-yellow-500/30' },
  { id: 'go',         label: 'Go',         ext: 'go',  color: 'text-cyan-400',    chipActive: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300',           chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-cyan-500/10 border-cyan-500/30' },
  { id: 'sql',        label: 'SQL',        ext: 'sql', color: 'text-purple-400',  chipActive: 'bg-purple-500/15 border-purple-500/50 text-purple-300',     chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-purple-500/10 border-purple-500/30' },
  { id: 'ruby',       label: 'Ruby',       ext: 'rb',  color: 'text-red-400',     chipActive: 'bg-red-500/15 border-red-500/50 text-red-300',             chipInactive: 'border-gray-700/60 text-gray-500 hover:border-gray-500 hover:text-gray-300', iconBg: 'bg-red-500/10 border-red-500/30' },
] as const;
type LangId = typeof LANGUAGES[number]['id'];

/* ── 타입 ────────────────────────────────────────────────────────── */
interface ScriptResult {
  filename:    string;
  description: string;
  script:      string;
}
interface SavedRecord extends ScriptResult {
  id:          number;
  language:    LangId;
  user_prompt: string;
  created_at:  string;
}

/* ── 복사 유틸 ───────────────────────────────────────────────────── */
function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCopy(text));
  } else { execCopy(text); }
}
function execCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand('copy'); } catch { /* ignore */ }
  document.body.removeChild(el);
}

/* ── 스트리밍 중 Raw 토큰 뷰어 (메타 2줄 제외) ───────────────────── */
function StreamingView({ tokens, language }: { tokens: string; language: LangId }) {
  const lang = LANGUAGES.find(l => l.id === language)!;
  const endRef = useRef<HTMLDivElement>(null);

  // 첫 두 메타 줄(FILENAME/DESCRIPTION)을 제외한 코드만 추출
  const lines = tokens.split('\n');
  let codeStart = 0;
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    if (/FILENAME:|DESCRIPTION:/i.test(lines[i])) codeStart = i + 1;
  }
  const codeLines = lines.slice(codeStart);
  // 앞 빈줄 제거
  while (codeLines.length && !codeLines[0].trim()) codeLines.shift();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [tokens]);

  return (
    <div className="rounded-xl border border-gray-700/60 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-800/70 border-b border-gray-700/60">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
        </div>
        <Loader2 className="w-3 h-3 animate-spin text-brand" />
        <span className={clsx('text-[11px] font-mono font-semibold', lang.color)}>
          {lang.label} 생성 중...
        </span>
      </div>
      <div className="overflow-auto max-h-[480px]">
        <table className="w-full border-collapse">
          <tbody>
            {codeLines.map((line, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="select-none w-12 px-3 text-right text-[11px] text-gray-700 font-mono leading-[1.7rem] border-r border-gray-800/60 align-top">
                  {i + 1}
                </td>
                <td className="px-4 text-xs text-gray-300 font-mono leading-[1.7rem] whitespace-pre">
                  {line || ' '}
                </td>
              </tr>
            ))}
            <tr>
              <td className="select-none w-12 px-3 text-right text-[11px] text-gray-700 font-mono leading-[1.7rem] border-r border-gray-800/60" />
              <td className="px-4">
                <span className="inline-block w-2 h-4 bg-brand/70 animate-pulse align-text-bottom" />
              </td>
            </tr>
          </tbody>
        </table>
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ── 완성된 결과 코드 블록 ───────────────────────────────────────── */
function ResultCodeBlock({
  result, language, onSave, saving, saved,
}: {
  result: ScriptResult;
  language: LangId;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const lang = LANGUAGES.find(l => l.id === language)!;
  const lines = result.script.split('\n');

  function handleCopy() { copyText(result.script); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  function handleDownload() {
    const blob = new Blob([result.script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = result.filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2.5">
      {/* 파일 정보 바 */}
      <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border', lang.iconBg)}>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border', lang.iconBg)}>
          <FileCode className={clsx('w-4 h-4', lang.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm font-bold font-mono', lang.color)}>{result.filename}</p>
          {result.description && (
            <p className="text-[11px] text-gray-400 mt-0.5">{result.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border', lang.iconBg, lang.color)}>
            {lang.label}
          </span>
          <span className="text-[11px] text-gray-600 font-mono">{lines.length} lines</span>
        </div>
      </div>

      {/* 코드 에디터 */}
      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/70 border-b border-gray-700/60">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <span className={clsx('text-[11px] font-mono font-semibold', lang.color)}>{result.filename}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
            >
              <Download className="w-3 h-3" /> 다운로드
            </button>
            <button
              onClick={handleCopy}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors',
                copied ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50',
              )}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? '복사됨!' : '복사'}
            </button>
            <div className="w-px h-4 bg-gray-700/60 mx-0.5" />
            <button
              onClick={onSave}
              disabled={saving || saved}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors',
                saved
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-brand border border-brand/30 bg-brand/10 hover:bg-brand/15 disabled:opacity-50',
              )}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {saved ? '저장됨' : '저장'}
            </button>
          </div>
        </div>

        {/* 코드 본문 — 줄번호 + 내용 */}
        <div className="overflow-auto max-h-[540px]">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-white/[0.02] group">
                  <td className="select-none w-12 px-3 text-right text-[11px] text-gray-700 font-mono leading-[1.7rem] border-r border-gray-800/60 align-top group-hover:text-gray-600">
                    {i + 1}
                  </td>
                  <td className="px-4 text-xs text-gray-300 font-mono leading-[1.7rem] whitespace-pre">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 상태 바 */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800/40 border-t border-gray-700/60">
          <span className="text-[10px] text-gray-600 font-mono">{lang.label}</span>
          <div className="flex items-center gap-3 text-[10px] text-gray-600 font-mono">
            <span>{lines.length} lines</span>
            <span>{new Blob([result.script]).size.toLocaleString()} bytes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 저장된 스크립트 모달 ────────────────────────────────────────── */
function SavedScriptsModal({
  records,
  onClose,
  onLoad,
  onDelete,
}: {
  records: SavedRecord[];
  onClose: () => void;
  onLoad: (r: SavedRecord) => void;
  onDelete: (id: number) => void;
}) {
  const [selected, setSelected] = useState<SavedRecord | null>(records[0] ?? null);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl h-[80vh] bg-surface-raised border border-gray-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-gray-200">저장된 스크립트</h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand/15 text-brand">{records.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {records.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-600">
            저장된 스크립트가 없습니다
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* 목록 패널 */}
            <div className="w-[280px] flex-shrink-0 border-r border-gray-700/60 overflow-y-auto">
              {records.map(rec => {
                const l = LANGUAGES.find(x => x.id === rec.language)!;
                const isSelected = selected?.id === rec.id;
                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelected(rec)}
                    className={clsx(
                      'px-4 py-3 cursor-pointer border-b border-gray-800/50 transition-colors',
                      isSelected ? 'bg-brand/10' : 'hover:bg-gray-800/30',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border', l.iconBg, l.color)}>
                        {l.label}
                      </span>
                      <span className="text-[10px] text-gray-600 ml-auto font-mono">
                        {format(new Date(rec.created_at), 'MM.dd HH:mm', { locale: ko })}
                      </span>
                    </div>
                    <p className={clsx('text-xs font-mono font-semibold truncate', l.color)}>{rec.filename}</p>
                    {rec.description && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{rec.description}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 상세 패널 */}
            {selected && (() => {
              const l = LANGUAGES.find(x => x.id === selected.language)!;
              const lines = selected.script.split('\n');
              return (
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  {/* 파일 정보 */}
                  <div className="px-5 py-3 border-b border-gray-700/60 flex items-center gap-3 flex-shrink-0">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0', l.iconBg)}>
                      <FileCode className={clsx('w-4 h-4', l.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-bold font-mono', l.color)}>{selected.filename}</p>
                      {selected.description && <p className="text-[11px] text-gray-500 mt-0.5">{selected.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onDelete(selected.id)}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { onLoad(selected); onClose(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn btn-primary"
                      >
                        불러오기 <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 코드 */}
                  <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse">
                      <tbody>
                        {lines.map((line, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] group">
                            <td className="select-none w-12 px-3 text-right text-[11px] text-gray-700 font-mono leading-[1.7rem] border-r border-gray-800/60 align-top">
                              {i + 1}
                            </td>
                            <td className="px-4 text-xs text-gray-300 font-mono leading-[1.7rem] whitespace-pre">
                              {line || ' '}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 하단 바 */}
                  <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800/40 border-t border-gray-700/60 flex-shrink-0">
                    <span className="text-[10px] text-gray-600 font-mono">{lines.length} lines</span>
                    <span className="text-[10px] text-gray-600 font-mono">{new Blob([selected.script]).size.toLocaleString()} bytes</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────────────── */
export default function ScriptGeneratorPage() {
  const [language,    setLanguage]    = useState<LangId>('bash');
  const [description, setDescription] = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [streamTokens, setStreamTokens] = useState('');
  const [result,      setResult]      = useState<ScriptResult | null>(null);
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [records,     setRecords]     = useState<SavedRecord[]>([]);
  const [showSaved,   setShowSaved]   = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // 저장 목록 불러오기
  useEffect(() => {
    fetch('/api/script-generator/records', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setRecords)
      .catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    if (!description.trim() || generating) return;
    setGenerating(true);
    setError('');
    setResult(null);
    setStreamTokens('');
    setSaved(false);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/script-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ description: description.trim(), language }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'token') {
              setStreamTokens(prev => prev + ev.content);
            } else if (ev.type === 'done' && ev.result) {
              setResult(ev.result);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message ?? '생성 실패');
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [description, language, generating]);

  async function handleSave() {
    if (!result || saving || saved) return;
    setSaving(true);
    try {
      const res = await fetch('/api/script-generator/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          language,
          filename:    result.filename,
          description: result.description,
          script:      result.script,
          user_prompt: description,
        }),
      });
      if (!res.ok) throw new Error('저장 실패');
      const rec: SavedRecord = await res.json();
      setRecords(prev => [rec, ...prev]);
      setSaved(true);
    } catch (e: any) {
      setError(e.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecord(id: number) {
    if (!await confirm('저장된 스크립트를 삭제하시겠습니까?', { danger: true, confirmLabel: '삭제' })) return;
    await fetch(`/api/script-generator/records/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  function handleLoadRecord(rec: SavedRecord) {
    setLanguage(rec.language);
    setDescription(rec.user_prompt || '');
    setResult({ filename: rec.filename, description: rec.description, script: rec.script });
    setStreamTokens('');
    setSaved(true);
  }

  const lang = LANGUAGES.find(l => l.id === language)!;

  return (
    <div className="flex h-screen">
      <Sidebar />
    <div className="flex-1 overflow-y-auto bg-surface/50">
      <div className="max-w-[1100px] mx-auto px-8 py-7">

        {/* ── 헤더 ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-brand" />
              </div>
              <h1 className="text-xl font-bold text-gray-100 tracking-tight">스크립트 생성기</h1>
            </div>
            <p className="text-sm text-gray-500 ml-[42px]">원하는 동작을 설명하면 AI가 스크립트를 자동 생성합니다.</p>
          </div>
          <button
            onClick={() => setShowSaved(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-700/60 text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 transition-colors flex-shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            저장된 스크립트
            {records.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand/20 text-brand">{records.length}</span>
            )}
          </button>
        </div>

        <div className="space-y-4">

          {/* ── 입력 패널 ── */}
          <div className="bg-surface-raised border border-gray-800/70 rounded-xl p-5 space-y-4">

            {/* 언어 선택 */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">언어 선택</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all',
                      language === l.id ? l.chipActive : l.chipInactive,
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 설명 입력 */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">동작 설명</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
                placeholder={
                  language === 'bash'       ? '예) /var/log 아래 30일 이상 된 로그 파일을 찾아서 자동으로 압축하고 삭제' :
                  language === 'python'     ? '예) CSV 파일을 읽어 컬럼별 통계를 분석하고 결과를 리포트로 출력' :
                  language === 'powershell' ? '예) 윈도우 이벤트 로그에서 오류 항목만 추출하여 CSV로 저장' :
                  language === 'javascript' ? '예) REST API를 호출하고 응답을 JSON 파일로 저장' :
                  language === 'go'         ? '예) HTTP 헬스체크 서버를 열고 요청 로그를 파일에 기록' :
                  language === 'sql'        ? '예) 30일 이상 로그인하지 않은 사용자를 조회하여 비활성화' :
                                             '예) URL에서 HTML을 파싱하여 링크 목록을 추출'
                }
                rows={4}
                className="w-full bg-gray-900/50 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 resize-none transition-colors"
              />
              <p className="text-[10px] text-gray-700 mt-1.5">⌘+Enter 또는 버튼으로 생성 · 더 구체적으로 설명할수록 정확합니다</p>
            </div>

            {/* 버튼 */}
            <div className="flex items-center gap-3">
              {generating ? (
                <button
                  onClick={() => { abortRef.current?.abort(); setGenerating(false); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/15 transition-colors"
                >
                  <Loader2 className="w-4 h-4 animate-spin" /> 생성 중… 클릭하여 중지
                </button>
              ) : (
                <button
                  onClick={generate}
                  disabled={!description.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" /> 스크립트 생성
                </button>
              )}
              {(result || streamTokens) && !generating && (
                <button
                  onClick={() => { setResult(null); setStreamTokens(''); setDescription(''); setSaved(false); }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 초기화
                </button>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </div>

          {/* ── 스트리밍 중 ── */}
          {generating && (
            <StreamingView tokens={streamTokens} language={language} />
          )}

          {/* ── 완성 결과 ── */}
          {result && !generating && (
            <ResultCodeBlock
              result={result}
              language={language}
              onSave={handleSave}
              saving={saving}
              saved={saved}
            />
          )}

          {/* ── 빈 상태 ── */}
          {!generating && !result && (
            <div className="bg-surface-raised border border-gray-800/70 rounded-xl py-14 flex flex-col items-center gap-4 text-center">
              <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center border', lang.iconBg)}>
                <Terminal className={clsx('w-6 h-6', lang.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">생성된 스크립트가 여기에 표시됩니다</p>
                <p className="text-xs text-gray-700 mt-1">언어 선택 후 원하는 동작을 설명하세요</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-xl mt-1">
                {[
                  '서버 디스크 사용량 체크 후 80% 초과 시 메일 알림',
                  '30일 이상 된 로그 파일 자동 압축 및 삭제',
                  'SSH 접속 실패 IP 추출 및 자동 차단',
                  'DB 덤프를 주기적으로 원격 서버에 전송',
                ].map(ex => (
                  <button
                    key={ex}
                    onClick={() => setDescription(ex)}
                    className="px-3 py-1.5 rounded-full border border-gray-700/60 text-[11px] text-gray-500 hover:text-gray-200 hover:border-gray-500 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 저장된 스크립트 모달 ── */}
      {showSaved && (
        <SavedScriptsModal
          records={records}
          onClose={() => setShowSaved(false)}
          onLoad={handleLoadRecord}
          onDelete={handleDeleteRecord}
        />
      )}
    </div>
    </div>
  );
}
