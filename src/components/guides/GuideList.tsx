'use client';

import { useEffect, useState, useCallback } from 'react';
import { guidesApi } from '@/lib/api';
import type { Guide, GuideType, GuideVersion } from '@/lib/types';
import GuideModal from './GuideModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Plus, Edit2, Trash2, BookOpen, Wrench, Terminal, Zap,
  ChevronLeft, History, ArrowLeft, CheckSquare, Square, X,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';

interface Props { projectId: number; }

const TYPE_META: Record<GuideType, { label: string; color: string; icon: React.ElementType }> = {
  install:         { label: '설치',   color: 'bg-accent-green/10 text-accent-green',   icon: Terminal },
  troubleshooting: { label: '트러블', color: 'bg-accent-orange/10 text-accent-orange', icon: Wrench   },
  operation:       { label: '운영',   color: 'bg-brand/10 text-brand',                 icon: BookOpen },
};

/* ── 라인 diff 유틸 ─────────────────────────────────────────── */
type DiffLine = { type: 'same' | 'add' | 'remove'; text: string };

function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const m = a.length, n = b.length;

  // LCS 테이블
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  // 역추적
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
      result.unshift({ type: 'same',   text: a[i-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.unshift({ type: 'add',    text: b[j-1] });
      j--;
    } else {
      result.unshift({ type: 'remove', text: a[i-1] });
      i--;
    }
  }
  return result;
}

