'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { dashboardApi, type DashboardData } from '@/lib/api';
import { useAppStore } from '@/store';
import {
  FolderOpen, CheckSquare, Server, AlertTriangle,
  ArrowRight, RefreshCw,
  Circle, AlertCircle, Info, ShieldAlert, Mail, Flame,
  TrendingUp, Clock, Wifi, WifiOff, Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const AUTO_REFRESH_SEC = 30;

/* ── 시스템 시계 ─────────────────────────────────────────────── */
function SystemClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{time}</span>;
}

/* ── 건강도 계산 ─────────────────────────────────────────────── */
function calcHealthScore(data: DashboardData) {
  let score = 100;
  score -= Math.min(data.open_incident_count * 15, 45);
  score -= Math.min((data.servers.offline + data.servers.degraded) * 10, 30);
  score -= Math.min(data.overdue_count * 5, 20);
  score -= Math.min(data.recent_error_count * 2, 10);
  return Math.max(0, score);
}

/* ── 건강도 링 ───────────────────────────────────────────────── */
function HealthRing({ score }: { score: number }) {
  const r = 18, cx = 22, cy = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const isGood = score >= 80;
  const isMid  = score >= 55;
  const color  = isGood ? 'oklch(0.76 0.16 152)' : isMid ? 'oklch(0.84 0.16 82)' : 'oklch(0.70 0.20 22)';
  const glow   = isGood ? 'oklch(0.76 0.16 152 / 0.25)' : isMid ? 'oklch(0.84 0.16 82 / 0.25)' : 'oklch(0.70 0.20 22 / 0.25)';
  const label  = isGood ? '정상' : isMid ? '주의' : '위험';
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-11 h-11 flex-shrink-0">
        <svg width={44} height={44} className="-rotate-90" viewBox="0 0 44 44">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3.5} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3.5}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{
              transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)',
              filter: `drop-shadow(0 0 4px ${glow})`,
            }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold" style={{ color }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>시스템 건강도</p>
      </div>
    </div>
  );
}

