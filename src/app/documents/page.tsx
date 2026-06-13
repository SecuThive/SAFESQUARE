import { Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import PersonalDocsPage from '@/components/personal-docs/PersonalDocsPage';

export default function DocumentsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-surface-raised border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        }>
          <PersonalDocsPage />
        </Suspense>
      </main>
    </div>
  );
}
