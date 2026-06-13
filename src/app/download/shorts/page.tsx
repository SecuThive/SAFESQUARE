'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, Shield, Zap, CheckCircle, AlertCircle } from 'lucide-react';

type InfoResp = {
  app: string;
  filename: string;
  size_bytes: number;
  size_mb: number;
  modified: number;
  build: 'debug' | 'release';
};

export default function ShortsDownloadPage() {
  const [info, setInfo] = useState<InfoResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadUrl = '/api/downloads/shorts.apk';

  useEffect(() => {
    fetch('/api/downloads/shorts/info')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || '정보 조회 실패');
        return r.json();
      })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0B10] via-[#15121C] to-[#0B0B10] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Hero */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#FF2D55] to-[#9B6BFF] shadow-2xl shadow-[#FF2D55]/30">
            <Zap className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">쇼츠 자동화</h1>
          <p className="mt-2 text-base text-[#B4B0C0]">전자기기 반란 채널 대본 생성기</p>
          <p className="mt-1 text-sm text-[#7A7686]">Android 8.0+ (API 26+)</p>
        </div>

        {/* Download card */}
        <div className="rounded-3xl border border-[#2C2936] bg-gradient-to-br from-[#262230] to-[#1B1823] p-6 shadow-xl">
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              <div>
                <p className="font-semibold text-red-300">APK를 찾을 수 없습니다</p>
                <p className="mt-1 text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          ) : info ? (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#B4B0C0]">{info.filename}</p>
                  <p className="text-xs text-[#7A7686]">
                    {info.size_mb} MB · {info.build === 'release' ? 'Release' : 'Debug'} 빌드
                  </p>
                </div>
                <span className="rounded-lg border border-[#9B6BFF]/40 bg-[#9B6BFF]/15 px-2.5 py-1 text-xs font-semibold text-[#C6A8FF]">
                  v1.0.0
                </span>
              </div>

              <a
                href={downloadUrl}
                className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF2D55] to-[#9B6BFF] font-semibold text-white shadow-lg shadow-[#FF2D55]/30 transition-transform active:scale-[0.98]"
              >
                <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                APK 다운로드
              </a>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B9D] border-t-transparent" />
            </div>
          )}
        </div>

        {/* Install guide */}
        <div className="mt-8 rounded-3xl border border-[#2C2936] bg-[#1A1820]/60 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Smartphone className="h-5 w-5 text-[#FF6B9D]" />
            설치 방법
          </h2>
          <ol className="space-y-3 text-sm text-[#B4B0C0]">
            <Step n={1}>위 버튼으로 APK 파일 다운로드</Step>
            <Step n={2}>
              설정 → 앱 → <span className="text-white">알 수 없는 출처</span> 허용 (크롬/파일앱)
            </Step>
            <Step n={3}>다운로드한 APK 탭하여 설치</Step>
            <Step n={4}>SafeSquare 계정으로 로그인</Step>
          </ol>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Feature icon={<Zap className="h-4 w-4 text-[#FF6B9D]" />} title="즉시 생성" desc="탭 한 번으로 5개 대본" />
          <Feature icon={<Shield className="h-4 w-4 text-[#5AC8FA]" />} title="로컬 인증" desc="기존 SafeSquare 계정 사용" />
          <Feature icon={<CheckCircle className="h-4 w-4 text-[#32D74B]" />} title="히스토리 보관" desc="과거 대본 다시 보기" />
          <Feature icon={<Smartphone className="h-4 w-4 text-[#9B6BFF]" />} title="모바일 최적화" desc="Compose UI · 다크 테마" />
        </div>

        <p className="mt-10 text-center text-xs text-[#7A7686]">
          © {new Date().getFullYear()} ThiveLab · Shorts Automation
        </p>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF2D55] to-[#9B6BFF] text-xs font-bold text-white">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-[#2C2936] bg-[#1A1820]/60 p-4">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#221F2B]">{icon}</div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-[#7A7686]">{desc}</p>
    </div>
  );
}