/* ── 카운트다운 링 ───────────────────────────────────────────── */
function CountdownRing({ countdown, total }: { countdown: number; total: number }) {
  const r = 7, cx = 9, cy = 9;
  const circ = 2 * Math.PI * r;
  const dash = (countdown / total) * circ;
  return (
    <svg width={18} height={18} className="-rotate-90" viewBox="0 0 18 18">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="oklch(0.60 0.010 230)" strokeWidth={2}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────────── */
export default function DashboardPage() {
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown,  setCountdown]  = useState(AUTO_REFRESH_SEC);
  const loadRef = useRef<() => void>(() => {});

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const d = await dashboardApi.get();
      setData(d);
      setLastUpdate(new Date());
      setCountdown(AUTO_REFRESH_SEC);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRef.current = () => load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { loadRef.current(); return AUTO_REFRESH_SEC; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 sm:px-8">

          {/* 헤더 */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>SAFESQUARE</span>
                <span style={{ color: 'var(--border)' }}>/</span>
                <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>대시보드</span>
              </div>
              <h1 className="text-xl font-black tracking-tight mb-2.5 gradient-text">운영 현황</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{
                      background: 'oklch(0.76 0.16 152)',
                      boxShadow: '0 0 6px oklch(0.76 0.16 152 / 0.60)',
                    }}
                  />
                  <span className="text-xs font-medium" style={{ color: 'oklch(0.76 0.16 152 / 0.80)' }}>실시간 모니터링</span>
                </div>
                <span style={{ color: 'var(--border)' }}>·</span>
                <SystemClock />
                {lastUpdate && (
                  <>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      갱신 {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: ko })}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {data && <HealthRing score={calcHealthScore(data)} />}
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-sm transition-all rounded-lg"
                style={{
                  color: 'var(--text-muted)',
                  background: 'oklch(0.18 0.010 242)',
                  border: '1px solid oklch(0.26 0.010 236)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.color = 'var(--text)';
                  el.style.borderColor = 'oklch(0.36 0.014 228)';
                  el.style.background = 'oklch(0.22 0.010 238)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.color = 'var(--text-muted)';
                  el.style.borderColor = 'oklch(0.26 0.010 236)';
                  el.style.background = 'oklch(0.18 0.010 242)';
                }}
              >
                {refreshing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CountdownRing countdown={countdown} total={AUTO_REFRESH_SEC} />
                )}
                <span>{refreshing ? '갱신 중' : `${countdown}s`}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : data ? (
            <DashboardContent data={data} />
          ) : (
            <p className="text-sm text-center py-20" style={{ color: 'var(--text-faint)' }}>
              데이터를 불러올 수 없습니다
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── 메인 콘텐츠 ─────────────────────────────────────────────── */
function DashboardContent({ data }: { data: DashboardData }) {
  const router = useRouter();
  const { setSelectedProject } = useAppStore();
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning' | 'info' | 'auth'>('all');
  const [activityTab, setActivityTab] = useState<'all' | 'mail' | 'incident'>('all');

  const totalActive  = data.tasks.pending + data.tasks.in_progress;
  const serverOnline = data.servers.online;
  const serverTotal  = data.servers.total;
  const serverAlert  = data.servers.offline + data.servers.degraded;

  const alerts: { label: string; color: string }[] = [];
  if (data.open_incident_count > 0)
    alerts.push({ label: `진행 중 장애 ${data.open_incident_count}건`, color: 'oklch(0.70 0.20 22)' });
  if (serverAlert > 0)
    alerts.push({ label: `서버 오프라인/장애 ${serverAlert}대`, color: 'oklch(0.70 0.20 22)' });
  if (data.overdue_count > 0)
    alerts.push({ label: `기한 초과 태스크 ${data.overdue_count}건`, color: 'oklch(0.84 0.16 82)' });
  if (data.recent_error_count > 0)
    alerts.push({ label: `최근 에러 로그 ${data.recent_error_count}건`, color: 'oklch(0.84 0.16 82)' });

  const taskTotal = data.tasks.pending + data.tasks.in_progress + data.tasks.completed + data.tasks.cancelled;

  type ActivityItem =
    | { kind: 'mail'; ts: Date; data: DashboardData['recent_mails'][0] }
    | { kind: 'incident'; ts: Date; data: DashboardData['recent_incidents'][0] };

  const activityItems: ActivityItem[] = [
    ...data.recent_mails.map(m => ({ kind: 'mail' as const, ts: new Date(m.received_at), data: m })),
    ...data.recent_incidents.map(i => ({ kind: 'incident' as const, ts: new Date(i.occurred_at), data: i })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  const filteredActivity = activityTab === 'all' ? activityItems
    : activityItems.filter(a => a.kind === activityTab);

  const filteredLogs = logFilter === 'all'
    ? data.recent_logs
    : data.recent_logs.filter(l => l.type === logFilter);

  const logCounts = {
    all:     data.recent_logs.length,
    error:   data.recent_logs.filter(l => l.type === 'error').length,
    warning: data.recent_logs.filter(l => l.type === 'warning').length,
    info:    data.recent_logs.filter(l => l.type === 'info').length,
    auth:    data.recent_logs.filter(l => l.type === 'auth').length,
  };

  return (
    <div className="space-y-5">

      {/* 경고 배너 */}
      {alerts.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: 'oklch(0.40 0.11 22 / 0.10)',
            border: '1px solid oklch(0.55 0.14 22 / 0.35)',
            boxShadow: '0 2px 16px oklch(0.70 0.20 22 / 0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(0.70 0.20 22 / 0.15)', color: 'oklch(0.70 0.20 22)' }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {alerts.map((a, i) => (
              <span key={i} className="text-sm font-semibold" style={{ color: a.color }}>{a.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* 상단 통계 카드 6개 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<FolderOpen className="w-4 h-4" />}
          label="전체 프로젝트"
          value={data.projects.total}
          sub={`활성 ${data.projects.active} · 완료 ${data.projects.completed}`}
          accent="oklch(0.68 0.18 235)"
          glowColor="oklch(0.68 0.18 235 / 0.20)"
        />
        <StatCard
          icon={<CheckSquare className="w-4 h-4" />}
          label="진행 중 태스크"
          value={totalActive}
          sub={`대기 ${data.tasks.pending} · 진행 ${data.tasks.in_progress}`}
          accent={data.overdue_count > 0 ? 'oklch(0.70 0.20 22)' : 'oklch(0.84 0.16 82)'}
          glowColor={data.overdue_count > 0 ? 'oklch(0.70 0.20 22 / 0.18)' : 'oklch(0.84 0.16 82 / 0.18)'}
          alert={data.overdue_count > 0 ? `기한 초과 ${data.overdue_count}건` : undefined}
        />
        <StatCard
          icon={serverAlert > 0 ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          label="서버 온라인"
          value={serverTotal === 0 ? '—' : `${serverOnline} / ${serverTotal}`}
          sub={serverAlert > 0 ? `오프라인/장애 ${serverAlert}대` : '전체 정상'}
          accent={serverAlert > 0 ? 'oklch(0.70 0.20 22)' : 'oklch(0.76 0.16 152)'}
          glowColor={serverAlert > 0 ? 'oklch(0.70 0.20 22 / 0.18)' : 'oklch(0.76 0.16 152 / 0.18)'}
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="최근 에러"
          value={data.recent_error_count}
          sub="최근 로그 기준"
          accent={data.recent_error_count > 0 ? 'oklch(0.70 0.20 22)' : 'oklch(0.76 0.16 152)'}
          glowColor={data.recent_error_count > 0 ? 'oklch(0.70 0.20 22 / 0.18)' : 'oklch(0.76 0.16 152 / 0.18)'}
        />
        <StatCard
          icon={<Mail className="w-4 h-4" />}
          label="미읽은 메일"
          value={data.unread_mail_count}
          sub={`미분류 ${data.unassigned_mail_count}건`}
          accent={data.unread_mail_count > 0 ? 'oklch(0.84 0.16 82)' : 'oklch(0.76 0.16 152)'}
          glowColor={data.unread_mail_count > 0 ? 'oklch(0.84 0.16 82 / 0.18)' : 'oklch(0.76 0.16 152 / 0.18)'}
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          label="진행 중 장애"
          value={data.open_incident_count}
          sub="open / investigating"
          accent={data.open_incident_count > 0 ? 'oklch(0.70 0.20 22)' : 'oklch(0.76 0.16 152)'}
          glowColor={data.open_incident_count > 0 ? 'oklch(0.70 0.20 22 / 0.18)' : 'oklch(0.76 0.16 152 / 0.18)'}
        />
      </div>

      {/* 중단: 프로젝트 현황 + 긴급 태스크 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 프로젝트 현황 (2/3) */}
        <Card className="lg:col-span-2">
          <CardHeader title="프로젝트 현황" badge={`${data.project_summaries.length}개`} />
          <div className="divide-y" style={{ borderColor: 'oklch(0.20 0.010 240 / 0.60)' }}>
            {data.project_summaries.length === 0 ? (
              <EmptyState icon={<FolderOpen className="w-8 h-8" style={{ color: 'var(--text-faint)' }} />} text="프로젝트 없음" />
            ) : (
              data.project_summaries.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProject(p.id); router.push(`/projects/${p.id}`); }}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-left group transition-all duration-150"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <StatusDot status={p.status} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{p.name}</p>
                      {p.recent_errors > 0 && (
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{
                            color: 'oklch(0.70 0.20 22)',
                            background: 'oklch(0.40 0.11 22 / 0.12)',
                            border: '1px solid oklch(0.55 0.14 22 / 0.25)',
                          }}
                        >
                          에러 {p.recent_errors}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {p.client_name && (
                        <span className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{p.client_name}</span>
                      )}
                      {p.task_counts.total > 0 && (
                        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                          <div
                            className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{ background: 'oklch(0.22 0.010 238)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${p.completion_rate}%`,
                                background: 'linear-gradient(90deg, oklch(0.76 0.16 196) 0%, oklch(0.68 0.18 218) 100%)',
                              }}
                            />
                          </div>
                          <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
                            {p.completion_rate}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p.task_counts.in_progress > 0 && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={{
                          color: 'var(--accent)',
                          background: 'var(--accent-bg)',
                          border: '1px solid var(--accent-border)',
                        }}
                      >
                        진행 {p.task_counts.in_progress}
                      </span>
                    )}
                    {p.task_counts.pending > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          color: 'var(--text-muted)',
                          background: 'oklch(0.20 0.010 240)',
                          border: '1px solid oklch(0.26 0.010 236)',
                        }}
                      >
                        대기 {p.task_counts.pending}
                      </span>
                    )}
                    {p.server_counts.total > 0 && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: p.server_counts.offline > 0 ? 'oklch(0.70 0.20 22)' : 'oklch(0.76 0.16 152)',
                            boxShadow: p.server_counts.offline > 0
                              ? '0 0 4px oklch(0.70 0.20 22 / 0.50)'
                              : '0 0 4px oklch(0.76 0.16 152 / 0.50)',
                          }}
                        />
                        {p.server_counts.online}/{p.server_counts.total}
                      </div>
                    )}
                  </div>

                  <ArrowRight
                    className="w-4 h-4 flex-shrink-0 transition-all duration-150 group-hover:translate-x-0.5"
                    style={{ color: 'var(--text-faint)' }}
                  />
                </button>
              ))
            )}
          </div>
        </Card>

        {/* 긴급 태스크 (1/3) */}
        <Card>
          <CardHeader
            title="긴급 태스크"
            badge={data.urgent_tasks.length > 0 ? `${data.urgent_tasks.length}건` : undefined}
            badgeColor="orange"
          />
          <div className="overflow-y-auto max-h-72 divide-y" style={{ borderColor: 'oklch(0.20 0.010 240 / 0.60)' }}>
            {data.urgent_tasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="w-8 h-8" style={{ color: 'oklch(0.76 0.16 152 / 0.30)' }} />}
                text="긴급 태스크 없음"
              />
            ) : (
              data.urgent_tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedProject(t.project_id); router.push(`/projects/${t.project_id}`); }}
                  className="w-full flex flex-col gap-1.5 px-4 py-3.5 text-left transition-all duration-150"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="flex items-start gap-2">
                    <PriorityBadge priority={t.priority} />
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>{t.title}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                    <span className="truncate">{t.project_name}</span>
                    {t.due_date && (
                      <>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span
                          className="flex items-center gap-1"
                          style={{ color: new Date(t.due_date) < new Date() ? 'oklch(0.70 0.20 22)' : 'var(--text-faint)' }}
                        >
                          <Clock className="w-3 h-3" />
                          {t.due_date}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 최근 활동 */}
      <Card>
        <div
          className="flex items-center gap-0 px-5 py-3.5"
          style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
        >
          <Activity className="w-4 h-4 mr-2.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-sm font-semibold mr-4" style={{ color: 'var(--text)' }}>최근 활동</h2>
          <div className="flex gap-0.5">
            {(
              [
                { key: 'all',      label: '전체',  count: activityItems.length },
                { key: 'mail',     label: '메일',  count: data.recent_mails.length },
                { key: 'incident', label: '장애',  count: data.recent_incidents.length },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActivityTab(key)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
                style={{
                  color: activityTab === key ? 'var(--text)' : 'var(--text-faint)',
                  background: activityTab === key ? 'oklch(0.22 0.010 238)' : 'transparent',
                }}
              >
                {label}
                <span
                  className="text-[10px] tabular-nums px-1 rounded"
                  style={{ color: activityTab === key ? 'var(--text-muted)' : 'var(--text-faint)' }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y" style={{ borderColor: 'oklch(0.18 0.010 242 / 0.70)' }}>
          {filteredActivity.length === 0 ? (
            <EmptyState icon={<Activity className="w-7 h-7" style={{ color: 'var(--text-faint)' }} />} text="최근 활동 없음" />
          ) : (
            filteredActivity.map((item, idx) => {
              if (item.kind === 'mail') {
                const m = item.data;
                return (
                  <div key={`mail-${m.id}-${idx}`} className="flex items-start gap-3 px-5 py-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'oklch(0.84 0.16 82 / 0.10)', color: 'oklch(0.84 0.16 82)' }}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {!m.is_read && (
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background: 'oklch(0.84 0.16 82)',
                              boxShadow: '0 0 4px oklch(0.84 0.16 82 / 0.50)',
                            }}
                          />
                        )}
                        <p
                          className={clsx('text-sm truncate leading-snug', m.is_read ? '' : 'font-semibold')}
                          style={{ color: m.is_read ? 'var(--text-muted)' : 'var(--text)' }}
                        >
                          {m.subject ?? '(제목 없음)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                        <span className="truncate">{m.from_name ?? m.from_email ?? '—'}</span>
                        {m.project_name && (
                          <><span style={{ color: 'var(--border)' }}>·</span><span className="truncate" style={{ color: 'var(--text-muted)' }}>{m.project_name}</span></>
                        )}
                        <span className="ml-auto flex-shrink-0">
                          {formatDistanceToNow(item.ts, { addSuffix: true, locale: ko })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const i = item.data;
                return (
                  <div key={`incident-${i.id}-${idx}`} className="flex items-start gap-3 px-5 py-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'oklch(0.40 0.11 22 / 0.12)', color: 'oklch(0.70 0.20 22)' }}
                    >
                      <Flame className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate leading-snug mb-0.5" style={{ color: 'var(--text-dim)' }}>{i.title}</p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                        <span className="truncate">{i.project_name}</span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <SeverityBadge severity={i.severity} />
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <IncidentStatusBadge status={i.status} />
                        <span className="ml-auto flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
                          {formatDistanceToNow(item.ts, { addSuffix: true, locale: ko })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </Card>

      {/* 하단: 태스크 분포 + 서버 상태 + 최근 로그 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 태스크·서버 분포 (1/3) */}
        <div className="space-y-4">
          <Card>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>태스크 분포</h2>
                <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--text-faint)' }}>{taskTotal}건</span>
              </div>
              <div className="space-y-3">
                <TaskBar label="대기"  value={data.tasks.pending}     total={taskTotal} color="oklch(0.55 0.012 232)" />
                <TaskBar label="진행"  value={data.tasks.in_progress} total={taskTotal} color="oklch(0.68 0.18 218)" />
                <TaskBar label="완료"  value={data.tasks.completed}   total={taskTotal} color="oklch(0.76 0.16 152)" />
                <TaskBar label="취소"  value={data.tasks.cancelled}   total={taskTotal} color="oklch(0.30 0.010 235)" />
              </div>
            </div>
          </Card>

          {serverTotal > 0 && (
            <Card>
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>서버 상태</h2>
                  <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--text-faint)' }}>{serverTotal}대</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: '온라인',    val: data.servers.online,   color: 'oklch(0.76 0.16 152)', bg: 'oklch(0.42 0.09 152 / 0.12)', border: 'oklch(0.58 0.12 152 / 0.25)', glow: 'oklch(0.76 0.16 152 / 0.15)' },
                    { label: '오프라인',  val: data.servers.offline,  color: 'oklch(0.70 0.20 22)',  bg: 'oklch(0.40 0.11 22 / 0.12)',  border: 'oklch(0.55 0.14 22 / 0.25)',  glow: 'oklch(0.70 0.20 22 / 0.15)' },
                    { label: '장애',      val: data.servers.degraded, color: 'oklch(0.84 0.16 82)',  bg: 'oklch(0.46 0.10 82 / 0.12)',  border: 'oklch(0.62 0.12 82 / 0.25)',  glow: 'oklch(0.84 0.16 82 / 0.15)' },
                    { label: '알 수 없음', val: data.servers.unknown, color: 'oklch(0.55 0.012 232)',bg: 'oklch(0.22 0.010 238)',        border: 'oklch(0.28 0.010 234)',        glow: 'transparent' },
                  ].map(({ label, val, color, bg, border, glow }) => (
                    <div
                      key={label}
                      className="flex flex-col gap-1 px-3 py-2.5 rounded-xl"
                      style={{
                        background: bg,
                        border: `1px solid ${border}`,
                        boxShadow: val > 0 ? `0 2px 12px ${glow}, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      }}
                    >
                      <span className="text-xl font-black tabular-nums" style={{ color }}>{val}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* 최근 로그 (2/3) */}
        <Card className="lg:col-span-2">
          <div
            className="flex items-center gap-0 px-5 py-3.5"
            style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
          >
            <h2 className="text-sm font-semibold mr-4" style={{ color: 'var(--text)' }}>최근 로그</h2>
            <div className="flex gap-0.5 flex-wrap">
              {(
                [
                  { key: 'all',     label: '전체',   count: logCounts.all     },
                  { key: 'error',   label: '에러',   count: logCounts.error   },
                  { key: 'warning', label: '경고',   count: logCounts.warning },
                  { key: 'info',    label: '정보',   count: logCounts.info    },
                  { key: 'auth',    label: '인증',   count: logCounts.auth    },
                ] as const
              ).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setLogFilter(key)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
                  style={{
                    color: logFilter === key ? 'var(--text)' : 'var(--text-faint)',
                    background: logFilter === key ? 'oklch(0.22 0.010 238)' : 'transparent',
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[480px]">
            {filteredLogs.length === 0 ? (
              <EmptyState icon={<Circle className="w-7 h-7" style={{ color: 'var(--text-faint)' }} />} text="로그 없음" />
            ) : (
              <div className="divide-y" style={{ borderColor: 'oklch(0.18 0.010 242 / 0.70)' }}>
                {filteredLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                    <LogTypeIcon type={log.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: 'var(--text-dim)' }}>{log.message}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-faint)' }}>
                        <span className="font-medium truncate" style={{ color: 'var(--text-muted)' }}>{log.project_name}</span>
                        {log.source && (
                          <><span style={{ color: 'var(--border)' }}>·</span><span className="truncate font-mono">{log.source}</span></>
                        )}
                        <span className="ml-auto flex-shrink-0">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ko })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── 공통 카드 컴포넌트 ──────────────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx('overflow-hidden', className)}
      style={{
        background: 'oklch(0.18 0.010 242)',
        border: '1px solid oklch(0.24 0.010 236)',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title, badge, badgeColor = 'default',
}: {
  title: string;
  badge?: string;
  badgeColor?: 'default' | 'red' | 'orange' | 'yellow' | 'green';
}) {
  const badgeStyles: Record<string, React.CSSProperties> = {
    default: { color: 'var(--text-muted)',       background: 'oklch(0.22 0.010 238)',        border: '1px solid oklch(0.28 0.010 234)' },
    red:     { color: 'oklch(0.70 0.20 22)',      background: 'oklch(0.40 0.11 22 / 0.12)',  border: '1px solid oklch(0.55 0.14 22 / 0.25)' },
    orange:  { color: 'oklch(0.80 0.16 52)',      background: 'oklch(0.44 0.10 52 / 0.12)',  border: '1px solid oklch(0.60 0.12 52 / 0.25)' },
    yellow:  { color: 'oklch(0.84 0.16 82)',      background: 'oklch(0.46 0.10 82 / 0.12)',  border: '1px solid oklch(0.62 0.12 82 / 0.25)' },
    green:   { color: 'oklch(0.76 0.16 152)',     background: 'oklch(0.42 0.09 152 / 0.12)', border: '1px solid oklch(0.58 0.12 152 / 0.25)' },
  };
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderBottom: '1px solid oklch(0.20 0.010 240)' }}
    >
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
      {badge && (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-md"
          style={badgeStyles[badgeColor]}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      {icon}
      <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{text}</p>
    </div>
  );
}

/* ── 통계 카드 ───────────────────────────────────────────────── */
function StatCard({
  icon, label, value, sub, accent, glowColor, alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  accent: string;
  glowColor: string;
  alert?: string;
}) {
  return (
    <div
      className="relative overflow-hidden p-4 rounded-xl"
      style={{
        background: `linear-gradient(135deg, oklch(0.19 0.010 241) 0%, oklch(0.17 0.010 243) 100%)`,
        border: `1px solid oklch(0.26 0.010 235)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.20)`,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
          opacity: 0.5,
        }}
      />
      {/* Ambient glow */}
      <div
        className="absolute -top-6 left-0 right-0 h-12 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      <div
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg mb-3"
        style={{
          background: `linear-gradient(135deg, ${accent.replace(')', ' / 0.18)').replace('oklch(', 'oklch(')} 0%, ${accent.replace(')', ' / 0.08)').replace('oklch(', 'oklch(')} 100%)`,
          border: `1px solid ${accent.replace(')', ' / 0.25)').replace('oklch(', 'oklch(')}`,
          color: accent,
          boxShadow: `0 2px 8px ${glowColor}`,
        }}
      >
        {icon}
      </div>

      <p
        className="relative text-2xl font-black mb-0.5 leading-tight tabular-nums"
        style={{ color: 'var(--text)' }}
      >
        {value}
      </p>
      <p className="relative text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="relative text-xs" style={{ color: 'var(--text-faint)' }}>{sub}</p>
      {alert && (
        <p className="relative text-xs font-semibold mt-1" style={{ color: 'oklch(0.70 0.20 22)' }}>{alert}</p>
      )}
    </div>
  );
}

/* ── 보조 컴포넌트들 ─────────────────────────────────────────── */
function StatusDot({ status }: { status: string }) {
  const map: Record<string, { bg: string; glow: string }> = {
    active:    { bg: 'oklch(0.76 0.16 152)', glow: 'oklch(0.76 0.16 152 / 0.40)' },
    completed: { bg: 'oklch(0.68 0.18 218)', glow: 'oklch(0.68 0.18 218 / 0.40)' },
    archived:  { bg: 'oklch(0.45 0.010 235)', glow: 'transparent' },
  };
  const style = map[status] ?? { bg: 'oklch(0.35 0.010 235)', glow: 'transparent' };
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
      style={{ background: style.bg, boxShadow: `0 0 6px ${style.glow}` }}
    />
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, React.CSSProperties> = {
    urgent: { color: 'oklch(0.78 0.18 22)',  background: 'oklch(0.40 0.11 22 / 0.12)',  border: '1px solid oklch(0.55 0.14 22 / 0.28)' },
    high:   { color: 'oklch(0.80 0.16 52)',  background: 'oklch(0.44 0.10 52 / 0.12)',  border: '1px solid oklch(0.60 0.12 52 / 0.28)' },
  };
  const labels: Record<string, string> = { urgent: '긴급', high: '높음' };
  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
      style={styles[priority] ?? { color: 'var(--text-faint)', background: 'oklch(0.22 0.010 238)', border: '1px solid oklch(0.28 0.010 234)' }}
    >
      {labels[priority] ?? priority}
    </span>
  );
}

function TaskBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(0.20 0.010 240)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: pct > 0 ? `0 0 6px ${color}80` : 'none' }}
        />
      </div>
      <div className="flex items-center gap-1.5 w-16 justify-end flex-shrink-0">
        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-dim)' }}>{value}</span>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-faint)' }}>({pct}%)</span>
      </div>
    </div>
  );
}

function LogTypeIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    error:   { icon: <AlertCircle className="w-3.5 h-3.5" />,  color: 'oklch(0.70 0.20 22)'  },
    warning: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'oklch(0.84 0.16 82)'  },
    auth:    { icon: <ShieldAlert className="w-3.5 h-3.5" />,  color: 'oklch(0.74 0.16 300)'  },
    info:    { icon: <Info className="w-3.5 h-3.5" />,         color: 'oklch(0.76 0.16 196)'  },
    system:  { icon: <Circle className="w-3.5 h-3.5" />,       color: 'oklch(0.55 0.012 232)' },
  };
  const { icon, color } = map[type] ?? map.system;
  return (
    <span className="flex-shrink-0 mt-0.5" style={{ color }}>
      {icon}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'oklch(0.70 0.20 22)',
    high:     'oklch(0.80 0.16 52)',
    medium:   'oklch(0.84 0.16 82)',
    low:      'oklch(0.55 0.012 232)',
  };
  const labels: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  return (
    <span className="font-semibold" style={{ color: map[severity] ?? 'var(--text-faint)' }}>
      {labels[severity] ?? severity}
    </span>
  );
}

function IncidentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open:          'oklch(0.70 0.20 22)',
    investigating: 'oklch(0.80 0.16 52)',
    resolved:      'oklch(0.76 0.16 152)',
    closed:        'oklch(0.55 0.012 232)',
  };
  const labels: Record<string, string> = { open: '미처리', investigating: '조사중', resolved: '해결됨', closed: '종료' };
  return (
    <span className="font-semibold" style={{ color: styles[status] ?? 'var(--text-faint)' }}>
      {labels[status] ?? status}
    </span>
  );
}

/* ── 로딩 스켈레톤 ───────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl shimmer"
            style={{ border: '1px solid oklch(0.22 0.010 238)' }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 rounded-xl shimmer" style={{ border: '1px solid oklch(0.22 0.010 238)' }} />
        <div className="h-64 rounded-xl shimmer" style={{ border: '1px solid oklch(0.22 0.010 238)' }} />
      </div>
      <div className="h-48 rounded-xl shimmer" style={{ border: '1px solid oklch(0.22 0.010 238)' }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-48 rounded-xl shimmer" style={{ border: '1px solid oklch(0.22 0.010 238)' }} />
        <div className="lg:col-span-2 h-48 rounded-xl shimmer" style={{ border: '1px solid oklch(0.22 0.010 238)' }} />
      </div>
    </div>
  );
}
