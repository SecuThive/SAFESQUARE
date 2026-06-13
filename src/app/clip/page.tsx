'use client';

import { useState } from 'react';
import { ClipboardCopy, CheckCircle, AlertCircle, Send } from 'lucide-react';

export default function ClipPage() {
  const [label,      setLabel]      = useState('');
  const [content,    setContent]    = useState('');
  const [status,     setStatus]     = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [errorMsg,   setErrorMsg]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setStatus('sending');
    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), label: label.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? '전송 실패');
      }
      setStatus('ok');
      setContent('');
      setLabel('');
    } catch (err: any) {
      setErrorMsg(err.message ?? '오류가 발생했습니다');
      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle');
    setErrorMsg('');
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <ClipboardCopy className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100">텍스트 전달</h1>
            <p className="text-xs text-gray-500">내용을 붙여넣고 전송하세요</p>
          </div>
        </div>

        {/* 성공 */}
        {status === 'ok' && (
          <div className="bg-green-900/20 border border-green-800 rounded-xl p-5 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-green-300 mb-1">전송 완료</p>
            <p className="text-xs text-gray-500 mb-4">수신함에서 확인할 수 있습니다</p>
            <button
              onClick={reset}
              className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              다시 전송
            </button>
          </div>
        )}

        {/* 에러 */}
        {status === 'error' && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-5 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-300 mb-4">{errorMsg}</p>
            <button
              onClick={reset}
              className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 폼 */}
        {(status === 'idle' || status === 'sending') && (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                제목 <span className="text-gray-600">(선택)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="예: 서버 에러 로그"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="에러 메시지, 로그, 텍스트 등 붙여넣기..."
                rows={12}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!content.trim() || status === 'sending'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              {status === 'sending' ? '전송 중...' : '전송'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
