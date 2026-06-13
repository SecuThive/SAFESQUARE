'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { docEditorApi, getAuthHeaders } from '@/lib/api';
import type { PersonalDocument } from '@/lib/api';
import {
  X, Save, FileDown, Loader2, AlertTriangle, Bold, Italic,
  Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Heading1, Heading2, Heading3,
  Minus, Undo, Redo, Table as TableIcon, FileText,
} from 'lucide-react';
import clsx from 'clsx';

interface Props {
  doc: PersonalDocument;
  onClose: () => void;
  onSaved: (newDoc?: PersonalDocument) => void;
}

/* ── 툴바 버튼 ────────────────────────────────────────────── */
function ToolBtn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded transition-colors disabled:opacity-30',
        active
          ? 'bg-brand/20 text-brand'
          : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700/50',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-700/60 mx-0.5 flex-shrink-0" />;
}

/* ════════════════════════════════════════════════════════════ */
export default function DocumentEditorModal({ doc, onClose, onSaved }: Props) {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');
  const [hwp,      setHwp]      = useState(false);
  const [loAvail,  setLoAvail]  = useState(true);
  const [needsLo,  setNeedsLo]  = useState(false);
  const [saveFmt,  setSaveFmt]  = useState('docx');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[60vh] p-6',
      },
    },
  });

  // ESC 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // 문서 → HTML 변환 로드
  useEffect(() => {
    if (!editor) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // 편집 가능 여부 먼저 확인
        const info = await docEditorApi.info(doc.id);
        if (!info.editable) {
          setError(`${info.ext} 파일은 편집을 지원하지 않습니다.`);
          setLoading(false);
          return;
        }
        setHwp(info.hwp);
        setLoAvail(info.lo_available);
        setNeedsLo(info.needs_lo);
        setSaveFmt(info.save_format);

        if (info.needs_lo && !info.lo_available) {
          setError(
            'HWP/DOC 편집은 LibreOffice가 필요합니다.\n' +
            'macOS: brew install --cask libreoffice\n' +
            'Ubuntu: sudo apt install libreoffice',
          );
          setLoading(false);
          return;
        }

        const content = await docEditorApi.toHtml(doc.id);
        editor.commands.setContent(content.html || '<p></p>');

        if (info.hwp) {
          setNotice('HWP 파일은 DOCX 형식으로 새 파일이 생성됩니다. 원본은 유지됩니다.');
        }
      } catch (e: any) {
        setError(e.message ?? '파일을 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    })();
  }, [editor, doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    setError('');
    try {
      const html = editor.getHTML();
      const result = await docEditorApi.save(doc.id, html);
      if (result.new_file && result.new_doc) {
        setNotice(`저장 완료 — "${result.new_doc.original_name}" 파일이 생성되었습니다.`);
        onSaved(result.new_doc);
      } else {
        onSaved();
        onClose();
      }
    } catch (e: any) {
      setError(e.message ?? '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }, [editor, doc.id, onClose, onSaved]);

  const handleExportPdf = useCallback(async () => {
    const url = docEditorApi.exportPdfUrl(doc.id);
    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? 'PDF 내보내기 실패');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = doc.original_name.replace(/\.[^.]+$/, '.pdf');
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e.message);
    }
  }, [doc]);

  const ext = doc.original_name.split('.').pop()?.toLowerCase() ?? '';
  const isEditable = ['hwp', 'docx', 'doc', 'odt', 'txt', 'md'].includes(ext);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-950">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-surface flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-4 h-4 text-brand flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-200 truncate">{doc.original_name}</span>
          {hwp && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 flex-shrink-0">
              저장 시 DOCX 생성
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loAvail && (
            <button
              onClick={handleExportPdf}
              disabled={loading || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-gray-700 hover:bg-gray-700/40 transition-colors disabled:opacity-40"
            >
              <FileDown className="w-3.5 h-3.5" /> PDF 내보내기
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || saving || !!error}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? '저장 중...' : `저장 (${saveFmt.toUpperCase()})`}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700/40 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 알림 / 에러 ── */}
      {notice && !error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-900/20 border-b border-amber-800/40 text-xs text-amber-300 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="whitespace-pre-line">{notice}</span>
          <button onClick={() => setNotice('')} className="ml-auto text-amber-500 hover:text-amber-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 에디터 툴바 ── */}
      {!loading && !error && editor && (
        <div className="flex items-center gap-0.5 px-4 py-2 border-b border-gray-800 bg-surface flex-shrink-0 flex-wrap">
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="실행 취소"><Undo className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="다시 실행"><Redo className="w-3.5 h-3.5" /></ToolBtn>
          <Divider />
          <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="제목 1"><Heading1 className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="제목 2"><Heading2 className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="제목 3"><Heading3 className="w-3.5 h-3.5" /></ToolBtn>
          <Divider />
          <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게"><Bold className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임"><Italic className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄"><UnderlineIcon className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선"><Minus className="w-3.5 h-3.5" /></ToolBtn>
          <Divider />
          <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="왼쪽 정렬"><AlignLeft className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="가운데 정렬"><AlignCenter className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="오른쪽 정렬"><AlignRight className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="양쪽 정렬"><AlignJustify className="w-3.5 h-3.5" /></ToolBtn>
          <Divider />
          <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="글머리 기호"><List className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호 목록"><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
          <Divider />
          <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="인용문">
            <span className="text-[11px] font-bold">&ldquo;</span>
          </ToolBtn>
          <ToolBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="코드 블록">
            <span className="text-[11px] font-mono">{'{}'}</span>
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="표 삽입"
          ><TableIcon className="w-3.5 h-3.5" /></ToolBtn>
        </div>
      )}

      {/* ── 에디터 본문 ── */}
      <div className="flex-1 overflow-y-auto bg-gray-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
            <p className="text-sm text-gray-400">문서 변환 중…</p>
            <p className="text-xs text-gray-600">HWP/DOC 파일은 처음 변환에 수 초 걸릴 수 있습니다</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <p className="text-sm text-gray-300 whitespace-pre-line">{error}</p>
            {!isEditable && (
              <p className="text-xs text-gray-500">지원 형식: HWP, DOCX, DOC, ODT, TXT, MD</p>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <style>{`
              .ProseMirror table { border-collapse: collapse; width: 100%; }
              .ProseMirror td, .ProseMirror th { border: 1px solid #374151; padding: 6px 10px; min-width: 60px; }
              .ProseMirror th { background: #1f2937; font-weight: 600; }
              .ProseMirror p { margin: 0.5em 0; }
              .ProseMirror h1 { font-size: 1.6em; font-weight: 700; margin: 0.8em 0 0.4em; }
              .ProseMirror h2 { font-size: 1.3em; font-weight: 600; margin: 0.7em 0 0.35em; }
              .ProseMirror h3 { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; }
              .ProseMirror ul { list-style: disc; padding-left: 1.5em; }
              .ProseMirror ol { list-style: decimal; padding-left: 1.5em; }
              .ProseMirror blockquote { border-left: 3px solid #4b5563; padding-left: 1em; color: #9ca3af; }
              .ProseMirror pre { background: #111827; border-radius: 6px; padding: 12px; font-size: 0.85em; overflow-x: auto; }
              .ProseMirror code { background: #1f2937; border-radius: 3px; padding: 2px 4px; font-size: 0.85em; }
              .ProseMirror hr { border-color: #374151; margin: 1em 0; }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {/* ── 하단 상태바 ── */}
      {!loading && !error && editor && (
        <div className="flex items-center justify-between px-5 py-2 border-t border-gray-800 bg-surface text-[11px] text-gray-600 flex-shrink-0">
          <span>
            단어 {editor.storage.characterCount?.words?.() ?? '—'}개 ·
            글자 {editor.getText().length}자
          </span>
          <span>
            {needsLo && !loAvail
              ? '⚠ LibreOffice 미설치'
              : loAvail
              ? '✓ LibreOffice 사용 가능'
              : 'LibreOffice 미설치 (DOCX 기본 저장)'}
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}
