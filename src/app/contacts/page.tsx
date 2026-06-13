'use client';

import Sidebar from '@/components/layout/Sidebar';
import ContactsPage from '@/components/contacts/ContactsPage';

export default function Page() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface">
        <header className="flex-shrink-0 border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4 bg-surface-raised">
          <h1 className="text-sm font-semibold text-gray-100">담당자 연락처</h1>
          <p className="text-xs text-gray-500 mt-0.5">프로젝트별 담당자 및 고객사 연락처 관리</p>
        </header>
        <div className="flex-1 overflow-hidden">
          <ContactsPage />
        </div>
      </div>
    </div>
  );
}
