'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthHeaders } from '@/lib/api';
import clsx from 'clsx';
import {
  Code2, Hash, FileJson, Clock, ArrowLeftRight, Network,
  Plug, Search, ShieldCheck, Copy, Check, AlertCircle, Loader2,
} from 'lucide-react';

/* ── 도구 목록 ─────────────────────────────────────────────────── */
type ToolId = 'base64' | 'hash' | 'json' | 'ts' | 'diff' | 'cidr' | 'port' | 'regex' | 'ssl';

const TOOLS: { id: ToolId; label: string; icon: React.ElementType }[] = [
  { id: 'base64', label: 'Base64 / URL', icon: Code2         },
  { id: 'hash',   label: '해시 계산',    icon: Hash          },
  { id: 'json',   label: 'JSON 포맷터',  icon: FileJson      },
  { id: 'ts',     label: '타임스탬프',   icon: Clock         },
  { id: 'diff',   label: 'Diff 비교',    icon: ArrowLeftRight },
  { id: 'cidr',   label: 'CIDR 계산',    icon: Network       },
  { id: 'port',   label: '포트 참조',    icon: Plug          },
  { id: 'regex',  label: '정규식',       icon: Search        },
  { id: 'ssl',    label: 'SSL 인증서',   icon: ShieldCheck   },
];

/* ── 공통 컴포넌트 ─────────────────────────────────────────────── */
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
      title="복사"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TA({
  value, onChange, placeholder, readOnly = false, rows = 6,
}: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; readOnly?: boolean; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={rows}
      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-brand resize-none"
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-gray-500 mb-1.5">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-800/60 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs text-gray-200 font-mono break-all text-right">{value}</span>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
    </div>
  );
}

/* ── 1. Base64 / URL ───────────────────────────────────────────── */
function Base64Tool() {
  const [input,  setInput]  = useState('');
  const [mode,   setMode]   = useState<'b64e' | 'b64d' | 'urle' | 'urld'>('b64e');
  const [output, setOutput] = useState('');
  const [error,  setError]  = useState('');

  useEffect(() => {
    setError('');
    if (!input) { setOutput(''); return; }
    try {
      switch (mode) {
        case 'b64e': setOutput(btoa(unescape(encodeURIComponent(input)))); break;
        case 'b64d': setOutput(decodeURIComponent(escape(atob(input)))); break;
        case 'urle': setOutput(encodeURIComponent(input)); break;
        case 'urld': setOutput(decodeURIComponent(input)); break;
      }
    } catch (e: any) {
      setError('변환 실패: ' + e.message);
      setOutput('');
    }
  }, [input, mode]);

  const modes = [
    { id: 'b64e' as const, label: 'Base64 인코딩' },
    { id: 'b64d' as const, label: 'Base64 디코딩' },
    { id: 'urle' as const, label: 'URL 인코딩'    },
    { id: 'urld' as const, label: 'URL 디코딩'    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={clsx('px-3 py-1 text-xs rounded-lg transition-colors',
              mode === m.id ? 'bg-brand text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            )}
          >{m.label}</button>
        ))}
      </div>
      <div>
        <Label>입력</Label>
        <TA value={input} onChange={setInput} placeholder="변환할 텍스트 입력..." rows={5} />
      </div>
      <ErrMsg msg={error} />
      {output && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>결과</Label>
            <CopyBtn text={output} />
          </div>
          <TA value={output} readOnly rows={5} />
        </div>
      )}
    </div>
  );
}

/* ── 2. 해시 계산기 ────────────────────────────────────────────── */
async function digestHex(algo: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function HashTool() {
  const [input,  setInput]  = useState('');
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!input) { setHashes({}); return; }
    Promise.all([
      digestHex('SHA-1',   input).then(h => ['SHA-1',   h] as const),
      digestHex('SHA-256', input).then(h => ['SHA-256', h] as const),
      digestHex('SHA-512', input).then(h => ['SHA-512', h] as const),
    ]).then(r => setHashes(Object.fromEntries(r)));
  }, [input]);

  return (
    <div className="space-y-4">
      <div>
        <Label>입력 텍스트</Label>
        <TA value={input} onChange={setInput} placeholder="해시를 계산할 텍스트..." rows={4} />
      </div>
      {Object.keys(hashes).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3">
          {Object.entries(hashes).map(([algo, h]) => <InfoRow key={algo} label={algo} value={h} />)}
        </div>
      )}
    </div>
  );
}

