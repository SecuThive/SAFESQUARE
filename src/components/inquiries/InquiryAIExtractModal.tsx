'use client';

import { useState } from 'react';
import { inquiriesApi } from '@/lib/api';
import type { ClientInquiry, Project } from '@/lib/types';
import { Sparkles, Loader2, X, Mail, FolderOpen } from 'lucide-react';

interface Props {
  projectId:  number;
  projects?:  Project[];   // 전달 시 프로젝트 선택 드롭다운 표시
  onCreated: (item: ClientInquiry) => void;
  onClose:   () => void;
}

export default function InquiryAIExtractModal({ projectId, projects, onCreated, onClose }: Props) {
  const [selectedProject, setSelectedProject] = useState(projectId);
  const [emailText, setEmailText] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleExtract() {
    if (!emailText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const created = await inquiriesApi.aiExtract(selectedProject, emailText);
      onCreated(created);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'AI 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d23] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">AI 문의 자동 등록</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">gemma4:e4b</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

          {/* 프로젝트 선택 (전역 페이지에서만 표시) */}
          {projects && projects.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                <FolderOpen className="w-3.5 h-3.5" /> 등록할 프로젝트
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(Number(e.target.value))}
                disabled={loading}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 안내 */}
          <div className="flex items-start gap-3 bg-brand/8 border border-brand/20 rounded-xl px-4 py-3">
            <Mail className="w-4 h-4 text-brand mt-0.5 shrink-0" />
            <p className="text-xs text-gray-300 leading-relaxed">
              고객사로부터 받은 <span className="text-brand font-medium">문의 메일</span> 또는 주고받은 <span className="text-brand font-medium">메일 스레드 전체</span>를 붙여넣으세요.
              AI가 제목·문의 내용·답변·문의자·일시를 자동으로 추출해 등록합니다.
            </p>
          </div>

          {/* 텍스트에어리어 */}
          <div className="relative">
            <textarea
              rows={22}
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              disabled={loading}
              className="w-full bg-[#12141a] border border-white/10 rounded-xl px-4 py-4 text-sm text-gray-200 font-mono leading-relaxed resize-none outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-gray-600 disabled:opacity-50"
              placeholder={`보낸 사람: 홍길동 <hong@client.com>
받는 사람: 담당자 <me@company.com>
날짜: 2026-05-11
제목: 보안 점검 관련 문의

안녕하세요,

궁금한 점이 있어 문의드립니다. ...

(인사말, 서명 포함 전체 내용을 붙여넣으세요)`}
            />
            {emailText && (
              <div className="absolute bottom-3 right-3 text-xs text-gray-600">
                {emailText.length.toLocaleString()}자
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-7 py-5 border-t border-white/8 shrink-0">
          <p className="text-xs text-gray-600">
            {loading ? 'AI가 메일을 분석하고 있습니다...' : '메일 내용을 붙여넣고 자동 등록하세요'}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-all disabled:opacity-40"
            >
              취소
            </button>
            <button
              onClick={handleExtract}
              disabled={!emailText.trim() || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</>
                : <><Sparkles className="w-4 h-4" /> 자동 등록</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
