'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Loader2, XCircle, CheckCircle } from 'lucide-react';

type Status = 'idle' | 'downloading' | 'done' | 'error';

export default function ShortCodeDownloadPage() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus]   = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!code) return;
    handleDownload(code.toUpperCase().replace('-', ''));
  }, [code]);

  async function handleDownload(token: string) {
    setStatus('downloading');
    try {
      const res = await fetch(`/api/personal-docs/public/dl/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || '다운로드에 실패했습니다.');
      }

      const disposition = res.headers.get('content-disposition') ?? '';
      const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
      const filename = nameMatch ? decodeURIComponent(nameMatch[1]) : 'download';

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('done');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : '오류가 발생했습니다.');
      setStatus('error');
    }
  }

  const displayCode = code
    ? code.toUpperCase().replace('-', '').replace(/^(.{4})(.{4})$/, '$1-$2')
    : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl p-8 text-center space-y-6">
        <div className="space-y-1">
          <p className="text-xs text-gray-600 uppercase tracking-widest">단축 코드</p>
          <p className="text-3xl font-mono font-bold tracking-[0.2em] text-brand">{displayCode}</p>
        </div>

        {status === 'idle' || status === 'downloading' ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
            <p className="text-sm text-gray-400">파일을 가져오는 중…</p>
          </div>
        ) : status === 'done' ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <p className="text-sm text-gray-300">다운로드가 시작되었습니다.</p>
            <p className="text-xs text-gray-600">브라우저 다운로드 폴더를 확인하세요.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-400">{message}</p>
            <button
              onClick={() => handleDownload(code.toUpperCase().replace('-', ''))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-brand border border-brand/30 bg-brand/10 hover:bg-brand/15 transition-all"
            >
              <Download className="w-4 h-4" /> 다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
