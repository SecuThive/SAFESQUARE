'use client';

import Sidebar from '@/components/layout/Sidebar';
import MinutesList from '@/components/minutes/MinutesList';

export default function MinutesPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
        <header className="flex-shrink-0 border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4 bg-surface-raised">
          <h1 className="text-sm font-semibold text-gray-100">회의록</h1>
          <p className="text-xs text-gray-500 mt-0.5">Meeting Minutes · 회의 내용 및 결정사항 기록</p>
        </header>
        <div className="flex-1 overflow-hidden">
          <MinutesList />
        </div>
      </div>
    </div>
  );
}
