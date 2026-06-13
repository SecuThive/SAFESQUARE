'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { getAuthMeta, getAuthHeaders } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { confirm } from '@/lib/confirm';
import {
  ChevronLeft, ChevronRight, Loader2, Sparkles,
  RefreshCw, Save, Trash2, Plus, Search, Download,
} from 'lucide-react';

/* ── 타입 ── */
type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'terrible';

interface DiaryEntry {
  id: number;
  created_by: string;
  entry_date: string;
  mood: Mood;
  content: string;
  ai_advice: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── 상수 ── */
const MOOD_META: Record<Mood, { emoji: string; label: string; color: string }> = {
  great:    { emoji: '😄', label: '아주 좋음', color: 'var(--success)' },
  good:     { emoji: '🙂', label: '좋음',      color: 'var(--accent)'  },
  neutral:  { emoji: '😐', label: '보통',      color: 'var(--text-muted)' },
  bad:      { emoji: '😔', label: '나쁨',      color: 'var(--warn)'    },
  terrible: { emoji: '😤', label: '매우 나쁨', color: 'var(--danger)'  },
};
const MOODS: Mood[] = ['great', 'good', 'neutral', 'bad', 'terrible'];
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const BASE = '/api/diary';

function todayISO() { return new Date().toISOString().slice(0, 10); }

/* ── API ── */
async function apiList(year: number, month: number): Promise<DiaryEntry[]> {
  const res = await fetch(`${BASE}?year=${year}&month=${month}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('목록 로드 실패');
  return res.json();
}
async function apiCreate(entry_date: string, mood: Mood, content: string): Promise<DiaryEntry> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ entry_date, mood, content }),
  });
  if (res.status === 409) throw new Error('해당 날짜의 일기가 이미 존재합니다');
  if (!res.ok) throw new Error('저장 실패');
  return res.json();
}
async function apiUpdate(id: number, mood: Mood, content: string): Promise<DiaryEntry> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ mood, content }),
  });
  if (!res.ok) throw new Error('수정 실패');
  return res.json();
}
async function apiDelete(id: number) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!res.ok) throw new Error('삭제 실패');
}

/* ── 캘린더 빌더 ── */
function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon = 0
  const cells: ({ day: number; dateStr: string } | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }
  return cells;
}

/* ══ 페이지 ══ */
export default function DiaryPage() {
  const router = useRouter();
  useEffect(() => { if (!getAuthMeta()) router.replace('/login'); }, [router]);

  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [entries,   setEntries]   = useState<DiaryEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  /* 편집 상태 */
  const [editMood,    setEditMood]    = useState<Mood>('neutral');
  const [editContent, setEditContent] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [dirty,       setDirty]       = useState(false);

  /* AI */
  const [analyzing, setAnalyzing] = useState(false);
  const [aiStream,  setAiStream]  = useState('');
  const aiBoxRef = useRef<HTMLDivElement>(null);

  /* 데이터 로드 */
  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await apiList(viewYear, viewMonth)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, [viewYear, viewMonth]);
  useEffect(() => { load(); }, [load]);

  const entriesMap = Object.fromEntries(entries.map(e => [e.entry_date.slice(0, 10), e]));
  const selectedEntry = entriesMap[selectedDate] ?? null;

  /* selectedDate 변경 시 편집 상태 동기화 */
  useEffect(() => {
    const e = entriesMap[selectedDate];
    setEditMood(e?.mood ?? 'neutral');
    setEditContent(e?.content ?? '');
    setAiStream(e?.ai_advice ?? '');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, entries.length]);

  /* 월 이동 */
  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  /* 저장 */
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = selectedEntry
        ? await apiUpdate(selectedEntry.id, editMood, editContent)
        : await apiCreate(selectedDate, editMood, editContent);
      setEntries(prev => {
        const exists = prev.find(e => e.id === updated.id);
        return exists ? prev.map(e => e.id === updated.id ? updated : e) : [updated, ...prev];
      });
      setDirty(false);
    } catch (err: any) { alert(err.message ?? '저장 실패'); }
    finally { setSaving(false); }
  };

  /* 삭제 */
  const handleDelete = async () => {
    if (!selectedEntry) return;
    if (!await confirm('이 일기를 삭제하시겠습니까?', { danger: true, confirmLabel: '삭제' })) return;
    await apiDelete(selectedEntry.id);
    setEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
    setDirty(false);
  };

  /* AI 분석 */
  const handleAnalyze = async () => {
    if (!selectedEntry || analyzing) return;
    setAnalyzing(true);
    setAiStream('');
    try {
      const res = await fetch(`${BASE}/${selectedEntry.id}/analyze`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok || !res.body) { alert('AI 분석 실패'); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.type === 'token') {
              setAiStream(s => s + chunk.content);
              if (aiBoxRef.current) aiBoxRef.current.scrollTop = aiBoxRef.current.scrollHeight;
            }
            if (chunk.type === 'done') {
              const upd = await fetch(`${BASE}/${selectedEntry.id}`, { headers: getAuthHeaders() });
              if (upd.ok) {
                const data: DiaryEntry = await upd.json();
                setEntries(prev => prev.map(e => e.id === data.id ? data : e));
              }
            }
          } catch { /* ignore */ }
        }
      }
    } finally { setAnalyzing(false); }
  };

  /* 월간 통계 */
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const moodDist = MOODS.map(m => ({ mood: m, count: entries.filter(e => e.mood === m).length }));

  const calendar = buildCalendar(viewYear, viewMonth);

  /* ── 렌더 ── */
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
      <Sidebar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>

        {/* ── 좌: 캘린더 사이드바 ── */}
        <aside style={{
          width: 240, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border-soft)',
          background: 'var(--bg-sidebar)',
          overflowY: 'auto',
        }}>
          {/* 월 네비 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {viewYear}년 {viewMonth}월
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={prevMonth} className="btn btn-ghost btn-sm btn-icon">
                <ChevronLeft style={{ width: 13, height: 13 }} />
              </button>
              <button onClick={nextMonth} className="btn btn-ghost btn-sm btn-icon">
                <ChevronRight style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>

          {/* 캘린더 그리드 */}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', padding: '2px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {calendar.map((cell, i) => {
                if (!cell) return <div key={i} />;
                const { day, dateStr } = cell;
                const isToday    = dateStr === todayISO();
                const isSelected = dateStr === selectedDate;
                const entry      = entriesMap[dateStr];
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dateStr)}
                    style={{
                      aspectRatio: '1',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 2,
                      border: isSelected
                        ? '1px solid var(--accent)'
                        : isToday
                        ? '1px solid var(--border)'
                        : '1px solid transparent',
                      background: isSelected
                        ? 'var(--accent-bg)'
                        : entry ? 'var(--bg-raised)' : 'transparent',
                      borderRadius: 4, cursor: 'pointer',
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      fontWeight: isSelected || isToday ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums',
                      color: isSelected
                        ? 'var(--accent)'
                        : entry ? 'var(--text)' : 'var(--text-faint)',
                    }}>{day}</span>
                    {entry && (
                      <span style={{
                        width: 4, height: 4, borderRadius: 2, flexShrink: 0,
                        background: MOOD_META[entry.mood].color,
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 기분 차트 */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-soft)', marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
              이번 달 기분
            </div>
            {entries.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
                {entries.slice(-20).map((e, i) => {
                  const scoreMap: Record<Mood, number> = { great: 1, good: 0.8, neutral: 0.55, bad: 0.35, terrible: 0.15 };
                  return (
                    <div key={i} style={{
                      flex: 1, minWidth: 4,
                      height: `${scoreMap[e.mood] * 100}%`,
                      background: MOOD_META[e.mood].color,
                      borderRadius: 2, opacity: 0.85, minHeight: 4,
                    }} />
                  );
                })}
              </div>
            ) : (
              <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>기록 없음</span>
              </div>
            )}
          </div>

          {/* 범례 */}
          <div style={{ padding: '0 14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
              기분 범례
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MOODS.map(m => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: MOOD_META[m].color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-dim)' }}>{MOOD_META[m].emoji} {MOOD_META[m].label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── 중앙: 에디터 ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* TopBar */}
          <div style={{
            height: 42, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 16px',
            borderBottom: '1px solid var(--border-soft)',
            background: 'var(--bg)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>개인</span>
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>일일 다이어리</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm">
              <Search style={{ width: 12, height: 12 }} />검색
            </button>
            <button className="btn btn-ghost btn-sm">
              <Download style={{ width: 12, height: 12 }} />내보내기
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setSelectedDate(todayISO()); }}
            >
              <Plus style={{ width: 12, height: 12 }} />오늘 기록
            </button>
          </div>

          {/* 에디터 툴바 */}
          <div style={{
            height: 40, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 20px',
            borderBottom: '1px solid var(--border-soft)',
            background: 'var(--bg)',
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {format(parseISO(selectedDate + 'T00:00:00'), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            </span>
            {selectedEntry && (
              <button
                onClick={handleDelete}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />삭제
              </button>
            )}
            {selectedEntry && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !editContent.trim()}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--accent)' }}
              >
                {analyzing
                  ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />분석 중</>
                  : <><Sparkles style={{ width: 12, height: 12 }} />AI 조언</>}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || (!dirty && !!selectedEntry)}
              className="btn btn-primary btn-sm"
            >
              {saving
                ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />저장 중</>
                : <><Save style={{ width: 12, height: 12 }} />{selectedEntry ? '수정' : '저장'}</>}
            </button>
          </div>

          {/* 에디터 본문 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 660, margin: '0 auto', padding: '24px 28px' }}>

              {/* 날짜 · 기분 메타 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedDate}
                </span>
                {selectedEntry && (
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    · {MOOD_META[selectedEntry.mood].emoji} {MOOD_META[selectedEntry.mood].label}
                  </span>
                )}
                {loading && <Loader2 style={{ width: 12, height: 12, color: 'var(--text-faint)', marginLeft: 4 }} className="animate-spin" />}
              </div>

              {/* 기분 선택 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0',
                borderTop: '1px solid var(--border-soft)',
                borderBottom: '1px solid var(--border-soft)',
                marginBottom: 24,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>기분</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {MOODS.map(m => {
                    const isActive = editMood === m;
                    return (
                      <button
                        key={m}
                        onClick={() => { setEditMood(m); setDirty(true); }}
                        title={MOOD_META[m].label}
                        style={{
                          width: 34, height: 34,
                          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isActive ? 'var(--accent-bg)' : 'var(--bg-raised)',
                          borderRadius: 6, fontSize: 18, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'border-color 0.12s, background 0.12s',
                        }}
                      >{MOOD_META[m].emoji}</button>
                    );
                  })}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: MOOD_META[editMood].color }}>
                  {MOOD_META[editMood].label}
                </span>
              </div>

              {/* 내용 textarea */}
              <textarea
                value={editContent}
                onChange={e => { setEditContent(e.target.value); setDirty(true); }}
                placeholder={`오늘 있었던 일, 느꼈던 감정을 자유롭게 기록하세요.\n\n예시:\n• 중요한 배포 작업이 성공적으로 마무리됐다\n• 팀 미팅에서 좋은 아이디어가 나왔다\n• 감사한 것 세 가지를 적어보세요`}
                rows={14}
                style={{
                  width: '100%', background: 'transparent',
                  border: 'none', outline: 'none',
                  resize: 'none', fontSize: 14,
                  lineHeight: 1.75, color: 'var(--text)',
                  fontFamily: 'var(--font-sans)',
                }}
              />

              {/* AI 조언 */}
              {selectedEntry && (
                <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>AI 조언</span>
                      {selectedEntry.ai_analyzed_at && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
                          {format(parseISO(selectedEntry.ai_analyzed_at), 'M/d HH:mm')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing || !editContent.trim()}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--accent)' }}
                    >
                      {analyzing
                        ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />분석 중...</>
                        : <><RefreshCw style={{ width: 12, height: 12 }} />{aiStream ? '재분석' : 'AI 추천 받기'}</>}
                    </button>
                  </div>
                  {aiStream ? (
                    <div
                      ref={aiBoxRef}
                      style={{
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: 8, padding: '12px 14px',
                        fontSize: 13, color: 'var(--text-dim)',
                        lineHeight: 1.65, whiteSpace: 'pre-wrap',
                        maxHeight: 280, overflowY: 'auto',
                      }}
                    >
                      {aiStream}
                      {analyzing && (
                        <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--accent)', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-start infinite' }} />
                      )}
                    </div>
                  ) : (
                    <div style={{
                      background: 'var(--bg-raised)',
                      border: '1px dashed var(--border)',
                      borderRadius: 8, padding: '28px',
                      textAlign: 'center',
                    }}>
                      <Sparkles style={{ width: 22, height: 22, color: 'var(--text-faint)', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        일기를 저장한 후 "AI 추천 받기"를 눌러보세요
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 신규 날짜 빈 상태 안내 */}
              {!selectedEntry && !editContent && (
                <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
                  위에 오늘의 기록을 작성하고 저장하세요
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 우: 월간 통계 ── */}
        <aside style={{
          width: 240, flexShrink: 0,
          borderLeft: '1px solid var(--border-soft)',
          overflowY: 'auto',
          background: 'var(--bg)',
        }}>
          {/* 월간 요약 */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
              {viewYear}년 {viewMonth}월 통계
            </div>
            {[
              { k: '작성 일수',  v: `${entries.length}일` },
              { k: '작성률',     v: `${entries.length ? Math.round(entries.length / daysInMonth * 100) : 0}%` },
              { k: '이번 달',    v: `${daysInMonth}일` },
            ].map((r, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.k}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* 기분 분포 */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
              기분 분포
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {moodDist.map(({ mood, count }) => {
                const pct = entries.length ? Math.round(count / entries.length * 100) : 0;
                return (
                  <div key={mood}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {MOOD_META[mood].emoji} {MOOD_META[mood].label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {count}일
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-elev)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: MOOD_META[mood].color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 최근 기록 목록 */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
              최근 기록
            </div>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <Loader2 style={{ width: 16, height: 16, color: 'var(--text-muted)' }} className="animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-faint)', fontSize: 11 }}>
                이 달의 기록이 없습니다
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date)).slice(0, 10).map(e => {
                  const isSelected = e.entry_date.slice(0, 10) === selectedDate;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedDate(e.entry_date.slice(0, 10))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px', borderRadius: 4,
                        background: isSelected ? 'var(--accent-bg)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: 2, flexShrink: 0,
                        background: MOOD_META[e.mood].color,
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {e.entry_date.slice(5).replace('-', '/')}
                      </span>
                      <span style={{
                        fontSize: 11, color: 'var(--text-dim)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {e.content.slice(0, 18) || '(내용 없음)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
