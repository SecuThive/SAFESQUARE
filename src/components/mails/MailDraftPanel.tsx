'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mailDraftsApi, getAuthHeaders, type MailDraft, type MailDraftAttachment } from '@/lib/api';
import type { Project } from '@/lib/types';
import {
  Plus, Trash2, Edit2, Send, X, Save, Clock,
  MailCheck, ArrowUpCircle, FolderOpen,
  Sparkles, RotateCcw, ChevronDown, ChevronUp, Check,
  Paperclip, Download, FileText,
} from 'lucide-react';
import MailBody from './MailBody';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';
import TableSkeleton from '@/components/ui/TableSkeleton';
import { toast } from '@/lib/toast';

// ── 메타 ──────────────────────────────────────────────────────

const STATUS_META = {
  draft:     { label: '초안',    color: 'text-gray-400',    bg: 'bg-gray-700/40',      icon: Edit2         },
  sent:      { label: '발송 완료', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: MailCheck      },
  cancelled: { label: '취소됨',  color: 'text-red-400',     bg: 'bg-red-500/10',       icon: X             },
} as const;

const PRIORITY_META = {
  high:   { label: '높음', color: 'text-red-400',   dot: 'bg-red-400'   },
  normal: { label: '보통', color: 'text-gray-400',  dot: 'bg-gray-500'  },
  low:    { label: '낮음', color: 'text-sky-400',   dot: 'bg-sky-400'   },
} as const;