/* ── 3. JSON 포맷터 ────────────────────────────────────────────── */
function JsonTool() {
  const [input,  setInput]  = useState('');
  const [output, setOutput] = useState('');
  const [error,  setError]  = useState('');
  const [indent, setIndent] = useState(2);

  function run(fn: (parsed: unknown) => string) {
    setError('');
    try {
      setOutput(fn(JSON.parse(input)));
    } catch (e: any) {
      setError(e.message);
      setOutput('');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>JSON 입력</Label>
        <TA value={input} onChange={v => { setInput(v); setError(''); setOutput(''); }} placeholder='{"key": "value"}' rows={7} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run(p => JSON.stringify(p, null, indent))}
          className="px-3 py-1.5 text-xs bg-brand/20 text-brand hover:bg-brand/30 rounded-lg transition-colors">정렬</button>
        <button onClick={() => run(p => JSON.stringify(p))}
          className="px-3 py-1.5 text-xs bg-brand/20 text-brand hover:bg-brand/30 rounded-lg transition-colors">압축</button>
        <button onClick={() => { try { JSON.parse(input); setError(''); setOutput('✓ 유효한 JSON입니다.'); } catch (e: any) { setError(e.message); setOutput(''); } }}
          className="px-3 py-1.5 text-xs bg-brand/20 text-brand hover:bg-brand/30 rounded-lg transition-colors">검증</button>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          들여쓰기
          {[2, 4].map(n => (
            <button key={n} onClick={() => setIndent(n)}
              className={clsx('px-2 py-0.5 rounded', indent === n ? 'bg-brand text-white' : 'bg-gray-800 text-gray-400')}
            >{n}</button>
          ))}
        </div>
      </div>
      <ErrMsg msg={error} />
      {output && !error && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>결과</Label>
            <CopyBtn text={output} />
          </div>
          <TA value={output} readOnly rows={7} />
        </div>
      )}
    </div>
  );
}

