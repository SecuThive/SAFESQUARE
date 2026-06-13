'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { designQueueApi, type DesignJob } from '@/lib/api';
import {
  Cpu, ChevronDown, ChevronUp, X, ExternalLink,
  CheckCircle2, XCircle, Loader2, Clock, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

// ── 상태별 메타 ──────────────────────────────────────────────
const STATUS_META: Record<DesignJob['status'], { label: string; color: string; dot: string }> = {
  pending:   { label: '대기 중',  color: 'text-yellow-400', dot: 'bg-yellow-400' },
  running:   { label: '생성 중',  color: 'text-blue-400',   dot: 'bg-blue-400'   },
  completed: { label: '완료',     color: 'text-emerald-400',dot: 'bg-emerald-500'},
  failed:    { label: '실패',     color: 'text-red-400',    dot: 'bg-red-500'    },
  cancelled: { label: '취소됨',   color: 'text-gray-500',   dot: 'bg-gray-600'   },
};

function elapsed(from: string): string {
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function JobRow({ job, onCancel }: { job: DesignJob; onCancel: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[job.status];

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* 헤더 행 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50">
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', meta.dot,
          job.status === 'running' && 'animate-pulse')} />

        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-200 truncate">{job.label}</p>
          <p className="text-[10px] text-gray-500">
            {job.status === 'running' && job.started_at
              ? `실행 중 ${elapsed(job.started_at)} 경과`
              : job.status === 'pending'
              ? `대기 중 ${elapsed(job.queued_at)} 경과`
              : job.status === 'completed' && job.completed_at
              ? `완료 · ${job.quality_score != null ? `score ${job.quality_score}` : ''}`
              : job.status === 'failed'
              ? '실패'
              : '취소됨'}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 완료 시 링크 */}
          {job.status === 'completed' && job.result_slug && (
            <a
              href={`https://ui-syntax.com/design/${job.result_slug}`}
              target="_blank" rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
              title="결과 보기"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {/* 로그 토글 */}
          {job.log_tail && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-gray-500 hover:text-gray-300"
              title="로그 보기"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* 취소 버튼 (pending + running) */}
          {(job.status === 'pending' || job.status === 'running') && (
            <button
              onClick={() => onCancel(job.id)}
              className="text-gray-600 hover:text-red-400"
              title="취소"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 로그 패널 */}
      {expanded && job.log_tail && (
        <div className="bg-gray-950 px-3 py-2 max-h-40 overflow-y-auto">
          <pre className="text-[9px] text-gray-400 whitespace-pre-wrap leading-relaxed">
            {job.log_tail}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── 메인 패널 ─────────────────────────────────────────────────
export default function DesignQueuePanel() {
  const [jobs, setJobs] = useState<DesignJob[]>([]);
  const [open, setOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await designQueueApi.list(20);
      setJobs(data);
      const active = data.filter(j => j.status === 'pending' || j.status === 'running').length;
      setActiveCount(active);
    } catch {/* 조용히 무시 */}
  }, []);

  // 활성 잡이 있으면 5초, 없으면 30초 폴링
  useEffect(() => {
    fetchJobs();
    const tick = () => {
      fetchJobs();
    };
    pollingRef.current = setInterval(tick, activeCount > 0 ? 5000 : 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchJobs, activeCount]);

  async function handleCancel(jobId: number) {
    try {
      await designQueueApi.cancel(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
      setActiveCount(c => Math.max(0, c - 1));
    } catch (e: any) {
      alert(e.message ?? '취소 실패');
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }

  // 완료/실패/취소 잡은 최근 5개만 표시
  const activeJobs  = jobs.filter(j => j.status === 'pending' || j.status === 'running');
  const finishedJobs = jobs
    .filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled')
    .slice(0, 5);
  const visibleJobs = [...activeJobs, ...finishedJobs];

  if (jobs.length === 0 && activeCount === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72">
      {/* 패널 본체 */}
      {open && (
        <div className="mb-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* 패널 헤더 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-gray-200">디자인 생성 큐</span>
              {activeCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                  {activeCount}개 실행 중
                </span>
              )}
            </div>
            <button onClick={handleRefresh} className="text-gray-500 hover:text-gray-300">
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* 잡 목록 */}
          <div className="px-3 py-3 space-y-2 max-h-96 overflow-y-auto">
            {visibleJobs.length === 0 ? (
              <p className="text-[11px] text-gray-600 text-center py-4">잡이 없습니다</p>
            ) : (
              visibleJobs.map(job => (
                <JobRow key={job.id} job={job} onCancel={handleCancel} />
              ))
            )}
          </div>
        </div>
      )}

      {/* 플로팅 토글 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'ml-auto flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg transition-colors text-sm font-medium',
          activeCount > 0
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700',
        )}
      >
        {activeCount > 0
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Cpu className="w-4 h-4 text-purple-400" />}
        <span>
          {activeCount > 0 ? `생성 중 ${activeCount}` : '디자인 큐'}
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
