'use client';

import { useState } from 'react';
import { guidesApi } from '@/lib/api';
import type { Guide, GuideType } from '@/lib/types';
import { X, Upload, FileText, Sparkles, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  projectId: number;
  guide?: Guide | null;       // null/undefined = 신규, Guide = 수정
  onClose: () => void;
  onSave: (g: Guide) => void;
}

export default function GuideModal({ projectId, guide, onClose, onSave }: Props) {
  const isEdit = !!guide;
  const [mode, setMode] = useState<'text' | 'pdf'>('text');
  const [formData, setFormData] = useState({
    title:   guide?.title   ?? '',
    content: guide?.content ?? '',
    type:    (guide?.type   ?? 'operation') as GuideType,
  });
  const [file, setFile]         = useState<File | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [enhancing, setEnhancing] = useState(false);

  async function handleEnhance() {
    const content = formData.content.trim();
    if (!content) return;
    setEnhancing(true);
    setFormData(f => ({ ...f, content: '' }));
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/guides/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
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
            const { token: tok } = JSON.parse(raw);
            if (tok) setFormData(f => ({ ...f, content: f.content + tok }));
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 개선 실패');
      setFormData(f => ({ ...f, content }));
    } finally {
      setEnhancing(false);
    }
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let saved: Guide;
      if (isEdit) {
        saved = await guidesApi.update(guide.id, formData);
      } else {
        saved = await guidesApi.create({ project_id: projectId, ...formData });
      }
      onSave(saved);
    } catch (err: any) {
      setError(err.message ?? '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('project_id', String(projectId));
      fd.append('title', formData.title);
      fd.append('type', formData.type);
      fd.append('file', file);

      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/guides/upload-pdf', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('PDF 업로드 실패');
      const saved: Guide = await res.json();
      onSave(saved);
    } catch (err: any) {
      setError(err.message ?? 'PDF 업로드 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-raised border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-gray-100">
            {isEdit ? '가이드 수정' : '새 가이드'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* 신규 작성일 때만 모드 선택 표시 */}
          {!isEdit && (
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2',
                  mode === 'text'
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                )}
              >
                <FileText className="w-4 h-4" /> 텍스트 직접 입력
              </button>
              <button
                type="button"
                onClick={() => setMode('pdf')}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2',
                  mode === 'pdf'
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                )}
              >
                <Upload className="w-4 h-4" /> PDF 업로드
              </button>
            </div>
          )}

          {/* 텍스트 모드 (수정 포함) */}
          {(mode === 'text' || isEdit) && (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div>
                <label className="label">제목 *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="가이드 제목"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">유형</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as GuideType })}
                  className="select w-full"
                >
                  <option value="install">설치</option>
                  <option value="troubleshooting">트러블슈팅</option>
                  <option value="operation">운영</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">내용 (Markdown 지원)</label>
                  <button
                    type="button"
                    disabled={!formData.content.trim() || enhancing}
                    onClick={handleEnhance}
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {enhancing
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> AI 개선 중...</>
                      : <><Sparkles className="w-3 h-3" /> AI 가독성 개선</>}
                  </button>
                </div>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input w-full font-mono text-sm"
                  rows={14}
                  placeholder={'# 제목\n\n## 섹션\n\n내용...'}
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? '저장 중...' : isEdit ? '수정 완료' : '생성'}
                </button>
              </div>
            </form>
          )}

          {/* PDF 모드 (신규만) */}
          {mode === 'pdf' && !isEdit && (
            <form onSubmit={handlePdfSubmit} className="space-y-4">
              <div>
                <label className="label">제목 *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="가이드 제목"
                />
              </div>

              <div>
                <label className="label">유형</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as GuideType })}
                  className="select w-full"
                >
                  <option value="install">설치</option>
                  <option value="troubleshooting">트러블슈팅</option>
                  <option value="operation">운영</option>
                </select>
              </div>

              <div>
                <label className="label">PDF 파일</label>
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    {file ? (
                      <div>
                        <p className="text-sm text-brand">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-400">PDF 파일을 선택하세요</p>
                        <p className="text-xs text-gray-600 mt-1">클릭하거나 드래그하여 업로드</p>
                      </div>
                    )}
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-2">✨ PDF에서 텍스트를 자동 추출하여 가이드를 생성합니다</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">취소</button>
                <button type="submit" disabled={saving || !file} className="btn-primary flex-1">
                  {saving ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
