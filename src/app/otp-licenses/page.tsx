'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthHeaders } from '@/lib/api';
import {
  Plus, Pencil, Trash2, Search, X,
  AlertTriangle, ChevronUp, ChevronDown,
  ShoppingCart, Timer, Activity, Database,
  ShieldAlert, ShieldCheck, Cpu,
} from 'lucide-react';
import clsx from 'clsx';

// ── 타입 ─────────────────────────────────────────────────────

type LicenseType = 'temporary' | 'purchased';

interface OtpLicense {
  id:            number;
  license_type:  LicenseType;
  customer_name: string;
  product_name:  string;
  total_count:   number;
  used_count:    number;
  available:     number;
  license_key:   string | null;
  issue_date:    string | null;
  expire_date:   string | null;
  days_left:     number | null;
  notes:         string | null;
  created_at:    string;
  updated_at:    string;
}

interface TypeSummary {
  record_count:   number;
  total_licenses: number;
  used_licenses:  number;
  available:      number;
  expiring_30:    number;
  expired:        number;
}

interface Summary {
  all:       TypeSummary;
  temporary: TypeSummary;
  purchased: TypeSummary;
}

// ── 시스템 시계 ───────────────────────────────────────────────

function SystemClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-cyan-500/50 tabular-nums">{time}</span>;
}

// ── 상태 배지 ─────────────────────────────────────────────────

function StatusTag({ days, expireDate }: { days: number | null; expireDate: string | null }) {
  if (!expireDate || days === null) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] tracking-wider text-gray-500 bg-gray-800/60 border border-gray-700/40">
      NO EXPIRY
    </span>
  );
  if (days < 0) return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] tracking-wider text-red-300 bg-red-500/10 border border-red-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
      EXPIRED
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] tracking-wider text-red-300 bg-red-500/10 border border-red-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
      CRITICAL · {days}d
    </span>
  );
  if (days <= 30) return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      WARNING · {days}d
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
      ACTIVE · {days}d
    </span>
  );
}

// ── 게이지 바 ─────────────────────────────────────────────────

function GaugeBar({ used, total }: { used: number; total: number }) {
  if (total === 0) return <span className="font-mono text-sm text-gray-600">—</span>;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const segments = 20;
  const filled = Math.round((pct / 100) * segments);
  const color =
    pct >= 90 ? '#ef4444' :
    pct >= 70 ? '#f59e0b' :
    '#22d3ee';

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-px">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 5, height: 14,
              background: i < filled ? color : 'rgba(255,255,255,0.07)',
              opacity: i < filled ? (0.5 + (i / segments) * 0.5) : 1,
            }}
          />
        ))}
      </div>
      <span className="font-mono text-xs tabular-nums text-gray-400">
        {used.toLocaleString()}<span className="text-gray-600">/{total.toLocaleString()}</span>
      </span>
    </div>
  );
}

// ── HUD 코너 장식 ─────────────────────────────────────────────

function HudCorners({ color = 'rgba(79,142,247,0.4)', size = 8 }: { color?: string; size?: number }) {
  const s = size;
  const style = { position: 'absolute' as const, width: s, height: s };
  const line = { background: color };
  return (
    <>
      <span style={{ ...style, top: 0, left: 0 }}>
        <span style={{ ...line, position: 'absolute', top: 0, left: 0, width: s, height: 1 }} />
        <span style={{ ...line, position: 'absolute', top: 0, left: 0, width: 1, height: s }} />
      </span>
      <span style={{ ...style, top: 0, right: 0 }}>
        <span style={{ ...line, position: 'absolute', top: 0, right: 0, width: s, height: 1 }} />
        <span style={{ ...line, position: 'absolute', top: 0, right: 0, width: 1, height: s }} />
      </span>
      <span style={{ ...style, bottom: 0, left: 0 }}>
        <span style={{ ...line, position: 'absolute', bottom: 0, left: 0, width: s, height: 1 }} />
        <span style={{ ...line, position: 'absolute', bottom: 0, left: 0, width: 1, height: s }} />
      </span>
      <span style={{ ...style, bottom: 0, right: 0 }}>
        <span style={{ ...line, position: 'absolute', bottom: 0, right: 0, width: s, height: 1 }} />
        <span style={{ ...line, position: 'absolute', bottom: 0, right: 0, width: 1, height: s }} />
      </span>
    </>
  );
}