/* ── 4. 타임스탬프 ─────────────────────────────────────────────── */
function TimestampTool() {
  const [unix,  setUnix]  = useState(String(Math.floor(Date.now() / 1000)));
  const [dateS, setDateS] = useState('');
  const [now,   setNow]   = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fromUnix = useMemo(() => {
    const n = Number(unix);
    if (isNaN(n) || !unix) return null;
    const ms = unix.length >= 13 ? n : n * 1000;
    const d  = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }, [unix]);

  function applyDate() {
    if (!dateS) return;
    const d = new Date(dateS);
    if (!isNaN(d.getTime())) setUnix(String(Math.floor(d.getTime() / 1000)));
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">현재 Unix 타임스탬프</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl font-mono font-bold text-brand">{Math.floor(now / 1000)}</span>
          <CopyBtn text={String(Math.floor(now / 1000))} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{new Date(now).toLocaleString('ko-KR')}</p>
      </div>

      <div>
        <Label>Unix 타임스탬프 → 날짜</Label>
        <input value={unix} onChange={e => setUnix(e.target.value)} placeholder="1700000000"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
        />
        {fromUnix && (
          <div className="mt-2 bg-gray-900 rounded-lg p-3">
            <InfoRow label="로컬" value={fromUnix.toLocaleString('ko-KR')} />
            <InfoRow label="UTC"  value={fromUnix.toUTCString()} />
            <InfoRow label="ISO"  value={fromUnix.toISOString()} />
            <InfoRow label="ms"   value={String(fromUnix.getTime())} />
          </div>
        )}
      </div>

      <div>
        <Label>날짜 → Unix 타임스탬프</Label>
        <div className="flex gap-2">
          <input type="datetime-local" value={dateS} onChange={e => setDateS(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand"
          />
          <button onClick={applyDate}
            className="px-3 py-1.5 text-xs bg-brand/20 text-brand hover:bg-brand/30 rounded-lg transition-colors">변환</button>
        </div>
      </div>
    </div>
  );
}

/* ── 5. Diff 비교기 ────────────────────────────────────────────── */
type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

function computeDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  const out: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { out.unshift({ type: 'same', text: a[i-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { out.unshift({ type: 'add', text: b[j-1] }); j--; }
    else { out.unshift({ type: 'del', text: a[i-1] }); i--; }
  }
  return out;
}

function DiffTool() {
  const [left,  setLeft]  = useState('');
  const [right, setRight] = useState('');
  const [dirty, setDirty] = useState(true);
  const [diff,  setDiff]  = useState<DiffLine[]>([]);

  function compare() {
    setDiff(computeDiff(left.split('\n'), right.split('\n')));
    setDirty(false);
  }

  const stats = useMemo(() => ({
    add:  diff.filter(d => d.type === 'add').length,
    del:  diff.filter(d => d.type === 'del').length,
    same: diff.filter(d => d.type === 'same').length,
  }), [diff]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>원본 (Before)</Label>
          <TA value={left}  onChange={v => { setLeft(v);  setDirty(true); }} rows={8} placeholder="원본 텍스트..." />
        </div>
        <div>
          <Label>수정본 (After)</Label>
          <TA value={right} onChange={v => { setRight(v); setDirty(true); }} rows={8} placeholder="수정된 텍스트..." />
        </div>
      </div>

      <button onClick={compare}
        className="px-4 py-1.5 text-xs bg-brand/20 text-brand hover:bg-brand/30 rounded-lg transition-colors"
      >비교</button>

      {!dirty && diff.length > 0 && (
        <>
          <div className="flex gap-4 text-xs">
            <span className="text-green-400">+{stats.add} 추가</span>
            <span className="text-red-400">-{stats.del} 삭제</span>
            <span className="text-gray-500">{stats.same} 동일</span>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-y-auto max-h-72">
            {diff.map((line, idx) => (
              <div key={idx} className={clsx(
                'flex items-start px-3 py-0.5 text-xs font-mono',
                line.type === 'add'  && 'bg-green-900/20 text-green-300',
                line.type === 'del'  && 'bg-red-900/20   text-red-300',
                line.type === 'same' && 'text-gray-600',
              )}>
                <span className="w-4 flex-shrink-0 mr-2 text-gray-700">
                  {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── 6. CIDR 계산기 ────────────────────────────────────────────── */
function numToIp(n: number) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function cidrCalc(cidr: string) {
  const m = cidr.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) return null;
  const parts = m[1].split('.').map(Number);
  if (parts.some(p => p > 255)) return null;
  const prefix = parseInt(m[2]);
  if (prefix > 32) return null;

  const ipNum   = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const mask    = prefix === 0 ? 0 : ((~0 << (32 - prefix)) >>> 0);
  const network = (ipNum & mask) >>> 0;
  const bcast   = (network | ((~mask) >>> 0)) >>> 0;
  const hosts   = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;

  return {
    network:   numToIp(network),
    broadcast: numToIp(bcast),
    firstHost: prefix >= 31 ? numToIp(network)   : numToIp(network + 1),
    lastHost:  prefix >= 31 ? numToIp(bcast)      : numToIp(bcast - 1),
    hosts:     Math.max(0, hosts),
    mask:      numToIp(mask),
    wildcard:  numToIp((~mask) >>> 0),
    prefix,
  };
}

function CidrTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => cidrCalc(input), [input]);

  return (
    <div className="space-y-4">
      <div>
        <Label>CIDR 표기법</Label>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="192.168.1.0/24"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
        />
      </div>
      {result ? (
        <div className="bg-gray-900 rounded-lg p-3">
          <InfoRow label="네트워크 주소"       value={result.network} />
          <InfoRow label="브로드캐스트"         value={result.broadcast} />
          <InfoRow label="첫 번째 호스트"       value={result.firstHost} />
          <InfoRow label="마지막 호스트"        value={result.lastHost} />
          <InfoRow label="사용 가능 호스트 수"  value={result.hosts.toLocaleString()} />
          <InfoRow label="서브넷 마스크"        value={result.mask} />
          <InfoRow label="와일드카드 마스크"    value={result.wildcard} />
          <InfoRow label="프리픽스"             value={`/${result.prefix}`} />
        </div>
      ) : input.trim() && (
        <p className="text-xs text-red-400">올바른 CIDR 형식이 아닙니다 (예: 10.0.0.0/8)</p>
      )}
    </div>
  );
}

/* ── 7. 포트 참조 ──────────────────────────────────────────────── */
const PORT_DATA = [
  { port: 20,    proto: 'TCP',     service: 'FTP-Data',      desc: 'FTP 데이터 전송' },
  { port: 21,    proto: 'TCP',     service: 'FTP',           desc: '파일 전송' },
  { port: 22,    proto: 'TCP',     service: 'SSH',           desc: '보안 원격 접속' },
  { port: 23,    proto: 'TCP',     service: 'Telnet',        desc: '원격 접속 (비암호화)' },
  { port: 25,    proto: 'TCP',     service: 'SMTP',          desc: '이메일 발송' },
  { port: 53,    proto: 'UDP/TCP', service: 'DNS',           desc: '도메인 이름 해석' },
  { port: 67,    proto: 'UDP',     service: 'DHCP Server',   desc: 'DHCP 서버' },
  { port: 68,    proto: 'UDP',     service: 'DHCP Client',   desc: 'DHCP 클라이언트' },
  { port: 80,    proto: 'TCP',     service: 'HTTP',          desc: '웹 서비스' },
  { port: 110,   proto: 'TCP',     service: 'POP3',          desc: '이메일 수신' },
  { port: 123,   proto: 'UDP',     service: 'NTP',           desc: '시간 동기화' },
  { port: 143,   proto: 'TCP',     service: 'IMAP',          desc: '이메일 수신 (동기)' },
  { port: 161,   proto: 'UDP',     service: 'SNMP',          desc: '네트워크 장비 관리' },
  { port: 389,   proto: 'TCP',     service: 'LDAP',          desc: '디렉토리 서비스' },
  { port: 443,   proto: 'TCP',     service: 'HTTPS',         desc: '암호화 웹 서비스' },
  { port: 445,   proto: 'TCP',     service: 'SMB',           desc: '파일 공유 (Windows)' },
  { port: 465,   proto: 'TCP',     service: 'SMTPS',         desc: 'SSL 이메일 발송' },
  { port: 514,   proto: 'UDP',     service: 'Syslog',        desc: '시스템 로그' },
  { port: 587,   proto: 'TCP',     service: 'SMTP-TLS',      desc: 'STARTTLS 이메일 발송' },
  { port: 636,   proto: 'TCP',     service: 'LDAPS',         desc: '암호화 LDAP' },
  { port: 993,   proto: 'TCP',     service: 'IMAPS',         desc: 'SSL IMAP' },
  { port: 995,   proto: 'TCP',     service: 'POP3S',         desc: 'SSL POP3' },
  { port: 1433,  proto: 'TCP',     service: 'MSSQL',         desc: 'Microsoft SQL Server' },
  { port: 1521,  proto: 'TCP',     service: 'Oracle DB',     desc: 'Oracle 데이터베이스' },
  { port: 3306,  proto: 'TCP',     service: 'MySQL',         desc: 'MySQL 데이터베이스' },
  { port: 3389,  proto: 'TCP',     service: 'RDP',           desc: '원격 데스크톱 (Windows)' },
  { port: 4444,  proto: 'TCP',     service: 'Meterpreter',   desc: 'Metasploit 기본 리버스 쉘' },
  { port: 5432,  proto: 'TCP',     service: 'PostgreSQL',    desc: 'PostgreSQL DB' },
  { port: 5900,  proto: 'TCP',     service: 'VNC',           desc: '원격 화면 공유' },
  { port: 6379,  proto: 'TCP',     service: 'Redis',         desc: 'Redis 캐시' },
  { port: 6443,  proto: 'TCP',     service: 'K8s API',       desc: 'Kubernetes API 서버' },
  { port: 8080,  proto: 'TCP',     service: 'HTTP-Alt',      desc: 'HTTP 대체 포트' },
  { port: 8443,  proto: 'TCP',     service: 'HTTPS-Alt',     desc: 'HTTPS 대체 포트' },
  { port: 8888,  proto: 'TCP',     service: 'Jupyter',       desc: 'Jupyter Notebook' },
  { port: 9200,  proto: 'TCP',     service: 'Elasticsearch', desc: 'Elasticsearch REST API' },
  { port: 9300,  proto: 'TCP',     service: 'ES Cluster',    desc: 'Elasticsearch 노드 통신' },
  { port: 11211, proto: 'TCP',     service: 'Memcached',     desc: '메모리 캐시' },
  { port: 27017, proto: 'TCP',     service: 'MongoDB',       desc: 'MongoDB 데이터베이스' },
  { port: 50000, proto: 'TCP',     service: 'Jenkins',       desc: 'Jenkins CI/CD' },
];

function PortTool() {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q) return PORT_DATA;
    const s = q.toLowerCase();
    return PORT_DATA.filter(p =>
      String(p.port).includes(s) ||
      p.service.toLowerCase().includes(s) ||
      p.desc.toLowerCase().includes(s) ||
      p.proto.toLowerCase().includes(s)
    );
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="포트 번호, 서비스명, 설명으로 검색..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
        />
      </div>
      <div className="overflow-y-auto max-h-80 rounded-lg border border-gray-800 divide-y divide-gray-800/50">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-6">검색 결과 없음</p>
        ) : (
          filtered.map(p => (
            <div key={p.port} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800/30 text-xs">
              <span className="w-14 font-mono font-bold text-brand flex-shrink-0">{p.port}</span>
              <span className="w-14 text-gray-600 flex-shrink-0">{p.proto}</span>
              <span className="w-28 font-medium text-gray-300 flex-shrink-0">{p.service}</span>
              <span className="text-gray-500 truncate">{p.desc}</span>
            </div>
          ))
        )}
      </div>
      <p className="text-[10px] text-gray-700 text-right">{filtered.length} / {PORT_DATA.length}</p>
    </div>
  );
}

/* ── 8. 정규식 테스터 ──────────────────────────────────────────── */
function RegexTool() {
  const [pattern, setPattern] = useState('');
  const [flags,   setFlags]   = useState('g');
  const [input,   setInput]   = useState('');

  const { matches, error } = useMemo(() => {
    if (!pattern || !input) return { matches: null as null | { text: string; index: number; groups: (string | undefined)[] }[], error: '' };
    try {
      const re = new RegExp(pattern, flags);
      const list: { text: string; index: number; groups: (string | undefined)[] }[] = [];
      if (flags.includes('g')) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(input)) !== null) {
          list.push({ text: m[0], index: m.index, groups: Array.from(m).slice(1) });
          if (m[0].length === 0) re.lastIndex++;
        }
      } else {
        const m = re.exec(input);
        if (m) list.push({ text: m[0], index: m.index, groups: Array.from(m).slice(1) });
      }
      return { matches: list, error: '' };
    } catch (e: any) {
      return { matches: null, error: e.message };
    }
  }, [pattern, flags, input]);

  return (
    <div className="space-y-4">
      <div>
        <Label>패턴 / 플래그</Label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 gap-1">
            <span className="text-gray-600 font-mono">/</span>
            <input value={pattern} onChange={e => setPattern(e.target.value)}
              placeholder="패턴 입력..."
              className="flex-1 bg-transparent text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none"
            />
            <span className="text-gray-600 font-mono">/{flags}</span>
          </div>
          <div className="flex gap-1">
            {['g','i','m','s'].map(f => (
              <button key={f} onClick={() => setFlags(p => p.includes(f) ? p.replace(f, '') : p + f)}
                className={clsx('w-8 rounded-lg text-xs font-mono transition-colors',
                  flags.includes(f) ? 'bg-brand text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                )}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label>테스트 문자열</Label>
        <TA value={input} onChange={setInput} placeholder="테스트할 텍스트..." rows={5} />
      </div>
      <ErrMsg msg={error} />
      {matches !== null && !error && (
        <div>
          <p className={clsx('text-xs font-medium mb-2', matches.length > 0 ? 'text-green-400' : 'text-gray-500')}>
            {matches.length > 0 ? `${matches.length}개 매칭` : '매칭 없음'}
          </p>
          {matches.length > 0 && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800/50 max-h-48 overflow-y-auto">
              {matches.map((m, i) => (
                <div key={i} className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 w-5 flex-shrink-0">{i+1}</span>
                    <span className="font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded">{m.text}</span>
                    <span className="text-gray-600">index: {m.index}</span>
                  </div>
                  {m.groups.some(g => g !== undefined) && (
                    <div className="ml-8 mt-1 flex flex-wrap gap-2">
                      {m.groups.map((g, gi) => (
                        <span key={gi} className="text-[10px] text-gray-500 font-mono">
                          [{gi+1}] {g ?? 'undefined'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 9. SSL 인증서 조회 ────────────────────────────────────────── */
interface SslResult {
  domain: string; common_name: string; org: string;
  issuer_cn: string; issuer_org: string;
  not_before: string; not_after: string;
  days_left: number; sans: string[]; serial: string;
}

function SslTool() {
  const [domain,  setDomain]  = useState('');
  const [port,    setPort]    = useState('443');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<SslResult | null>(null);
  const [error,   setError]   = useState('');

  async function check() {
    if (!domain.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(
        `/api/tools/ssl?domain=${encodeURIComponent(domain.trim())}&port=${port}`,
        { headers: getAuthHeaders() }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail ?? '조회 실패');
      setResult(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const dayColor = (d: number) =>
    d <= 7 ? 'text-red-400' : d <= 30 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={domain} onChange={e => setDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="example.com"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
        />
        <input value={port} onChange={e => setPort(e.target.value)} placeholder="443"
          className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
        />
        <button onClick={check} disabled={loading || !domain.trim()}
          className="px-4 py-2 text-xs bg-brand/20 text-brand hover:bg-brand/30 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ShieldCheck className="w-3.5 h-3.5" />
          }
          조회
        </button>
      </div>

      <ErrMsg msg={error} />

      {result && (
        <div className="space-y-3">
          <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">만료까지</p>
              <p className={clsx('text-3xl font-bold font-mono', dayColor(result.days_left))}>
                {result.days_left < 0 ? '만료됨' : `${result.days_left}일`}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500 space-y-0.5">
              <p>발급: {new Date(result.not_before).toLocaleDateString('ko-KR')}</p>
              <p className={dayColor(result.days_left)}>
                만료: {new Date(result.not_after).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-3">
            <InfoRow label="도메인 (CN)"   value={result.common_name} />
            <InfoRow label="조직"           value={result.org || '—'} />
            <InfoRow label="발급 기관 (CN)" value={result.issuer_cn} />
            <InfoRow label="발급 기관 조직" value={result.issuer_org || '—'} />
            <InfoRow label="시리얼 번호"    value={result.serial} />
          </div>

          {result.sans.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">SAN (Subject Alternative Names)</p>
              <div className="flex flex-wrap gap-1.5">
                {result.sans.map(san => (
                  <span key={san} className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{san}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 메인 페이지 ───────────────────────────────────────────────── */
export default function ToolsPage() {
  const [active, setActive] = useState<ToolId>('base64');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-100">보안 도구</h1>
            <p className="text-xs text-gray-500 mt-0.5">현장에서 바로 쓰는 유틸리티 모음</p>
          </div>

          {/* 탭 */}
          <div className="flex flex-wrap gap-2 mb-5">
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  active === t.id
                    ? 'bg-brand text-white'
                    : 'bg-surface-raised border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* 도구 콘텐츠 */}
          <div className="bg-surface-raised border border-gray-800 rounded-xl p-5">
            {active === 'base64' && <Base64Tool />}
            {active === 'hash'   && <HashTool />}
            {active === 'json'   && <JsonTool />}
            {active === 'ts'     && <TimestampTool />}
            {active === 'diff'   && <DiffTool />}
            {active === 'cidr'   && <CidrTool />}
            {active === 'port'   && <PortTool />}
            {active === 'regex'  && <RegexTool />}
            {active === 'ssl'    && <SslTool />}
          </div>
        </div>
      </main>
    </div>
  );
}
