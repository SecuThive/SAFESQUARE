'use client';

import Sidebar from '@/components/layout/Sidebar';
import TodoBoard from '@/components/todos2/TodoBoard';

export default function TodosPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
        <header className="flex-shrink-0 border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4 bg-surface-raised">
          <h1 className="text-sm font-semibold text-gray-100">할 일</h1>
          <p className="text-xs text-gray-500 mt-0.5">To-Do · 업무 및 개인 할 일 관리</p>
        </header>
        <div className="flex-1 overflow-hidden">
          <TodoBoard />
        </div>
      </div>
    </div>
  );
}