// ── 통계 패널 ─────────────────────────────────────────────────

const METRICS = [
  { key: 'record_count'   as const, label: 'Records',        icon: Database,     color: '#4f8ef7', dim: 'rgba(79,142,247,0.15)'  },
  { key: 'total_licenses' as const, label: 'Total Licenses', icon: Cpu,          color: '#22d3ee', dim: 'rgba(34,211,238,0.15)'  },
  { key: 'used_licenses'  as const, label: 'In Use',         icon: Activity,     color: '#a78bfa', dim: 'rgba(167,139,250,0.15)' },
  { key: 'available'      as const, label: 'Available',      icon: ShieldCheck,  color: '#10b981', dim: 'rgba(16,185,129,0.15)'  },
  { key: 'expiring_30'    as const, label: 'Expiring Soon',  icon: AlertTriangle,color: '#f59e0b', dim: 'rgba(245,158,11,0.15)'  },
  { key: 'expired'        as const, label: 'Expired',        icon: ShieldAlert,  color: '#ef4444', dim: 'rgba(239,68,68,0.15)'   },
];

function MetricsPanel({ s }: { s: TypeSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
      {METRICS.map(({ key, label, icon: Icon, color, dim }) => {
        const val = s[key];
        const isEmpty = val === 0;
        return (
          <div key={key} className="relative group" style={{ padding: 1 }}>
            <div
              className="relative overflow-hidden transition-all duration-300 group-hover:translate-y-[-1px]"
              style={{
                background: 'var(--bg)',
                border: `1px solid ${isEmpty ? 'rgba(255,255,255,0.05)' : `${color}22`}`,
                padding: '14px 16px 12px',
              }}
            >
              <HudCorners color={isEmpty ? 'rgba(255,255,255,0.08)' : color} size={6} />
              <div style={{
                position: 'absolute', right: 14, top: 10, bottom: 10, width: 1,
                background: `linear-gradient(to bottom, transparent, ${dim}, transparent)`,
              }} />
              <div className="flex items-center gap-1.5 mb-3">
                <Icon style={{ width: 12, height: 12, color: isEmpty ? '#4b5563' : color }} />
                <span
                  className="text-[11px] font-medium tracking-wide"
                  style={{ color: isEmpty ? '#4b5563' : `${color}bb` }}
                >
                  {label}
                </span>
              </div>
              <div
                className="font-mono text-[28px] font-bold tabular-nums leading-none"
                style={{ color: isEmpty ? '#1e293b' : color }}
              >
                {val.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 모달 ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  license_type:  'purchased' as LicenseType,
  customer_name: '',
  product_name:  '',
  total_count:   '',
  used_count:    '',
  license_key:   '',
  issue_date:    '',
  expire_date:   '',
  notes:         '',
};

interface ModalProps {
  initial:     OtpLicense | null;
  defaultType: LicenseType;
  onClose:     () => void;
  onSaved:     (row: OtpLicense) => void;
}

function LicenseModal({ initial, defaultType, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState(
    initial
      ? {
          license_type:  initial.license_type,
          customer_name: initial.customer_name,
          product_name:  initial.product_name,
          total_count:   String(initial.total_count),
          used_count:    String(initial.used_count),
          license_key:   initial.license_key ?? '',
          issue_date:    initial.issue_date   ?? '',
          expire_date:   initial.expire_date  ?? '',
          notes:         initial.notes        ?? '',
        }
      : { ...EMPTY_FORM, license_type: defaultType },
  );
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) return setErr('고객사명을 입력해주세요');
    if (!form.product_name.trim())  return setErr('OTP 제품명을 입력해주세요');
    const total = parseInt(form.total_count) || 0;
    const used  = parseInt(form.used_count)  || 0;
    if (total < 0 || used < 0) return setErr('라이센스 수는 0 이상이어야 합니다');

    setSaving(true); setErr('');
    try {
      const url    = initial ? `/api/otp-licenses/${initial.id}` : '/api/otp-licenses';
      const method = initial ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          license_type:  form.license_type,
          customer_name: form.customer_name.trim(),
          product_name:  form.product_name.trim(),
          total_count:   total, used_count: used,
          license_key:   form.license_key.trim() || null,
          issue_date:    form.issue_date          || null,
          expire_date:   form.expire_date         || null,
          notes:         form.notes.trim()        || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? '저장 실패');
      }
      onSaved(await res.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5 tracking-wide';
  const fieldCls =
    'w-full bg-transparent border-0 border-b border-gray-700/60 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'oklch(0.08 0.005 240 / 0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl relative"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)' }}
        onClick={e => e.stopPropagation()}
      >
        <HudCorners color="rgba(34,211,238,0.4)" size={12} />

        {/* 모달 헤더 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-cyan-400" style={{ boxShadow: '0 0 8px rgba(34,211,238,0.6)' }} />
            <div>
              <div className="text-[11px] text-cyan-500/60 tracking-wider uppercase mb-0.5">
                {initial ? `수정 · ID ${String(initial.id).padStart(4, '0')}` : '새 라이센스'}
              </div>
              <div className="text-base font-semibold text-gray-100 tracking-wide">
                {initial ? 'OTP 라이센스 수정' : 'OTP 라이센스 등록'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 tracking-wide transition-colors border border-gray-700/50 hover:border-red-500/30 px-2.5 py-1.5 rounded"
          >
            <X className="w-3.5 h-3.5" /> 닫기
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">

          {/* 분류 */}
          <div>
            <label className={labelCls}>라이센스 유형</label>
            <div className="flex gap-2">
              {(['purchased', 'temporary'] as LicenseType[]).map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, license_type: t }))}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium tracking-wide transition-all border rounded',
                    form.license_type === t
                      ? t === 'purchased'
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-gray-700/50 text-gray-500 hover:border-gray-600 hover:text-gray-400',
                  )}
                >
                  {t === 'purchased'
                    ? <><ShoppingCart className="w-3.5 h-3.5" />구매 라이센스</>
                    : <><Timer className="w-3.5 h-3.5" />임시 라이센스</>}
                </button>
              ))}
            </div>
          </div>

          {/* 고객 / 제품 */}
          <div>
            <label className={labelCls}>고객사 / 제품</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-gray-500 mb-1">고객사 *</div>
                <input value={form.customer_name} onChange={set('customer_name')} placeholder="ABC 은행" required className={fieldCls} />
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">제품명 *</div>
                <input value={form.product_name} onChange={set('product_name')} placeholder="SafeNet OTP" required className={fieldCls} />
              </div>
            </div>
          </div>

          {/* 수량 */}
          <div>
            <label className={labelCls}>라이센스 수량</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-gray-500 mb-1">총 수량</div>
                <input type="number" min="0" value={form.total_count} onChange={set('total_count')} placeholder="0" className={fieldCls} />
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">사용 중</div>
                <input type="number" min="0" value={form.used_count} onChange={set('used_count')} placeholder="0" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* 유효기간 */}
          <div>
            <label className={labelCls}>유효기간</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-gray-500 mb-1">발급일</div>
                <input type="date" value={form.issue_date} onChange={set('issue_date')} className={fieldCls} />
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">만료일</div>
                <input type="date" value={form.expire_date} onChange={set('expire_date')} className={fieldCls} />
              </div>
            </div>
          </div>

          {/* 라이센스 키 */}
          <div>
            <label className={labelCls}>라이센스 키</label>
            <input
              value={form.license_key} onChange={set('license_key')}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className={clsx(fieldCls, 'font-mono tracking-[0.15em] text-cyan-400/80')}
            />
          </div>

          {/* 비고 */}
          <div>
            <label className={labelCls}>비고</label>
            <textarea
              value={form.notes} onChange={set('notes')} rows={2} placeholder="메모를 입력하세요"
              className={clsx(fieldCls, 'resize-none')}
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 rounded"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {err}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 tracking-wide transition-colors border border-transparent hover:border-gray-700 rounded">
              취소
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-30">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 정렬 ─────────────────────────────────────────────────────

