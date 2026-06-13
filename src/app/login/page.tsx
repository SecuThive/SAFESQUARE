'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, saveAuth } from '@/lib/api';
import { Lock, User, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';

const STATS = [
  { k: '활성 프로젝트', v: '12',   color: 'oklch(0.68 0.18 218)' },
  { k: '등록 엔지니어', v: '28',   color: 'oklch(0.76 0.16 196)' },
  { k: '누적 작업일지', v: '2,847', color: 'oklch(0.76 0.16 152)' },
];

const FEATURES = [
  '프로젝트 · 태스크 통합 관리',
  '작업일지 · 회의록 · WBS 자동화',
  '장애조치 · 벤더 가이드 KB',
  'RAG 기반 AI 검색',
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const lsToken = localStorage.getItem('auth_token');
    const cookieToken = document.cookie.split(';').some(c => c.trim().startsWith('auth_token='));
    if (lsToken && cookieToken) {
      router.replace('/dashboard');
    } else {
      if (lsToken && !cookieToken) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        localStorage.removeItem('auth_is_admin');
      }
      setChecking(false);
    }
  }, [router]);

  if (checking) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await authApi.login(username, password);
      saveAuth(token);
      router.push('/');
    } catch (err: any) {
      setError(err.message ?? '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        background: 'oklch(0.12 0.010 246)',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 30% 40%, oklch(0.38 0.12 220 / 0.06) 0%, transparent 70%)',
        color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13,
      }}
    >

      {/* ── 좌: 로그인 폼 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: '40px', minWidth: 320, maxWidth: 520,
      }}>
        <div style={{ width: '100%', maxWidth: 340 }}>

          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, oklch(0.76 0.16 196 / 0.20) 0%, oklch(0.68 0.18 220 / 0.10) 100%)',
              border: '1px solid oklch(0.55 0.12 196 / 0.40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px oklch(0.76 0.16 196 / 0.15), inset 0 1px 0 rgba(255,255,255,0.10)',
            }}>
              <ShieldCheck style={{ width: 18, height: 18, color: 'oklch(0.76 0.16 196)' }} />
            </div>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 900, letterSpacing: '0.16em',
                background: 'linear-gradient(135deg, oklch(0.82 0.16 196) 0%, oklch(0.72 0.18 218) 60%, oklch(0.68 0.14 238) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                SAFESQUARE
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, letterSpacing: '0.04em' }}>
                Security Ops Platform
              </div>
            </div>
          </div>

          {/* 타이틀 */}
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
            로그인
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
            내부 엔지니어링 플랫폼에 접속합니다.
          </p>

          {/* 폼 */}
          <form onSubmit={handleSubmit}>

            {/* 아이디 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', letterSpacing: '0.06em',
                textTransform: 'uppercase', marginBottom: 6,
              }}>아이디</label>
              <div style={{ position: 'relative' }}>
                <User style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 13, height: 13, color: 'var(--text-faint)', pointerEvents: 'none',
                }} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  required
                  autoFocus
                  style={{
                    fontSize: '16px',
                    width: '100%', height: 38, paddingLeft: 32, paddingRight: 12,
                    background: 'oklch(0.15 0.010 244)',
                    border: '1px solid oklch(0.24 0.010 238)',
                    borderRadius: 8, color: 'var(--text)', outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.20)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'oklch(0.76 0.16 196)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.76 0.16 196 / 0.14), inset 0 1px 2px rgba(0,0,0,0.15)';
                    e.currentTarget.style.background = 'oklch(0.17 0.012 242)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'oklch(0.24 0.010 238)';
                    e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.20)';
                    e.currentTarget.style.background = 'oklch(0.15 0.010 244)';
                  }}
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div style={{ marginBottom: 22 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', letterSpacing: '0.06em',
                textTransform: 'uppercase', marginBottom: 6,
              }}>비밀번호</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 13, height: 13, color: 'var(--text-faint)', pointerEvents: 'none',
                }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  style={{
                    fontSize: '16px',
                    width: '100%', height: 38, paddingLeft: 32, paddingRight: 12,
                    background: 'oklch(0.15 0.010 244)',
                    border: '1px solid oklch(0.24 0.010 238)',
                    borderRadius: 8, color: 'var(--text)', outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.20)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'oklch(0.76 0.16 196)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.76 0.16 196 / 0.14), inset 0 1px 2px rgba(0,0,0,0.15)';
                    e.currentTarget.style.background = 'oklch(0.17 0.012 242)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'oklch(0.24 0.010 238)';
                    e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.20)';
                    e.currentTarget.style.background = 'oklch(0.15 0.010 244)';
                  }}
                />
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px',
                background: 'oklch(0.40 0.11 22 / 0.12)',
                border: '1px solid oklch(0.55 0.14 22 / 0.35)',
                borderRadius: 8, fontSize: 12,
                color: 'oklch(0.78 0.18 22)',
                boxShadow: '0 2px 12px oklch(0.70 0.20 22 / 0.08)',
              }}>
                {error}
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: loading
                  ? 'oklch(0.54 0.11 196)'
                  : 'linear-gradient(160deg, oklch(0.80 0.16 196) 0%, oklch(0.68 0.18 210) 100%)',
                color: 'oklch(0.10 0.015 245)',
                border: '1px solid oklch(0.72 0.16 196)',
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: loading ? 'none' : '0 2px 8px oklch(0.76 0.16 196 / 0.25), inset 0 1px 0 rgba(255,255,255,0.22)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'linear-gradient(160deg, oklch(0.84 0.17 196) 0%, oklch(0.72 0.19 210) 100%)';
                  el.style.boxShadow = '0 4px 20px oklch(0.76 0.16 196 / 0.35), inset 0 1px 0 rgba(255,255,255,0.24)';
                  el.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'linear-gradient(160deg, oklch(0.80 0.16 196) 0%, oklch(0.68 0.18 210) 100%)';
                  el.style.boxShadow = '0 2px 8px oklch(0.76 0.16 196 / 0.25), inset 0 1px 0 rgba(255,255,255,0.22)';
                  el.style.transform = 'translateY(0)';
                }
              }}
            >
              {loading ? (
                <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />로그인 중...</>
              ) : (
                <>
                  <Lock style={{ width: 13, height: 13 }} />
                  안전하게 로그인
                  <ArrowRight style={{ width: 13, height: 13 }} />
                </>
              )}
            </button>
          </form>

          {/* 시스템 상태 */}
          <div style={{
            marginTop: 24, paddingTop: 18,
            borderTop: '1px solid oklch(0.22 0.010 238)',
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 10, color: 'var(--text-faint)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: 'oklch(0.76 0.16 152)',
              boxShadow: '0 0 6px oklch(0.76 0.16 152 / 0.50)',
            }} />
            <span>All systems operational</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
              v{new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* ── 우: 데코레이션 패널 ── */}
      <div
        style={{
          flex: 1.3, position: 'relative', overflow: 'hidden',
          borderLeft: '1px solid oklch(0.20 0.010 240)',
          background: 'oklch(0.13 0.012 244)',
          backgroundImage: [
            'radial-gradient(ellipse 70% 60% at 50% 20%, oklch(0.38 0.12 210 / 0.08) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 40% at 80% 80%, oklch(0.38 0.10 250 / 0.06) 0%, transparent 60%)',
          ].join(', '),
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: 48,
        }}
        className="hidden lg:flex"
      >
        {/* Grid overlay */}
        <svg
          style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none' }}
          width="100%" height="100%"
        >
          <defs>
            <pattern id="ss-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="oklch(0.60 0.08 210)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ss-grid)" />
        </svg>

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '15%', right: '20%',
          width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(0.76 0.16 196 / 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '25%', left: '10%',
          width: 160, height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(0.68 0.18 218 / 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* 상단: 태그라인 */}
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 22, padding: '0 10px', borderRadius: 6,
            background: 'oklch(0.76 0.16 196 / 0.10)',
            border: '1px solid oklch(0.55 0.12 196 / 0.35)',
            fontSize: 10, fontWeight: 600, color: 'oklch(0.76 0.16 196)',
            marginBottom: 22, letterSpacing: '0.04em',
            boxShadow: '0 0 12px oklch(0.76 0.16 196 / 0.10)',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'oklch(0.76 0.16 196)',
              boxShadow: '0 0 6px oklch(0.76 0.16 196 / 0.60)',
            }} />
            2026.05 Release
          </div>

          <h2 style={{
            fontSize: 32, fontWeight: 800,
            letterSpacing: '-0.03em', lineHeight: 1.2,
            margin: '0 0 18px',
            background: 'linear-gradient(135deg, oklch(0.97 0.004 220) 0%, oklch(0.78 0.008 228) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            보안 엔지니어링을<br />한 곳에서 운영합니다.
          </h2>

          <p style={{
            fontSize: 13, color: 'var(--text-muted)',
            lineHeight: 1.70, maxWidth: 380, margin: '0 0 32px',
          }}>
            분산되어 있던 보안 운영의 모든 컨텍스트를<br />
            하나의 워크스페이스로 통합합니다.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: 'oklch(0.76 0.16 196 / 0.12)',
                  border: '1px solid oklch(0.55 0.12 196 / 0.30)',
                }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="oklch(0.76 0.16 196)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 하단: 통계 카드 */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {STATS.map((s, i) => (
            <div
              key={i}
              style={{
                padding: '16px 18px',
                background: 'oklch(0.17 0.010 242)',
                border: '1px solid oklch(0.24 0.010 236)',
                borderRadius: 12,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg, transparent 0%, ${s.color}80 50%, transparent 100%)`,
              }} />
              <div style={{
                fontSize: 10, color: 'var(--text-faint)',
                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
                fontWeight: 600,
              }}>
                {s.k}
              </div>
              <div style={{
                fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em',
                fontVariantNumeric: 'tabular-nums',
                color: s.color,
                textShadow: `0 0 20px ${s.color}40`,
              }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
