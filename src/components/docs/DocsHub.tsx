'use client';

import { useState, useRef, useEffect } from 'react';
import type { Project } from '@/lib/types';
import { ChevronDown, FileText, ClipboardList, ClipboardCheck } from 'lucide-react';
import WSLGenerator from '@/components/wsl/WSLGenerator';
import InspectionReport from './InspectionReport';

interface Props {
  project: Project;
}

type DocType = 'wsl' | 'inspection';

interface DocMeta {
  id: DocType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const DOC_TYPES: DocMeta[] = [
  {
    id:          'wsl',
    label:       '작업 지시서',
    description: '작업 일정·절차·위험도·승인을 기록하는 작업 지시 문서',
    icon:        ClipboardList,
  },
  {
    id:          'inspection',
    label:       '정기 점검보고서',
    description: '시스템 항목별 점검 결과 및 조치 사항 보고 문서',
    icon:        ClipboardCheck,
  },
];

export default function DocsHub({ project }: Props) {
  const [current, setCurrent] = useState<DocType>('wsl');
  const [open,    setOpen]    = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentMeta = DOC_TYPES.find((d) => d.id === current)!;
  const Icon = currentMeta.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 문서 유형 선택 드롭다운 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-surface-raised no-print">
        <FileText className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">문서 유형</span>

        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-surface-overlay hover:border-gray-600 text-sm text-gray-200 transition-colors"
          >
            <Icon className="w-4 h-4 text-brand" />
            {currentMeta.label}
            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-surface-raised border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {DOC_TYPES.map((doc) => {
                const DIcon = doc.icon;
                const isActive = doc.id === current;
                return (
                  <button
                    key={doc.id}
                    onClick={() => { setCurrent(doc.id); setOpen(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-overlay transition-colors ${
                      isActive ? 'bg-brand/5 border-l-2 border-brand' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <DIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-brand' : 'text-gray-500'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isActive ? 'text-brand' : 'text-gray-200'}`}>{doc.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{doc.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 선택된 문서 컴포넌트 */}
      <div className="flex-1 overflow-hidden">
        {current === 'wsl'        && <WSLGenerator      project={project} />}
        {current === 'inspection' && <InspectionReport  project={project} />}
      </div>
    </div>
  );
}
