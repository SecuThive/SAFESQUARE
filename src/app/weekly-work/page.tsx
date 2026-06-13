'use client';

import Sidebar from '@/components/layout/Sidebar';
import WorkWeeklyPage from '@/components/work-weekly/WorkWeeklyPage';

export default function Page() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'oklch(0.14 0.010 245)' }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <WorkWeeklyPage />
      </main>
    </div>
  );
}
