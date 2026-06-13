'use client';

import { useState, useRef } from 'react';
import { inquiriesApi } from '@/lib/api';
import type { ClientInquiry } from '@/lib/types';
import { Sparkles, Copy, Check, Save, X } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  inquiry: ClientInquiry;
  onSave:  (summarized: string) => Promise<void>;
  onClose: () => void;
}

export default function InquiryAIModal({ inquiry, onSave, onClose }: Props) {
  const [emailText,  setEmailText]  = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [result,     setResult]     = useState('');
  const [done,       setDone]       = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [error,      setError]      = useState('');
  const abortRef = useRef<AbortController | null>(null);

  async function handleSummarize() {
    if (!emailText.trim()) return;
    setStreaming(true);
    setResult('');
    setDone(false);
    setError('');

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await inquiriesApi.aiSummarize(inquiry.id, emailText);
      if (!res.ok || !res.body) {
        setError('AI 서버 응답 오류');
        return;
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.phase === 'token') {
              setResult((prev) => prev + evt.content);
            } else if (evt.phase === 'done') {
              setDone(true);
            } else if (evt.phase === 'error') {
              setError(evt.message ?? 'AI 처리 중 오류 발생');
            }
          } catch {
            /* skip malformed line */
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(String(e));
    } finally {
      setStreaming(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setStreaming(false);
    setDone(true);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(result);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-white/10 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-gray-200">AI 답변 정리</h3>
            <span className="text-xs text-gray-500 font-mono">gemma4:e4b</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 원래 문의 요약 */}
          <div className="bg-white/5 rounded-lg px-4 py-3 border border-white/10">
            <p className="text-xs font-medium text-gray-400 mb-1">문의</p>
            <p className="text-xs text-gray-300 line-clamp-3">{inquiry.question}</p>
          </div>

          {/* 메일 입력 */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              메일 답변 원문 붙여넣기
            </label>
            <textarea
              rows={8}
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              disabled={streaming}
              className="input w-full resize-none text-sm font-mono"
              placeholder="고객사에 보낸 메일 내용을 전체 복사해서 붙여넣으세요 (헤더, 서명 포함해도 됩니다)"
            />
          </div>

          {/* 실행 버튼 */}
          <div className="flex items-center gap-2">
            {!streaming ? (
              <button
                onClick={handleSummarize}
                disabled={!emailText.trim()}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {result ? '다시 정리' : 'AI 정리 시작'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="btn-ghost text-sm text-red-400 hover:text-red-300 flex items-center gap-2"
              >
                중지
              </button>
            )}
          </div>

          {/* 에러 */}
          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* 스트리밍 결과 */}
          {(result || streaming) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-brand" />
                  정리된 답변
                  {streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-brand rounded-sm animate-pulse ml-1" />
                  )}
                </p>
                {result && !streaming && (
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                )}
              </div>
              <div
                className={clsx(
                  'rounded-lg border px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed min-h-[80px]',
                  done
                    ? 'bg-brand/5 border-brand/20'
                    : 'bg-white/5 border-white/10',
                )}
              >
                {result || <span className="text-gray-500">정리 중...</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">취소</button>
          <button
            onClick={handleSave}
            disabled={!result || streaming || saving}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '답변으로 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