function formatDate(iso: string) {
  return format(parseISO(iso), 'MM.dd HH:mm', { locale: ko });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── 초안 폼 ───────────────────────────────────────────────────

interface DraftFormProps {
  initial?: MailDraft | null;
  projects: Project[];
  onSaved: (draft: MailDraft) => void;
  onCancel: () => void;
}

const TONE_OPTIONS = [
  { value: 'formal',      label: '격식체'   },
  { value: 'semi-formal', label: '준격식체' },
  { value: 'casual',      label: '비격식체' },
] as const;

function DraftForm({ initial, projects, onSaved, onCancel }: DraftFormProps) {
  const [toEmail,   setToEmail]   = useState(initial?.to_email   ?? '');
  const [toName,    setToName]    = useState(initial?.to_name    ?? '');
  const [subject,   setSubject]   = useState(initial?.subject    ?? '');
  const [body,      setBody]      = useState(initial?.body       ?? '');
  const [note,      setNote]      = useState(initial?.note       ?? '');
  const [priority,  setPriority]  = useState<'high'|'normal'|'low'>(initial?.priority ?? 'normal');
  const [projectId, setProjectId] = useState<string>(initial?.project_id ? String(initial.project_id) : '');
  const [saving,    setSaving]    = useState(false);

  // 첨부파일 상태
  const [existingAtts, setExistingAtts] = useState<MailDraftAttachment[]>(initial?.attachments ?? []);
  const [pendingFiles,  setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI 초안 작성 상태
  const [aiOpen,    setAiOpen]    = useState(false);
  const [aiNotes,   setAiNotes]   = useState('');
  const [aiTone,    setAiTone]    = useState<'formal'|'semi-formal'|'casual'>('formal');
  const [aiState,   setAiState]   = useState<'idle'|'loading'|'done'|'error'>('idle');
  const abortRef = useRef<AbortController | null>(null);

  async function runCompose() {
    if (!aiNotes.trim() || aiState === 'loading') return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAiState('loading');
    setBody('');

    try {
      const res = await fetch('/api/mails/compose', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body:    JSON.stringify({
          notes:    aiNotes.trim(),
          subject:  subject.trim() || undefined,
          to_name:  toName.trim()  || undefined,
          tone:     aiTone,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('요청 실패');
      if (!res.body) throw new Error('스트림 없음');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token') setBody(prev => prev + data.content);
            if (data.type === 'done')  { setAiState('done'); return; }
          } catch { /* ignore */ }
        }
      }
      setAiState('done');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setAiState('error');
      toast.error('AI 초안 작성에 실패했습니다. Ollama가 실행 중인지 확인하세요.');
    }
  }

  function resetAi() {
    abortRef.current?.abort();
    setAiState('idle');
    setBody('');
  }

  async function handleSave() {
    if (!toEmail.trim() || !subject.trim()) return;
    setSaving(true);
    try {
      let saved = initial
        ? await mailDraftsApi.update(initial.id, {
            to_email:   toEmail.trim(),
            to_name:    toName.trim() || null,
            subject:    subject.trim(),
            body:       body.trim(),
            note:       note.trim() || null,
            priority,
            project_id: projectId ? Number(projectId) : null,
          })
        : await mailDraftsApi.create({
            to_email:   toEmail.trim(),
            to_name:    toName.trim() || undefined,
            subject:    subject.trim(),
            body:       body.trim(),
            note:       note.trim() || undefined,
            priority,
            project_id: projectId ? Number(projectId) : null,
          });

      // 대기 중인 파일 업로드
      if (pendingFiles.length > 0) {
        const uploaded: MailDraftAttachment[] = [];
        for (const f of pendingFiles) {
          try {
            const att = await mailDraftsApi.uploadAttachment(saved.id, f);
            uploaded.push(att);
          } catch {
            toast.error(`${f.name} 업로드 실패`);
          }
        }
        // 응답에 attachments가 없을 수 있으므로 직접 병합
        saved = { ...saved, attachments: [...(saved.attachments ?? []), ...uploaded] };
        setPendingFiles([]);
      }

      toast.success(initial ? '초안을 수정했습니다' : '초안을 저장했습니다');
      onSaved(saved);
    } catch (e: any) {
      toast.error(e?.message ?? '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExisting(attId: number) {
    if (!initial) return;
    try {
      await mailDraftsApi.deleteAttachment(initial.id, attId);
      setExistingAtts(prev => prev.filter(a => a.id !== attId));
    } catch {
      toast.error('첨부파일 삭제에 실패했습니다');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  }

  function removePending(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }

  const isValid = toEmail.trim() && subject.trim();

  return (
    <div className="flex flex-col h-full">
      {/* 폼 헤더 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-100">
          {initial ? '초안 수정' : '새 메일 초안'}
        </h3>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 폼 바디 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 수신자 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">수신 이메일 *</label>
            <input
              className="input"
              type="email"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">수신자 이름</label>
            <input
              className="input"
              placeholder="홍길동"
              value={toName}
              onChange={e => setToName(e.target.value)}
            />
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="label">제목 *</label>
          <input
            className="input"
            placeholder="메일 제목을 입력하세요"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        {/* 우선순위 + 프로젝트 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">우선순위</label>
            <div className="flex rounded-lg border border-gray-700 overflow-hidden">
              {(['high','normal','low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                    priority === p
                      ? `${PRIORITY_META[p].color} bg-surface`
                      : 'text-gray-500 hover:text-gray-300 bg-surface-overlay',
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_META[p].dot)} />
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">관련 프로젝트</label>
            <select
              className="select"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">프로젝트 없음</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* AI 초안 작성 */}
        <div className="rounded-xl border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setAiOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-overlay hover:bg-gray-800 transition-colors text-left"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="text-xs font-medium text-purple-300 flex-1">AI 초안 작성</span>
            {aiOpen
              ? <ChevronUp   className="w-3.5 h-3.5 text-gray-500" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            }
          </button>

          {aiOpen && (
            <div className="px-4 py-3 space-y-3 border-t border-gray-700 bg-purple-500/5">
              {/* 전달 내용 메모 */}
              <div>
                <label className="label text-purple-300">전달 내용 메모</label>
                <textarea
                  className="textarea text-sm"
                  rows={4}
                  placeholder="전달하고 싶은 핵심 내용, 키워드, 요점을 자유롭게 입력하세요&#10;예) 납기 연장 요청, 2주 추가 필요, 이유는 부품 수급 지연"
                  value={aiNotes}
                  onChange={e => setAiNotes(e.target.value)}
                  disabled={aiState === 'loading'}
                />
              </div>

              {/* 문체 선택 */}
              <div>
                <label className="label text-purple-300">문체</label>
                <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                  {TONE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAiTone(value)}
                      className={clsx(
                        'flex-1 py-1.5 text-xs font-medium transition-colors',
                        aiTone === value
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'text-gray-500 hover:text-gray-300 bg-surface-overlay',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 버튼 행 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runCompose}
                  disabled={!aiNotes.trim() || aiState === 'loading'}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    aiState === 'loading'
                      ? 'bg-purple-500/10 text-purple-400 cursor-wait'
                      : 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Sparkles className={clsx('w-3.5 h-3.5', aiState === 'loading' && 'animate-pulse')} />
                  {aiState === 'loading' ? 'AI 작성 중…' : 'AI 초안 작성'}
                </button>

                {(aiState === 'done' || aiState === 'error') && (
                  <button
                    type="button"
                    onClick={resetAi}
                    className="flex items-center gap-1 px-2 py-1.5 rounded text-[11px] text-gray-500 hover:text-gray-300 hover:bg-surface-overlay transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> 다시 작성
                  </button>
                )}

                {aiState === 'done' && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 ml-auto">
                    <Check className="w-3 h-3" /> 본문에 적용됨
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 본문 */}
        <div>
          <label className="label">
            본문
            {aiState === 'loading' && (
              <span className="ml-2 text-[11px] text-purple-400 font-normal animate-pulse">AI 생성 중…</span>
            )}
          </label>
          <div className="relative">
            <textarea
              className="textarea"
              rows={10}
              placeholder="메일 본문을 작성하세요…"
              value={body}
              onChange={e => setBody(e.target.value)}
              disabled={aiState === 'loading'}
            />
            {aiState === 'loading' && (
              <span className="absolute bottom-3 right-3 inline-block w-0.5 h-4 bg-purple-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* 내부 메모 */}
        <div>
          <label className="label">내부 메모 <span className="text-gray-600 font-normal">(수신자에게 보이지 않음)</span></label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="발송 관련 참고사항, 배경 등을 기록하세요"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {/* 첨부파일 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">첨부파일</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-surface-overlay transition-colors border border-gray-700"
            >
              <Paperclip className="w-3 h-3" /> 파일 추가
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* 기존 첨부파일 (수정 모드) */}
          {existingAtts.length > 0 && (
            <div className="space-y-1 mb-2">
              {existingAtts.map(att => (
                <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-overlay border border-gray-700">
                  <FileText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="flex-1 text-xs text-gray-300 truncate">{att.original_name}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{formatFileSize(att.file_size)}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExisting(att.id)}
                    className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
                    title="삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 추가 대기 파일 */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/5 border border-brand/20">
                  <FileText className="w-3.5 h-3.5 text-brand/60 flex-shrink-0" />
                  <span className="flex-1 text-xs text-gray-300 truncate">{f.name}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {existingAtts.length === 0 && pendingFiles.length === 0 && (
            <p className="text-xs text-gray-600 py-1">첨부파일 없음</p>
          )}
        </div>
      </div>

      {/* 폼 푸터 */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 flex-shrink-0 bg-surface-raised">
        <button onClick={onCancel} className="btn-ghost text-sm">취소</button>
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="btn-primary text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? '저장 중…' : '초안 저장'}
        </button>
      </div>
    </div>
  );
}

// ── 첨부파일 다운로드 행 ───────────────────────────────────────

function AttachmentRow({ draftId, att }: { draftId: number; att: MailDraftAttachment }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(mailDraftsApi.downloadUrl(draftId, att.id), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = att.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('파일 다운로드에 실패했습니다');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-overlay border border-gray-700 hover:border-gray-600 hover:bg-gray-800 transition-colors group text-left"
    >
      <FileText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
      <span className="flex-1 text-xs text-gray-300 truncate">{att.original_name}</span>
      <span className="text-[10px] text-gray-600">{formatFileSize(att.file_size)}</span>
      <Download className={clsx('w-3 h-3 flex-shrink-0 transition-colors', downloading ? 'text-brand animate-pulse' : 'text-gray-600 group-hover:text-gray-300')} />
    </button>
  );
}


// ── 초안 상세 보기 ─────────────────────────────────────────────

interface DraftDetailProps {
  draft: MailDraft;
  projects: Project[];
  onEdit: () => void;
  onMarkSent: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function DraftDetail({ draft, projects, onEdit, onMarkSent, onDelete, onClose }: DraftDetailProps) {
  const status   = STATUS_META[draft.status];
  const StatusIcon = status.icon;
  const priority = PRIORITY_META[draft.priority];
  const project  = projects.find(p => p.id === draft.project_id);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={clsx('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', status.bg, status.color)}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            <span className={clsx('inline-flex items-center gap-1 text-[11px]', priority.color)}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', priority.dot)} />
              {priority.label}
            </span>
            {project && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                <FolderOpen className="w-3 h-3" />
                {project.name}
              </span>
            )}
          </div>
          <h2 className="text-sm font-semibold text-gray-100 leading-snug">{draft.subject}</h2>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {draft.status === 'draft' && (
            <>
              <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-brand hover:bg-brand/10 rounded transition-colors" title="수정">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onMarkSent} className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors" title="발송 완료 처리">
                <Send className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="삭제">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300 rounded transition-colors ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 수신자 정보 */}
      <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[11px] text-gray-500 w-8 flex-shrink-0">받는사람</span>
          <span className="text-gray-200 font-medium">
            {draft.to_name ? `${draft.to_name} <${draft.to_email}>` : draft.to_email}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {draft.status === 'sent' && draft.sent_at
            ? `발송 완료 · ${formatDate(draft.sent_at)}`
            : `마지막 수정 · ${formatDate(draft.updated_at)}`
          }
          {draft.created_by && <span>· {draft.created_by}</span>}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {draft.body ? (
          <MailBody body={draft.body} subject={draft.subject} />
        ) : (
          <p className="text-sm text-gray-600 italic">본문이 없습니다.</p>
        )}

        {/* 내부 메모 */}
        {draft.note && (
          <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <p className="text-[11px] text-amber-400 font-medium mb-1">내부 메모</p>
            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{draft.note}</p>
          </div>
        )}

        {/* 첨부파일 */}
        {draft.attachments && draft.attachments.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] text-gray-500 font-medium mb-2 flex items-center gap-1">
              <Paperclip className="w-3 h-3" /> 첨부파일 {draft.attachments.length}개
            </p>
            <div className="space-y-1">
              {draft.attachments.map(att => (
                <AttachmentRow key={att.id} draftId={draft.id} att={att} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 목록 아이템 ────────────────────────────────────────────────

function DraftItem({ draft, active, onClick }: { draft: MailDraft; active: boolean; onClick: () => void }) {
  const status   = STATUS_META[draft.status];
  const StatusIcon = status.icon;
  const priority = PRIORITY_META[draft.priority];

  return (
    <div
      onClick={onClick}
      className={clsx(
        'px-4 py-3 cursor-pointer transition-colors border-l-2',
        active
          ? 'bg-brand/5 border-brand'
          : 'hover:bg-surface-overlay border-transparent',
      )}
    >
      <div className="flex items-start gap-2">
        <span className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', priority.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-semibold text-gray-200 truncate flex-1">{draft.subject}</p>
            <span className={clsx('inline-flex items-center gap-0.5 text-[10px] flex-shrink-0', status.color)}>
              <StatusIcon className="w-2.5 h-2.5" />
              {status.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate">→ {draft.to_email}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-gray-700">{formatDate(draft.updated_at)}</p>
            {draft.attachments && draft.attachments.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                <Paperclip className="w-2.5 h-2.5" />{draft.attachments.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

interface Props {
  projects: Project[];
}

export default function MailDraftPanel({ projects }: Props) {
  const [drafts,     setDrafts]     = useState<MailDraft[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<MailDraft | null>(null);
  const [mode,       setMode]       = useState<'list' | 'new' | 'edit'>('list');
  const [statusTab,  setStatusTab]  = useState<'all' | 'draft' | 'sent'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDrafts(await mailDraftsApi.list());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = statusTab === 'all'
    ? drafts
    : drafts.filter(d => d.status === statusTab);

  const draftCount = drafts.filter(d => d.status === 'draft').length;
  const sentCount  = drafts.filter(d => d.status === 'sent').length;

  const handleSaved = (draft: MailDraft) => {
    setDrafts(prev => {
      const exists = prev.find(d => d.id === draft.id);
      return exists
        ? prev.map(d => d.id === draft.id ? draft : d)
        : [draft, ...prev];
    });
    setSelected(draft);
    setMode('list');
  };

  const handleMarkSent = async () => {
    if (!selected) return;
    if (!await confirm('이 메일을 발송 완료로 표시하시겠습니까?', {
      title: '발송 완료 처리',
      danger: false,
      confirmLabel: '발송 완료',
    })) return;
    try {
      const updated = await mailDraftsApi.update(selected.id, { status: 'sent' });
      setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
      setSelected(updated);
      toast.success('발송 완료로 표시했습니다');
    } catch (e: any) {
      toast.error(e?.message ?? '처리에 실패했습니다');
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!await confirm('이 초안을 삭제하시겠습니까?')) return;
    try {
      await mailDraftsApi.delete(selected.id);
      setDrafts(prev => prev.filter(d => d.id !== selected.id));
      setSelected(null);
      toast.success('초안을 삭제했습니다');
    } catch (e: any) {
      toast.error(e?.message ?? '삭제에 실패했습니다');
    }
  };

  const openNew = () => { setSelected(null); setMode('new'); };
  const openEdit = () => setMode('edit');
  const cancelForm = () => setMode('list');

  // 폼 모드일 때 오른쪽 패널을 폼으로 채움
  const showForm = mode === 'new' || mode === 'edit';

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* 좌측: 목록 */}
      <div className={clsx(
        'flex flex-col border-r border-gray-800 bg-surface-raised flex-shrink-0',
        selected || showForm ? 'w-80' : 'flex-1 max-w-lg',
      )}>
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex gap-1">
            {([
              ['all', '전체', null],
              ['draft', '초안', draftCount],
              ['sent', '발송', sentCount],
            ] as const).map(([id, label, count]) => (
              <button
                key={id}
                onClick={() => setStatusTab(id)}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusTab === id
                    ? 'bg-brand/10 text-brand'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                )}
              >
                {label}
                {count !== null && count > 0 && (
                  <span className="text-[10px] px-1 py-0.5 rounded-full bg-gray-700 text-gray-400 font-bold">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 초안
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <TableSkeleton rows={5} rowHeight="h-16" className="space-y-px p-2" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <ArrowUpCircle className="w-9 h-9 text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">
                {statusTab === 'draft' ? '저장된 초안이 없습니다' :
                 statusTab === 'sent'  ? '발송 완료된 메일이 없습니다' :
                 '보낼 메일이 없습니다'}
              </p>
              {statusTab !== 'sent' && (
                <button onClick={openNew} className="btn-primary mt-4 text-sm">
                  <Plus className="w-4 h-4" /> 첫 초안 작성
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {filtered.map(d => (
                <DraftItem
                  key={d.id}
                  draft={d}
                  active={selected?.id === d.id && !showForm}
                  onClick={() => { setSelected(d); setMode('list'); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 우측: 상세 or 폼 */}
      {showForm ? (
        <div className="flex-1 overflow-hidden">
          <DraftForm
            initial={mode === 'edit' ? selected : null}
            projects={projects}
            onSaved={handleSaved}
            onCancel={cancelForm}
          />
        </div>
      ) : selected ? (
        <div className="flex-1 overflow-hidden">
          <DraftDetail
            draft={selected}
            projects={projects}
            onEdit={openEdit}
            onMarkSent={handleMarkSent}
            onDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <ArrowUpCircle className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500 mb-1">보낼 메일 초안을 관리하세요</p>
          <p className="text-xs text-gray-600 mb-5">수신자, 제목, 본문을 미리 작성해두고<br/>발송 완료 여부를 추적할 수 있습니다</p>
          <button onClick={openNew} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> 새 초안 작성
          </button>
        </div>
      )}
    </div>
  );
}
