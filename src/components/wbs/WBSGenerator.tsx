'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Trash2, ArrowUp, ArrowDown, FileDown, ChevronDown, ChevronRight,
  Save, Settings2, X, LayoutList, Search, Clock, User, StickyNote,
  CalendarDays, Hourglass, TrendingUp, Tag, Paperclip, Upload,
  FileText, FileImage, FileArchive, File, Download,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import type { Project } from '@/lib/types';
import DatePicker from '@/components/ui/DatePicker';
import { filesApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type WBSLevel    = 1 | 2 | 3;
type WBSStatus   = 'not_started' | 'in_progress' | 'done' | 'delayed';
type WBSPriority = 'critical' | 'high' | 'medium' | 'low' | '';

interface WBSAttachment {
  id: number;
  original_name: string;
  file_size: number;
  mime_type: string | null;
}

interface WBSItem {
  id: string;
  level: WBSLevel;
  title: string;
  assignee: string;
  startDate: string;
  endDate: string;
  duration: string;
  status: WBSStatus;
  note: string;
  // 상세 필드
  priority: WBSPriority;
  progress: number;
  estimatedHours: string;
  actualHours: string;
  description: string;
  tags: string;
  attachments: WBSAttachment[];
}

interface WBSData {
  projectName:    string;
  clientName:     string;
  docNumber:      string;
  version:        string;
  createdAt:      string;
  projectManager: string;
  items:          WBSItem[];
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<WBSStatus, { label: string; badge: string; printColor: string; dot: string }> = {
  not_started: { label: '미시작', badge: 'bg-gray-700/60 text-gray-400',      printColor: '#6b7280', dot: 'bg-gray-500'    },
  in_progress: { label: '진행중', badge: 'bg-blue-900/40 text-blue-300',       printColor: '#2563eb', dot: 'bg-blue-400'    },
  done:        { label: '완료',   badge: 'bg-emerald-900/40 text-emerald-300', printColor: '#16a34a', dot: 'bg-emerald-400' },
  delayed:     { label: '지연',   badge: 'bg-red-900/40 text-red-300',         printColor: '#dc2626', dot: 'bg-red-400'     },
};

const PRIORITY_META: Record<WBSPriority, { label: string; badge: string }> = {
  critical: { label: '긴급', badge: 'bg-red-900/50 text-red-300'      },
  high:     { label: '높음', badge: 'bg-orange-900/50 text-orange-300' },
  medium:   { label: '중간', badge: 'bg-yellow-900/50 text-yellow-300' },
  low:      { label: '낮음', badge: 'bg-gray-800 text-gray-500'        },
  '':       { label: '-',    badge: ''                                  },
};

const LEVEL_BG: Record<WBSLevel, string> = { 1: '#dce6f1', 2: '#f0f4fa', 3: '#ffffff' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2, 9); }

function makeDocNumber() {
  const d = new Date();
  return `WBS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-001`;
}

function computeCodes(items: WBSItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  const c = [0, 0, 0];
  for (const item of items) {
    if (item.level === 1)      { c[0]++; c[1]=0; c[2]=0; map[item.id] = String(c[0]); }
    else if (item.level === 2) { c[1]++; c[2]=0; map[item.id] = `${c[0]}.${c[1]}`; }
    else                       { c[2]++; map[item.id] = `${c[0]}.${c[1]}.${c[2]}`; }
  }
  return map;
}

function mkItem(level: WBSLevel): WBSItem {
  return {
    id: makeId(), level, title: '', assignee: '', startDate: '', endDate: '',
    duration: '', status: 'not_started', note: '',
    priority: '', progress: 0, estimatedHours: '', actualHours: '',
    description: '', tags: '', attachments: [],
  };
}

function migrateItem(raw: Partial<WBSItem>): WBSItem {
  return {
    id: raw.id ?? makeId(), level: (raw.level ?? 2) as WBSLevel,
    title: raw.title ?? '', assignee: raw.assignee ?? '',
    startDate: raw.startDate ?? '', endDate: raw.endDate ?? '',
    duration: raw.duration ?? '', status: (raw.status ?? 'not_started') as WBSStatus,
    note: raw.note ?? '', priority: (raw.priority ?? '') as WBSPriority,
    progress: raw.progress ?? 0, estimatedHours: raw.estimatedHours ?? '',
    actualHours: raw.actualHours ?? '', description: raw.description ?? '',
    tags: raw.tags ?? '', attachments: raw.attachments ?? [],
  };
}

const DEFAULT_ITEMS: WBSItem[] = [
  { id: makeId(), level: 1, title: '요구사항 분석',  assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '현황 분석',       assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '요구사항 정의',   assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 1, title: '설계',            assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '시스템 설계',     assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '네트워크 설계',   assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 1, title: '구현 / 설치',     assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '서버 구성',       assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '소프트웨어 설치', assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 1, title: '테스트',          assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '단위 테스트',     assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '통합 테스트',     assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 1, title: '완료 / 인수',     assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '최종 검수',       assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
  { id: makeId(), level: 2, title: '교육 / 인수인계', assignee: '', startDate: '', endDate: '', duration: '', status: 'not_started', note: '', priority: '', progress: 0, estimatedHours: '', actualHours: '', description: '', tags: '', attachments: [] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WBSGenerator({ project, projectId }: { project?: Project; projectId?: number }) {
  const today      = format(new Date(), 'yyyy-MM-dd');
  const storageKey = projectId ? `wbs_project_${projectId}` : null;

  const [addOpen,      setAddOpen]      = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set());
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<WBSStatus | ''>('');

  const addRef      = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const getInitial = (): WBSData => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<WBSData> & { items?: Partial<WBSItem>[] };
          return {
            projectName:    parsed.projectName    ?? project?.name ?? '',
            clientName:     parsed.clientName     ?? project?.client_name ?? '',
            docNumber:      parsed.docNumber      ?? makeDocNumber(),
            version:        parsed.version        ?? '1.0',
            createdAt:      parsed.createdAt      ?? today,
            projectManager: parsed.projectManager ?? '',
            items:          (parsed.items ?? []).map(migrateItem),
          };
        }
      } catch {}
    }
    return {
      projectName: project?.name ?? '', clientName: project?.client_name ?? '',
      docNumber: makeDocNumber(), version: '1.0', createdAt: today, projectManager: '',
      items: DEFAULT_ITEMS,
    };
  };

  const [data, setData] = useState<WBSData>(getInitial);

  // 자동 저장
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch {}
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [data]);

  // 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node))           setAddOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 인쇄 zoom 조정
  useEffect(() => {
    const A4_H = Math.round(297 * 96 / 25.4);
    const before = () => {
      document.querySelectorAll<HTMLElement>('.print-page').forEach(el => {
        el.style.zoom = '';
        const scale = Math.min(
          el.scrollWidth > el.clientWidth ? el.clientWidth / el.scrollWidth : 1,
          el.scrollHeight > A4_H          ? A4_H / el.scrollHeight          : 1,
        );
        if (scale < 1) el.style.zoom = String(scale);
      });
    };
    const after = () => document.querySelectorAll<HTMLElement>('.print-page').forEach(el => { el.style.zoom = ''; });
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint',  after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  // ── 변경 헬퍼 ──────────────────────────────────────────────────────────────

  const set = <K extends keyof WBSData>(k: K, v: WBSData[K]) =>
    setData(p => ({ ...p, [k]: v }));

  const setItem = (id: string, patch: Partial<WBSItem>) =>
    setData(p => ({ ...p, items: p.items.map(it => it.id === id ? { ...it, ...patch } : it) }));

  const addItem = (level: WBSLevel) => {
    const item = mkItem(level);
    setData(p => ({ ...p, items: [...p.items, item] }));
    setSelectedId(item.id);
    setAddOpen(false);
  };

  const removeItem = (id: string) => {
    if (selectedId === id) setSelectedId(null);
    setData(p => ({ ...p, items: p.items.filter(it => it.id !== id) }));
  };

  const moveItem = (idx: number, dir: -1 | 1) =>
    setData(p => {
      const arr = [...p.items];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return p;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...p, items: arr };
    });

  const toggleCollapse = (id: string) =>
    setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── 표시할 항목 계산 ───────────────────────────────────────────────────────

  const allCodes = useMemo(() => computeCodes(data.items), [data.items]);

  const displayItems = useMemo(() => {
    const hasFilter = search.trim() || filterStatus;

    // 필터 적용
    let items = data.items;
    if (hasFilter) {
      const q = search.toLowerCase();
      const matchIds = new Set(data.items
        .filter(it =>
          (!q || it.title.toLowerCase().includes(q) || it.assignee.toLowerCase().includes(q) || it.description.toLowerCase().includes(q) || it.tags.toLowerCase().includes(q)) &&
          (!filterStatus || it.status === filterStatus),
        )
        .map(it => it.id),
      );
      // 매칭 항목의 부모도 표시
      const show = new Set<string>();
      data.items.forEach((it, idx) => {
        if (!matchIds.has(it.id)) return;
        show.add(it.id);
        if (it.level >= 2) {
          for (let j = idx - 1; j >= 0; j--) {
            if (data.items[j].level < it.level) { show.add(data.items[j].id); if (data.items[j].level === 1) break; }
          }
        }
      });
      items = data.items.filter(it => show.has(it.id));
    }

    // collapse 적용 (필터 없을 때만)
    if (!hasFilter) {
      const result: WBSItem[] = [];
      let skipBelow = 0;
      for (const item of items) {
        if (skipBelow && item.level > skipBelow) continue;
        skipBelow = 0;
        result.push(item);
        if (item.level === 1 && collapsed.has(item.id)) skipBelow = 1;
      }
      return result;
    }
    return items;
  }, [data.items, search, filterStatus, collapsed]);

  // L1 그룹 진행률 계산
  const groupProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    let currentL1: string | null = null;
    for (const item of data.items) {
      if (item.level === 1) { currentL1 = item.id; map[item.id] = { done: 0, total: 0 }; }
      else if (currentL1) {
        map[currentL1].total++;
        if (item.status === 'done') map[currentL1].done++;
      }
    }
    return map;
  }, [data.items]);

  // 전체 통계
  const stats = {
    total:       data.items.length,
    done:        data.items.filter(i => i.status === 'done').length,
    in_progress: data.items.filter(i => i.status === 'in_progress').length,
    delayed:     data.items.filter(i => i.status === 'delayed').length,
    not_started: data.items.filter(i => i.status === 'not_started').length,
  };
  const doneRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const selectedItem = data.items.find(it => it.id === selectedId) ?? null;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── 관리 UI ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col h-full overflow-hidden print:hidden">

        {/* 헤더 */}
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-800 bg-surface-raised flex items-center gap-2 flex-wrap">
          <LayoutList className="w-4 h-4 text-brand flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-200 leading-none">WBS 일정 관리</h2>
            <p className="text-[10px] text-gray-600 mt-0.5">{data.docNumber} · v{data.version}</p>
          </div>

          {storageKey && saved && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400"><Save className="w-3 h-3" /> 저장됨</span>
          )}

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
            <input
              className="w-40 bg-surface border border-gray-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-brand/50 transition-colors"
              placeholder="검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* 상태 필터 */}
          <select
            className="select text-xs py-1.5 pr-7"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as WBSStatus | '')}
          >
            <option value="">전체 상태</option>
            {(Object.entries(STATUS_META) as [WBSStatus, typeof STATUS_META[WBSStatus]][]).map(([v, m]) => (
              <option key={v} value={v}>{m.label}</option>
            ))}
          </select>

          {/* 오른쪽 버튼 그룹 */}
          <div className="ml-auto flex items-center gap-2">

          {/* 문서 정보 */}
          <div ref={settingsRef} className="relative">
            <button
              onClick={() => setSettingsOpen(v => !v)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                settingsOpen ? 'bg-white/10 text-gray-200' : 'bg-white/[0.05] text-gray-400 hover:text-gray-200 hover:bg-white/[0.08]',
              )}
            >
              <Settings2 className="w-3.5 h-3.5" /> 문서 정보
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-[320px] rounded-xl shadow-2xl z-50 p-4 space-y-3"
                style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300">문서 정보</span>
                  <button onClick={() => setSettingsOpen(false)} className="text-gray-600 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                </div>
                {!project && (
                  <>
                    <SRow label="프로젝트명"><input className="input text-xs" value={data.projectName} onChange={e => set('projectName', e.target.value)} placeholder="프로젝트명" /></SRow>
                    <SRow label="고객사"><input className="input text-xs" value={data.clientName} onChange={e => set('clientName', e.target.value)} placeholder="고객사명" /></SRow>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <SRow label="문서번호"><input className="input text-xs" value={data.docNumber} onChange={e => set('docNumber', e.target.value)} /></SRow>
                  <SRow label="버전"><input className="input text-xs" value={data.version} onChange={e => set('version', e.target.value)} placeholder="1.0" /></SRow>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SRow label="작성일"><div className="input py-0 px-0"><DatePicker value={data.createdAt} onChange={v => set('createdAt', v)} /></div></SRow>
                  <SRow label="PM"><input className="input text-xs" value={data.projectManager} onChange={e => set('projectManager', e.target.value)} placeholder="담당자명" /></SRow>
                </div>
              </div>
            )}
          </div>

          {/* 항목 추가 */}
          <div ref={addRef} className="relative">
            <button
              onClick={() => setAddOpen(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-gray-300 text-xs font-medium hover:bg-white/[0.1] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 항목 추가 <ChevronDown className={clsx('w-3 h-3 transition-transform', addOpen && 'rotate-180')} />
            </button>
            {addOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl z-50 py-1 min-w-[130px]"
                style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.08)' }}>
                {([1, 2, 3] as WBSLevel[]).map(lv => (
                  <button key={lv} onClick={() => addItem(lv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors text-left">
                    <span className={clsx('text-[9px] px-1.5 py-0.5 rounded font-bold',
                      lv === 1 && 'bg-brand/20 text-brand', lv === 2 && 'bg-gray-700 text-gray-300', lv === 3 && 'bg-gray-800 text-gray-400')}>L{lv}</span>
                    {lv === 1 ? '대분류' : lv === 2 ? '중분류' : '세부항목'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PDF */}
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>

          </div>{/* /오른쪽 버튼 그룹 */}
        </div>

        {/* 진행률 바 */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-800/60 bg-surface flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${doneRate}%` }} />
            </div>
            <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">{doneRate}%</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 text-[11px]">
            <span className="text-gray-500">{stats.total}개</span>
            <span className="text-emerald-400">{stats.done} 완료</span>
            <span className="text-blue-400">{stats.in_progress} 진행</span>
            <span className="text-red-400">{stats.delayed} 지연</span>
          </div>
        </div>

        {/* 메인 영역: 테이블 + 상세 패널 */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* 테이블 */}
          <div className="flex-1 overflow-auto">
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
                <LayoutList className="w-8 h-8" />
                <p className="text-sm">{search || filterStatus ? '검색 결과가 없습니다' : '항목을 추가하세요'}</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-xs" style={{ minWidth: 780 }}>
                <thead>
                  <tr style={{ background: '#0d111a', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="sticky top-0 z-10">
                    {['코드', '작업명', '담당자', '시작일', '종료일', '진행률', '상태', '우선순위', ''].map((h, i) => (
                      <th key={i} className={clsx(
                        'py-2 px-2 text-[11px] font-semibold text-gray-500 whitespace-nowrap text-left',
                        i === 0 && 'pl-4 w-20', i === 8 && 'w-16 pr-3',
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, idx) => {
                    const isL1       = item.level === 1;
                    const isSelected = item.id === selectedId;
                    const sm         = STATUS_META[item.status];
                    const pm         = PRIORITY_META[item.priority];
                    const gp         = isL1 ? groupProgress[item.id] : null;
                    const isCollapsed = collapsed.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(isSelected ? null : item.id)}
                        className={clsx(
                          'group border-b cursor-pointer transition-colors',
                          isSelected
                            ? 'border-brand/30 bg-brand/[0.08]'
                            : isL1
                              ? 'border-gray-700/40 bg-brand/[0.02] hover:bg-brand/[0.06]'
                              : 'border-gray-800/50 hover:bg-white/[0.02]',
                        )}
                      >
                        {/* 코드 */}
                        <td className="pl-3 py-2 pr-1 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isL1 && (
                              <button
                                onClick={e => { e.stopPropagation(); toggleCollapse(item.id); }}
                                className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
                              >
                                {isCollapsed
                                  ? <ChevronRight className="w-3 h-3" />
                                  : <ChevronDown className="w-3 h-3" />
                                }
                              </button>
                            )}
                            {!isL1 && <span className="w-4 flex-shrink-0" />}
                            <span className={clsx(
                              'text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0',
                              isL1 ? 'bg-brand/20 text-brand' : item.level === 2 ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-gray-500',
                            )}>L{item.level}</span>
                            <span className="font-mono text-[11px] text-gray-500">{allCodes[item.id]}</span>
                          </div>
                        </td>

                        {/* 작업명 */}
                        <td className="py-2 px-2" style={{ paddingLeft: `${(item.level - 1) * 16 + 8}px` }}>
                          <div className="flex items-center gap-1.5">
                            <span className={clsx(
                              'truncate max-w-[240px]',
                              isL1 ? 'font-semibold text-gray-200' : item.level === 2 ? 'font-medium text-gray-300' : 'text-gray-400',
                              !item.title && 'text-gray-700 italic',
                            )}>
                              {item.title || '(미입력)'}
                            </span>
                            {item.description && <StickyNote className="w-3 h-3 text-gray-600 flex-shrink-0" />}
                            {item.attachments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-gray-600 flex-shrink-0">
                                <Paperclip className="w-3 h-3" />{item.attachments.length}
                              </span>
                            )}
                            {isL1 && gp && gp.total > 0 && (
                              <span className="text-[10px] text-gray-600 flex-shrink-0">{gp.done}/{gp.total}</span>
                            )}
                          </div>
                        </td>

                        {/* 담당자 */}
                        <td className="py-2 px-2 w-24">
                          <span className="text-gray-400 truncate block max-w-[80px]">{item.assignee || <span className="text-gray-700">-</span>}</span>
                        </td>

                        {/* 시작일 */}
                        <td className="py-2 px-2 w-28 text-gray-400 whitespace-nowrap">
                          {item.startDate || <span className="text-gray-700">-</span>}
                        </td>

                        {/* 종료일 */}
                        <td className="py-2 px-2 w-28 text-gray-400 whitespace-nowrap">
                          {item.endDate || <span className="text-gray-700">-</span>}
                        </td>

                        {/* 진행률 */}
                        <td className="py-2 px-2 w-28">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                              <div
                                className={clsx('h-full rounded-full transition-all', item.status === 'delayed' ? 'bg-red-500' : 'bg-brand')}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-gray-500 w-7 text-right">{item.progress}%</span>
                          </div>
                        </td>

                        {/* 상태 */}
                        <td className="py-2 px-2 w-20">
                          <span className={clsx('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium', sm.badge)}>
                            <span className={clsx('w-1 h-1 rounded-full', sm.dot)} />
                            {sm.label}
                          </span>
                        </td>

                        {/* 우선순위 */}
                        <td className="py-2 px-2 w-20">
                          {item.priority ? (
                            <span className={clsx('text-[11px] px-2 py-0.5 rounded font-medium', pm.badge)}>{pm.label}</span>
                          ) : (
                            <span className="text-gray-700 text-[11px]">-</span>
                          )}
                        </td>

                        {/* 액션 */}
                        <td className="py-2 pr-3 pl-1">
                          <div
                            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end"
                            onClick={e => e.stopPropagation()}
                          >
                            <button onClick={() => moveItem(data.items.indexOf(item), -1)} className="p-1 text-gray-600 hover:text-gray-300 rounded">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => moveItem(data.items.indexOf(item), 1)} className="p-1 text-gray-600 hover:text-gray-300 rounded">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeItem(item.id)} className="p-1 text-gray-600 hover:text-red-400 rounded">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 우측 상세 패널 */}
          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              code={allCodes[selectedItem.id] ?? ''}
              onChange={patch => setItem(selectedItem.id, patch)}
              onClose={() => setSelectedId(null)}
              projectId={projectId}
            />
          )}
        </div>
      </div>

      {/* 인쇄 전용 */}
      <div id="doc-preview" className="hidden print:block">
        <WBSPrintView data={data} codes={allCodes} />
      </div>
    </div>
  );
}

// ─── 상세 패널 ────────────────────────────────────────────────────────────────

function DetailPanel({
  item, code, onChange, onClose, projectId,
}: {
  item: WBSItem;
  code: string;
  onChange: (p: Partial<WBSItem>) => void;
  onClose: () => void;
  projectId?: number;
}) {
  const sm = STATUS_META[item.status];

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l border-gray-800 bg-surface-raised overflow-hidden"
      style={{ width: 340 }}
    >
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-bold',
            item.level === 1 ? 'bg-brand/20 text-brand' : item.level === 2 ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-400',
          )}>L{item.level}</span>
          <span className="text-[11px] font-mono text-gray-500">{code}</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-600 hover:text-gray-300 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* 작업명 */}
        <div>
          <input
            className="w-full bg-transparent text-sm font-semibold text-gray-200 outline-none border-b border-gray-800 pb-1.5 focus:border-brand/50 transition-colors placeholder-gray-700"
            value={item.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="작업명 입력..."
          />
        </div>

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <Row icon={<User className="w-3.5 h-3.5" />} label="담당자">
            <input className="input text-xs flex-1" value={item.assignee} onChange={e => onChange({ assignee: e.target.value })} placeholder="담당자명" />
          </Row>

          <Row icon={null} label="상태">
            <select
              className={clsx('select text-xs flex-1 font-medium rounded-full', sm.badge)}
              value={item.status}
              onChange={e => onChange({ status: e.target.value as WBSStatus })}
            >
              {(Object.entries(STATUS_META) as [WBSStatus, typeof STATUS_META[WBSStatus]][]).map(([v, m]) => (
                <option key={v} value={v} className="bg-gray-900 text-gray-200">{m.label}</option>
              ))}
            </select>
          </Row>

          <Row icon={null} label="우선순위">
            <select
              className="select text-xs flex-1"
              value={item.priority}
              onChange={e => onChange({ priority: e.target.value as WBSPriority })}
            >
              <option value="">없음</option>
              {(Object.entries(PRIORITY_META).filter(([v]) => v !== '') as [WBSPriority, typeof PRIORITY_META[WBSPriority]][]).map(([v, m]) => (
                <option key={v} value={v} className="bg-gray-900">{m.label}</option>
              ))}
            </select>
          </Row>
        </Section>

        {/* 일정 */}
        <Section title="일정">
          <Row icon={<CalendarDays className="w-3.5 h-3.5" />} label="시작일">
            <div className="flex-1">
              <DatePicker value={item.startDate} onChange={v => onChange({ startDate: v })} placeholder="시작일 선택" rangeEnd={item.endDate} />
            </div>
          </Row>
          <Row icon={<CalendarDays className="w-3.5 h-3.5" />} label="종료일">
            <div className="flex-1">
              <DatePicker value={item.endDate} onChange={v => onChange({ endDate: v })} placeholder="종료일 선택" rangeStart={item.startDate} />
            </div>
          </Row>
          <Row icon={null} label="기간">
            <input className="input text-xs flex-1" value={item.duration} onChange={e => onChange({ duration: e.target.value })} placeholder="예: 5일" />
          </Row>
        </Section>

        {/* 진행률 */}
        <Section title="진행률">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">완료율</span>
              <span className="text-xs font-bold text-brand">{item.progress}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={item.progress}
              onChange={e => onChange({ progress: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#4f8ef7' }}
            />
            <div className="flex justify-between text-[10px] text-gray-700">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>
        </Section>

        {/* 시간 추적 */}
        <Section title="시간 추적">
          <Row icon={<Hourglass className="w-3.5 h-3.5" />} label="예상 (h)">
            <input
              className="input text-xs flex-1" type="number" min={0}
              value={item.estimatedHours}
              onChange={e => onChange({ estimatedHours: e.target.value })}
              placeholder="예: 8"
            />
          </Row>
          <Row icon={<Clock className="w-3.5 h-3.5" />} label="실제 (h)">
            <input
              className="input text-xs flex-1" type="number" min={0}
              value={item.actualHours}
              onChange={e => onChange({ actualHours: e.target.value })}
              placeholder="예: 6"
            />
          </Row>
          {item.estimatedHours && item.actualHours && (
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="w-3 h-3 text-gray-600" />
              <span className="text-[11px] text-gray-500">
                소진율&nbsp;
                <span className={clsx('font-semibold', Number(item.actualHours) > Number(item.estimatedHours) ? 'text-red-400' : 'text-emerald-400')}>
                  {Math.round((Number(item.actualHours) / Number(item.estimatedHours)) * 100)}%
                </span>
              </span>
            </div>
          )}
        </Section>

        {/* 태그 */}
        <Section title="태그">
          <Row icon={<Tag className="w-3.5 h-3.5" />} label="태그">
            <input
              className="input text-xs flex-1"
              value={item.tags}
              onChange={e => onChange({ tags: e.target.value })}
              placeholder="쉼표로 구분 (예: 보안,네트워크)"
            />
          </Row>
          {item.tags && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{t}</span>
              ))}
            </div>
          )}
        </Section>

        {/* 상세 설명 */}
        <Section title="상세 설명">
          <textarea
            className="textarea text-xs w-full min-h-[120px]"
            value={item.description}
            onChange={e => onChange({ description: e.target.value })}
            placeholder="작업에 대한 상세 설명, 기술적 메모, 참고사항 등을 자유롭게 작성하세요..."
          />
        </Section>

        {/* 비고 */}
        <Section title="비고">
          <input className="input text-xs w-full" value={item.note} onChange={e => onChange({ note: e.target.value })} placeholder="간단한 메모" />
        </Section>

        {/* 파일 첨부 */}
        <Section title={`첨부파일 ${item.attachments.length > 0 ? `(${item.attachments.length})` : ''}`}>
          <AttachmentZone
            attachments={item.attachments}
            projectId={projectId}
            onAdd={att => onChange({ attachments: [...item.attachments, att] })}
            onRemove={id => onChange({ attachments: item.attachments.filter(a => a.id !== id) })}
          />
        </Section>
      </div>
    </div>
  );
}

// ─── 인쇄용 뷰 ────────────────────────────────────────────────────────────────

function WBSPrintView({ data, codes }: { data: WBSData; codes: Record<string, string> }) {
  return (
    <div className="print-page bg-white text-gray-900 text-[11px] leading-snug">
      <div className="text-center mb-5">
        <h1 className="text-[18px] font-bold tracking-wider">업무 분류 체계 (WBS)</h1>
        <p className="text-xs text-gray-500 mt-1">Work Breakdown Structure</p>
      </div>
      <table className="w-full border-collapse text-xs mb-4">
        <tbody>
          <tr>
            <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap w-24">프로젝트명</th>
            <td className="border border-gray-400 px-2 py-1" colSpan={3}>{data.projectName}</td>
          </tr>
          <tr>
            <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">고객사</th>
            <td className="border border-gray-400 px-2 py-1">{data.clientName}</td>
            <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap w-16">PM</th>
            <td className="border border-gray-400 px-2 py-1">{data.projectManager}</td>
          </tr>
          <tr>
            <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">문서번호</th>
            <td className="border border-gray-400 px-2 py-1">{data.docNumber}</td>
            <th style={{ backgroundColor: '#dce6f1' }} className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">작성일 / 버전</th>
            <td className="border border-gray-400 px-2 py-1">{data.createdAt} / v{data.version}</td>
          </tr>
        </tbody>
      </table>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {['WBS코드', '작업명', '담당자', '시작일', '종료일', '기간', '진행률', '상태', '우선순위', '비고'].map(h => (
              <th key={h} style={{ backgroundColor: '#dce6f1' }}
                className="border border-gray-400 px-2 py-1 text-center font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map(item => (
            <tr key={item.id} style={{ backgroundColor: LEVEL_BG[item.level] }}>
              <td className="border border-gray-400 px-2 py-0.5 font-mono text-center whitespace-nowrap">{codes[item.id]}</td>
              <td className="border border-gray-400 py-0.5" style={{ paddingLeft: `${(item.level - 1) * 10 + 6}px` }}>
                <span style={{ fontWeight: item.level === 1 ? 700 : item.level === 2 ? 600 : 400 }}>
                  {item.level === 1 && <span className="mr-1">▶</span>}
                  {item.level === 2 && <span className="mr-1 text-gray-400">├─</span>}
                  {item.level === 3 && <span className="mr-1 text-gray-400">└─</span>}
                  {item.title}
                </span>
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-center">{item.assignee}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-center whitespace-nowrap">{item.startDate}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-center whitespace-nowrap">{item.endDate}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-center">{item.duration}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-center">{item.progress}%</td>
              <td className="border border-gray-400 px-2 py-0.5 text-center whitespace-nowrap"
                style={{ color: STATUS_META[item.status].printColor, fontWeight: 600 }}>
                {STATUS_META[item.status].label}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-center">
                {item.priority ? PRIORITY_META[item.priority].label : '-'}
              </td>
              <td className="border border-gray-400 px-2 py-0.5">{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 소형 컴포넌트 ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-800/80">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 w-20 flex-shrink-0 text-gray-600">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

// ─── 파일 첨부 ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="w-4 h-4 text-gray-500" />;
  if (mime.startsWith('image/'))       return <FileImage   className="w-4 h-4 text-blue-400" />;
  if (mime.includes('pdf'))            return <FileText    className="w-4 h-4 text-red-400" />;
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz'))
                                       return <FileArchive className="w-4 h-4 text-yellow-400" />;
  if (mime.startsWith('text/') || mime.includes('document') || mime.includes('sheet'))
                                       return <FileText    className="w-4 h-4 text-brand" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

function AttachmentZone({
  attachments, projectId, onAdd, onRemove,
}: {
  attachments: WBSAttachment[];
  projectId?: number;
  onAdd: (a: WBSAttachment) => void;
  onRemove: (id: number) => void;
}) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging,   setDragging]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!projectId) { setError('프로젝트에 연결된 WBS에서만 파일 첨부가 가능합니다.'); return; }
    setError('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await filesApi.upload(projectId, file);
        onAdd({ id: result.id, original_name: result.original_name, file_size: result.file_size, mime_type: result.mime_type });
      }
    } catch (e: any) {
      setError(e.message ?? '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (att: WBSAttachment) => {
    setDeletingId(att.id);
    try {
      await filesApi.delete(att.id);
      onRemove(att.id);
    } catch {
      setError('삭제 실패');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* 업로드 영역 */}
      {projectId ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
          className={clsx(
            'flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
            dragging  ? 'border-brand bg-brand/10' : 'border-gray-800 hover:border-gray-700 hover:bg-white/[0.02]',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          {uploading ? (
            <div className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
          ) : (
            <Upload className={clsx('w-5 h-5', dragging ? 'text-brand' : 'text-gray-600')} />
          )}
          <span className="text-[11px] text-gray-600">
            {uploading ? '업로드 중...' : '클릭하거나 파일을 드래그하세요'}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => upload(e.target.files)}
          />
        </div>
      ) : (
        <p className="text-[11px] text-gray-600 text-center py-3">프로젝트에 연결된 WBS에서만 파일을 첨부할 수 있습니다.</p>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {/* 첨부 목록 */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface hover:bg-white/[0.04] group transition-colors"
            >
              <FileIcon mime={att.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-300 truncate">{att.original_name}</p>
                <p className="text-[10px] text-gray-600">{formatBytes(att.file_size)}</p>
              </div>
              <button
                onClick={() => filesApi.download(att.id, att.original_name)}
                className="p-1 text-gray-600 hover:text-brand transition-colors opacity-0 group-hover:opacity-100"
                title="다운로드"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(att)}
                disabled={deletingId === att.id}
                className="p-1 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="삭제"
              >
                {deletingId === att.id
                  ? <div className="w-3.5 h-3.5 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
