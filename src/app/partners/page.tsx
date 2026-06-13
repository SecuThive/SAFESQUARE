'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthMeta } from '@/lib/api';
import Sidebar from '@/components/layout/Sidebar';
import PartnersPage from '@/components/partners/PartnersPage';

export default function Partners() {
  const router = useRouter();
  useEffect(() => {
    if (!getAuthMeta()) router.replace('/login');
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-surface-raised">
          <h1 className="text-lg font-bold text-gray-100">파트너사 관리</h1>
          <p className="text-xs text-gray-500 mt-0.5">협력사 정보 및 프로젝트 연결을 관리합니다</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <PartnersPage />
        </div>
      </div>
    </div>
  );
}
