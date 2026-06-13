'use client';

import Sidebar from '@/components/layout/Sidebar';
import WSLGenerator from '@/components/wsl/WSLGenerator';

export default function WSLPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
        <header className="flex-shrink-0 border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4 bg-surface-raised">
          <h1 className="text-sm font-semibold text-gray-100">작업 지시서 (WSL)</h1>
          <p className="text-xs text-gray-500 mt-0.5">Work Statement Letter · 신규 프로젝트 작업 전 작성</p>
        </header>
        <div className="flex-1 overflow-hidden">
          <WSLGenerator />
        </div>
      </div>
    </div>
  );
}
