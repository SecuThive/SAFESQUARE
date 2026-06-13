'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { personalDocsApi, getAuthHeaders } from '@/lib/api';
import type { PersonalDocument, PersonalDocGroup } from '@/lib/api';
import DocumentEditorModal from './DocumentEditorModal';
import {
  Upload, Download, Trash2, File, FileText, FileImage,
  FileArchive, FileCode, FolderPlus, Folder, FolderOpen,
  ChevronDown, ChevronRight, ChevronLeft, ChevronUp, MoreHorizontal, Pencil, Check, X,
  Loader2, Search, Grid3X3, List, UploadCloud, HardDrive,
  Link, Copy, Link2Off, Eye, FilePen, Star, RotateCcw, CheckSquare, Square,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';

/* ── 복사 유틸 ──────────────────────────────────────────────────────── */
function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCopy(text));
  } else {
    execCopy(text);
  }
}
function execCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand('copy'); } catch { /* ignore */ }
  document.body.removeChild(el);
}

/* ── 일회성 다운로드 링크 모달 ──────────────────────────────────────── */
const DL_COUNT_OPTIONS = [
  { value: 1,  label: '1회' },
  { value: 3,  label: '3회' },
  { value: 5,  label: '5회' },
  { value: 10, label: '10회' },
];

