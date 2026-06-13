'use client';

import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  X, Maximize2, Minimize2, Plus, Terminal,
  RefreshCw, Loader2, WifiOff, ZoomIn, ZoomOut,
  Search, PanelRight, PanelRightClose, Copy, Check,
  Trash2, Info, Zap, Clock, Hash, Key, KeyRound,
} from 'lucide-react';
import clsx from 'clsx';
import type { SshServer } from '@/lib/api';

/* ── WebSocket URL ────────────────────────────────────────── */
function getWsUrl(path: string): string {
  if (typeof window === 'undefined') return '';
  const isLocalDev = window.location.port === '4000' || window.location.hostname === 'localhost';
  if (isLocalDev) return `ws://localhost:8000${path}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}

/* ── 테마 정의 ────────────────────────────────────────────── */
const THEMES = {
  dark: {
    label: 'Dark',
    bg: '#0d1117',
    theme: {
      background: '#0d1117', foreground: '#c9d1d9',
      cursor: '#58a6ff', cursorAccent: '#0d1117',
      selectionBackground: '#264f7840',
      black: '#484f58',   red: '#ff7b72',     green: '#3fb950',  yellow: '#d29922',
      blue: '#58a6ff',    magenta: '#bc8cff', cyan: '#39c5cf',   white: '#b1bac4',
      brightBlack: '#6e7681',   brightRed: '#ffa198',   brightGreen: '#56d364',
      brightYellow: '#e3b341',  brightBlue: '#79c0ff',  brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',    brightWhite: '#f0f6fc',
    },
  },
  midnight: {
    label: 'Midnight',
    bg: '#090c10',
    theme: {
      background: '#090c10', foreground: '#a0b0c0',
      cursor: '#00d4ff', cursorAccent: '#090c10',
      selectionBackground: '#1a3a5040',
      black: '#303040',   red: '#ff5566',     green: '#00cc88',  yellow: '#ffcc00',
      blue: '#3399ff',    magenta: '#cc66ff', cyan: '#00cccc',   white: '#9090a0',
      brightBlack: '#505060',   brightRed: '#ff7788',   brightGreen: '#33ddaa',
      brightYellow: '#ffdd44',  brightBlue: '#55aaff',  brightMagenta: '#dd88ff',
      brightCyan: '#33dddd',    brightWhite: '#c0d0e0',
    },
  },
  solarized: {
    label: 'Solarized',
    bg: '#002b36',
    theme: {
      background: '#002b36', foreground: '#839496',
      cursor: '#268bd2', cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',   red: '#dc322f',     green: '#859900',  yellow: '#b58900',
      blue: '#268bd2',    magenta: '#d33682', cyan: '#2aa198',   white: '#eee8d5',
      brightBlack: '#586e75',   brightRed: '#cb4b16',   brightGreen: '#859900',
      brightYellow: '#657b83',  brightBlue: '#839496',  brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',    brightWhite: '#fdf6e3',
    },
  },
} as const;
type ThemeKey = keyof typeof THEMES;

/* ── Quick Commands ───────────────────────────────────────── */
const QUICK_CMDS = [
  { label: 'ls -la',        cmd: 'ls -la\r',        desc: '파일 목록' },
  { label: 'pwd',           cmd: 'pwd\r',            desc: '현재 경로' },
  { label: 'whoami',        cmd: 'whoami\r',         desc: '현재 사용자' },
  { label: 'uptime',        cmd: 'uptime\r',         desc: '서버 가동 시간' },
  { label: 'df -h',         cmd: 'df -h\r',          desc: '디스크 사용량' },
  { label: 'free -h',       cmd: 'free -h\r',        desc: '메모리 사용량' },
  { label: 'ps aux',        cmd: 'ps aux\r',         desc: '프로세스 목록' },
  { label: 'top',           cmd: 'top\r',            desc: '실시간 프로세스' },
  { label: 'netstat -tlnp', cmd: 'netstat -tlnp\r',  desc: '포트 목록' },
  { label: 'last',          cmd: 'last\r',           desc: '로그인 기록' },
  { label: 'history',       cmd: 'history\r',        desc: '명령어 이력' },
  { label: 'env',           cmd: 'env\r',            desc: '환경변수' },
];

/* ── 타입 ─────────────────────────────────────────────────── */
type Status = 'connecting' | 'connected' | 'error' | 'closed';

interface Tab {
  id: string;
  label: string;
  server: SshServer;            // ← 탭마다 독립 서버
  status: Status;
  errorMsg: string;
  connectedAt: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  term: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fitAddon: any | null;
  ws: WebSocket | null;
}

/* ── Uptime 컴포넌트 ──────────────────────────────────────── */
function Uptime({ since }: { since: number | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!since) return;
    setElapsed(Math.floor((Date.now() - since) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return null;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return (
    <span className="font-mono tabular-nums">
      {h > 0 && `${h}:`}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function TerminalModal({
  initialServer,
  servers,
  onClose,
}: {
  initialServer: SshServer;
  servers: SshServer[];
  onClose: () => void;
}) {
  /* ── 레이아웃 상태 ──────────────────────────────────────── */
  const [fullscreen,      setFullscreen]      = useState(false);
  const [showSide,        setShowSide]        = useState(false);
  const [showSearch,      setShowSearch]      = useState(false);
  const [fontSize,        setFontSize]        = useState(13);
  const [themeKey,        setThemeKey]        = useState<ThemeKey>('dark');
  const [dimensions,      setDimensions]      = useState({ cols: 0, rows: 0 });
  const [copiedCmd,       setCopiedCmd]       = useState<string | null>(null);
  const [showPicker,      setShowPicker]      = useState(false);   // 서버 선택 드롭다운
  const [pickerQuery,     setPickerQuery]     = useState('');
  const pickerRef         = useRef<HTMLDivElement>(null);
  const pickerInputRef    = useRef<HTMLInputElement>(null);

  /* ── 탭 상태 ─────────────────────────────────────────────── */
  const [tabs,       setTabs]       = useState<Tab[]>([]);
  const [activeId,   setActiveId]   = useState('');
  const tabsRef = useRef<Tab[]>([]);
  tabsRef.current = tabs;

  /* ── 검색 ───────────────────────────────────────────────── */
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchAddonMap] = useState<Map<string, unknown>>(() => new Map());
  const searchInputRef   = useRef<HTMLInputElement>(null);

  /* ── 터미널 컨테이너 (탭 ID → div ref) ─────────────────── */
  const containerMap = useRef<Map<string, HTMLDivElement | null>>(new Map());

  /* ── 업데이트 헬퍼 ──────────────────────────────────────── */
  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  /* ── 세션 연결 ──────────────────────────────────────────── */
  const openSession = useCallback(async (tab: Tab) => {
    const container = containerMap.current.get(tab.id);
    if (!container) return;

    await import('@xterm/xterm/css/xterm.css');
    const { Terminal }  = await import('@xterm/xterm');
    const { FitAddon }  = await import('@xterm/addon-fit');
    const { SearchAddon } = await import('@xterm/addon-search');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    const theme = THEMES[themeKey].theme;
    const term = new Terminal({
      theme,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, monospace',
      fontSize,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon    = new FitAddon();
    const searchAddon = new SearchAddon();
    const linksAddon  = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(linksAddon);
    term.open(container);
    fitAddon.fit();
    searchAddonMap.set(tab.id, searchAddon);

    const { cols, rows } = term;
    setDimensions({ cols, rows });

    // 연결 중 배너
    const sv = tab.server;
    term.writeln(`\x1b[38;5;240m┌─────────────────────────────────────────┐\x1b[0m`);
    term.writeln(`\x1b[38;5;240m│\x1b[0m  \x1b[1;36mSSH 연결 중...\x1b[0m`);
    term.writeln(`\x1b[38;5;240m│\x1b[0m  \x1b[90m${sv.username}@${sv.host}:${sv.port}\x1b[0m`);
    term.writeln(`\x1b[38;5;240m└─────────────────────────────────────────┘\x1b[0m`);
    term.writeln('');

    // WebSocket 연결
    const token = localStorage.getItem('auth_token') ?? '';
    const ws = new WebSocket(
      getWsUrl(`/api/ssh-terminal/${sv.id}?token=${encodeURIComponent(token)}`),
    );

    // tab에 인스턴스 저장
    const t = tabsRef.current.find(x => x.id === tab.id);
    if (t) { t.term = term; t.fitAddon = fitAddon; t.ws = ws; }
    setTabs(prev => prev.map(x => x.id === tab.id ? { ...x, term, fitAddon, ws } : x));

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'connected') {
          updateTab(tab.id, { status: 'connected', connectedAt: Date.now() });
          term.clear();
          term.focus();
        } else if (msg.type === 'data') {
          // 뷰포트가 하단에 있을 때만 자동 스크롤 (스크롤 업 중이면 유지)
          const isAtBottom = term.buffer.active.baseY + term.rows >= term.buffer.active.length - 2;
          term.write(msg.data as string);
          if (isAtBottom) term.scrollToBottom();
        } else if (msg.type === 'error') {
          updateTab(tab.id, { status: 'error', errorMsg: msg.message });
          term.writeln(`\r\n\x1b[1;31m✖ ${msg.message}\x1b[0m`);
        } else if (msg.type === 'closed') {
          updateTab(tab.id, { status: 'closed' });
          term.writeln(`\r\n\x1b[90m— 세션 종료 —\x1b[0m`);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => updateTab(tab.id, { status: 'error', errorMsg: 'WebSocket 연결 실패' });
    ws.onclose = () => {
      const cur = tabsRef.current.find(x => x.id === tab.id);
      if (cur?.status === 'connected') {
        updateTab(tab.id, { status: 'closed' });
        term.writeln('\r\n\x1b[90m— 연결이 끊겼습니다 —\x1b[0m');
      }
    };

    // 입력
    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    });

    // 크기 변경
    const sendResize = () => {
      try { fitAddon.fit(); } catch { return; }
      const { cols: c, rows: r } = term;
      setDimensions({ cols: c, rows: r });
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: c, rows: r }));
    };

    const obs = new ResizeObserver(sendResize);
    obs.observe(container);
    // cleanup via tab close
    (tab as unknown as Record<string, unknown>)._obs = obs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey, fontSize]);

  /* ── 탭 생성 ─────────────────────────────────────────────── */
  const addTab = useCallback((targetServer: SshServer) => {
    const id = `tab-${Date.now()}`;
    const newTab: Tab = {
      id,
      label: targetServer.name,
      server: targetServer,
      status: 'connecting', errorMsg: '',
      connectedAt: null,
      term: null, fitAddon: null, ws: null,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveId(id);
    setTimeout(() => openSession(newTab), 80);
    return id;
  }, [openSession]);

  /* 최초 마운트 */
  useEffect(() => {
    addTab(initialServer);
    return () => {
      tabsRef.current.forEach(t => {
        t.ws?.close();
        t.term?.dispose();
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 탭 닫기 ─────────────────────────────────────────────── */
  const closeTab = useCallback((id: string) => {
    const t = tabsRef.current.find(x => x.id === id);
    t?.ws?.close();
    t?.term?.dispose();

    setTabs(prev => {
      const next = prev.filter(x => x.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[next.length - 1].id);
      if (next.length === 0) onClose();
      return next;
    });
  }, [activeId, onClose]);

  /* ── 재연결 ──────────────────────────────────────────────── */
  const reconnect = useCallback((id: string) => {
    const t = tabsRef.current.find(x => x.id === id);
    if (!t) return;
    t.ws?.close();
    t.term?.writeln('\r\n\x1b[90m— 재연결 중... —\x1b[0m');
    // term/fitAddon/ws는 openSession에서 재설정되므로 status만 초기화
    updateTab(id, { status: 'connecting', errorMsg: '', connectedAt: null });
    setTimeout(() => openSession(t), 200);
  }, [openSession, updateTab]);

  /* ── 서버 선택 드롭다운 외부 클릭 닫기 ─────────────────────── */
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  useEffect(() => {
    if (showPicker) {
      setPickerQuery('');
      setTimeout(() => pickerInputRef.current?.focus(), 50);
    }
  }, [showPicker]);

  /* ── 폰트 크기 변경 ──────────────────────────────────────── */
  useEffect(() => {
    tabsRef.current.forEach(t => {
      if (!t.term) return;
      try {
        // 개별 setter 사용 — 전체 options 재적용 시 렌더 노이즈 방지
        t.term.options.fontSize = fontSize;
        requestAnimationFrame(() => {
          try { t.fitAddon?.fit(); } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    });
  }, [fontSize]);

  /* ── 검색 ───────────────────────────────────────────────── */
  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);

  const doSearch = (forward = true) => {
    const addon = searchAddonMap.get(activeId) as { findNext: (q: string) => void; findPrevious: (q: string) => void } | undefined;
    if (!addon || !searchQuery) return;
    forward ? addon.findNext(searchQuery) : addon.findPrevious(searchQuery);
  };

  /* ── 선택 텍스트 복사 ─────────────────────────────────────── */
  const copySelection = useCallback(() => {
    const t = tabsRef.current.find(x => x.id === activeId);
    if (!t?.term) return;
    const sel = t.term.getSelection();
    if (sel) {
      navigator.clipboard.writeText(sel).catch(() => {});
      setCopiedCmd('copy');
      setTimeout(() => setCopiedCmd(null), 1500);
    }
  }, [activeId]);

  /* ── 화면 지우기 ─────────────────────────────────────────── */
  const clearTerminal = useCallback(() => {
    const t = tabsRef.current.find(x => x.id === activeId);
    t?.term?.clear();
  }, [activeId]);

  /* ── Quick Command 실행 ──────────────────────────────────── */
  const sendCmd = useCallback((cmd: string) => {
    const t = tabsRef.current.find(x => x.id === activeId);
    if (!t || t.ws?.readyState !== WebSocket.OPEN) return;
    // 먼저 하단으로 스크롤해 프롬프트 노출
    t.term?.scrollToBottom();
    t.ws.send(JSON.stringify({ type: 'input', data: cmd }));
    // 서버 에코/출력이 돌아온 뒤에도 하단 유지
    setTimeout(() => {
      t.term?.scrollToBottom();
      t.term?.focus();
    }, 80);
  }, [activeId]);

  /* ── ESC 단축키 ──────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showSearch) onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch, onClose]);

  /* ── 현재 탭 정보 ────────────────────────────────────────── */
  const activeTab = tabs.find(t => t.id === activeId);

  const statusBadge: Record<Status, React.ReactNode> = {
    connecting: <span className="flex items-center gap-1.5 text-yellow-400"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-[11px]">연결 중</span></span>,
    connected:  <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[11px]">연결됨</span></span>,
    error:      <span className="flex items-center gap-1.5 text-red-400"><WifiOff className="w-3 h-3" /><span className="text-[11px]">오류</span></span>,
    closed:     <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-600" /><span className="text-[11px]">종료됨</span></span>,
  };

  /* ── 렌더 ────────────────────────────────────────────────── */
  const wrapCls = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col'
    : 'fixed inset-2 sm:inset-6 md:inset-10 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl';

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div
        className={wrapCls}
        style={{ background: THEMES[themeKey].bg, border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* ══ 타이틀 바 ══════════════════════════════════════════ */}
        <div
          className="flex items-center gap-0 flex-shrink-0 select-none"
          style={{ background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.07)', height: 38 }}
        >
          {/* macOS 닫기 버튼 */}
          <div className="flex items-center gap-1.5 px-3 flex-shrink-0">
            <button onClick={onClose}
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 flex items-center justify-center group transition-all"
              title="닫기">
              <X className="w-1.5 h-1.5 text-[#7a0000] opacity-0 group-hover:opacity-100" />
            </button>
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] opacity-50" />
            <button onClick={() => setFullscreen(v => !v)}
              className="w-3 h-3 rounded-full bg-[#27c93f] hover:brightness-110 flex items-center justify-center group transition-all"
              title={fullscreen ? '창 모드' : '전체화면'}>
              {fullscreen
                ? <Minimize2 className="w-1.5 h-1.5 text-[#003000] opacity-0 group-hover:opacity-100" />
                : <Maximize2 className="w-1.5 h-1.5 text-[#003000] opacity-0 group-hover:opacity-100" />}
            </button>
          </div>

          {/* 탭 스트립 — overflow-x-auto 안에는 탭만, + 버튼은 바깥 */}
          <div className="flex items-end h-full flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 h-full text-[11px] whitespace-nowrap transition-colors border-r flex-shrink-0 max-w-[160px]',
                  'border-white/5 group/tab',
                  t.id === activeId
                    ? 'text-gray-200 bg-transparent border-b-0'
                    : 'text-gray-600 hover:text-gray-400',
                )}
                style={t.id === activeId ? {
                  background: `${THEMES[themeKey].bg}`,
                  boxShadow: 'inset 0 2px 0 rgba(88,166,255,0.4)',
                } : {}}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
                  'bg-emerald-400 animate-pulse': t.status === 'connected',
                  'bg-yellow-400 animate-pulse': t.status === 'connecting',
                  'bg-red-400': t.status === 'error',
                  'bg-gray-600': t.status === 'closed',
                })} />
                <span className="truncate">{t.label}</span>
                <span
                  onClick={e => { e.stopPropagation(); closeTab(t.id); }}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover/tab:opacity-100 hover:bg-white/15 transition-all flex-shrink-0 cursor-pointer"
                >
                  <X className="w-2 h-2" />
                </span>
              </button>
            ))}
          </div>

          {/* 탭 추가 — overflow-x-auto 바깥에 위치해 드롭다운이 잘리지 않음 */}
          <div className="relative flex-shrink-0 flex items-center h-full" ref={pickerRef}>
            <button
              onClick={() => setShowPicker(v => !v)}
              className={clsx(
                'w-8 h-full flex items-center justify-center transition-colors border-r border-white/5',
                showPicker ? 'text-blue-400 bg-white/8' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5',
              )}
              title="새 서버 세션 열기"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {showPicker && (
              <div
                className="absolute top-full left-0 mt-1 w-72 rounded-xl overflow-hidden shadow-2xl z-[100]"
                style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {/* 헤더 */}
                <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <input
                    ref={pickerInputRef}
                    value={pickerQuery}
                    onChange={e => setPickerQuery(e.target.value)}
                    placeholder="서버 이름 또는 호스트 검색..."
                    className="flex-1 bg-transparent text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none"
                    onKeyDown={e => e.key === 'Escape' && setShowPicker(false)}
                  />
                  <button onClick={() => setShowPicker(false)} className="text-gray-700 hover:text-gray-400 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* 서버 목록 */}
                <div className="max-h-60 overflow-y-auto py-1">
                  {servers
                    .filter(s =>
                      !pickerQuery ||
                      s.name.toLowerCase().includes(pickerQuery.toLowerCase()) ||
                      s.host.toLowerCase().includes(pickerQuery.toLowerCase()),
                    )
                    .map(s => (
                      <button
                        key={s.id}
                        onClick={() => { addTab(s); setShowPicker(false); setPickerQuery(''); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/8 transition-colors text-left group"
                      >
                        <div className={clsx(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          s.last_test_ok === true  ? 'bg-emerald-400' :
                          s.last_test_ok === false ? 'bg-red-400' : 'bg-gray-600',
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-200 truncate group-hover:text-white transition-colors font-medium">{s.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono truncate">{s.username}@{s.host}:{s.port}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {s.auth_type === 'key'
                            ? <Key className="w-3 h-3 text-violet-400" />
                            : <KeyRound className="w-3 h-3 text-blue-400" />}
                          <span className="text-[9px] text-gray-600">{s.auth_type === 'key' ? 'Key' : 'PW'}</span>
                        </div>
                      </button>
                    ))}
                  {servers.filter(s =>
                    !pickerQuery ||
                    s.name.toLowerCase().includes(pickerQuery.toLowerCase()) ||
                    s.host.toLowerCase().includes(pickerQuery.toLowerCase()),
                  ).length === 0 && (
                    <p className="px-3 py-4 text-xs text-gray-600 text-center">검색 결과가 없습니다</p>
                  )}
                </div>

                <div className="px-3 py-1.5 text-[10px] text-gray-700 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  총 {servers.length}개의 서버
                </div>
              </div>
            )}
          </div>

          {/* 우측: 서버명 + 상태 + 사이드바 토글 */}
          <div className="flex items-center gap-3 px-3 flex-shrink-0">
            {activeTab?.server && (
              <span className="text-[10px] text-gray-600 font-mono hidden sm:block truncate max-w-[160px]">
                {activeTab.server.username}@{activeTab.server.host}
              </span>
            )}
            {activeTab && statusBadge[activeTab.status]}
            <button
              onClick={() => setShowSide(v => !v)}
              className={clsx(
                'w-6 h-6 flex items-center justify-center rounded transition-colors',
                showSide ? 'text-blue-400 bg-blue-400/15' : 'text-gray-600 hover:text-gray-300 hover:bg-white/8',
              )}
              title={showSide ? '패널 닫기' : '서버 정보 / 빠른 명령어 열기'}
            >
              {showSide ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ══ 툴바 ═══════════════════════════════════════════════ */}
        <div
          className="flex items-center gap-1 px-3 flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.28)', borderBottom: '1px solid rgba(255,255,255,0.05)', height: 32 }}
        >
          {/* 재연결 */}
          {activeTab && (activeTab.status === 'closed' || activeTab.status === 'error') && (
            <button
              onClick={() => reconnect(activeId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-brand/20 text-brand hover:bg-brand/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> 재연결
            </button>
          )}

          {/* 구분선 */}
          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* 폰트 크기 */}
          <button onClick={() => setFontSize(s => Math.max(9, s - 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
            title="폰트 작게"><ZoomOut className="w-3 h-3" /></button>
          <span className="text-[11px] text-gray-600 tabular-nums w-6 text-center">{fontSize}</span>
          <button onClick={() => setFontSize(s => Math.min(20, s + 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
            title="폰트 크게"><ZoomIn className="w-3 h-3" /></button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* 테마 */}
          {(Object.keys(THEMES) as ThemeKey[]).map(k => (
            <button
              key={k}
              onClick={() => setThemeKey(k)}
              className={clsx(
                'px-2 py-0.5 rounded text-[10px] transition-colors',
                themeKey === k
                  ? 'bg-white/15 text-gray-200'
                  : 'text-gray-600 hover:text-gray-400 hover:bg-white/5',
              )}
            >{THEMES[k].label}</button>
          ))}

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* 선택 복사 */}
          <button
            onClick={copySelection}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
            title="선택 영역 복사"
          >
            {copiedCmd === 'copy' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* 화면 지우기 */}
          <button
            onClick={clearTerminal}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
            title="화면 지우기 (clear)"
          ><Trash2 className="w-3 h-3" /></button>

          {/* 검색 토글 */}
          <button
            onClick={() => setShowSearch(v => !v)}
            className={clsx(
              'w-6 h-6 flex items-center justify-center rounded transition-colors',
              showSearch ? 'bg-brand/20 text-brand' : 'text-gray-500 hover:text-gray-300 hover:bg-white/10',
            )}
            title="터미널 검색 (Ctrl+F)"
          ><Search className="w-3 h-3" /></button>

          {/* 오른쪽: 서버 info */}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-700">
            <span className="font-mono">{activeTab?.server.host}:{activeTab?.server.port}</span>
          </div>
        </div>

        {/* ══ 검색 바 ════════════════════════════════════════════ */}
        {showSearch && (
          <div
            className="flex items-center gap-2 px-3 flex-shrink-0"
            style={{
              background: 'rgba(10,20,40,0.85)',
              borderBottom: '1px solid rgba(59,130,246,0.3)',
              borderTop: '1px solid rgba(59,130,246,0.15)',
              height: 36,
            }}
          >
            <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') doSearch(!e.shiftKey);
                if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); }
              }}
              placeholder="검색어 입력 후 Enter (이전: Shift+Enter)"
              className="flex-1 bg-transparent text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none"
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => doSearch(false)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 rounded hover:bg-white/10 transition-colors"
                title="이전 (Shift+Enter)">↑ 이전</button>
              <button onClick={() => doSearch(true)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 rounded hover:bg-white/10 transition-colors"
                title="다음 (Enter)">↓ 다음</button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-300 rounded hover:bg-white/10 transition-colors"
                title="검색 닫기 (Esc)">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* ══ 메인 콘텐츠 ════════════════════════════════════════ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* 터미널 영역 */}
          <div className="flex-1 min-w-0 relative" style={{ background: THEMES[themeKey].bg }}>
            {tabs.map(t => (
              <div
                key={t.id}
                ref={el => {
                  containerMap.current.set(t.id, el);
                }}
                className="absolute inset-0 p-1"
                style={{
                  visibility: t.id === activeId ? 'visible' : 'hidden',
                  pointerEvents: t.id === activeId ? 'auto' : 'none',
                  background: THEMES[themeKey].bg,
                }}
              />
            ))}

            {/* 연결 중 오버레이 */}
            {activeTab?.status === 'connecting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none"
                style={{ background: `${THEMES[themeKey].bg}cc` }}>
                <div className="w-10 h-10 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                <p className="text-sm text-gray-400">SSH 연결 중...</p>
                <p className="text-xs text-gray-600 font-mono">{activeTab?.server.username}@{activeTab?.server.host}:{activeTab?.server.port}</p>
              </div>
            )}

            {/* 오류/종료 오버레이 버튼 */}
            {activeTab && (activeTab.status === 'error' || activeTab.status === 'closed') && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
                <button
                  onClick={() => reconnect(activeId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-brand/20 border border-brand/40 text-brand hover:bg-brand/30 transition-colors shadow-lg backdrop-blur-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  재연결
                </button>
              </div>
            )}
          </div>

          {/* ── 사이드 패널 ─────────────────────────────────────── */}
          {showSide && (
            <div
              className="w-60 flex-shrink-0 flex flex-col overflow-hidden"
              style={{ background: 'rgba(5,10,20,0.8)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}
            >
              {/* 서버 정보 */}
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3 h-3 text-gray-600" />
                  <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">서버 정보</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {[
                    { label: '이름',   value: activeTab?.server.name },
                    { label: '호스트', value: activeTab?.server.host, mono: true },
                    { label: '포트',   value: activeTab?.server.port, mono: true },
                    { label: '사용자', value: activeTab?.server.username, mono: true },
                    { label: '인증',   value: activeTab?.server.auth_type === 'key' ? 'SSH Key' : 'Password' },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-gray-600 flex-shrink-0">{label}</span>
                      <span className={clsx('text-gray-300 truncate', mono && 'font-mono')}>{value}</span>
                    </div>
                  ))}
                </div>
                {(activeTab?.server.tags.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activeTab?.server.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-white/8 text-gray-500">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 빠른 명령어 */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">빠른 명령어</span>
                  </div>
                  <span className="text-[9px] text-gray-700">클릭 → Enter</span>
                </div>
                <div className="py-1">
                  {QUICK_CMDS.map(({ label, cmd, desc }) => (
                    <button
                      key={cmd}
                      onClick={() => sendCmd(cmd)}
                      disabled={activeTab?.status !== 'connected'}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/8 transition-colors group disabled:opacity-30 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-200 font-mono group-hover:text-yellow-400 transition-colors truncate">{label}</p>
                        <p className="text-[9px] text-gray-600 mt-0.5">{desc}</p>
                      </div>
                      <Terminal className="w-2.5 h-2.5 text-gray-700 group-hover:text-yellow-500 transition-colors flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ 상태 바 ════════════════════════════════════════════ */}
        <div
          className="flex items-center gap-4 px-3 flex-shrink-0 text-[10px] text-gray-700"
          style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', height: 22 }}
        >
          {/* 접속 정보 */}
          <span className="flex items-center gap-1">
            <Terminal className="w-2.5 h-2.5" />
            <span className="font-mono">{activeTab?.server.username}@{activeTab?.server.host}</span>
          </span>

          {/* 업타임 */}
          {activeTab?.status === 'connected' && activeTab.connectedAt && (
            <span className="flex items-center gap-1 text-emerald-700">
              <Clock className="w-2.5 h-2.5" />
              <Uptime since={activeTab.connectedAt} />
            </span>
          )}

          {/* 터미널 크기 */}
          {dimensions.cols > 0 && (
            <span className="flex items-center gap-1">
              <Hash className="w-2.5 h-2.5" />
              {dimensions.cols}×{dimensions.rows}
            </span>
          )}

          {/* 오류 메시지 */}
          {activeTab?.errorMsg && (
            <span className="text-red-600 truncate max-w-xs">{activeTab.errorMsg}</span>
          )}

          {/* 단축키 힌트 */}
          <div className="ml-auto flex items-center gap-3">
            <span>Ctrl+F 검색</span>
            <span>Ctrl+C 인터럽트</span>
            <span>Ctrl+D 로그아웃</span>
          </div>
        </div>
      </div>
    </div>
  );
}
