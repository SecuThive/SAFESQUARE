'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import WBSGenerator from '@/components/wbs/WBSGenerator';
import { useAppStore } from '@/store';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/types';
import { GitBranch, ChevronRight, Search, Activity, CheckCircle2, Archive } from 'lucide-react';
import clsx from 'clsx';

const STATUS_META = {
  active:    { label: '운영 중', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  completed: { label: '완료',    color: 'text-brand',       dot: 'bg-brand'       },
  archived:  { label: '보관',    color: 'text-gray-500',    dot: 'bg-gray-500'    },
};

export default function WBSPage() {
  const { projects, setProjects } = useAppStore();
  const [selected, setSelected] = useState<Project | null>(null);
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (projects.length > 0) return;
    setLoading(true);
    projectsApi.list()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex min-w-0 overflow-hidden">

        {/* ── 프로젝트 목록 패널 ──────────────────────────── */}
        <aside className="w-64 flex-shrink-0 flex flex-col border-r border-gray-800 bg-surface-raised">
          {/* 헤더 */}
          <div className="px-4 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-brand" />
              <h1 className="text-sm font-semibold text-gray-200">WBS 관리</h1>
            </div>
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                className="w-full bg-surface border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-brand/50 transition-colors"
                placeholder="프로젝트 검색..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-10">프로젝트가 없습니다</p>
            )}
            {!loading && filtered.map(p => {
              const sm = STATUS_META[p.status] ?? STATUS_META.archived;
              const isActive = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group',
                    isActive
                      ? 'bg-brand/10 border-r-2 border-brand'
                      : 'hover:bg-white/[0.03]',
                  )}
                >
                  {/* 아이콘 */}
                  <div className={clsx(
                    'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors',
                    isActive
                      ? 'bg-brand/20 text-brand'
                      : 'bg-gray-800 text-gray-500 group-hover:bg-gray-700 group-hover:text-gray-300',
                  )}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0">
                    <p className={clsx(
                      'text-xs font-medium truncate',
                      isActive ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-300',
                    )}>
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={clsx('w-1 h-1 rounded-full flex-shrink-0', sm.dot)} />
                      <span className={clsx('text-[10px]', sm.color)}>{sm.label}</span>
                      {p.client_name && (
                        <span className="text-[10px] text-gray-600 truncate">· {p.client_name}</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className={clsx(
                    'w-3 h-3 flex-shrink-0 transition-colors',
                    isActive ? 'text-brand' : 'text-gray-700 group-hover:text-gray-500',
                  )} />
                </button>
              );
            })}
          </div>

          {/* 하단 통계 */}
          <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-3 text-[11px] text-gray-600">
            <span>{projects.filter(p => p.status === 'active').length} 운영중</span>
            <span className="text-gray-800">·</span>
            <span>{projects.length} 전체</span>
          </div>
        </aside>

        {/* ── WBS 콘텐츠 ──────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
          {selected ? (
            <WBSGenerator key={selected.id} project={selected} projectId={selected.id} />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
        <GitBranch className="w-7 h-7 text-brand/60" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-400 mb-1">프로젝트를 선택하세요</p>
        <p className="text-xs text-gray-600">좌측 목록에서 프로젝트를 선택하면<br />해당 프로젝트의 WBS를 관리할 수 있습니다.</p>
      </div>
    </div>
  );
}
