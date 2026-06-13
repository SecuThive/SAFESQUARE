'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { filesApi, getAuthMeta } from '@/lib/api';
import type { ProjectFile, FileGroup } from '@/lib/types';
import {
  Upload, Download, Trash2, File, FileText, FileImage,
  FileArchive, FileCode, Paperclip, FolderPlus, Folder,
  FolderOpen, ChevronDown, ChevronRight, MoreHorizontal,
  Pencil, Check, X, MoveRight, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { confirm } from '@/lib/confirm';
import { ko } from 'date-fns/locale';

interface Props { projectId: number }

/* ── 유틸 ── */
function fmtSize(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function FileIcon({ mime, className }: { mime: string | null; className?: string }) {
  const cls = clsx('flex-shrink-0', className);
  if (!mime)                    return <File        className={cls} />;
  if (mime.startsWith('image/')) return <FileImage  className={clsx(cls, 'text-pink-400')}   />;
  if (mime.includes('pdf'))      return <FileText   className={clsx(cls, 'text-red-400')}    />;
  if (mime.startsWith('text/'))  return <FileText   className={clsx(cls, 'text-blue-400')}   />;
  if (/zip|tar|gz|rar/.test(mime)) return <FileArchive className={clsx(cls, 'text-yellow-400')} />;
  if (/json|xml|javascript|python|typescript/.test(mime))
                                 return <FileCode   className={clsx(cls, 'text-green-400')}  />;
  return <File className={clsx(cls, 'text-gray-400')} />;
}

/* ── 파일 행 ── */
function FileRow({
  file, groups, isAdmin,
  onDownload, onDelete, onMoveGroup, downloading, deleting,
}: {
  file: ProjectFile;
  groups: FileGroup[];
  isAdmin: boolean;
  onDownload: (f: ProjectFile) => void;
  onDelete: (f: ProjectFile) => void;
  onMoveGroup: (fileId: number, groupId: number | null) => void;
  downloading: number | null;
  deleting: number | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos,  setMenuPos]  = useState({ top: 0, right: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setShowMenu(v => !v);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-gray-800 rounded-xl hover:bg-gray-800/30 transition-colors group">
      <FileIcon mime={file.mime_type} className="w-4 h-4" />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate font-medium">{file.original_name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-600">
          <span>{fmtSize(file.file_size)}</span>
          <span>·</span>
          <span>{file.uploaded_by}</span>
          <span>·</span>
          <span>{format(new Date(file.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDownload(file)}
          disabled={downloading === file.id}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors disabled:opacity-50"
        >
          {downloading === file.id
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />}
        </button>

        {/* 더보기 버튼 */}
        <button
          ref={btnRef}
          onClick={openMenu}
          className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-surface-overlay rounded-lg transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* 드롭다운 — portal로 body에 렌더 (overflow 잘림 방지) */}
        {showMenu && typeof window !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
            className="w-48 bg-surface-raised border border-gray-700 rounded-xl shadow-2xl z-[9999] overflow-hidden py-1"
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">그룹 이동</div>
            <button
              onClick={() => { onMoveGroup(file.id, null); setShowMenu(false); }}
              className={clsx(
                'w-full px-3 py-2 text-left text-xs transition-colors flex items-center gap-2',
                file.group_id === null
                  ? 'text-brand font-medium bg-brand/5'
                  : 'text-gray-400 hover:bg-surface-overlay hover:text-gray-200',
              )}
            >
              <Folder className="w-3.5 h-3.5 flex-shrink-0" /> 미분류
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => { onMoveGroup(file.id, g.id); setShowMenu(false); }}
                className={clsx(
                  'w-full px-3 py-2 text-left text-xs transition-colors flex items-center gap-2',
                  file.group_id === g.id
                    ? 'text-brand font-medium bg-brand/5'
                    : 'text-gray-400 hover:bg-surface-overlay hover:text-gray-200',
                )}
              >
                <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{g.name}</span>
              </button>
            ))}
            {isAdmin && (
              <>
                <div className="border-t border-gray-700/60 my-1" />
                <button
                  onClick={() => { onDelete(file); setShowMenu(false); }}
                  disabled={deleting === file.id}
                  className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

/* ── 그룹 섹션 ── */
function GroupSection({
  group, files, groups, isAdmin,
  onUpload, onDownload, onDelete, onMoveGroup,
  onRename, onDeleteGroup,
  downloading, deleting, uploading,
}: {
  group: FileGroup | null;  // null = 미분류
  files: ProjectFile[];
  groups: FileGroup[];
  isAdmin: boolean;
  onUpload: (files: FileList, groupId: number | null) => void;
  onDownload: (f: ProjectFile) => void;
  onDelete: (f: ProjectFile) => void;
  onMoveGroup: (fileId: number, groupId: number | null) => void;
  onRename: (groupId: number, name: string) => void;
  onDeleteGroup: (groupId: number) => void;
  downloading: number | null;
  deleting: number | null;
  uploading: boolean;
}) {
  const [open,       setOpen]       = useState(true);
  const [dragOver,   setDragOver]   = useState(false);
  const [renaming,   setRenaming]   = useState(false);
  const [nameInput,  setNameInput]  = useState(group?.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [renaming]);

  const confirmRename = () => {
    if (group && nameInput.trim()) onRename(group.id, nameInput.trim());
    setRenaming(false);
  };

  const groupId = group?.id ?? null;

  return (
    <div className={clsx(
      'border border-gray-800 rounded-xl',
      dragOver && 'border-brand bg-brand/5',
    )}>
      {/* 그룹 헤더 */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-surface-raised cursor-pointer select-none rounded-t-xl"
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false);
          onUpload(e.dataTransfer.files, groupId);
        }}
      >
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {open
            ? <ChevronDown  className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          }
          {open
            ? <FolderOpen className="w-4 h-4 text-brand flex-shrink-0" />
            : <Folder     className="w-4 h-4 text-gray-500 flex-shrink-0" />
          }

          {renaming ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-surface border border-brand rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none"
            />
          ) : (
            <span className="text-sm font-medium text-gray-200 truncate">
              {group ? group.name : '미분류'}
            </span>
          )}

          <span className="text-[10px] text-gray-600 ml-1 flex-shrink-0">
            {files.length}개
          </span>
        </button>

        {/* 그룹 액션 */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {renaming ? (
            <>
              <button onClick={confirmRename} className="p-1 text-green-400 hover:text-green-300 transition-colors">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setRenaming(false)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" multiple className="hidden"
                onChange={e => { onUpload(e.target.files!, groupId); fileRef.current!.value = ''; }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                title="이 그룹에 파일 업로드"
              >
                <Upload className="w-3.5 h-3.5" />
                업로드
              </button>
              {group && (
                <>
                  <button
                    onClick={() => { setNameInput(group.name); setRenaming(true); }}
                    className="p-1 text-gray-600 hover:text-gray-300 hover:bg-surface-overlay rounded-lg transition-colors"
                    title="그룹 이름 변경"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteGroup(group.id)}
                    className="p-1 text-gray-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="그룹 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 파일 목록 */}
      {open && (
        <div className="p-2 space-y-1.5">
          {files.length === 0 ? (
            <div
              className="py-6 text-center text-xs text-gray-600 border border-dashed border-gray-800 rounded-lg"
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                onUpload(e.dataTransfer.files, groupId);
              }}
            >
              파일을 드래그하거나 업로드 버튼을 눌러 추가하세요
            </div>
          ) : (
            files.map(f => (
              <FileRow
                key={f.id}
                file={f}
                groups={groups}
                isAdmin={isAdmin}
                onDownload={onDownload}
                onDelete={onDelete}
                onMoveGroup={onMoveGroup}
                downloading={downloading}
                deleting={deleting}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function FileManager({ projectId }: Props) {
  const [files,       setFiles]       = useState<ProjectFile[]>([]);
  const [groups,      setGroups]      = useState<FileGroup[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState<number | null>(null);
  const [error,       setError]       = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName,  setNewGroupName]  = useState('');
  const newGroupRef = useRef<HTMLInputElement>(null);
  const globalUploadRef = useRef<HTMLInputElement>(null);

  const isAdmin = getAuthMeta()?.isAdmin ?? false;

  /* 로드 */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, g] = await Promise.all([
        filesApi.list(projectId),
        filesApi.listGroups(projectId),
      ]);
      setFiles(f);
      setGroups(g);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (creatingGroup) newGroupRef.current?.focus(); }, [creatingGroup]);

  /* 업로드 */
  async function handleUpload(fileList: FileList | null, groupId: number | null = null) {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const uploaded: ProjectFile[] = [];
      for (const file of Array.from(fileList)) {
        uploaded.push(await filesApi.upload(projectId, file, groupId));
      }
      setFiles(prev => [...uploaded.reverse(), ...prev]);
    } catch (e: any) {
      setError(e.message ?? '업로드에 실패했습니다');
    } finally { setUploading(false); }
  }

  /* 다운로드 */
  async function handleDownload(f: ProjectFile) {
    setDownloading(f.id);
    try { await filesApi.download(f.id, f.original_name); }
    catch (e: any) { setError(e.message ?? '다운로드 실패'); }
    finally { setDownloading(null); }
  }

  /* 삭제 */
  async function handleDelete(f: ProjectFile) {
    if (!await confirm(`"${f.original_name}" 파일을 삭제하시겠습니까?`, { danger: true, confirmLabel: '삭제' })) return;
    setDeleting(f.id);
    try {
      await filesApi.delete(f.id);
      setFiles(prev => prev.filter(x => x.id !== f.id));
    } catch (e: any) { setError(e.message ?? '삭제 실패'); }
    finally { setDeleting(null); }
  }

  /* 그룹 이동 */
  async function handleMoveGroup(fileId: number, groupId: number | null) {
    try {
      const updated = await filesApi.moveGroup(fileId, groupId);
      setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
    } catch (e: any) { setError(e.message ?? '이동 실패'); }
  }

  /* 그룹 생성 */
  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const g = await filesApi.createGroup(projectId, name);
      setGroups(prev => [...prev, g]);
      setNewGroupName('');
      setCreatingGroup(false);
    } catch (e: any) { setError(e.message ?? '그룹 생성 실패'); }
  }

  /* 그룹 이름 변경 */
  async function handleRenameGroup(groupId: number, name: string) {
    try {
      const updated = await filesApi.updateGroup(groupId, { name });
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (e: any) { setError(e.message ?? '이름 변경 실패'); }
  }

  /* 그룹 삭제 */
  async function handleDeleteGroup(groupId: number) {
    const group = groups.find(g => g.id === groupId);
    const hasFiles = files.some(f => f.group_id === groupId);
    const msg = hasFiles
      ? `"${group?.name}" 그룹을 삭제하면 파일들이 미분류로 이동됩니다. 계속하시겠습니까?`
      : `"${group?.name}" 그룹을 삭제하시겠습니까?`;
    if (!await confirm(msg, { danger: true, confirmLabel: '삭제' })) return;
    try {
      await filesApi.deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (hasFiles) setFiles(prev => prev.map(f => f.group_id === groupId ? { ...f, group_id: null } : f));
    } catch (e: any) { setError(e.message ?? '그룹 삭제 실패'); }
  }

  const totalSize = files.reduce((s, f) => s + f.file_size, 0);
  const ungrouped = files.filter(f => f.group_id === null);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200">프로젝트 파일</h2>
          {files.length > 0 && (
            <span className="text-xs text-gray-500">{files.length}개 · {fmtSize(totalSize)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 새 그룹 */}
          {creatingGroup ? (
            <div className="flex items-center gap-1">
              <input
                ref={newGroupRef}
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateGroup();
                  if (e.key === 'Escape') { setCreatingGroup(false); setNewGroupName(''); }
                }}
                placeholder="그룹 이름"
                className="bg-surface border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand transition-colors w-36"
              />
              <button onClick={handleCreateGroup} className="p-1.5 text-green-400 hover:text-green-300 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setCreatingGroup(false); setNewGroupName(''); }} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingGroup(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors border border-gray-700 hover:border-brand/40"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              새 그룹
            </button>
          )}

          {/* 전체 업로드 (미분류) */}
          <input ref={globalUploadRef} type="file" multiple className="hidden"
            onChange={e => { handleUpload(e.target.files, null); globalUploadRef.current!.value = ''; }} />
          <button
            onClick={() => globalUploadRef.current?.click()}
            disabled={uploading}
            className="btn-primary text-sm"
          >
            <Upload className="w-4 h-4" />
            {uploading ? '업로드 중...' : '파일 업로드'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-raised border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 && groups.length === 0 ? (
        /* 완전히 비어있는 상태 */
        <div
          className="border-2 border-dashed border-gray-700 rounded-xl py-16 text-center cursor-pointer hover:border-gray-600 transition-colors"
          onClick={() => globalUploadRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files, null); }}
        >
          <Paperclip className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">파일을 드래그하거나 클릭해서 업로드</p>
          <p className="text-xs text-gray-700 mt-1">그룹을 만들어 파일을 분류할 수 있습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 그룹별 섹션 */}
          {groups.map(group => (
            <GroupSection
              key={group.id}
              group={group}
              files={files.filter(f => f.group_id === group.id)}
              groups={groups}
              isAdmin={isAdmin}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onMoveGroup={handleMoveGroup}
              onRename={handleRenameGroup}
              onDeleteGroup={handleDeleteGroup}
              downloading={downloading}
              deleting={deleting}
              uploading={uploading}
            />
          ))}

          {/* 미분류 섹션 — 항상 마지막에 */}
          {(ungrouped.length > 0 || groups.length === 0) && (
            <GroupSection
              group={null}
              files={ungrouped}
              groups={groups}
              isAdmin={isAdmin}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onMoveGroup={handleMoveGroup}
              onRename={() => {}}
              onDeleteGroup={() => {}}
              downloading={downloading}
              deleting={deleting}
              uploading={uploading}
            />
          )}
        </div>
      )}
    </div>
  );
}
