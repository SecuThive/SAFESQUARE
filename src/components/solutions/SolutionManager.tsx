'use client';

import { useEffect, useState } from 'react';
import {
  Package, Check, BookOpen, FileText, Wrench, Terminal,
  ChevronRight, Settings, Info,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api';
import clsx from 'clsx';

interface Solution {
  id: number;
  name: string;
  description: string | null;
  guide_count: number;
}

interface SolutionGuide {
  id: number;
  solution_id: number;
  title: string;
  content: string;
  type: string;
  file_path: string | null;
}

interface Props {
  projectId: number;
}

const TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  install:         { label: '설치',       color: 'bg-accent-green/10 text-accent-green',   icon: Terminal },
  troubleshooting: { label: '트러블슈팅', color: 'bg-accent-orange/10 text-accent-orange', icon: Wrench   },
  operation:       { label: '운영',       color: 'bg-brand/10 text-brand',                 icon: BookOpen },
};

export default function SolutionManager({ projectId }: Props) {
  const [allSolutions,     setAllSolutions]     = useState<Solution[]>([]);
  const [appliedIds,       setAppliedIds]       = useState<number[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  const [solutionGuides,   setSolutionGuides]   = useState<SolutionGuide[]>([]);
  const [selectedGuide,    setSelectedGuide]    = useState<SolutionGuide | null>(null);
  const [loadingGuides,    setLoadingGuides]    = useState(false);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const headers = { headers: getAuthHeaders() };
      const [allRes, projectRes] = await Promise.all([
        fetch('/api/solutions', headers),
        fetch(`/api/solutions/project-solutions?project_id=${projectId}`, headers),
      ]);
      const all     = await allRes.json();
      const project = await projectRes.json();
      setAllSolutions(Array.isArray(all) ? all : []);
      setAppliedIds(Array.isArray(project) ? project.map((ps: any) => ps.solution_id) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSolution = async (solutionId: number) => {
    const isApplied = appliedIds.includes(solutionId);
    try {
      const res = await fetch('/api/solutions/project-solutions', {
        method: isApplied ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ project_id: projectId, solution_id: solutionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        alert(err.detail ?? '저장 실패');
        return;
      }
      // 서버 상태로 재확인
      const updated = await fetch(`/api/solutions/project-solutions?project_id=${projectId}`, { headers: getAuthHeaders() });
      const data = await updated.json();
      setAppliedIds(data.map((ps: any) => ps.solution_id));
    } catch (err) {
      console.error(err);
      alert('서버 연결 오류');
    }
  };

  const selectSolution = async (solution: Solution) => {
    if (selectedSolution?.id === solution.id) {
      setSelectedSolution(null);
      setSolutionGuides([]);
      setSelectedGuide(null);
      return;
    }
    setSelectedSolution(solution);
    setSelectedGuide(null);
    setLoadingGuides(true);
    try {
      const res = await fetch(`/api/solution-guides?solution_id=${solution.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setSolutionGuides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSolutionGuides([]);
    } finally {
      setLoadingGuides(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Solution list ── */}
      <div className={clsx(
        'flex flex-col border-r border-gray-800 bg-surface-raised flex-shrink-0',
        selectedSolution ? 'w-72' : 'flex-1 max-w-xl',
      )}>
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">솔루션 적용</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            이 프로젝트에 구축된 솔루션을 선택하세요
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {allSolutions.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">등록된 솔루션이 없습니다</p>
              <p className="text-xs text-gray-600">
                하단 <span className="text-brand">설정</span>에서 솔루션을 추가하세요
              </p>
            </div>
          ) : (
            allSolutions.map((solution) => {
              const isApplied  = appliedIds.includes(solution.id);
              const isSelected = selectedSolution?.id === solution.id;

              return (
                <div
                  key={solution.id}
                  className={clsx(
                    'rounded-lg border transition-all cursor-pointer',
                    isSelected
                      ? 'border-brand bg-brand/5'
                      : isApplied
                      ? 'border-accent-green/30 bg-accent-green/5 hover:border-accent-green/50'
                      : 'border-gray-800 bg-surface-overlay hover:border-gray-700',
                  )}
                  onClick={() => selectSolution(solution)}
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isApplied ? 'bg-accent-green/10' : 'bg-gray-800',
                    )}>
                      <Package className={clsx('w-4 h-4', isApplied ? 'text-accent-green' : 'text-gray-500')} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx(
                          'text-sm font-medium truncate',
                          isApplied ? 'text-gray-100' : 'text-gray-400',
                        )}>
                          {solution.name}
                        </span>
                        {isApplied && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" />
                            적용됨
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                          <BookOpen className="w-3 h-3" />
                          가이드 {solution.guide_count}개
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Apply toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSolution(solution.id); }}
                        className={clsx(
                          'text-xs px-2 py-1 rounded border transition-colors',
                          isApplied
                            ? 'border-accent-green/30 text-accent-green hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                            : 'border-gray-700 text-gray-500 hover:border-brand hover:text-brand hover:bg-brand/10',
                        )}
                        title={isApplied ? '적용 해제' : '적용'}
                      >
                        {isApplied ? '해제' : '적용'}
                      </button>
                      <ChevronRight className={clsx(
                        'w-3.5 h-3.5 transition-transform',
                        isSelected ? 'rotate-90 text-brand' : 'text-gray-700',
                      )} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Info footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-600 leading-snug">
            솔루션 가이드 내용은 <span className="text-gray-500">설정</span>에서 관리됩니다.
            프로젝트별 커스텀 가이드는 <span className="text-gray-500">가이드 탭</span>에서 추가하세요.
          </p>
        </div>
      </div>

      {/* ── Middle: Solution guide list ── */}
      {selectedSolution && (
        <div className={clsx(
          'flex flex-col border-r border-gray-800 bg-surface flex-shrink-0',
          selectedGuide ? 'w-64' : 'flex-1',
        )}>
          <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-200">{selectedSolution.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">솔루션 가이드 (읽기 전용)</p>
            </div>
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full border',
              appliedIds.includes(selectedSolution.id)
                ? 'text-accent-green border-accent-green/30 bg-accent-green/10'
                : 'text-gray-500 border-gray-700',
            )}>
              {appliedIds.includes(selectedSolution.id) ? '적용됨' : '미적용'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingGuides ? (
              <div className="p-4 text-xs text-gray-500">로딩 중...</div>
            ) : solutionGuides.length === 0 ? (
              <div className="py-12 text-center px-4">
                <BookOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-1">등록된 가이드가 없습니다</p>
                <p className="text-[11px] text-gray-600">설정에서 가이드를 추가하세요</p>
              </div>
            ) : (
              solutionGuides.map((guide) => {
                const meta    = TYPE_META[guide.type] ?? TYPE_META.operation;
                const Icon    = meta.icon;
                const isActive = selectedGuide?.id === guide.id;
                return (
                  <div
                    key={guide.id}
                    onClick={() => setSelectedGuide(isActive ? null : guide)}
                    className={clsx(
                      'flex items-start gap-3 px-4 py-3 border-b border-gray-800/60 cursor-pointer transition-colors',
                      isActive ? 'bg-surface-overlay' : 'hover:bg-surface-overlay/50',
                    )}
                  >
                    <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', meta.color.split(' ')[1])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{guide.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx('badge text-[10px]', meta.color)}>{meta.label}</span>
                        {guide.file_path && (
                          <span className="badge text-[10px] bg-brand/10 text-brand">PDF</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={clsx(
                      'w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform',
                      isActive ? 'rotate-90 text-brand' : 'text-gray-700',
                    )} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Right: Guide content ── */}
      {selectedGuide && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 bg-surface-raised flex items-center gap-3 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-100 truncate">{selectedGuide.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {(() => {
                  const meta = TYPE_META[selectedGuide.type] ?? TYPE_META.operation;
                  return <span className={clsx('badge text-[10px]', meta.color)}>{meta.label}</span>;
                })()}
                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                  <Settings className="w-3 h-3" />
                  설정에서 관리
                </span>
              </div>
            </div>
            {selectedGuide.file_path && (
              <span className="badge text-xs bg-brand/10 text-brand border-brand/20 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                PDF
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="prose-dark max-w-none whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
              {selectedGuide.content || (
                <span className="text-gray-600 italic">내용이 없습니다.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