function DownloadLinkModal({
  doc,
  onClose,
}: {
  doc: PersonalDocument;
  onClose: () => void;
}) {
  const [loading,    setLoading]    = useState(false);
  const [maxDl,      setMaxDl]      = useState(1);
  const [linkInfo,   setLinkInfo]   = useState<{ token: string; expires_at: string; max_downloads: number } | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error,      setError]      = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // XXXXXXXX → XXXX-XXXX 형식
  const shortCode  = linkInfo ? `${linkInfo.token.slice(0, 4)}-${linkInfo.token.slice(4)}` : null;
  // 단축 페이지 URL: /dl/XXXX-XXXX
  const downloadUrl = linkInfo ? `${origin}/dl/${shortCode}` : null;

  async function generate() {
    setLoading(true); setError('');
    try {
      const res = await personalDocsApi.createDownloadLink(doc.id, maxDl);
      setLinkInfo({ token: res.token, expires_at: res.expires_at, max_downloads: res.max_downloads });
    } catch {
      setError('링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!downloadUrl) return;
    copyToClipboard(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCodeCopy() {
    if (!shortCode) return;
    copyToClipboard(shortCode.replace('-', ''));
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-surface-raised border border-gray-700/80">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
              <Link className="w-3.5 h-3.5 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">다운로드 링크 생성</h2>
              <p className="text-[10px] text-gray-600 truncate max-w-[240px]">{doc.original_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!linkInfo ? (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                생성 후 <strong className="text-gray-400">24시간</strong> 내 유효.
                로그인 없이 누구나 접근 가능하니 주의하세요.
              </p>

              {/* 다운로드 횟수 선택 */}
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 font-medium">다운로드 허용 횟수</p>
                <div className="flex gap-2">
                  {DL_COUNT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMaxDl(opt.value)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                        maxDl === opt.value
                          ? 'bg-brand/15 border-brand/50 text-brand'
                          : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 text-brand border border-brand/30 bg-brand/10 hover:bg-brand/15"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                링크 생성
              </button>
            </>
          ) : (
            <div className="space-y-3">
              {/* 만료 + 횟수 안내 */}
              <div className="flex items-center gap-1.5 text-[11px] text-amber-500/80">
                <span>⏱</span>
                <span>만료: {format(new Date(linkInfo.expires_at), 'yyyy.MM.dd HH:mm', { locale: ko })} · {linkInfo.max_downloads}회 다운로드 가능</span>
              </div>

              {/* 짧은 코드 — 손으로 입력하기 쉬운 코드 */}
              <div className="rounded-xl bg-gray-900/80 border border-gray-700/60 p-4 text-center space-y-1">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest">단축 코드</p>
                <p className="text-3xl font-mono font-bold tracking-[0.2em] text-brand">{shortCode}</p>
                <p className="text-[10px] text-gray-600">다른 컴퓨터에서 직접 입력하세요</p>
              </div>

              {/* 코드 복사 */}
              <button
                onClick={handleCodeCopy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all text-gray-400 border border-gray-700/50 hover:border-gray-600 hover:text-gray-300"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {codeCopied ? '코드 복사됨!' : '코드 복사'}
              </button>

              {/* 전체 URL */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800/60 border border-gray-700/60">
                <Link className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                <span className="flex-1 text-xs text-gray-400 truncate font-mono">{downloadUrl}</span>
              </div>

              {/* URL 복사 버튼 */}
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-brand border border-brand/30 bg-brand/10 hover:bg-brand/15"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사됨!' : '전체 URL 복사'}
              </button>

              {/* 새 링크 생성 */}
              <button
                onClick={() => { setLinkInfo(null); setCopied(false); setCodeCopied(false); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Link2Off className="w-3.5 h-3.5" /> 새 링크 생성
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const EDITABLE_EXTS = new Set(['hwp', 'docx', 'doc', 'odt', 'txt', 'md']);
function isEditable(name: string) {
  return EDITABLE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

/* ── 파일 미리보기 모달 ─────────────────────────────────────────────── */
function FilePreviewModal({
  doc, onClose, onDownload,
}: {
  doc: PersonalDocument;
  onClose: () => void;
  onDownload: (d: PersonalDocument) => void;
}) {
  const [blobUrl,     setBlobUrl]     = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [previewErr,  setPreviewErr]  = useState('');

  const mime = doc.mime_type ?? '';
  const ext  = doc.original_name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = mime.startsWith('image/');
  const isPdf   = mime.includes('pdf') || ext === 'pdf';
  const isText  = mime.startsWith('text/') ||
    /^(txt|md|json|xml|csv|log|yaml|yml|toml|sh|py|js|ts|jsx|tsx|go|rs|java|css|html|env|ini|cfg)$/.test(ext);
  const canPreview = isImage || isPdf || isText;

  useEffect(() => {
    let objectUrl = '';
    if (!canPreview) { setLoading(false); return; }
    fetch(`/api/personal-docs/${doc.id}/download`, { headers: getAuthHeaders() })
      .then(async res => {
        if (!res.ok) throw new Error('미리보기 로드 실패');
        if (isText) {
          setTextContent(await res.text());
        } else {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      })
      .catch(e => setPreviewErr(e.message))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-surface-raised border border-gray-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700/60 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{doc.original_name}</p>
            <span className="text-xs text-gray-500 flex-shrink-0 font-mono">{fmtSize(doc.file_size)}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={() => onDownload(doc)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-brand border border-brand/30 bg-brand/10 hover:bg-brand/15 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> 다운로드
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* 컨텐츠 */}
        <div className="flex-1 overflow-auto min-h-0 flex items-center justify-center bg-gray-950/40">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
              <p className="text-sm text-gray-500">미리보기 로드 중…</p>
            </div>
          ) : previewErr ? (
            <p className="text-sm text-red-400 py-16">{previewErr}</p>
          ) : isImage && blobUrl ? (
            <img src={blobUrl} alt={doc.original_name} className="max-w-full object-contain p-4" style={{ maxHeight: '75vh' }} />
          ) : isPdf && blobUrl ? (
            <iframe src={blobUrl} className="w-full" style={{ height: '75vh' }} title={doc.original_name} />
          ) : isText && textContent !== null ? (
            <pre className="w-full overflow-auto p-6 text-xs text-gray-300 font-mono whitespace-pre-wrap break-words" style={{ minHeight: '30vh', maxHeight: '75vh' }}>
              {textContent.slice(0, 200_000)}
              {textContent.length > 200_000 && '\n\n… (일부만 표시됩니다)'}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
                <File className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-sm text-gray-500">이 파일 형식은 미리보기를 지원하지 않습니다</p>
              <button
                onClick={() => onDownload(doc)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-brand border border-brand/30 bg-brand/10 hover:bg-brand/15 transition-colors"
              >
                <Download className="w-4 h-4" /> 다운로드
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── 유틸 ─────────────────────────────────────────────────────────── */
function fmtSize(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

type FileTypeInfo = {
  label: string;
  iconColor: string;
  bgColor: string;
  badgeColor: string;
  icon: React.ReactNode;
};

function getGroupDepth(groupId: number, allGroups: PersonalDocGroup[]): number {
  const g = allGroups.find(x => x.id === groupId);
  if (!g || g.parent_id === null) return 0;
  return 1 + getGroupDepth(g.parent_id, allGroups);
}

function flattenGroups(allGroups: PersonalDocGroup[]): PersonalDocGroup[] {
  const result: PersonalDocGroup[] = [];
  const visit = (parentId: number | null, depth: number) => {
    allGroups
      .filter(g => g.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(g => { result.push(g); visit(g.id, depth + 1); });
  };
  visit(null, 0);
  return result;
}

function getFileTypeInfo(mime: string | null, name: string): FileTypeInfo {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.includes('pdf') || ext === 'pdf')
    return { label: 'PDF',  iconColor: 'text-red-400',     bgColor: 'bg-red-500/15',     badgeColor: 'bg-red-500/25 text-red-300',     icon: <FileText    className="w-8 h-8" /> };
  if (['doc','docx'].includes(ext) || mime?.includes('word') || mime?.includes('document'))
    return { label: 'DOCX', iconColor: 'text-blue-400',    bgColor: 'bg-blue-500/15',    badgeColor: 'bg-blue-500/25 text-blue-300',    icon: <FileText    className="w-8 h-8" /> };
  if (['xls','xlsx'].includes(ext) || mime?.includes('excel') || mime?.includes('spreadsheet'))
    return { label: 'XLSX', iconColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15', badgeColor: 'bg-emerald-500/25 text-emerald-300', icon: <FileText  className="w-8 h-8" /> };
  if (['ppt','pptx'].includes(ext) || mime?.includes('powerpoint') || mime?.includes('presentation'))
    return { label: 'PPTX', iconColor: 'text-amber-400',   bgColor: 'bg-amber-500/15',   badgeColor: 'bg-amber-500/25 text-amber-300',   icon: <FileText    className="w-8 h-8" /> };
  if (mime?.startsWith('image/'))
    return { label: ext.toUpperCase() || 'IMG', iconColor: 'text-pink-400', bgColor: 'bg-pink-500/15', badgeColor: 'bg-pink-500/25 text-pink-300', icon: <FileImage className="w-8 h-8" /> };
  if (/^(zip|tar|gz|rar|7z)$/.test(ext))
    return { label: ext.toUpperCase(), iconColor: 'text-yellow-400', bgColor: 'bg-yellow-500/15', badgeColor: 'bg-yellow-500/25 text-yellow-300', icon: <FileArchive className="w-8 h-8" /> };
  if (/^(json|xml|js|ts|py|go|rs|java|cs|cpp|c|html|css|sh)$/.test(ext))
    return { label: ext.toUpperCase(), iconColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15', badgeColor: 'bg-emerald-500/25 text-emerald-300', icon: <FileCode className="w-8 h-8" /> };
  return { label: ext.toUpperCase() || 'FILE', iconColor: 'text-gray-400', bgColor: 'bg-gray-700/40', badgeColor: 'bg-gray-700 text-gray-400', icon: <File className="w-8 h-8" /> };
}

function getFolderPath(folderId: number, groups: PersonalDocGroup[]): PersonalDocGroup[] {
  const group = groups.find(g => g.id === folderId);
  if (!group) return [];
  if (group.parent_id === null) return [group];
  return [...getFolderPath(group.parent_id, groups), group];
}

/* ── FolderNode ────────────────────────────────────────────────────── */
function FolderNode({
  group, allGroups, depth, selectedId, onSelect, expandedIds, onToggle,
  onRename, onDelete, onAddChild, onDropDoc,
}: {
  group: PersonalDocGroup;
  allGroups: PersonalDocGroup[];
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onAddChild: (parentId: number, name: string) => void;
  onDropDoc: (docId: number, targetGroupId: number | null) => void;
}) {
  const [dropActive, setDropActive] = useState(false);
  const children = allGroups.filter(g => g.parent_id === group.id).sort((a, b) => a.sort_order - b.sort_order);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(group.id);
  const isSelected = selectedId === group.id;
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const [showActions, setShowActions] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childName, setChildName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);
  useEffect(() => { if (creatingChild) childInputRef.current?.focus(); }, [creatingChild]);

  const confirmRename = () => {
    if (nameInput.trim()) onRename(group.id, nameInput.trim());
    setRenaming(false);
  };

  const startAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatingChild(true);
    if (!expandedIds.has(group.id)) onToggle(group.id);
  };

  const confirmAddChild = () => {
    if (childName.trim()) onAddChild(group.id, childName.trim());
    setChildName('');
    setCreatingChild(false);
  };

  return (
    <div>
      <div
        className={clsx(
          'group/node flex items-center gap-1 rounded-lg cursor-pointer transition-colors select-none',
          isSelected
            ? 'bg-brand/10 text-brand'
            : dropActive
              ? 'bg-brand/20 text-brand ring-1 ring-brand/50'
              : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200',
        )}
        style={{ paddingLeft: `${6 + depth * 14}px`, paddingRight: 6, paddingTop: 5, paddingBottom: 5 }}
        onClick={() => !renaming && onSelect(group.id)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onDragOver={e => { if (e.dataTransfer.types.includes('text/doc-id')) { e.preventDefault(); setDropActive(true); } }}
        onDragLeave={() => setDropActive(false)}
        onDrop={e => {
          e.preventDefault(); setDropActive(false);
          const docId = parseInt(e.dataTransfer.getData('text/doc-id'));
          if (!isNaN(docId)) onDropDoc(docId, group.id);
        }}
      >
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
          onClick={e => { e.stopPropagation(); if (hasChildren || creatingChild) onToggle(group.id); }}
        >
          {(hasChildren || creatingChild)
            ? (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
            : <span className="w-3" />
          }
        </button>
        {(isExpanded || isSelected)
          ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
          : <Folder     className="w-3.5 h-3.5 flex-shrink-0" />
        }
        {renaming ? (
          <input
            ref={inputRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-surface border border-brand rounded px-1.5 py-0 text-xs text-gray-100 focus:outline-none"
          />
        ) : (
          <span className={clsx('flex-1 truncate text-xs', isSelected && 'font-semibold')}>{group.name}</span>
        )}
        {!renaming && showActions && (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={startAddChild}
              className="p-0.5 rounded hover:bg-brand/15 text-gray-600 hover:text-brand transition-colors"
              title="소그룹 추가"
            ><FolderPlus className="w-2.5 h-2.5" /></button>
            <button
              onClick={() => { setNameInput(group.name); setRenaming(true); }}
              className="p-0.5 rounded hover:bg-gray-700/60 text-gray-600 hover:text-gray-300 transition-colors"
            ><Pencil className="w-2.5 h-2.5" /></button>
            <button
              onClick={() => onDelete(group.id)}
              className="p-0.5 rounded hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-colors"
            ><Trash2 className="w-2.5 h-2.5" /></button>
          </div>
        )}
      </div>

      {/* 소그룹 인라인 입력 */}
      {creatingChild && (
        <div
          className="flex items-center gap-1 py-1 pr-1.5"
          style={{ paddingLeft: `${6 + (depth + 1) * 14 + 4}px` }}
        >
          <Folder className="w-3.5 h-3.5 text-brand flex-shrink-0" />
          <input
            ref={childInputRef}
            value={childName}
            onChange={e => setChildName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmAddChild();
              if (e.key === 'Escape') { setCreatingChild(false); setChildName(''); }
            }}
            placeholder="소그룹 이름"
            className="flex-1 bg-surface border border-brand/40 rounded px-1.5 py-0.5 text-xs text-gray-100 placeholder:text-gray-600 focus:outline-none"
          />
          <button onClick={confirmAddChild} className="p-0.5 text-green-400 hover:text-green-300 transition-colors"><Check className="w-3 h-3" /></button>
          <button onClick={() => { setCreatingChild(false); setChildName(''); }} className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"><X className="w-3 h-3" /></button>
        </div>
      )}

      {isExpanded && children.map(child => (
        <FolderNode
          key={child.id}
          group={child}
          allGroups={allGroups}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onRename={onRename}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onDropDoc={onDropDoc}
        />
      ))}
    </div>
  );
}

/* ── FolderCard (그리드 뷰 — 서브그룹) ──────────────────────────── */
function FolderCard({ group, onClick }: { group: PersonalDocGroup; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group border border-gray-700/60 rounded-xl bg-surface-raised overflow-hidden hover:border-amber-500/50 hover:shadow cursor-pointer transition-all"
    >
      <div className="relative h-20 flex items-center justify-center bg-amber-500/10">
        <FolderOpen className="w-9 h-9 text-amber-400" />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs text-gray-200 truncate font-medium leading-tight">{group.name}</p>
        <p className="text-[10px] text-gray-500 mt-1">폴더</p>
      </div>
    </div>
  );
}

/* ── FolderListRow (리스트 뷰 — 서브그룹) ────────────────────────── */
function FolderListRow({ group, onClick }: { group: PersonalDocGroup; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 hover:bg-gray-800/25 transition-colors cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/15">
        <FolderOpen className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-xs text-gray-200 truncate font-medium">{group.name}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono flex-shrink-0 bg-amber-500/20 text-amber-300">폴더</span>
      </div>
      <div className="w-[100px] flex-shrink-0 text-[11px] text-gray-600 hidden md:block">—</div>
      <div className="w-[140px] flex-shrink-0 text-[11px] text-gray-600 hidden sm:block">—</div>
      <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-600 text-right font-mono">—</div>
      <div className="w-[60px] flex-shrink-0" />
    </div>
  );
}

/* ── FileCard (그리드 뷰) ─────────────────────────────────────────── */
function FileCard({
  doc, onDownload, onDelete, onMoveDoc, onCreateLink, onPreview, onRename, onEdit, onToggleFavorite, onRestore,
  allGroups, downloading, deleting, selected, onSelectToggle, anySelected,
}: {
  doc: PersonalDocument;
  allGroups: PersonalDocGroup[];
  onDownload: (d: PersonalDocument) => void;
  onDelete: (d: PersonalDocument) => void;
  onMoveDoc: (docId: number, groupId: number | null) => void;
  onCreateLink: (d: PersonalDocument) => void;
  onPreview: (d: PersonalDocument) => void;
  onRename: (docId: number, name: string) => void;
  onEdit: (d: PersonalDocument) => void;
  onToggleFavorite: (d: PersonalDocument) => void;
  onRestore?: (d: PersonalDocument) => void;
  downloading: number | null;
  deleting: number | null;
  selected: boolean;
  onSelectToggle: (id: number) => void;
  anySelected: boolean;
}) {
  const { label, iconColor, bgColor, badgeColor, icon } = getFileTypeInfo(doc.mime_type, doc.original_name);
  const [showMenu,   setShowMenu]   = useState(false);
  const [menuPos,    setMenuPos]    = useState({ top: 0, right: 0 });
  const [renaming,   setRenaming]   = useState(false);
  const [nameInput,  setNameInput]  = useState(doc.original_name);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setShowMenu(v => !v);
  };

  const startRename = () => {
    setNameInput(doc.original_name);
    setRenaming(true);
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select(); }, 50);
  };

  const confirmRename = () => {
    const name = nameInput.trim();
    if (name && name !== doc.original_name) onRename(doc.id, name);
    setRenaming(false);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
        setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div
      className={clsx(
        'group border rounded-xl bg-surface-raised overflow-hidden hover:border-brand/50 hover:shadow transition-all relative',
        selected ? 'border-brand/60 bg-brand/5' : 'border-gray-700/60',
      )}
      draggable={!anySelected}
      onDragStart={e => { e.dataTransfer.setData('text/doc-id', String(doc.id)); e.dataTransfer.effectAllowed = 'move'; }}
    >
      {/* 체크박스 */}
      <button
        onClick={e => { e.stopPropagation(); onSelectToggle(doc.id); }}
        className={clsx(
          'absolute top-2 left-2 z-10 transition-opacity',
          selected || anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {selected
          ? <CheckSquare className="w-4 h-4 text-brand" />
          : <Square className="w-4 h-4 text-gray-500" />
        }
      </button>

      {/* 즐겨찾기 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(doc); }}
        className={clsx(
          'absolute top-2 right-2 z-10 transition-opacity',
          doc.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        title={doc.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      >
        <Star className={clsx('w-3.5 h-3.5', doc.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-gray-500 hover:text-amber-400')} />
      </button>

      {/* 썸네일 */}
      <div
        className={clsx('relative h-20 flex items-center justify-center cursor-pointer', bgColor)}
        onClick={() => !anySelected && onPreview(doc)}
      >
        <span className={iconColor}>{icon}</span>
        <span className={clsx('absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide', badgeColor)}>
          {label}
        </span>
        {/* 호버 액션 */}
        {!anySelected && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 bg-gray-900/50 transition-opacity">
            {onRestore ? (
              <>
                <button onClick={e => { e.stopPropagation(); onRestore(doc); }}
                  className="p-1.5 rounded-lg bg-surface-raised text-emerald-400 hover:bg-emerald-500/15 transition-colors" title="복원">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete(doc); }}
                  className="p-1.5 rounded-lg bg-surface-raised text-red-400 hover:bg-red-500/15 transition-colors" title="영구 삭제">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onPreview(doc); }}
                  className="p-1.5 rounded-lg bg-surface-raised text-gray-300 hover:text-white hover:bg-gray-700/60 transition-colors"
                  title="미리보기"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {isEditable(doc.original_name) && (
                  <button
                    onClick={e => { e.stopPropagation(); onEdit(doc); }}
                    className="p-1.5 rounded-lg bg-surface-raised text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                    title="문서 편집"
                  >
                    <FilePen className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onDownload(doc); }}
                  disabled={downloading === doc.id}
                  className="p-1.5 rounded-lg bg-surface-raised text-brand hover:bg-brand/15 transition-colors"
                  title="다운로드"
                >
                  {downloading === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onCreateLink(doc); }}
                  className="p-1.5 rounded-lg bg-surface-raised text-gray-400 hover:text-brand hover:bg-brand/15 transition-colors"
                  title="일회성 다운로드 링크 생성"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
                <button
                  ref={btnRef}
                  onClick={openMenu}
                  className="p-1.5 rounded-lg bg-surface-raised text-gray-400 hover:bg-gray-700/60 transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 파일 정보 */}
      <div className="px-3 py-2.5">
        {renaming ? (
          <input
            ref={renameRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={confirmRename}
            className="w-full bg-surface border border-brand/50 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none"
          />
        ) : (
          <p
            className="text-xs text-gray-200 truncate font-medium leading-tight cursor-pointer hover:text-brand transition-colors"
            onDoubleClick={startRename}
            title="더블클릭으로 이름 변경"
          >
            {doc.original_name}
          </p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-gray-500">
            {format(new Date(doc.created_at), 'yy.MM.dd', { locale: ko })}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">{fmtSize(doc.file_size)}</span>
        </div>
      </div>

      {showMenu && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="w-48 bg-surface-raised border border-gray-700/80 rounded-xl shadow-lg z-[9999] overflow-hidden py-1"
        >
          <button
            onClick={() => { onPreview(doc); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5" /> 미리보기
          </button>
          {isEditable(doc.original_name) && (
            <button
              onClick={() => { onEdit(doc); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2"
            >
              <FilePen className="w-3.5 h-3.5" /> 문서 편집
            </button>
          )}
          <button
            onClick={() => { onDownload(doc); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> 다운로드
          </button>
          <button
            onClick={() => { setShowMenu(false); startRename(); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2"
          >
            <Pencil className="w-3.5 h-3.5" /> 이름 변경
          </button>
          <button
            onClick={() => { onCreateLink(doc); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2"
          >
            <Link className="w-3.5 h-3.5" /> 일회성 링크 생성
          </button>
          <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider border-t border-gray-700/50 mt-1">폴더 이동</div>
          <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
            <button
              onClick={() => { onMoveDoc(doc.id, null); setShowMenu(false); }}
              className={clsx('w-full px-3 py-1.5 text-left text-xs flex items-center gap-2',
                doc.group_id === null ? 'text-brand font-medium' : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200')}
            >
              <Folder className="w-3.5 h-3.5 flex-shrink-0" /> 미분류
            </button>
            {flattenGroups(allGroups).map(g => {
              const depth = getGroupDepth(g.id, allGroups);
              return (
                <button key={g.id}
                  onClick={() => { onMoveDoc(doc.id, g.id); setShowMenu(false); }}
                  style={{ paddingLeft: `${12 + depth * 12}px` }}
                  className={clsx('w-full pr-3 py-1.5 text-left text-xs flex items-center gap-2 truncate',
                    doc.group_id === g.id ? 'text-brand font-medium' : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200')}
                >
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{g.name}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-700/50 mt-1 pt-1">
            <button
              onClick={() => { onDelete(doc); setShowMenu(false); }}
              disabled={deleting === doc.id}
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> 삭제
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── FileRow (리스트 뷰) ─────────────────────────────────────────── */
function FileRow({
  doc, onDownload, onDelete, onMoveDoc, onCreateLink, onPreview, onRename, onEdit, onToggleFavorite, onRestore,
  allGroups, downloading, deleting, selected, onSelectToggle, anySelected,
}: {
  doc: PersonalDocument;
  allGroups: PersonalDocGroup[];
  onDownload: (d: PersonalDocument) => void;
  onDelete: (d: PersonalDocument) => void;
  onMoveDoc: (docId: number, groupId: number | null) => void;
  onCreateLink: (d: PersonalDocument) => void;
  onPreview: (d: PersonalDocument) => void;
  onRename: (docId: number, name: string) => void;
  onEdit: (d: PersonalDocument) => void;
  onToggleFavorite: (d: PersonalDocument) => void;
  onRestore?: (d: PersonalDocument) => void;
  downloading: number | null;
  deleting: number | null;
  selected: boolean;
  onSelectToggle: (id: number) => void;
  anySelected: boolean;
}) {
  const { iconColor, bgColor, label, badgeColor } = getFileTypeInfo(doc.mime_type, doc.original_name);
  const [showMenu,  setShowMenu]  = useState(false);
  const [menuPos,   setMenuPos]   = useState({ top: 0, right: 0 });
  const [renaming,  setRenaming]  = useState(false);
  const [nameInput, setNameInput] = useState(doc.original_name);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setShowMenu(v => !v);
  };

  const startRename = () => {
    setNameInput(doc.original_name);
    setRenaming(true);
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select(); }, 50);
  };

  const confirmRename = () => {
    const name = nameInput.trim();
    if (name && name !== doc.original_name) onRename(doc.id, name);
    setRenaming(false);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
        setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 transition-colors group',
        selected ? 'bg-brand/5' : 'hover:bg-gray-800/25',
      )}
      draggable={!anySelected}
      onDragStart={e => { e.dataTransfer.setData('text/doc-id', String(doc.id)); e.dataTransfer.effectAllowed = 'move'; }}
    >
      {/* 체크박스 */}
      <button
        onClick={e => { e.stopPropagation(); onSelectToggle(doc.id); }}
        className={clsx(
          'flex-shrink-0 transition-opacity',
          selected || anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {selected
          ? <CheckSquare className="w-4 h-4 text-brand" />
          : <Square className="w-4 h-4 text-gray-500" />
        }
      </button>

      {/* 아이콘 */}
      <div
        className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer', bgColor)}
        onClick={() => !anySelected && onPreview(doc)}
        title="미리보기"
      >
        <span className={clsx(iconColor, 'scale-75')}>{getFileTypeInfo(doc.mime_type, doc.original_name).icon}</span>
      </div>

      {/* 파일명 + 뱃지 */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {renaming ? (
          <input
            ref={renameRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={confirmRename}
            className="flex-1 bg-surface border border-brand/50 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs text-gray-200 truncate font-medium cursor-pointer hover:text-brand transition-colors"
            onDoubleClick={startRename}
            title="더블클릭으로 이름 변경"
          >
            {doc.original_name}
          </span>
        )}
        <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold font-mono flex-shrink-0', badgeColor)}>{label}</span>
      </div>

      {/* 수정자 */}
      <div className="w-[100px] flex-shrink-0 text-[11px] text-gray-500 truncate hidden md:block">나</div>

      {/* 날짜 */}
      <div className="w-[140px] flex-shrink-0 text-[11px] text-gray-500 hidden sm:block">
        {format(new Date(doc.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
      </div>

      {/* 용량 */}
      <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-500 text-right font-mono">{fmtSize(doc.file_size)}</div>

      {/* 즐겨찾기 */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(doc); }}
        className={clsx(
          'flex-shrink-0 p-1.5 rounded-md transition-colors',
          doc.is_favorite
            ? 'text-amber-400 opacity-100'
            : 'text-gray-600 hover:text-amber-400 opacity-0 group-hover:opacity-100',
        )}
        title={doc.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
      >
        <Star className={clsx('w-3.5 h-3.5', doc.is_favorite && 'fill-amber-400')} />
      </button>

      {/* 액션 */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-[100px] justify-end">
        {onRestore ? (
          <>
            <button onClick={() => onRestore(doc)} className="p-1.5 rounded-md text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="복원">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(doc)} className="p-1.5 rounded-md text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="영구 삭제">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => !anySelected && onPreview(doc)}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
              title="미리보기"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {isEditable(doc.original_name) && (
              <button
                onClick={() => onEdit(doc)}
                className="p-1.5 rounded-md text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                title="문서 편집"
              >
                <FilePen className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onDownload(doc)}
              disabled={downloading === doc.id}
              className="p-1.5 rounded-md text-gray-500 hover:text-brand hover:bg-brand/10 transition-colors"
              title="다운로드"
            >
              {downloading === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onCreateLink(doc)}
              className="p-1.5 rounded-md text-gray-500 hover:text-brand hover:bg-brand/10 transition-colors"
              title="일회성 다운로드 링크 생성"
            >
              <Link className="w-3.5 h-3.5" />
            </button>
            <button ref={btnRef} onClick={openMenu} className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 transition-colors">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {showMenu && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="w-48 bg-surface-raised border border-gray-700/80 rounded-xl shadow-lg z-[9999] overflow-hidden py-1"
        >
          <button onClick={() => { onPreview(doc); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" /> 미리보기
          </button>
          {isEditable(doc.original_name) && (
            <button onClick={() => { onEdit(doc); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2">
              <FilePen className="w-3.5 h-3.5" /> 문서 편집
            </button>
          )}
          <button onClick={() => { onDownload(doc); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> 다운로드
          </button>
          <button onClick={() => { setShowMenu(false); startRename(); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" /> 이름 변경
          </button>
          <button onClick={() => { onCreateLink(doc); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/40 flex items-center gap-2">
            <Link className="w-3.5 h-3.5" /> 일회성 링크 생성
          </button>
          <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider border-t border-gray-700/50 mt-1">폴더 이동</div>
          <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
            <button onClick={() => { onMoveDoc(doc.id, null); setShowMenu(false); }}
              className={clsx('w-full px-3 py-1.5 text-left text-xs flex items-center gap-2',
                doc.group_id === null ? 'text-brand font-medium' : 'text-gray-400 hover:bg-gray-700/40')}>
              <Folder className="w-3.5 h-3.5" /> 미분류
            </button>
            {flattenGroups(allGroups).map(g => {
              const depth = getGroupDepth(g.id, allGroups);
              return (
                <button key={g.id} onClick={() => { onMoveDoc(doc.id, g.id); setShowMenu(false); }}
                  style={{ paddingLeft: `${12 + depth * 12}px` }}
                  className={clsx('w-full pr-3 py-1.5 text-left text-xs flex items-center gap-2 truncate',
                    doc.group_id === g.id ? 'text-brand font-medium' : 'text-gray-400 hover:bg-gray-700/40')}>
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{g.name}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-700/50 mt-1 pt-1">
            <button onClick={() => { onDelete(doc); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> 삭제
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
export default function PersonalDocsPage() {
  const [docs,        setDocs]        = useState<PersonalDocument[]>([]);
  const [trashDocs,   setTrashDocs]   = useState<PersonalDocument[]>([]);
  const [groups,      setGroups]      = useState<PersonalDocGroup[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [downloading,  setDownloading]  = useState<number | null>(null);
  const [deleting,     setDeleting]     = useState<number | null>(null);
  const [error,        setError]        = useState('');
  const [linkModalDoc,  setLinkModalDoc]  = useState<PersonalDocument | null>(null);
  const [previewDoc,    setPreviewDoc]    = useState<PersonalDocument | null>(null);
  const [editorDoc,     setEditorDoc]     = useState<PersonalDocument | null>(null);

  /* UI 상태 */
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [sidebarView, setSidebarView] = useState<'all' | 'favorites' | 'trash'>('all');
  const [selectedIds,  setSelectedIds]  = useState<Set<number>>(new Set());
  const [viewMode,    setViewMode]    = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [sortBy,      setSortBy]      = useState<'date' | 'name' | 'size'>('date');
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [dragOverZone, setDragOverZone] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number }[]>([]);

  const globalUploadRef = useRef<HTMLInputElement>(null);
  const zoneUploadRef   = useRef<HTMLInputElement>(null);
  const newFolderRef    = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g] = await Promise.all([personalDocsApi.listDocs(), personalDocsApi.listGroups()]);
      setDocs(d); setGroups(g);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (sidebarView === 'trash') {
      personalDocsApi.listTrash().then(setTrashDocs).catch(console.error);
    }
    clearSelection();
  }, [sidebarView]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (creatingFolder) newFolderRef.current?.focus(); }, [creatingFolder]);

  /* ── 핸들러 ── */
  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError('');
    const files = Array.from(fileList);
    const uploaded: PersonalDocument[] = [];
    for (const file of files) {
      setUploadProgress(prev => [...prev, { name: file.name, pct: 0 }]);
      try {
        const doc = await personalDocsApi.upload(file, selectedFolderId, pct => {
          setUploadProgress(prev => prev.map(p => p.name === file.name ? { ...p, pct } : p));
        });
        uploaded.push(doc);
      } catch (e: any) {
        setError(e.message ?? '업로드 실패');
      } finally {
        setUploadProgress(prev => prev.filter(p => p.name !== file.name));
      }
    }
    if (uploaded.length > 0) setDocs(prev => [...uploaded.reverse(), ...prev]);
  }

  async function handleDownload(d: PersonalDocument) {
    setDownloading(d.id);
    try { await personalDocsApi.download(d.id, d.original_name); }
    catch (e: any) { setError(e.message ?? '다운로드 실패'); }
    finally { setDownloading(null); }
  }

  async function handleDelete(d: PersonalDocument) {
    if (!await confirm(`"${d.original_name}" 파일을 휴지통으로 이동하시겠습니까?`, { danger: true, confirmLabel: '삭제' })) return;
    setDeleting(d.id);
    try { await personalDocsApi.delete(d.id); setDocs(prev => prev.filter(x => x.id !== d.id)); }
    catch (e: any) { setError(e.message ?? '삭제 실패'); }
    finally { setDeleting(null); }
  }

  async function handleRestore(d: PersonalDocument) {
    try {
      await personalDocsApi.restore(d.id);
      setTrashDocs(prev => prev.filter(x => x.id !== d.id));
      const [freshDocs] = await Promise.all([personalDocsApi.listDocs()]);
      setDocs(freshDocs);
    } catch (e: any) { setError(e.message ?? '복원 실패'); }
  }

  async function handlePermanentDelete(d: PersonalDocument) {
    if (!await confirm(`"${d.original_name}" 파일을 영구 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`, { danger: true, confirmLabel: '영구 삭제' })) return;
    try {
      await personalDocsApi.permanentDelete(d.id);
      setTrashDocs(prev => prev.filter(x => x.id !== d.id));
    } catch (e: any) { setError(e.message ?? '영구 삭제 실패'); }
  }

  async function handleToggleFavorite(d: PersonalDocument) {
    try {
      const updated = await personalDocsApi.toggleFavorite(d.id);
      setDocs(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e: any) { setError(e.message ?? '즐겨찾기 변경 실패'); }
  }

  async function handleEmptyTrash() {
    if (!await confirm('휴지통을 비우시겠습니까? 모든 파일이 영구 삭제됩니다.', { danger: true, confirmLabel: '비우기' })) return;
    try {
      await personalDocsApi.bulkPermanentDelete(trashDocs.map(d => d.id));
      setTrashDocs([]);
    } catch (e: any) { setError(e.message ?? '휴지통 비우기 실패'); }
  }

  /* ── 일괄 작업 ── */
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelectedIds(new Set()); }

  async function handleBulkTrash() {
    const ids = [...selectedIds];
    if (!await confirm(`선택한 ${ids.length}개 파일을 휴지통으로 이동하시겠습니까?`, { danger: true, confirmLabel: '삭제' })) return;
    try {
      await personalDocsApi.bulkTrash(ids);
      setDocs(prev => prev.filter(d => !ids.includes(d.id)));
      clearSelection();
    } catch (e: any) { setError(e.message ?? '일괄 삭제 실패'); }
  }

  async function handleBulkMove(groupId: number | null) {
    const ids = [...selectedIds];
    try {
      await personalDocsApi.bulkMove(ids, groupId);
      setDocs(prev => prev.map(d => ids.includes(d.id) ? { ...d, group_id: groupId } : d));
      clearSelection();
    } catch (e: any) { setError(e.message ?? '일괄 이동 실패'); }
  }

  async function handleBulkRestore() {
    const ids = [...selectedIds];
    try {
      await personalDocsApi.bulkRestore(ids);
      setTrashDocs(prev => prev.filter(d => !ids.includes(d.id)));
      const freshDocs = await personalDocsApi.listDocs();
      setDocs(freshDocs);
      clearSelection();
    } catch (e: any) { setError(e.message ?? '일괄 복원 실패'); }
  }

  async function handleBulkPermanentDelete() {
    const ids = [...selectedIds];
    if (!await confirm(`선택한 ${ids.length}개 파일을 영구 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`, { danger: true, confirmLabel: '영구 삭제' })) return;
    try {
      await personalDocsApi.bulkPermanentDelete(ids);
      setTrashDocs(prev => prev.filter(d => !ids.includes(d.id)));
      clearSelection();
    } catch (e: any) { setError(e.message ?? '일괄 영구 삭제 실패'); }
  }

  async function handleMoveDoc(docId: number, groupId: number | null) {
    try {
      const updated = await personalDocsApi.moveGroup(docId, groupId);
      setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
    } catch (e: any) { setError(e.message ?? '이동 실패'); }
  }

  async function handleRenameDoc(docId: number, name: string) {
    try {
      const updated = await personalDocsApi.rename(docId, name);
      setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
    } catch (e: any) { setError(e.message ?? '이름 변경 실패'); }
  }

  function handleEditorSaved(newDoc?: PersonalDocument) {
    if (newDoc) setDocs(prev => [newDoc, ...prev]);
    setEditorDoc(null);
  }

  async function handleCreateFolder(name: string, parentId: number | null = null) {
    try {
      const g = await personalDocsApi.createGroup(name, parentId);
      setGroups(prev => [...prev, g]);
      window.dispatchEvent(new Event('personal-docs-groups-updated'));
    } catch (e: any) { setError(e.message ?? '폴더 생성 실패'); }
  }

  async function handleRenameFolder(id: number, name: string) {
    try {
      const updated = await personalDocsApi.updateGroup(id, { name });
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
      window.dispatchEvent(new Event('personal-docs-groups-updated'));
    } catch (e: any) { setError(e.message ?? '이름 변경 실패'); }
  }

  async function handleDeleteFolder(id: number) {
    const group = groups.find(g => g.id === id);
    const hasFiles   = docs.some(d => d.group_id === id);
    const childCount = groups.filter(g => g.parent_id === id).length;
    const detail = [
      hasFiles   && '파일들이 미분류로 이동됩니다',
      childCount > 0 && `하위 폴더 ${childCount}개도 삭제됩니다`,
    ].filter(Boolean).join(', ');
    if (!await confirm(
      `"${group?.name}" 폴더를 삭제하시겠습니까?${detail ? `\n(${detail})` : ''}`,
      { danger: true, confirmLabel: '삭제' },
    )) return;
    try {
      await personalDocsApi.deleteGroup(id);
      if (selectedFolderId === id) setSelectedFolderId(null);
      await load();
      window.dispatchEvent(new Event('personal-docs-groups-updated'));
    } catch (e: any) { setError(e.message ?? '폴더 삭제 실패'); }
  }

  const toggleFolder = (id: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── 파일 필터링 + 정렬 ── */
  const sourceList = sidebarView === 'trash' ? trashDocs : docs;
  const filteredDocs = sourceList
    .filter(doc => {
      if (sidebarView === 'favorites' && !doc.is_favorite) return false;
      if (sidebarView === 'all' && selectedFolderId !== null && doc.group_id !== selectedFolderId) return false;
      if (searchQuery && !doc.original_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (typeFilter !== 'all') {
        const ext = doc.original_name.split('.').pop()?.toLowerCase() ?? '';
        const mime = doc.mime_type ?? '';
        if (typeFilter === 'doc'     && !['pdf','doc','docx','xls','xlsx','ppt','pptx'].includes(ext)) return false;
        if (typeFilter === 'image'   && !mime.startsWith('image/')) return false;
        if (typeFilter === 'code'    && !/^(json|xml|js|ts|py|go|rs|java|cs|cpp|c|html|css|sh)$/.test(ext)) return false;
        if (typeFilter === 'archive' && !/^(zip|tar|gz|rar|7z)$/.test(ext)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.original_name.localeCompare(b.original_name, 'ko');
      else if (sortBy === 'size') cmp = a.file_size - b.file_size;
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const anySelected = selectedIds.size > 0;
  const favCount = docs.filter(d => d.is_favorite).length;

  /* ── 현재 폴더의 직속 하위 그룹 ── */
  const childGroups = groups
    .filter(g => g.parent_id === selectedFolderId)
    .sort((a, b) => a.sort_order - b.sort_order);

  /* ── 저장 공간 ── */
  const MAX_STORAGE = 100 * 1024 ** 3;
  const usedStorage = docs.reduce((s, d) => s + d.file_size, 0);
  const storagePercent = Math.min(100, Math.round((usedStorage / MAX_STORAGE) * 100));

  /* ── 브레드크럼 ── */
  const breadcrumb = selectedFolderId !== null ? getFolderPath(selectedFolderId, groups) : [];

  const topGroups = groups.filter(g => g.parent_id === null).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
    <div className="flex-1 overflow-y-auto bg-surface/50">
      <div className="max-w-[1320px] mx-auto px-8 py-7">

        {/* ── 페이지 헤더 ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-100 tracking-tight">문서함 &amp; 자료실</h1>
            <p className="text-sm text-gray-500 mt-1">
              {sidebarView === 'favorites' ? '즐겨찾기한 파일 목록입니다.' :
               sidebarView === 'trash' ? '삭제된 파일은 여기서 복원하거나 영구 삭제할 수 있습니다.' :
               '팀과 회사의 모든 문서를 안전하게 보관하고 공유하세요.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {sidebarView === 'trash' ? (
              <button
                onClick={handleEmptyTrash}
                disabled={trashDocs.length === 0}
                className="btn gap-1.5 rounded-[9px] text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" /> 휴지통 비우기
              </button>
            ) : (
              <>
                <input ref={globalUploadRef} type="file" multiple className="hidden"
                  onChange={e => { handleUpload(e.target.files); globalUploadRef.current!.value = ''; }} />
                <button
                  onClick={() => globalUploadRef.current?.click()}
                  disabled={uploadProgress.length > 0}
                  className="btn btn-primary gap-1.5 rounded-[9px]"
                >
                  {uploadProgress.length > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadProgress.length > 0 ? '업로드 중...' : '파일 업로드'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── 업로드 진행률 ── */}
        {uploadProgress.length > 0 && (
          <div className="mb-4 space-y-2">
            {uploadProgress.map(p => (
              <div key={p.name} className="bg-surface-raised border border-gray-700/60 rounded-xl px-4 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-300 truncate max-w-[80%]">{p.name}</span>
                  <span className="text-xs text-brand font-mono">{p.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-200"
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-xl text-sm text-red-400 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-600 hover:text-red-400 ml-2 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ── 2컬럼 그리드 ── */}
        <div className="flex gap-5">

          {/* ── 좌측 사이드바 ── */}
          <aside className="w-[240px] flex-shrink-0">
            <div className="bg-surface-raised border border-gray-800/70 rounded-xl overflow-hidden flex flex-col">
              {/* 폴더 헤더 */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px]">폴더</span>
                <button
                  onClick={() => setCreatingFolder(v => !v)}
                  className="p-1 rounded-md text-gray-600 hover:text-brand hover:bg-brand/10 transition-colors"
                  title="새 폴더"
                ><FolderPlus className="w-3.5 h-3.5" /></button>
              </div>

              {/* 새 폴더 입력 */}
              {creatingFolder && (
                <div className="mx-2 mb-2 flex items-center gap-1.5 px-2 py-1.5 bg-surface border border-brand/40 rounded-lg">
                  <Folder className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                  <input
                    ref={newFolderRef}
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { handleCreateFolder(newFolderName); setNewFolderName(''); setCreatingFolder(false); }
                      if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                    }}
                    placeholder="폴더 이름"
                    className="flex-1 bg-transparent text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none"
                  />
                  <button onClick={() => { handleCreateFolder(newFolderName); setNewFolderName(''); setCreatingFolder(false); }}
                    className="p-0.5 text-green-400 hover:text-green-300 transition-colors"><Check className="w-3 h-3" /></button>
                  <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
                    className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"><X className="w-3 h-3" /></button>
                </div>
              )}

              {/* 폴더 트리 */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {/* 즐겨찾기 */}
                <div
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors select-none text-xs',
                    sidebarView === 'favorites'
                      ? 'bg-amber-500/10 text-amber-400 font-semibold'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200',
                  )}
                  onClick={() => { setSidebarView('favorites'); setSelectedFolderId(null); }}
                >
                  <span className="w-4 flex-shrink-0" />
                  <Star className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate">즐겨찾기</span>
                  {favCount > 0 && <span className="text-[10px] text-gray-600 font-mono">{favCount}</span>}
                </div>

                {/* 전체 문서 */}
                <div
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors select-none text-xs',
                    sidebarView === 'all' && selectedFolderId === null
                      ? 'bg-brand/10 text-brand font-semibold'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200',
                  )}
                  onClick={() => { setSidebarView('all'); setSelectedFolderId(null); }}
                  onDragOver={e => { if (e.dataTransfer.types.includes('text/doc-id')) { e.preventDefault(); } }}
                  onDrop={e => {
                    e.preventDefault();
                    const docId = parseInt(e.dataTransfer.getData('text/doc-id'));
                    if (!isNaN(docId)) handleMoveDoc(docId, null);
                  }}
                >
                  <span className="w-4 flex-shrink-0" />
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate">전체 문서</span>
                  <span className="text-[10px] text-gray-600 font-mono">{docs.length}</span>
                </div>

                {loading ? (
                  <div className="space-y-1 px-1 pt-1">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-7 bg-gray-800/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  topGroups.map(group => (
                    <FolderNode
                      key={group.id}
                      group={group}
                      allGroups={groups}
                      depth={0}
                      selectedId={sidebarView === 'all' ? selectedFolderId : null}
                      onSelect={id => { setSidebarView('all'); setSelectedFolderId(id); }}
                      expandedIds={expandedFolders}
                      onToggle={toggleFolder}
                      onRename={handleRenameFolder}
                      onDelete={handleDeleteFolder}
                      onAddChild={(parentId, name) => {
                        handleCreateFolder(name, parentId);
                        setExpandedFolders(prev => new Set(prev).add(parentId));
                      }}
                      onDropDoc={handleMoveDoc}
                    />
                  ))
                )}

                {/* 휴지통 */}
                <div className="pt-1 mt-1 border-t border-gray-800/60">
                  <div
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors select-none text-xs',
                      sidebarView === 'trash'
                        ? 'bg-red-500/10 text-red-400 font-semibold'
                        : 'text-gray-500 hover:bg-gray-800/40 hover:text-gray-300',
                    )}
                    onClick={() => { setSidebarView('trash'); setSelectedFolderId(null); }}
                  >
                    <span className="w-4 flex-shrink-0" />
                    <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate">휴지통</span>
                    {trashDocs.length > 0 && <span className="text-[10px] text-red-600 font-mono">{trashDocs.length}</span>}
                  </div>
                </div>
              </div>

              {/* 저장 공간 */}
              <div className="border-t border-gray-800/60 px-3 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>저장 공간</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-mono">{storagePercent}%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 font-mono">
                  {fmtSize(usedStorage)} / 100 GB
                </p>
              </div>
            </div>
          </aside>

          {/* ── 우측 파일 영역 ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">

            {/* 툴바 */}
            <div className="bg-surface-raised border border-gray-800/70 rounded-xl px-4 py-3 flex items-center gap-3">
              {/* 뒤로가기 버튼 */}
              {selectedFolderId !== null && (() => {
                const parentId = groups.find(g => g.id === selectedFolderId)?.parent_id ?? null;
                return (
                  <button
                    onClick={() => setSelectedFolderId(parentId)}
                    className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-gray-700/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
                    title="뒤로가기"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                );
              })()}
              {/* 브레드크럼 */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0 text-sm">
                <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={clsx('transition-colors flex-shrink-0', selectedFolderId === null ? 'text-gray-200 font-medium' : 'text-gray-500 hover:text-gray-300')}
                >
                  전체 문서
                </button>
                {breadcrumb.map((folder, idx) => (
                  <span key={folder.id} className="flex items-center gap-1.5 flex-shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={clsx('transition-colors', idx === breadcrumb.length - 1 ? 'text-gray-200 font-semibold' : 'text-gray-500 hover:text-gray-300')}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* 검색 */}
              <div className="relative flex-shrink-0 w-[240px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="파일 검색..."
                  className="input pl-8 rounded-lg bg-gray-800/40 border-gray-700/60 text-xs"
                />
              </div>

              {/* 유형 필터 */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="select text-xs w-[110px] flex-shrink-0 rounded-lg bg-gray-800/40 border-gray-700/60"
              >
                <option value="all">전체 유형</option>
                <option value="doc">문서</option>
                <option value="image">이미지</option>
                <option value="code">코드</option>
                <option value="archive">압축</option>
              </select>

              {/* 정렬 */}
              <div className="flex items-center border border-gray-700/60 rounded-lg overflow-hidden flex-shrink-0">
                {(['date', 'name', 'size'] as const).map(key => {
                  const labels = { date: '날짜', name: '이름', size: '크기' } as const;
                  const active = sortBy === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setSortBy(key); setSortDir('desc'); }
                      }}
                      className={clsx(
                        'px-2 py-1.5 text-[11px] transition-colors flex items-center gap-0.5 border-l border-gray-700/60 first:border-l-0',
                        active ? 'bg-brand/15 text-brand' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-700/30',
                      )}
                    >
                      {labels[key]}
                      {active && (sortDir === 'desc'
                        ? <ChevronDown className="w-2.5 h-2.5" />
                        : <ChevronUp   className="w-2.5 h-2.5" />)}
                    </button>
                  );
                })}
              </div>

              {/* 뷰 토글 */}
              <div className="flex items-center border border-gray-700/60 rounded-lg overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={clsx('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-brand/15 text-brand' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-700/30')}
                  title="그리드 뷰"
                ><Grid3X3 className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => setViewMode('list')}
                  className={clsx('p-1.5 transition-colors border-l border-gray-700/60', viewMode === 'list' ? 'bg-brand/15 text-brand' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-700/30')}
                  title="리스트 뷰"
                ><List className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            {/* 일괄 작업 툴바 */}
            {anySelected && (
              <div className="bg-surface-raised border border-brand/30 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs text-brand font-semibold">{selectedIds.size}개 선택됨</span>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  {sidebarView === 'trash' ? (
                    <>
                      <button onClick={handleBulkRestore} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> 복원
                      </button>
                      <button onClick={handleBulkPermanentDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> 영구 삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleBulkTrash} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                      <div className="relative group/move">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-gray-700/60 hover:bg-gray-700/30 transition-colors">
                          <Folder className="w-3.5 h-3.5" /> 폴더 이동
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <div className="hidden group-hover/move:block absolute top-full left-0 mt-1 w-48 bg-surface-raised border border-gray-700/80 rounded-xl shadow-lg z-50 py-1 overflow-y-auto max-h-[200px]">
                          <button onClick={() => handleBulkMove(null)} className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-700/40 flex items-center gap-2">
                            <Folder className="w-3.5 h-3.5" /> 미분류
                          </button>
                          {flattenGroups(groups).map(g => (
                            <button key={g.id} onClick={() => handleBulkMove(g.id)}
                              style={{ paddingLeft: `${12 + getGroupDepth(g.id, groups) * 12}px` }}
                              className="w-full pr-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-700/40 flex items-center gap-2 truncate">
                              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{g.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={clearSelection} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 드래그앤드롭 업로드 존 */}
            {sidebarView !== 'trash' && (
            <div
              className={clsx(
                'border-2 border-dashed rounded-[10px] transition-all cursor-pointer',
                dragOverZone
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-700/60 bg-gray-800/20 hover:border-gray-600/60 hover:bg-gray-800/30',
              )}
              onDragOver={e => {
                if (!e.dataTransfer.types.includes('text/doc-id')) { e.preventDefault(); setDragOverZone(true); }
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverZone(false); }}
              onDrop={e => {
                if (e.dataTransfer.types.includes('text/doc-id')) return;
                e.preventDefault(); setDragOverZone(false); handleUpload(e.dataTransfer.files);
              }}
              onClick={() => zoneUploadRef.current?.click()}
            >
              <input ref={zoneUploadRef} type="file" multiple className="hidden"
                onChange={e => { handleUpload(e.target.files); zoneUploadRef.current!.value = ''; }} />
              <div className="flex items-center gap-3 px-5 py-3">
                <UploadCloud className={clsx('w-[22px] h-[22px] flex-shrink-0 transition-colors', dragOverZone ? 'text-brand' : 'text-gray-600')} />
                <div>
                  <p className={clsx('text-xs font-medium transition-colors', dragOverZone ? 'text-brand' : 'text-gray-400')}>
                    {dragOverZone ? '파일을 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    모든 파일 형식 지원 · 최대 3GB
                    {selectedFolderId !== null && ` · "${breadcrumb[breadcrumb.length - 1]?.name}" 폴더에 업로드`}
                  </p>
                </div>
                {uploadProgress.length > 0 && <Loader2 className="w-4 h-4 animate-spin text-brand ml-auto flex-shrink-0" />}
              </div>
            </div>
            )}

            {/* 파일 목록 */}
            <div className="bg-surface-raised border border-gray-800/70 rounded-xl overflow-hidden flex-1">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-800/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filteredDocs.length === 0 && (sidebarView !== 'all' || childGroups.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-800/60 flex items-center justify-center mb-3">
                    {sidebarView === 'trash' ? <Trash2 className="w-5 h-5 text-gray-600" /> :
                     sidebarView === 'favorites' ? <Star className="w-5 h-5 text-gray-600" /> :
                     <File className="w-5 h-5 text-gray-600" />}
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    {sidebarView === 'trash' ? '휴지통이 비어 있습니다' :
                     sidebarView === 'favorites' ? '즐겨찾기한 파일이 없습니다' :
                     searchQuery ? '검색 결과가 없습니다' :
                     selectedFolderId !== null ? '이 폴더에 파일이 없습니다' : '파일이 없습니다'}
                  </p>
                  {sidebarView === 'all' && <p className="text-xs text-gray-700 mt-1">위 업로드 영역을 클릭하거나 파일을 드래그하세요</p>}
                  {sidebarView === 'favorites' && <p className="text-xs text-gray-700 mt-1">파일에서 ★ 버튼을 눌러 즐겨찾기에 추가하세요</p>}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {/* 하위 폴더 (trash/favorites 뷰에선 숨김) */}
                  {sidebarView === 'all' && !searchQuery && childGroups.map(g => (
                    <FolderCard
                      key={g.id}
                      group={g}
                      onClick={() => setSelectedFolderId(g.id)}
                    />
                  ))}
                  {filteredDocs.map(doc => (
                    <FileCard
                      key={doc.id}
                      doc={doc}
                      allGroups={groups}
                      onDownload={handleDownload}
                      onDelete={sidebarView === 'trash' ? handlePermanentDelete : handleDelete}
                      onMoveDoc={handleMoveDoc}
                      onCreateLink={setLinkModalDoc}
                      onPreview={setPreviewDoc}
                      onRename={handleRenameDoc}
                      onEdit={setEditorDoc}
                      onToggleFavorite={handleToggleFavorite}
                      onRestore={sidebarView === 'trash' ? handleRestore : undefined}
                      downloading={downloading}
                      deleting={deleting}
                      selected={selectedIds.has(doc.id)}
                      onSelectToggle={toggleSelect}
                      anySelected={anySelected}
                    />
                  ))}
                </div>
              ) : (
                <div>
                  {/* 리스트 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800/60 bg-gray-800/20">
                    <div className="w-4 flex-shrink-0" />
                    <div className="w-8 flex-shrink-0" />
                    <div className="w-8 flex-shrink-0" />
                    <div className="flex-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">파일명</div>
                    <div className="w-[100px] flex-shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider hidden md:block">수정자</div>
                    <div className="w-[140px] flex-shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider hidden sm:block">날짜</div>
                    <div className="w-[70px] flex-shrink-0 text-[10px] font-semibold text-gray-600 uppercase tracking-wider text-right">크기</div>
                    <div className="w-[100px] flex-shrink-0" />
                  </div>
                  {/* 하위 폴더 */}
                  {sidebarView === 'all' && !searchQuery && childGroups.map(g => (
                    <FolderListRow
                      key={g.id}
                      group={g}
                      onClick={() => setSelectedFolderId(g.id)}
                    />
                  ))}
                  {filteredDocs.map(doc => (
                    <FileRow
                      key={doc.id}
                      doc={doc}
                      allGroups={groups}
                      onDownload={handleDownload}
                      onDelete={sidebarView === 'trash' ? handlePermanentDelete : handleDelete}
                      onMoveDoc={handleMoveDoc}
                      onCreateLink={setLinkModalDoc}
                      onPreview={setPreviewDoc}
                      onRename={handleRenameDoc}
                      onEdit={setEditorDoc}
                      onToggleFavorite={handleToggleFavorite}
                      onRestore={sidebarView === 'trash' ? handleRestore : undefined}
                      downloading={downloading}
                      deleting={deleting}
                      selected={selectedIds.has(doc.id)}
                      onSelectToggle={toggleSelect}
                      anySelected={anySelected}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {linkModalDoc && (
      <DownloadLinkModal
        doc={linkModalDoc}
        onClose={() => setLinkModalDoc(null)}
      />
    )}
    {previewDoc && (
      <FilePreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={d => { handleDownload(d); setPreviewDoc(null); }}
      />
    )}
    {editorDoc && (
      <DocumentEditorModal
        doc={editorDoc}
        onClose={() => setEditorDoc(null)}
        onSaved={handleEditorSaved}
      />
    )}
    </>
  );
}
