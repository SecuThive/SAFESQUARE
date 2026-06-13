'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ToastContainer from '@/components/ui/ToastContainer';
import CommandPalette from '@/components/ui/CommandPalette';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DesignQueuePanel from '@/components/layout/DesignQueuePanel';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = usePathname();
  const isPublic = pathname === '/login' || pathname.startsWith('/clip') || pathname.startsWith('/dl/') || pathname.startsWith('/work-methods/share/');

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      {children}
      <ToastContainer />
      <ConfirmDialog />
      {!isPublic && (
        <>
          <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
          <DesignQueuePanel />
        </>
      )}
    </>
  );
}