type SortKey = 'customer_name' | 'product_name' | 'total_count' | 'used_count' | 'available' | 'days_left';

function sortRows(rows: OtpLicense[], key: SortKey, asc: boolean): OtpLicense[] {
  return [...rows].sort((a, b) => {
    let va: string | number | null = a[key];
    let vb: string | number | null = b[key];
    if (va === null) va = asc ? Infinity : -Infinity;
    if (vb === null) vb = asc ? Infinity : -Infinity;
    if (typeof va === 'string' && typeof vb === 'string')
      return asc ? va.localeCompare(vb, 'ko') : vb.localeCompare(va, 'ko');
    return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

// ── 데이터 테이블 ─────────────────────────────────────────────

interface TableProps {
  rows:     OtpLicense[];
  loading:  boolean;
  search:   string;
  sortKey:  SortKey;
  sortAsc:  boolean;
  onSort:   (k: SortKey) => void;
  onEdit:   (row: OtpLicense) => void;
  onDelete: (id: number) => void;
}

function DataTable({ rows, loading, search, sortKey, sortAsc, onSort, onEdit, onDelete }: TableProps) {
  const sorted = sortRows(rows, sortKey, sortAsc);

  function ColHeader({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <th
        className="px-4 py-3 text-left cursor-pointer select-none group"
        onClick={() => onSort(k)}
        style={{ borderBottom: '1px solid var(--border-soft)' }}
      >
        <span className={clsx(
          'inline-flex items-center gap-1 text-xs font-medium tracking-wide transition-colors',
          active ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-400',
        )}>
          {label}
          {active
            ? sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3 opacity-30" />
          }
        </span>
      </th>
    );
  }

  if (loading) return (
    <div className="space-y-px">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded" style={{ background: `rgba(255,255,255,0.02)` }} />
      ))}
    </div>
  );

  if (sorted.length === 0) return (
    <div
      className="flex flex-col items-center justify-center py-24 rounded"
      style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
    >
      <div className="text-sm text-gray-500 mb-2">레코드 없음</div>
      <div className="text-xs text-gray-600">
        {search ? `"${search}" 검색 결과가 없습니다` : '등록된 라이센스가 없습니다'}
      </div>
    </div>
  );

  return (
    <div className="rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: 'rgba(0,0,0,0.4)' }}>
            <tr>
              <th className="px-4 py-3 text-left" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <span className="text-xs font-medium text-gray-500">#</span>
              </th>
              <ColHeader k="customer_name" label="고객사" />
              <ColHeader k="product_name"  label="제품명" />
              <ColHeader k="total_count"   label="총 수량" />
              <ColHeader k="used_count"    label="사용률" />
              <ColHeader k="available"     label="잔여" />
              <ColHeader k="days_left"     label="상태" />
              <th className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-soft)' }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const expired  = row.expire_date && row.days_left !== null && row.days_left < 0;
              const critical = !expired && row.days_left !== null && row.days_left <= 7;
              const warning  = !expired && !critical && row.days_left !== null && row.days_left <= 30;
              return (
                <tr
                  key={row.id}
                  className="group transition-all duration-100"
                  style={{
                    borderBottom: idx !== sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: expired   ? 'rgba(239,68,68,0.04)' :
                                critical  ? 'rgba(239,68,68,0.03)' :
                                warning   ? 'rgba(245,158,11,0.03)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background =
                      expired  ? 'rgba(239,68,68,0.07)'  :
                      critical ? 'rgba(239,68,68,0.06)'  :
                      warning  ? 'rgba(245,158,11,0.06)' :
                      'rgba(34,211,238,0.03)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background =
                      expired  ? 'rgba(239,68,68,0.04)' :
                      critical ? 'rgba(239,68,68,0.03)' :
                      warning  ? 'rgba(245,158,11,0.03)' : 'transparent';
                  }}
                >
                  {/* 번호 */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-gray-600 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </td>

                  {/* 고객사 */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-0.5 h-5 flex-shrink-0 rounded-full"
                        style={{ background: row.license_type === 'purchased' ? '#4f8ef7' : '#f59e0b', opacity: 0.7 }}
                      />
                      <div>
                        <div className="text-sm text-gray-100 font-medium leading-tight">{row.customer_name}</div>
                        {row.notes && (
                          <div className="text-xs text-gray-500 mt-0.5 max-w-[180px] truncate">{row.notes}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 제품명 */}
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-400">{row.product_name}</span>
                  </td>

                  {/* 총 수량 */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm text-gray-300 tabular-nums font-medium">
                      {row.total_count.toLocaleString()}
                    </span>
                  </td>

                  {/* 사용률 */}
                  <td className="px-4 py-4 min-w-[200px]">
                    <GaugeBar used={row.used_count} total={row.total_count} />
                  </td>

                  {/* 잔여 */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm tabular-nums font-bold" style={{
                      color: row.available === 0 ? '#ef4444' :
                             row.available <= 10  ? '#f59e0b' : '#10b981',
                    }}>
                      {row.available.toLocaleString()}
                    </span>
                  </td>

                  {/* 상태 */}
                  <td className="px-4 py-4">
                    <div className="space-y-1.5">
                      {row.expire_date && (
                        <div className="text-xs text-gray-500 tabular-nums">{row.expire_date}</div>
                      )}
                      <StatusTag days={row.days_left} expireDate={row.expire_date} />
                    </div>
                  </td>

                  {/* 액션 */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(row)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-cyan-400 transition-colors rounded border border-transparent hover:border-cyan-500/20 hover:bg-cyan-500/5"
                        title="수정"
                      >
                        <Pencil className="w-3.5 h-3.5" /> 수정
                      </button>
                      <button
                        onClick={() => onDelete(row.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors rounded border border-transparent hover:border-red-500/20 hover:bg-red-500/5"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 테이블 푸터 */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
      >
        <span className="text-xs text-gray-500">
          총 {sorted.length.toLocaleString()}건
          {search && <span className="text-gray-600 ml-2">· 검색 결과</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-500">실시간</span>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function OtpLicensesPage() {
  const [rows,     setRows]     = useState<OtpLicense[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [tab,      setTab]      = useState<LicenseType>('purchased');
  const [modal,    setModal]    = useState<'new' | OtpLicense | null>(null);
  const [sortKey,  setSortKey]  = useState<SortKey>('customer_name');
  const [sortAsc,  setSortAsc]  = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        fetch('/api/otp-licenses', { headers: getAuthHeaders() }).then(r => r.json()),
        fetch('/api/otp-licenses/summary', { headers: getAuthHeaders() }).then(r => r.json()),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setSummary(s?.all ? s : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    await fetch(`/api/otp-licenses/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    setRows(prev => prev.filter(r => r.id !== id));
    fetch('/api/otp-licenses/summary', { headers: getAuthHeaders() })
      .then(r => r.json()).then(setSummary).catch(() => {});
    setDeleteId(null);
  }

  function handleSaved(row: OtpLicense) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === row.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
      return [...prev, row];
    });
    setTab(row.license_type);
    setModal(null);
    fetch('/api/otp-licenses/summary', { headers: getAuthHeaders() })
      .then(r => r.json()).then(setSummary).catch(() => {});
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(true); }
  }

  const tabRows = rows.filter(r =>
    r.license_type === tab &&
    (!search ||
      r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      r.product_name.toLowerCase().includes(search.toLowerCase()))
  );

  const currentSummary = summary?.[tab] ?? null;

  const TABS = [
    { key: 'purchased' as LicenseType, label: '구매 라이센스', icon: ShoppingCart, color: '#4f8ef7', count: summary?.purchased.record_count ?? 0 },
    { key: 'temporary' as LicenseType, label: '임시 라이센스', icon: Timer,        color: '#f59e0b', count: summary?.temporary.record_count ?? 0 },
  ];

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">

        <div className="max-w-7xl mx-auto px-6 py-8 sm:px-8">

          {/* 페이지 헤더 */}
          <div className="flex items-start justify-between mb-8">
            <div>
              {/* 브레드크럼 */}
              <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-600">
                <span>SafeSquare</span>
                <span>/</span>
                <span>Security</span>
                <span>/</span>
                <span className="text-cyan-500/70">OTP 라이센스</span>
              </div>

              <h1 className="text-xl font-bold text-gray-100 tracking-tight mb-2">
                OTP 라이센스 관리
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-500/70">시스템 정상</span>
                </div>
                <span className="text-gray-700">·</span>
                <SystemClock />
              </div>
            </div>

            <button
              onClick={() => setModal('new')}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              새 라이센스 등록
            </button>
          </div>

          {/* 탭 셀렉터 */}
          <div className="flex items-center gap-0 mb-6" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            {TABS.map(({ key, label, icon: Icon, color, count }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="relative flex items-center gap-2 px-5 py-3 text-sm font-medium tracking-wide transition-all"
                  style={{ color: active ? color : '#6b7280' }}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  {label}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded tabular-nums"
                    style={{
                      background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
                      color:      active ? color          : '#6b7280',
                      border:     `1px solid ${active ? `${color}30` : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {count}
                  </span>
                  {active && (
                    <span
                      className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-t"
                      style={{ background: color }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 메트릭 패널 */}
          {currentSummary && <MetricsPanel s={currentSummary} />}

          {/* 검색 */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="고객사 또는 제품명으로 검색"
              className="w-full pl-11 pr-10 py-2.5 text-sm placeholder-gray-600 text-gray-300 bg-transparent focus:outline-none transition-all rounded"
              style={{
                border: `1px solid ${search ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.08)'}`,
                background: search ? 'rgba(34,211,238,0.02)' : 'rgba(0,0,0,0.3)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 데이터 테이블 */}
          <DataTable
            rows={tabRows}
            loading={loading}
            search={search}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={toggleSort}
            onEdit={row => setModal(row)}
            onDelete={id => setDeleteId(id)}
          />
        </div>
      </main>

      {/* 모달 */}
      {modal && (
        <LicenseModal
          initial={modal === 'new' ? null : modal}
          defaultType={tab}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* 삭제 확인 */}
      {deleteId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'oklch(0.08 0.005 240 / 0.75)' }}
        >
          <div
            className="relative w-full max-w-sm p-6 rounded"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--danger)' }}
          >
            <HudCorners color="rgba(239,68,68,0.4)" size={10} />
            <div className="text-xs text-red-500/70 tracking-wide mb-3">삭제 확인</div>
            <div className="text-base font-semibold text-gray-200 mb-1">
              레코드 #{String(deleteId).padStart(4, '0')} 삭제
            </div>
            <div className="text-sm text-gray-500 mb-6">이 작업은 되돌릴 수 없습니다.</div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 tracking-wide transition-colors border border-transparent hover:border-gray-700 rounded"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-medium text-red-300 tracking-wide transition-all rounded"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  boxShadow: '0 0 12px rgba(239,68,68,0.1)',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
