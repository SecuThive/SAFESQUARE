'use client';

import { useEffect, useState, FormEvent } from 'react';
import { inquiriesApi } from '@/lib/api';
import type { ClientInquiry, InquiryStatus } from '@/lib/types';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  MessageCircleQuestion, CheckCircle2, Clock, XCircle, Sparkles, Mail,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';
import InquiryAIModal from './InquiryAIModal';
import InquiryAIExtractModal from './InquiryAIExtractModal';
import InquiryRawEmailModal from './InquiryRawEmailModal';

const STATUS_META: Record<InquiryStatus, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ElementType }> = {
  pending:  { label: '답변 대기', color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  dot: 'bg-amber-400',  icon: Clock        },
  answered: { label: '답변 완료', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400', icon: CheckCircle2 },
  closed:   { label: '종료',     color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/25',    dot: 'bg-gray-500',    icon: XCircle      },
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const toLocal = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

interface Props { projectId: number; }

/* ═══════════════════════════════════════════════════════ */
export default function InquiryManager({ projectId }: Props) {
  const [items,         setItems]         = useState<ClientInquiry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [expanded,      setExpanded]      = useState<number | null>(null);
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState<ClientInquiry | null>(null);
  const [aiTarget,      setAiTarget]      = useState<ClientInquiry | null>(null);
  const [rawTarget,     setRawTarget]     = useState<ClientInquiry | null>(null);
  const [showAIExtract, setShowAIExtract] = useState(false);
  const [filterStatus,  setFilterStatus]  = useState('');

  useEffect(() => {
    inquiriesApi.list(projectId).then(setItems).finally(() => setLoading(false));
  }, [projectId]);

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(item: ClientInquiry) { setEditing(item); setShowModal(true); }

  async function handleSave(data: any) {
    if (editing) {
      const updated = await inquiriesApi.update(editing.id, data);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } else {
      const created = await inquiriesApi.create({ ...data, project_id: projectId });
      setItems((prev) => [created, ...prev]);
    }
    setShowModal(false);
  }

  async function handleDelete(id: number) {
    if (!await confirm('이 문의를 삭제하시겠습니까?')) return;
    await inquiriesApi.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function handleAISave(summarized: string) {
    if (!aiTarget) return;
    const updated = await inquiriesApi.update(aiTarget.id, { answer: summarized });
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setAiTarget(null);
  }

  const displayed = filterStatus ? items.filter((i) => i.status === filterStatus) : items;
  const pending   = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="h-full overflow-y-auto p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-gray-200">고객사 문의</h2>
          {pending > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" /> 미답변 {pending}건
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 text-xs bg-white/5 border border-white/10 text-gray-300 rounded-lg px-2.5 outline-none hover:bg-white/8 transition-colors cursor-pointer"
          >
            <option value="">전체 상태</option>
            <option value="pending">답변 대기</option>
            <option value="answered">답변 완료</option>
            <option value="closed">종료</option>
          </select>

          {/* AI 자동 등록 */}
          <button
            onClick={() => setShowAIExtract(true)}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-brand/15 text-brand hover:bg-brand/25 border border-brand/30 hover:border-brand/50 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 자동 등록
          </button>

          {/* 직접 등록 */}
          <button
            onClick={openCreate}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-white/8 text-gray-200 hover:bg-white/15 border border-white/10 hover:border-white/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            직접 등록
          </button>
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 text-sm">불러오는 중...</div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-600">
          <MessageCircleQuestion className="w-10 h-10 opacity-20" />
          <p className="text-sm">등록된 문의가 없습니다</p>
          <button
            onClick={() => setShowAIExtract(true)}
            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand/15 text-brand hover:bg-brand/25 border border-brand/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI로 첫 문의 등록하기
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayed.map((item) => {
            const meta   = STATUS_META[item.status];
            const Icon   = meta.icon;
            const isOpen = expanded === item.id;

            return (
              <div
                key={item.id}
                className={clsx(
                  'rounded-xl border transition-all',
                  isOpen ? 'bg-white/4' : 'bg-white/2 hover:bg-white/4',
                  meta.border,
                )}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                >
                  {isOpen
                    ? <ChevronDown  className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />}

                  {/* 상태 뱃지 */}
                  <span className={clsx(
                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    meta.color, meta.bg,
                  )}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
                    {meta.label}
                  </span>

                  <span className="text-sm text-gray-200 flex-1 truncate font-medium">{item.title}</span>

                  <span className="text-xs text-gray-500 shrink-0 hidden sm:block">
                    {item.asked_by && <span className="mr-2 text-gray-400">{item.asked_by}</span>}
                    {format(new Date(item.asked_at), 'yy.MM.dd', { locale: ko })}
                  </span>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {item.email_raw && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRawTarget(item); }}
                        className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/25 transition-all"
                      >
                        <Mail className="w-3 h-3" /> 원문
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setAiTarget(item); }}
                      className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-xs font-semibold bg-brand/12 text-brand hover:bg-brand/22 border border-brand/25 transition-all"
                    >
                      <Sparkles className="w-3 h-3" /> AI
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 펼쳐진 상세 */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-white/6 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">문의 내용</p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{item.question}</p>
                    </div>
                    {item.answer ? (
                      <div className="bg-brand/6 border border-brand/18 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                          <span className="text-xs font-semibold text-brand">답변</span>
                          {item.answered_by && <span className="text-xs text-gray-500">by {item.answered_by}</span>}
                          {item.answered_at && (
                            <span className="text-xs text-gray-600 ml-auto">
                              {format(new Date(item.answered_at), 'yy.MM.dd HH:mm', { locale: ko })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setAiTarget(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand/12 text-brand hover:bg-brand/22 border border-brand/25 transition-all"
                        >
                          <Sparkles className="w-3 h-3" /> AI로 정리
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/6 text-gray-300 hover:bg-white/12 border border-white/10 transition-all"
                        >
                          <Edit2 className="w-3 h-3" /> 직접 작성
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <InquiryModal initial={editing} onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
      {aiTarget && (
        <InquiryAIModal inquiry={aiTarget} onClose={() => setAiTarget(null)} onSave={handleAISave} />
      )}
      {showAIExtract && (
        <InquiryAIExtractModal
          projectId={projectId}
          onCreated={(item) => setItems((prev) => [item, ...prev])}
          onClose={() => setShowAIExtract(false)}
        />
      )}
      {rawTarget && (
        <InquiryRawEmailModal
          title={rawTarget.title}
          emailRaw={rawTarget.email_raw!}
          onClose={() => setRawTarget(null)}
        />
      )}
    </div>
  );
}

/* ── 직접 등록/수정 모달 ─────────────────────────────────── */

interface ModalProps {
  initial: ClientInquiry | null;
  onClose: () => void;
  onSave:  (data: any) => Promise<void>;
}

function InquiryModal({ initial, onClose, onSave }: ModalProps) {
  const [saving,    setSaving]    = useState(false);
  const [title,     setTitle]     = useState(initial?.title    ?? '');
  const [question,  setQuestion]  = useState(initial?.question ?? '');
  const [answer,    setAnswer]    = useState(initial?.answer   ?? '');
  const [askedBy,   setAskedBy]   = useState(initial?.asked_by ?? '');
  const [askedAt,   setAskedAt]   = useState(initial ? toLocal(initial.asked_at) : nowLocal());
  const [statusVal, setStatusVal] = useState<InquiryStatus>(initial?.status ?? 'pending');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ title, question, answer: answer || null, asked_by: askedBy || null, asked_at: askedAt, status: statusVal });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d23] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <h3 className="text-sm font-semibold text-gray-100">{initial ? '문의 수정' : '문의 직접 등록'}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-all text-base">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">제목 *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" placeholder="문의 제목" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">문의자</label>
              <input value={askedBy} onChange={(e) => setAskedBy(e.target.value)} className="input w-full" placeholder="홍길동 대리" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">문의 일시</label>
              <input type="datetime-local" value={askedAt} onChange={(e) => setAskedAt(e.target.value)} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">문의 내용 *</label>
            <textarea required rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} className="input w-full resize-none" placeholder="고객사에서 질문한 내용을 입력하세요" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">답변</label>
            <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} className="input w-full resize-none" placeholder="답변 내용 (작성 시 자동으로 '답변 완료' 처리됩니다)" />
          </div>

          {initial && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">상태</label>
              <select value={statusVal} onChange={(e) => setStatusVal(e.target.value as InquiryStatus)} className="input w-full">
                <option value="pending">답변 대기</option>
                <option value="answered">답변 완료</option>
                <option value="closed">종료</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-all">취소</button>
            <button type="submit" disabled={saving} className="h-9 px-5 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-all disabled:opacity-50 shadow-lg shadow-brand/20">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
