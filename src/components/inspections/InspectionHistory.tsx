'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/lib/types';
import { getAuthHeaders } from '@/lib/api';
import { FileText, Trash2, ChevronRight, Plus, X, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import InspectionReport from '@/components/docs/InspectionReport';
import { confirm } from '@/lib/confirm';

interface Record {
  id: number;
  title: string;
  inspected_at: string;
  doc_type: string;
  created_at: string;
  updated_at: string;
}

interface Props { project: Project; }

// 날짜별 그룹화
function groupByYear(records: Record[]) {
  const map = new Map<string, Record[]>();
  for (const r of records) {
    const year = r.inspected_at.slice(0, 4);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(r);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default function InspectionHistory({ project }: Props) {
  const [records,   setRecords]   = useState<Record[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<{ id: number; data: any } | null>(null);
  const [creating,  setCreating]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inspection-records?project_id=${project.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const openRecord = async (id: number) => {
    try {
      const res  = await fetch(`/api/inspection-records/${id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setSelected({ id, data: data.data });
      setCreating(false);
    } catch { /* ignore */ }
  };

  const deleteRecord = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!await confirm('이 점검보고서를 삭제할까요?')) return;
    await fetch(`/api/inspection-records/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setRecords(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleSaved = (id: number) => {
    load(); // 목록 갱신
  };

  // 신규 작성 모드
  if (creating) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-surface-raised flex-shrink-0">
          <button onClick={() => setCreating(false)} className="p-1 text-gray-400 hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-200">새 점검보고서 작성</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <InspectionReport
            project={project}
            onSaved={(id) => { handleSaved(id); setCreating(false); openRecord(id); }}
          />
        </div>
      </div>
    );
  }

  // 열람/수정 모드
  if (selected) {
    const rec = records.find(r => r.id === selected.id);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-surface-raised flex-shrink-0">
          <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{rec?.title}</p>
            <p className="text-[10px] text-gray-500">{rec?.inspected_at}</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <InspectionReport
            project={project}
            initialData={selected.data}
            recordId={selected.id}
            onSaved={handleSaved}
          />
        </div>
      </div>
    );
  }

  // 목록 모드
  const grouped = groupByYear(records);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 사이드 목록 */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-800 bg-surface-raised">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">점검 이력</h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 점검
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">불러오는 중...</div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <FileText className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">저장된 점검보고서가 없습니다</p>
              <p className="text-xs text-gray-600 mt-1">문서 탭에서 작성 후 저장하거나<br/>새 점검 버튼을 눌러주세요</p>
            </div>
          ) : (
            <div className="py-2">
              {grouped.map(([year, items]) => (
                <div key={year}>
                  {/* 연도 헤더 */}
                  <div className="flex items-center gap-2 px-4 py-2 mt-1">
                    <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-400">{year}년</span>
                    <span className="text-[10px] text-gray-600">({items.length}건)</span>
                  </div>
                  {/* 해당 연도 보고서 목록 */}
                  {items.map((rec) => (
                    <div
                      key={rec.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openRecord(rec.id)}
                      onKeyDown={e => e.key === 'Enter' && openRecord(rec.id)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-overlay transition-colors border-b border-gray-800/50 group cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-200 truncate leading-snug">{rec.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500">{rec.inspected_at}</span>
                            <span className="text-[10px] text-gray-600 bg-surface-overlay px-1.5 py-0.5 rounded">
                              {rec.doc_type === 'inspection_report' ? '점검보고서' : rec.doc_type}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            저장: {format(parseISO(rec.updated_at), 'MM/dd HH:mm', { locale: ko })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => deleteRecord(rec.id, e)}
                            className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 우측 안내 */}
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">보고서를 선택하거나 새 점검을 시작하세요</p>
          <p className="text-xs text-gray-600 mt-1">문서 탭에서 작성 후 저장하면 여기에 기록됩니다</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-brand text-white text-sm hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> 새 점검보고서 작성
          </button>
        </div>
      </div>
    </div>
  );
}
