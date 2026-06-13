'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, FileText, Upload } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import clsx from 'clsx';
import { confirm } from '@/lib/confirm';

interface Solution {
  id: number;
  name: string;
  description: string | null;
}

interface Guide {
  id: number;
  solution_id: number;
  title: string;
  content: string;
  type: string;
  file_path: string | null;
  created_at: string;
}

export default function SolutionGuidesPage() {
  const params = useParams();
  const router = useRouter();
  const solutionId = Number(params.id);

  const [solution, setSolution] = useState<Solution | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadSolution();
    loadGuides();
  }, [solutionId]);

  const loadSolution = async () => {
    try {
      const res = await fetch(`/api/solutions/${solutionId}`);
      const data = await res.json();
      setSolution(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadGuides = async () => {
    try {
      const res = await fetch(`/api/solution-guides?solution_id=${solutionId}`);
      const data = await res.json();
      setGuides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setGuides([]);
    }
  };

  const deleteGuide = async (id: number) => {
    if (!await confirm('이 가이드를 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/solution-guides/${id}`, { method: 'DELETE' });
      await loadGuides();
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'install': return '설치';
      case 'troubleshooting': return '트러블슈팅';
      case 'operation': return '운영';
      default: return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'install': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'troubleshooting': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'operation': return 'bg-green-500/10 text-green-400 border-green-500/20';
      default: return 'bg-gray-700/50 text-gray-400 border-gray-600';
    }
  };

  if (!solution) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      
      <div className="flex-1 overflow-auto bg-surface">
        <div className="max-w-6xl mx-auto p-4 sm:p-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <button
              onClick={() => router.push('/settings/solutions')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              솔루션 목록으로
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-100">{solution.name}</h1>
                <p className="text-sm text-gray-500 mt-1">가이드 문서 관리</p>
              </div>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                가이드 추가
              </button>
            </div>
          </div>

          {/* Guides List */}
          <div className="space-y-3">
            {guides.map((guide) => (
              <div
                key={guide.id}
                className="bg-surface-overlay border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-gray-100">{guide.title}</h3>
                      <span className={clsx('badge text-xs', getTypeBadgeColor(guide.type))}>
                        {getTypeLabel(guide.type)}
                      </span>
                      {guide.file_path && (
                        <span className="badge text-xs bg-brand/10 text-brand border-brand/20">
                          <FileText className="w-3 h-3" />
                          PDF
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {guide.content.substring(0, 150)}...
                    </p>
                  </div>
                  <button
                    onClick={() => deleteGuide(guide.id)}
                    className="ml-4 p-2 text-gray-600 hover:text-accent-red hover:bg-accent-red/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {guides.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-lg">
                <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">아직 가이드가 없습니다</p>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  첫 가이드 추가
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <GuideModal
          solutionId={solutionId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadGuides();
          }}
        />
      )}
    </div>
  );
}

function GuideModal({
  solutionId,
  onClose,
  onSuccess,
}: {
  solutionId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'text' | 'pdf'>('pdf');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'install',
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('solution_id', String(solutionId));
      formDataObj.append('title', formData.title);
      formDataObj.append('content', formData.content);
      formDataObj.append('type', formData.type);

      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/solution-guides', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formDataObj,
      });

      if (!res.ok) throw new Error('Failed');
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('가이드 생성 실패');
    } finally {
      setUploading(false);
    }
  };

  const handlePdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('solution_id', String(solutionId));
      formDataObj.append('title', formData.title);
      formDataObj.append('type', formData.type);
      formDataObj.append('file', file);

      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/solution-guides/upload-pdf', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formDataObj,
      });

      if (!res.ok) throw new Error('Upload failed');
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('PDF 업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-raised border border-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">가이드 추가</h3>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
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
            <Upload className="w-4 h-4" />
            PDF 업로드 (권장)
          </button>
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
            <FileText className="w-4 h-4" />
            텍스트 입력
          </button>
        </div>

        {/* PDF Mode */}
        {mode === 'pdf' && (
          <form onSubmit={handlePdfSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">가이드 제목</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input w-full"
                placeholder="예: GrippinTower OTP 설치 가이드"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input w-full"
              >
                <option value="install">설치 가이드</option>
                <option value="operation">운영 가이드</option>
                <option value="troubleshooting">트러블슈팅 가이드</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">PDF 파일</label>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-600 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-upload-solution"
                />
                <label htmlFor="pdf-upload-solution" className="cursor-pointer">
                  <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                  {file ? (
                    <div>
                      <p className="text-sm text-brand font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-400">PDF 파일을 선택하세요</p>
                      <p className="text-xs text-gray-600 mt-1">
                        클릭하거나 드래그하여 업로드
                      </p>
                    </div>
                  )}
                </label>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                ✨ PDF에서 자동으로 텍스트를 추출하여 AI 검색에 활용합니다
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                취소
              </button>
              <button type="submit" disabled={uploading || !file} className="btn-primary flex-1">
                {uploading ? '업로드 중...' : 'PDF 업로드'}
              </button>
            </div>
          </form>
        )}

        {/* Text Mode */}
        {mode === 'text' && (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">가이드 제목</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input w-full"
                placeholder="예: 일일 점검 체크리스트"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">유형</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input w-full"
              >
                <option value="install">설치 가이드</option>
                <option value="operation">운영 가이드</option>
                <option value="troubleshooting">트러블슈팅 가이드</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">내용 (Markdown)</label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="input w-full font-mono text-sm"
                rows={12}
                placeholder="# 제목&#10;&#10;## 섹션&#10;&#10;내용..."
              />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                취소
              </button>
              <button type="submit" disabled={uploading} className="btn-primary flex-1">
                {uploading ? '생성 중...' : '생성'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
