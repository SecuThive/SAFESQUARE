'use client';

import { useState } from 'react';
import { X, Mail, Copy, Check } from 'lucide-react';

interface Props {
  title:    string;
  emailRaw: string;
  onClose:  () => void;
}

export default function InquiryRawEmailModal({ title, emailRaw, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(emailRaw).catch(() => fallbackCopy());
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fallbackCopy() {
    const el = document.createElement('textarea');
    el.value = emailRaw;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d23] border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">원문 메일</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-all"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">복사됨</span></>
                : <><Copy className="w-3.5 h-3.5" />복사</>
              }
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <pre className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words bg-[#12141a] border border-white/8 rounded-xl px-5 py-4">
            {emailRaw}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-7 py-4 border-t border-white/8 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-all"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