/* ════════════════════════════════════════════════════════════ */
export default function GuidesTab({ projectId }: Props) {
  const [guides,    setGuides]    = useState<Guide[]>([]);
  const [filter,    setFilter]    = useState<GuideType | 'all'>('all');
  const [selected,  setSelected]  = useState<Guide | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editGuide, setEditGuide] = useState<Guide | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [embedding, setEmbedding] = useState(false);

  // 일괄 선택
  const [selectMode,   setSelectMode]   = useState(false);
  const [checkedIds,   setCheckedIds]   = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // 버전 관련 상태
  const [showVersions,    setShowVersions]    = useState(false);
  const [versions,        setVersions]        = useState<GuideVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [diffVersion,     setDiffVersion]     = useState<GuideVersion | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    guidesApi.list(projectId)
      .then(setGuides)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); setSelected(null); setShowVersions(false); }, [projectId]);

  // 가이드 선택 변경 시 버전 패널 초기화
  useEffect(() => {
    setShowVersions(false);
    setDiffVersion(null);
    setVersions([]);
  }, [selected?.id]);

  async function openVersionHistory() {
    if (!selected) return;
    setVersionsLoading(true);
    setShowVersions(true);
    setDiffVersion(null);
    try {
      const v = await guidesApi.listVersions(selected.id);
      setVersions(v);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  const handleDelete = async (guide: Guide) => {
    if (!await confirm(`"${guide.title}" 가이드를 삭제하시겠습니까?`)) return;
    await guidesApi.delete(guide.id);
    setGuides((prev) => prev.filter((g) => g.id !== guide.id));
    if (selected?.id === guide.id) setSelected(null);
  };

  const handleEmbedAll = async () => {
    setEmbedding(true);
    const result = await guidesApi.embedAll(projectId).catch(() => null);
    setEmbedding(false);
    if (result) alert(`임베딩 완료: ${result.embedded}/${result.total} 가이드`);
    else alert('Ollama가 실행 중이지 않습니다.');
  };

  const filtered = filter === 'all' ? guides : guides.filter((g) => g.type === filter);

  function toggleSelectMode() {
    setSelectMode(v => !v);
    setCheckedIds(new Set());
  }

  function toggleCheck(id: number) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map(g => g.id)));
    }
  }

  async function handleBulkDelete() {
    if (checkedIds.size === 0) return;
    if (!await confirm(`선택한 ${checkedIds.size}개의 가이드를 삭제하시겠습니까?`, { title: '일괄 삭제', confirmLabel: '전체 삭제' })) return;
    setBulkDeleting(true);
    try {
      await guidesApi.bulkDelete([...checkedIds]);
      setGuides(prev => prev.filter(g => !checkedIds.has(g.id)));
      if (selected && checkedIds.has(selected.id)) setSelected(null);
      setCheckedIds(new Set());
      setSelectMode(false);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* ── 가이드 목록 패널 ── */}
      <div className={clsx(
        'flex flex-col border-r border-gray-800 bg-surface-raised',
        selected ? 'w-72 flex-shrink-0' : 'flex-1',
      )}>
        {/* 툴바 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          {selectMode ? (
            /* 선택 모드 툴바 */
            <>
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                {checkedIds.size === filtered.length && filtered.length > 0
                  ? <CheckSquare className="w-4 h-4 text-brand" />
                  : <Square className="w-4 h-4" />
                }
                전체
              </button>
              <span className="text-xs text-gray-600 flex-1">
                {checkedIds.size > 0 ? `${checkedIds.size}개 선택됨` : '항목을 선택하세요'}
              </span>
              {checkedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  {bulkDeleting ? '삭제 중…' : `${checkedIds.size}개 삭제`}
                </button>
              )}
              <button
                onClick={toggleSelectMode}
                className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors"
                title="선택 취소"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            /* 기본 툴바 */
            <>
              <div className="flex gap-1 flex-1">
                {(['all', 'install', 'troubleshooting', 'operation'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={clsx(
                      'px-3 py-1 rounded text-xs font-medium transition-colors',
                      filter === t ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-overlay',
                    )}
                  >
                    {t === 'all' ? '전체' : TYPE_META[t].label}
                  </button>
                ))}
              </div>
              <button onClick={handleEmbedAll} disabled={embedding} title="AI 임베딩 생성" className="btn-ghost p-1.5 text-gray-500">
                <Zap className={clsx('w-4 h-4', embedding && 'animate-pulse text-brand')} />
              </button>
              <button
                onClick={toggleSelectMode}
                title="일괄 선택"
                className="btn-ghost p-1.5 text-gray-500 hover:text-gray-300"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditGuide(null); setShowModal(true); }} className="btn-primary py-1 text-xs">
                <Plus className="w-3 h-3" /> 추가
              </button>
            </>
          )}
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-gray-500">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">가이드 없음</p>
              <button onClick={() => { setEditGuide(null); setShowModal(true); }} className="mt-3 text-xs text-brand hover:underline">
                첫 가이드 작성 →
              </button>
            </div>
          ) : (
            filtered.map((guide) => {
              const meta = TYPE_META[guide.type];
              const Icon = meta.icon;
              const isActive  = selected?.id === guide.id;
              const isChecked = checkedIds.has(guide.id);
              return (
                <div
                  key={guide.id}
                  onClick={() => {
                    if (selectMode) { toggleCheck(guide.id); }
                    else { setSelected(isActive ? null : guide); }
                  }}
                  className={clsx(
                    'group flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-800/60 transition-colors',
                    selectMode && isChecked ? 'bg-brand/10' :
                    isActive ? 'bg-surface-overlay' : 'hover:bg-surface-overlay/50',
                  )}
                >
                  {/* 체크박스 (선택 모드에서만) */}
                  {selectMode && (
                    <div className="mt-0.5 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleCheck(guide.id); }}>
                      {isChecked
                        ? <CheckSquare className="w-4 h-4 text-brand" />
                        : <Square className="w-4 h-4 text-gray-600" />
                      }
                    </div>
                  )}

                  {!selectMode && <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', meta.color.split(' ')[1])} />}

                  <div className="flex-1 min-w-0">
                    <div className={clsx(
                      'text-sm truncate',
                      isChecked ? 'text-gray-100' : 'text-gray-200',
                    )}>
                      {guide.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('badge text-[10px]', meta.color)}>{meta.label}</span>
                      <span className="text-[10px] text-gray-600">
                        {format(new Date(guide.updated_at), 'MM/dd HH:mm')}
                      </span>
                    </div>
                  </div>

                  {!selectMode && (
                    <div className="hidden group-hover:flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditGuide(guide); setShowModal(true); }}
                        className="p-1 rounded hover:bg-white/10 text-gray-500"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(guide); }}
                        className="p-1 rounded hover:bg-accent-red/10 text-gray-500 hover:text-accent-red"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 가이드 상세 / 버전 패널 ── */}
      {selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-surface-raised flex-shrink-0">
            <button onClick={() => setSelected(null)} className="btn-ghost p-1.5">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-100 truncate">
                {showVersions && diffVersion ? `v${diffVersion.version} vs 현재` : selected.title}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={clsx('badge text-[10px]', TYPE_META[selected.type].color)}>
                  {TYPE_META[selected.type].label}
                </span>
                <span className="text-[10px] text-gray-600">
                  수정: {format(new Date(selected.updated_at), 'yyyy/MM/dd HH:mm')}
                </span>
              </div>
            </div>
            {showVersions ? (
              <button onClick={() => { setShowVersions(false); setDiffVersion(null); }} className="btn-ghost text-xs">
                <ArrowLeft className="w-3 h-3" /> 본문
              </button>
            ) : (
              <>
                <button onClick={openVersionHistory} className="btn-ghost text-xs" title="버전 기록">
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">버전 기록</span>
                </button>
                <button onClick={() => { setEditGuide(selected); setShowModal(true); }} className="btn-ghost text-xs">
                  <Edit2 className="w-3 h-3" /> 수정
                </button>
              </>
            )}
          </div>

          {/* 본문 or 버전 패널 */}
          {showVersions ? (
            <VersionPanel
              guide={selected}
              versions={versions}
              loading={versionsLoading}
              diffVersion={diffVersion}
              onSelectDiff={setDiffVersion}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="prose-dark max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.75rem' }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    },
                  }}
                >
                  {selected.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <GuideModal
          projectId={projectId}
          guide={editGuide}
          onClose={() => setShowModal(false)}
          onSave={(g) => {
            setGuides((prev) => {
              const exists = prev.findIndex((x) => x.id === g.id);
              if (exists >= 0) {
                const next = [...prev];
                next[exists] = g;
                return next;
              }
              return [g, ...prev];
            });
            setSelected(g);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ── 버전 기록 패널 ─────────────────────────────────────────── */
function VersionPanel({
  guide, versions, loading, diffVersion, onSelectDiff,
}: {
  guide: Guide;
  versions: GuideVersion[];
  loading: boolean;
  diffVersion: GuideVersion | null;
  onSelectDiff: (v: GuideVersion | null) => void;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 버전 목록 */}
      <div className="w-56 flex-shrink-0 border-r border-gray-800 overflow-y-auto bg-surface-raised">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-gray-400">버전 기록</p>
          <p className="text-[10px] text-gray-600 mt-0.5">수정 시 자동 저장</p>
        </div>

        {/* 현재 버전 */}
        <button
          onClick={() => onSelectDiff(null)}
          className={clsx(
            'w-full text-left px-4 py-3 border-b border-gray-800/60 transition-colors',
            !diffVersion ? 'bg-surface-overlay' : 'hover:bg-surface-overlay/50',
          )}
        >
          <p className="text-xs font-semibold text-brand">현재 버전</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {format(new Date(guide.updated_at), 'yyyy/MM/dd HH:mm', { locale: ko })}
          </p>
        </button>

        {loading ? (
          <div className="p-4 text-xs text-gray-500">로딩 중...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-xs text-gray-600">아직 수정 이력이 없습니다</div>
        ) : (
          versions.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelectDiff(v)}
              className={clsx(
                'w-full text-left px-4 py-3 border-b border-gray-800/60 transition-colors',
                diffVersion?.id === v.id ? 'bg-surface-overlay' : 'hover:bg-surface-overlay/50',
              )}
            >
              <p className="text-xs text-gray-300">v{v.version}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{v.title}</p>
              <p className="text-[10px] text-gray-600">
                {format(new Date(v.created_at), 'yyyy/MM/dd HH:mm', { locale: ko })}
              </p>
            </button>
          ))
        )}
      </div>

      {/* 내용 / diff */}
      <div className="flex-1 overflow-y-auto">
        {!diffVersion ? (
          /* 현재 버전 전문 */
          <div className="px-8 py-6 prose-dark max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide.content}</ReactMarkdown>
          </div>
        ) : (
          /* diff 뷰 */
          <DiffViewer oldVersion={diffVersion} currentContent={guide.content} />
        )}
      </div>
    </div>
  );
}

/* ── Diff 뷰어 ──────────────────────────────────────────────── */
function DiffViewer({ oldVersion, currentContent }: { oldVersion: GuideVersion; currentContent: string }) {
  const diff = lineDiff(oldVersion.content, currentContent);
  const added   = diff.filter((l) => l.type === 'add').length;
  const removed = diff.filter((l) => l.type === 'remove').length;

  return (
    <div className="h-full flex flex-col">
      {/* 요약 */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800 bg-surface-raised flex-shrink-0">
        <span className="text-[10px] text-gray-500">v{oldVersion.version} → 현재</span>
        {added > 0   && <span className="text-[10px] text-green-400 font-medium">+{added}줄</span>}
        {removed > 0 && <span className="text-[10px] text-red-400  font-medium">-{removed}줄</span>}
        {added === 0 && removed === 0 && <span className="text-[10px] text-gray-600">변경 없음</span>}
      </div>

      {/* diff 본문 */}
      <div className="flex-1 overflow-y-auto">
        <pre className="font-mono text-xs leading-relaxed p-4">
          {diff.map((line, i) => (
            <div
              key={i}
              className={clsx(
                'px-2 py-px',
                line.type === 'add'    && 'bg-green-900/30 text-green-300',
                line.type === 'remove' && 'bg-red-900/30   text-red-300 line-through opacity-70',
                line.type === 'same'   && 'text-gray-400',
              )}
            >
              <span className="select-none mr-3 text-gray-700 w-4 inline-block">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              {line.text || ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
