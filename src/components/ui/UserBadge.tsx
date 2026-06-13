'use client';

import clsx from 'clsx';

// username → 색상 결정 (일관성 유지)
const COLORS = [
  'bg-violet-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-fuchsia-600',
  'bg-teal-600',
];

function colorFor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

interface UserBadgeProps {
  username: string;
  displayName?: string | null;
  size?: 'xs' | 'sm' | 'md';
  showName?: boolean;
  className?: string;
}

export default function UserBadge({
  username,
  displayName,
  size = 'sm',
  showName = true,
  className,
}: UserBadgeProps) {
  const label   = displayName || username;
  const initial = label.charAt(0).toUpperCase();
  const color   = colorFor(username); // 색상은 username 기준으로 일관성 유지

  const avatarSize = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-6 h-6 text-xs',
  }[size];

  const textSize = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
  }[size];

  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span className={clsx(
        'rounded-full flex items-center justify-center font-bold text-white flex-shrink-0',
        avatarSize, color,
      )}>
        {initial}
      </span>
      {showName && (
        <span className={clsx('text-gray-400 font-medium leading-none', textSize)}>
          {label}
        </span>
      )}
    </span>
  );
}
