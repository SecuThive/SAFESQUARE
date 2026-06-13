'use client';

import { Send } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FeedMessage } from './mockData';

interface Props {
  messages: FeedMessage[];
  onSend: (msg: string) => void;
}

export default function CollaborationFeed({ messages, onSend }: Props) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* feed items */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2.5 items-start group">
            {/* avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 border"
              style={{
                background: msg.agentColor + '18',
                borderColor: msg.agentColor + '30',
              }}
            >
              {msg.agentEmoji}
            </div>
            {/* bubble */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-xs font-bold text-slate-700" style={{ color: msg.agentColor }}>
                  {msg.agent}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">{msg.timestamp}</span>
              </div>
              <div
                className="text-xs text-slate-600 leading-relaxed px-2.5 py-1.5 rounded-xl rounded-tl-sm border"
                style={{
                  background: msg.agentColor + '08',
                  borderColor: msg.agentColor + '20',
                }}
              >
                {msg.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* input */}
      <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2
                      focus-within:bg-white focus-within:border-violet-200 transition-all">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message your AI team..."
          className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: input.trim() ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#e2e8f0',
          }}
        >
          <Send className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
}
