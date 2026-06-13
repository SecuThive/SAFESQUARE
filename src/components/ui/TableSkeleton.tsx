'use client';

import clsx from 'clsx';

interface TableSkeletonProps {
  /** 스켈레톤 행 수 (기본 5) */
  rows?: number;
  /** 행 높이 클래스 (기본 'h-14') */
  rowHeight?: string;
  /** 컨테이너 패딩 클래스 (기본 'p-4') */
  className?: string;
}

/**
 * 목록 페이지 로딩 중 표시할 통일된 스켈레톤 컴포넌트.
 * worklogs / mails / contacts / incidents 등에서 공통 사용.
 */
export default function TableSkeleton({
  rows = 5,
  rowHeight = 'h-14',
  className = 'space-y-2',
}: TableSkeletonProps) {
  return (
    <div className={className} aria-label="불러오는 중" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            rowHeight,
            'bg-surface-raised border border-gray-800 rounded-xl animate-pulse',
            // 뒤쪽 행을 조금 더 투명하게 해서 자연스러운 페이드 효과
            i >= rows - 2 && 'opacity-60',
            i === rows - 1 && 'opacity-30',
          )}
        />
      ))}
    </div>
  );
}
