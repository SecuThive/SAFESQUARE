'use client';

import { useState, useEffect } from 'react';
import type { Project } from '@/lib/types';
import { getAuthHeaders } from '@/lib/api';
import { Printer, Save, Check } from 'lucide-react';
import SignaturePad from '@/components/ui/SignaturePad';
import clsx from 'clsx';

interface Props {
  project: Project;
  initialData?: D;      // 저장된 보고서 불러올 때
  recordId?: number;    // 수정 모드: 기존 record id
  onSaved?: (id: number) => void;
}

type R3         = '양호' | '점검' | '불량';
type RPN        = 'pass' | 'fail';
type ServerCfg  = 'ha_relay' | 'single_relay' | 'auth_only';

// 서버 구성에 따라 활성 노드 반환
function getNodes(cfg: ServerCfg): Array<'A' | 'S' | 'G'> {
  if (cfg === 'ha_relay')     return ['A', 'S', 'G'];
  if (cfg === 'single_relay') return ['A', 'G'];
  return ['A'];
}
function hasStandby(cfg: ServerCfg) { return cfg === 'ha_relay'; }
function hasRelay(cfg: ServerCfg)   { return cfg !== 'auth_only'; }

interface SvrNode  { hostname: string; ip: string; os: string; note: string; }
interface ProcRow  { name: string; status: 'RUN' | 'STOP'; cpu: string; mem: string; note: string; }
interface MountRow { path: string; used: string; avail: string; usePct: string; note: string; }
interface MemRow   { total: string; used: string; free: string; shared: string; bufs: string; cached: string; }
interface OTPDev   { model: string; serial: string; regDate: string; expDate: string; qty: string; }

interface D {
  serverCfg: ServerCfg;
  clientName: string; verAuth: string; verRelay: string;
  inspType: string; inspTypeOther: string; inspPlace: string;
  inspYear: string; inspMonth: string; inspDay: string;
  inspStartH: string; inspStartM: string; inspEndH: string; inspEndM: string;
  durH: string; durM: string;
  license: string; currentUser: string; otpCount: string;
  authVip: SvrNode; authActive: SvrNode; authStandby: SvrNode; relayGw: SvrNode;
  sCpu: RPN; sMem: RPN; sHdd: RPN; sProc: RPN; sNtp: RPN; sLogs: RPN;
  sCpuNote: string; sMemNote: string; sHddNote: string; sProcNote: string; sNtpNote: string; sLogsNote: string;
  issues: string; patchRec: string;
  vendorCompany: string; vendorName: string; vendorContact: string;
  clientTeam: string; clientSignName: string; clientContact: string;
  vendorSign: string;   // base64 서명 이미지
  clientSign: string;   // base64 서명 이미지
  procAResult: R3; procAAction: string; procA: ProcRow[];
  drbdAcs: string; drbdAro: string; drbdAds: string;
  procSResult: R3; procSAction: string; procS: ProcRow[];
  drbdScs: string; drbdSro: string; drbdSds: string;
  procGResult: R3; procGAction: string;
  procGStatus: 'RUN' | 'STOP'; procGStopReason: string;
  procGAppType: string; procGClientCode: string; procGPort: string;
  cpuAResult: R3; cpuAAction: string; cpuASys: string; cpuAIdle: string;
  cpuSResult: R3; cpuSAction: string; cpuSSys: string; cpuSIdle: string;
  cpuGResult: R3; cpuGAction: string; cpuGSys: string; cpuGIdle: string;
  hddAResult: R3; hddAAction: string; hddA: MountRow[];
  hddSResult: R3; hddSAction: string; hddS: MountRow[];
  hddGResult: R3; hddGAction: string; hddG: MountRow[];
  memAResult: R3; memAAction: string; memA: MemRow;
  memSResult: R3; memSAction: string; memS: MemRow;
  memGResult: R3; memGAction: string; memG: MemRow;
  ntpAResult: R3; ntpAAction: string; ntpAIp: string; ntpAOk: boolean; ntpAOffset: string; ntpARunning: boolean;
  ntpSResult: R3; ntpSAction: string; ntpSIp: string; ntpSOk: boolean; ntpSOffset: string; ntpSRunning: boolean;
  ntpGResult: R3; ntpGAction: string; ntpGIp: string; ntpGOk: boolean; ntpGOffset: string; ntpGRunning: boolean;
  logAResult: R3; logAAction: string; logAAuthOk: boolean; logAAuthErr: string; logASyncRunning: boolean;
  logSResult: R3; logSAction: string; logSAuthOk: boolean; logSAuthErr: string; logSSyncRunning: boolean;
  logGResult: R3; logGAction: string; logGAccessOk: boolean; logGAccessErr: string; logGSgexOk: boolean; logGSgexErr: string;
  otpDevices: OTPDev[];
  kernelVer: string; pgVer: string; tomcatVer: string;
  accountSync: string; smsInteg: string; emailInteg: string; jarVer: string;
}

const PROCS = ['GTRadiusOTPServer','GTWebAdmin','DBMS_PostgreSQL','NTP_DaeMon','DRBD','Heartbeat'];
const mkProcs  = (): ProcRow[]  => PROCS.map(n => ({ name: n, status: 'RUN' as const, cpu:'', mem:'', note:'' }));
const mkMounts = (): MountRow[] => ['/','/boot','/drbd'].map(p => ({ path:p, used:'', avail:'', usePct:'', note:'' }));
const mkMem    = (): MemRow     => ({ total:'', used:'', free:'', shared:'', bufs:'', cached:'' });
const mkSvr    = (): SvrNode    => ({ hostname:'', ip:'', os:'', note:'' });

function initData(project: Project): D {
  const t = new Date();
  return {
    serverCfg: 'ha_relay' as ServerCfg,
    clientName: project.client_name || project.name,
    verAuth:'', verRelay:'',
    inspType:'regular', inspTypeOther:'', inspPlace:'',
    inspYear: String(t.getFullYear()),
    inspMonth: String(t.getMonth()+1).padStart(2,'0'),
    inspDay: String(t.getDate()).padStart(2,'0'),
    inspStartH:'', inspStartM:'', inspEndH:'', inspEndM:'',
    durH:'', durM:'',
    license:'', currentUser:'', otpCount:'',
    authVip: mkSvr(), authActive: mkSvr(), authStandby: mkSvr(), relayGw: mkSvr(),
    sCpu:'pass', sMem:'pass', sHdd:'pass', sProc:'pass', sNtp:'pass', sLogs:'pass',
    sCpuNote:'', sMemNote:'', sHddNote:'', sProcNote:'', sNtpNote:'', sLogsNote:'',
    issues:'', patchRec:'',
    vendorCompany:'', vendorName:'', vendorContact:'',
    clientTeam:'', clientSignName:'', clientContact:'',
    vendorSign:'', clientSign:'',
    procAResult:'양호', procAAction:'', procA: mkProcs(),
    drbdAcs:'', drbdAro:'', drbdAds:'',
    procSResult:'양호', procSAction:'', procS: mkProcs(),
    drbdScs:'', drbdSro:'', drbdSds:'',
    procGResult:'양호', procGAction:'',
    procGStatus:'RUN', procGStopReason:'',
    procGAppType:'in-house', procGClientCode:'', procGPort:'normal',
    cpuAResult:'양호', cpuAAction:'', cpuASys:'', cpuAIdle:'',
    cpuSResult:'양호', cpuSAction:'', cpuSSys:'', cpuSIdle:'',
    cpuGResult:'양호', cpuGAction:'', cpuGSys:'', cpuGIdle:'',
    hddAResult:'양호', hddAAction:'', hddA: mkMounts(),
    hddSResult:'양호', hddSAction:'', hddS: mkMounts(),
    hddGResult:'양호', hddGAction:'', hddG: mkMounts(),
    memAResult:'양호', memAAction:'', memA: mkMem(),
    memSResult:'양호', memSAction:'', memS: mkMem(),
    memGResult:'양호', memGAction:'', memG: mkMem(),
    ntpAResult:'양호', ntpAAction:'', ntpAIp:'', ntpAOk:true, ntpAOffset:'', ntpARunning:true,
    ntpSResult:'양호', ntpSAction:'', ntpSIp:'', ntpSOk:true, ntpSOffset:'', ntpSRunning:true,
    ntpGResult:'양호', ntpGAction:'', ntpGIp:'', ntpGOk:true, ntpGOffset:'', ntpGRunning:true,
    logAResult:'양호', logAAction:'', logAAuthOk:true, logAAuthErr:'', logASyncRunning:true,
    logSResult:'양호', logSAction:'', logSAuthOk:true, logSAuthErr:'', logSSyncRunning:true,
    logGResult:'양호', logGAction:'', logGAccessOk:true, logGAccessErr:'', logGSgexOk:true, logGSgexErr:'',
    otpDevices: Array(8).fill(null).map(()=>({ model:'', serial:'', regDate:'', expDate:'', qty:'' })),
    kernelVer:'', pgVer:'', tomcatVer:'',
    accountSync:'', smsInteg:'', emailInteg:'', jarVer:'',
  };
}

// ─── Form section tabs ────────────────────────────────────────────────────────
const SECTIONS = [
  { id:'basic',    label:'기본 정보'   },
  { id:'server',   label:'서버 정보'   },
  { id:'summary',  label:'점검 요약'   },
  { id:'process',  label:'프로세스'    },
  { id:'hardware', label:'하드웨어'    },
  { id:'ntp',      label:'NTP/로그'   },
  { id:'otp',      label:'OTP/기타'   },
];

export default function InspectionReport({ project, initialData, recordId: initRecordId, onSaved }: Props) {
  const [d, setD]         = useState<D>(() => initialData ?? initData(project));
  const [sec, setSec]     = useState('basic');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [recId,  setRecId]  = useState<number | undefined>(initRecordId);

  // 인쇄 전 각 페이지를 A4(210×297mm) 안에 맞도록 zoom 조정
  useEffect(() => {
    // 297mm → CSS px (96dpi 기준: 1mm = 96/25.4 px)
    const A4_HEIGHT_PX = Math.round(297 * 96 / 25.4); // ≈ 1123px

    const beforePrint = () => {
      document.querySelectorAll<HTMLElement>('.print-page').forEach(el => {
        el.style.zoom = '';
        const a4W = el.clientWidth;   // width: 210mm 적용된 값
        const a4H = A4_HEIGHT_PX;
        const scaleX = el.scrollWidth  > a4W ? a4W / el.scrollWidth  : 1;
        const scaleY = el.scrollHeight > a4H ? a4H / el.scrollHeight : 1;
        const scale  = Math.min(scaleX, scaleY);
        if (scale < 1) {
          el.style.zoom = String(scale);
        }
      });
    };
    const afterPrint = () => {
      document.querySelectorAll<HTMLElement>('.print-page').forEach(el => {
        el.style.zoom = '';
      });
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const title = `${d.clientName || project.name} 점검보고서 (${d.inspYear}-${d.inspMonth}-${d.inspDay})`;
      const inspected_at = `${d.inspYear}-${d.inspMonth}-${d.inspDay}`;
      const authHeaders = getAuthHeaders();
      if (recId) {
        // 덮어쓰기
        const res = await fetch(`/api/inspection-records/${recId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ title, inspected_at, data: d }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail ?? '저장 실패');
        }
        onSaved?.(recId);
      } else {
        // 신규 저장
        const res = await fetch(`/api/inspection-records?project_id=${project.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ title, inspected_at, doc_type: 'inspection_report', data: d }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail ?? '저장 실패');
        }
        const json = await res.json();
        setRecId(json.id);
        onSaved?.(json.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error(e);
      setSaveErr(e.message ?? '저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof D>(k: K, v: D[K]) => setD(p => ({ ...p, [k]: v }));
  const setSvr = (k: keyof D, f: keyof SvrNode, v: string) =>
    setD(p => ({ ...p, [k]: { ...(p[k] as SvrNode), [f]: v } }));
  const setProc = (which: 'procA'|'procS', idx: number, f: keyof ProcRow, v: string) =>
    setD(p => { const arr = [...p[which]]; arr[idx] = { ...arr[idx], [f]: v }; return { ...p, [which]: arr }; });
  const setMount = (which: 'hddA'|'hddS'|'hddG', idx: number, f: keyof MountRow, v: string) =>
    setD(p => { const arr = [...p[which]]; arr[idx] = { ...arr[idx], [f]: v }; return { ...p, [which]: arr }; });
  const setMem = (which: 'memA'|'memS'|'memG', f: keyof MemRow, v: string) =>
    setD(p => ({ ...p, [which]: { ...p[which], [f]: v } }));
  const setOTP = (idx: number, f: keyof OTPDev, v: string) =>
    setD(p => { const arr = [...p.otpDevices]; arr[idx] = { ...arr[idx], [f]: v }; return { ...p, otpDevices: arr }; });

  return (
    <div className="inspection-root flex h-full overflow-hidden">
      {/* ── 편집 폼 (좌) ─────────────────────────────────────────────── */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-gray-800 bg-surface-raised no-print">
        {/* 섹션 탭 */}
        <div className="flex overflow-x-auto border-b border-gray-800 flex-shrink-0">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSec(s.id)}
              className={clsx('text-[11px] px-3 py-2.5 whitespace-nowrap transition-colors border-b-2',
                sec === s.id ? 'border-brand text-brand font-semibold' : 'border-transparent text-gray-400 hover:text-gray-200'
              )}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sec === 'basic' && <FormBasic d={d} set={set} />}
          {sec === 'server' && <FormServer d={d} setSvr={setSvr} />}
          {sec === 'summary' && <FormSummary d={d} set={set} />}
          {sec === 'process' && <FormProcess d={d} set={set} setProc={setProc} />}
          {sec === 'hardware' && <FormHardware d={d} set={set} setMount={setMount} setMem={setMem} />}
          {sec === 'ntp' && <FormNTP d={d} set={set} />}
          {sec === 'otp' && <FormOTP d={d} set={set} setOTP={setOTP} />}
        </div>
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors',
              saved
                ? 'bg-green-600 text-white'
                : 'bg-surface-overlay border border-gray-600 text-gray-200 hover:border-brand hover:text-brand'
            )}>
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? '저장 중...' : saved ? '저장됨' : recId ? '덮어쓰기' : '저장'}
          </button>
          <button onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
            <Printer className="w-3.5 h-3.5" /> 인쇄
          </button>
        </div>
        {saveErr && (
          <div className="px-3 pb-2 text-xs text-red-400">{saveErr}</div>
        )}
      </div>

      {/* ── 미리보기 (우) ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-200 p-6 space-y-6" id="doc-preview">
        <PreviewPage1 d={d} project={project} />
        <PreviewPage2 d={d} />
        <PreviewPageHDD d={d} />
        <PreviewPage3 d={d} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// FORM SECTIONS
// ════════════════════════════════════════════════════════════════════════════════

function FormBasic({ d, set }: { d: D; set: any }) {
  const CFG_OPTIONS: { value: ServerCfg; label: string; desc: string }[] = [
    { value: 'ha_relay',     label: '이중화 + 중계서버', desc: 'Active / StandBy + Gateway' },
    { value: 'single_relay', label: '단일 + 중계서버',   desc: 'Active + Gateway' },
    { value: 'auth_only',    label: '인증서버만',        desc: 'Active only' },
  ];
  return (
    <>
      {/* ── 서버 구성 선택 ── */}
      <FS title="서버 구성">
        <div className="grid grid-cols-1 gap-2">
          {CFG_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => set('serverCfg', opt.value)}
              className={clsx(
                'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                d.serverCfg === opt.value
                  ? 'border-brand bg-brand/10 text-gray-100'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              )}>
              <span className={clsx(
                'mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0',
                d.serverCfg === opt.value ? 'border-brand bg-brand' : 'border-gray-600'
              )} />
              <div>
                <p className="text-xs font-semibold">{opt.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </FS>
      <FS title="고객 정보">
        <FL label="고객사명"><input className="input text-xs" value={d.clientName} onChange={e=>set('clientName',e.target.value)} /></FL>
        <div className="grid grid-cols-2 gap-2">
          <FL label="인증서버 버전"><input className="input text-xs" value={d.verAuth} onChange={e=>set('verAuth',e.target.value)} /></FL>
          <FL label="중계서버 버전"><input className="input text-xs" value={d.verRelay} onChange={e=>set('verRelay',e.target.value)} /></FL>
        </div>
        <FL label="점검구분">
          <div className="flex flex-wrap gap-3 mt-1">
            {[['regular','정기점검'],['temporary','임시점검'],['recovery','시스템복구'],['other','기타']].map(([v,l])=>(
              <label key={v} className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                <input type="radio" name="inspType" checked={d.inspType===v} onChange={()=>set('inspType',v)} className="accent-brand" />
                {l}
              </label>
            ))}
          </div>
          {d.inspType==='other' && <input className="input text-xs mt-1" placeholder="기타 내용" value={d.inspTypeOther} onChange={e=>set('inspTypeOther',e.target.value)} />}
        </FL>
        <FL label="점검장소"><input className="input text-xs" value={d.inspPlace} onChange={e=>set('inspPlace',e.target.value)} /></FL>
        <FL label="점검일시">
          <div className="flex gap-1 items-center flex-wrap">
            <input className="input text-xs w-14" placeholder="년" value={d.inspYear} onChange={e=>set('inspYear',e.target.value)} />년
            <input className="input text-xs w-10" placeholder="월" value={d.inspMonth} onChange={e=>set('inspMonth',e.target.value)} />월
            <input className="input text-xs w-10" placeholder="일" value={d.inspDay} onChange={e=>set('inspDay',e.target.value)} />일
            <input className="input text-xs w-10" placeholder="시" value={d.inspStartH} onChange={e=>set('inspStartH',e.target.value)} />시
            <input className="input text-xs w-10" placeholder="분" value={d.inspStartM} onChange={e=>set('inspStartM',e.target.value)} />분
            <span>~</span>
            <input className="input text-xs w-10" placeholder="시" value={d.inspEndH} onChange={e=>set('inspEndH',e.target.value)} />시
            <input className="input text-xs w-10" placeholder="분" value={d.inspEndM} onChange={e=>set('inspEndM',e.target.value)} />분
          </div>
          <div className="flex gap-1 items-center mt-1 text-xs text-gray-400">
            소요:
            <input className="input text-xs w-12" placeholder="시간" value={d.durH} onChange={e=>set('durH',e.target.value)} />시간
            <input className="input text-xs w-12" placeholder="분" value={d.durM} onChange={e=>set('durM',e.target.value)} />분
          </div>
        </FL>
        <div className="grid grid-cols-3 gap-2">
          <FL label="Server License"><input className="input text-xs" value={d.license} onChange={e=>set('license',e.target.value)} /></FL>
          <FL label="Current User"><input className="input text-xs" value={d.currentUser} onChange={e=>set('currentUser',e.target.value)} /></FL>
          <FL label="OTP 기기수량"><input className="input text-xs" value={d.otpCount} onChange={e=>set('otpCount',e.target.value)} /></FL>
        </div>
      </FS>
      <FS title="특이사항 / 패치권고사항">
        <FL label="특이사항"><textarea className="textarea text-xs" rows={3} value={d.issues} onChange={e=>set('issues',e.target.value)} /></FL>
        <FL label="패치권고사항"><textarea className="textarea text-xs" rows={3} value={d.patchRec} onChange={e=>set('patchRec',e.target.value)} /></FL>
      </FS>
      <FS title="유지보수 점검 확인">
        <div className="grid grid-cols-2 gap-4">
          {/* 보수업체 */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 border-b border-gray-700 pb-1">보수업체</p>
            <FL label="업체명"><input className="input text-xs" value={d.vendorCompany} onChange={e=>set('vendorCompany',e.target.value)} /></FL>
            <FL label="성명"><input className="input text-xs" value={d.vendorName} onChange={e=>set('vendorName',e.target.value)} /></FL>
            <FL label="연락처"><input className="input text-xs" value={d.vendorContact} onChange={e=>set('vendorContact',e.target.value)} /></FL>
            <SignaturePad label="전자서명 (보수업체)" value={d.vendorSign} onChange={v=>set('vendorSign',v)} />
          </div>
          {/* 담당팀 */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 border-b border-gray-700 pb-1">담당팀</p>
            <FL label="팀명"><input className="input text-xs" value={d.clientTeam} onChange={e=>set('clientTeam',e.target.value)} /></FL>
            <FL label="성명"><input className="input text-xs" value={d.clientSignName} onChange={e=>set('clientSignName',e.target.value)} /></FL>
            <FL label="연락처"><input className="input text-xs" value={d.clientContact} onChange={e=>set('clientContact',e.target.value)} /></FL>
            <SignaturePad label="전자서명 (담당팀)" value={d.clientSign} onChange={v=>set('clientSign',v)} />
          </div>
        </div>
      </FS>
    </>
  );
}

function FormServer({ d, setSvr }: { d: D; setSvr: any }) {
  const allNodes: [keyof D, string, ServerCfg[]][] = [
    ['authVip',     '인증서버 VIP',     ['ha_relay']],
    ['authActive',  '인증서버 Active',  ['ha_relay','single_relay','auth_only']],
    ['authStandby', '인증서버 StandBy', ['ha_relay']],
    ['relayGw',     '중계서버 Gateway', ['ha_relay','single_relay']],
  ];
  const nodes = allNodes.filter(([,,cfgs]) => cfgs.includes(d.serverCfg));
  return (
    <FS title="Server Information">
      {nodes.map(([k, label]) => (
        <div key={String(k)} className="border border-gray-700 rounded-lg p-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-300">{label}</p>
          <div className="grid grid-cols-2 gap-2">
            <FL label="Hostname"><input className="input text-xs" value={(d[k] as SvrNode).hostname} onChange={e=>setSvr(k,'hostname',e.target.value)} /></FL>
            <FL label="IP Address"><input className="input text-xs" value={(d[k] as SvrNode).ip} onChange={e=>setSvr(k,'ip',e.target.value)} /></FL>
            <FL label="O/S"><input className="input text-xs" value={(d[k] as SvrNode).os} onChange={e=>setSvr(k,'os',e.target.value)} /></FL>
            <FL label="비고"><input className="input text-xs" value={(d[k] as SvrNode).note} onChange={e=>setSvr(k,'note',e.target.value)} /></FL>
          </div>
        </div>
      ))}
    </FS>
  );
}

function FormSummary({ d, set }: { d: D; set: any }) {
  const rows: [keyof D, keyof D, string, string][] = [
    ['sCpu','sCpuNote','CPU 사용량','80% 이하'],
    ['sMem','sMemNote','Memory 사용량','80% 이하'],
    ['sHdd','sHddNote','HDD 사용량','90% 이하'],
    ['sProc','sProcNote','Process 상태','Process 정상'],
    ['sNtp','sNtpNote','시간동기화 여부','현 시간'],
    ['sLogs','sLogsNote','Logs','이상로그 없음'],
  ];
  return (
    <FS title="Server Summary (OTP 인증시스템)">
      {rows.map(([rk, nk, label, std]) => (
        <div key={String(rk)} className="border border-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-200">{label}</span>
            <span className="text-[10px] text-gray-500">기준: {std}</span>
          </div>
          <div className="flex gap-2 mb-2">
            {(['pass','fail'] as RPN[]).map(v => (
              <label key={v} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" checked={(d[rk] as RPN)===v} onChange={()=>set(rk,v)} className="accent-brand" />
                <span className={v==='pass'?'text-green-400':'text-red-400'}>{v==='pass'?'정상':'비정상'}</span>
              </label>
            ))}
          </div>
          <input className="input text-xs" placeholder="비고" value={d[nk] as string} onChange={e=>set(nk,e.target.value)} />
        </div>
      ))}
    </FS>
  );
}

function FormProcess({ d, set, setProc }: { d: D; set: any; setProc: any }) {
  const nodes = getNodes(d.serverCfg);
  const authNodes = nodes.filter(n => n !== 'G') as Array<'A'|'S'>;
  return (
    <>
      {authNodes.map(node => {
        const rk = `proc${node}Result` as keyof D;
        const ak = `proc${node}Action` as keyof D;
        const pk = `proc${node}` as 'procA'|'procS';
        const csK = `drbd${node}cs` as keyof D;
        const roK = `drbd${node}ro` as keyof D;
        const dsK = `drbd${node}ds` as keyof D;
        return (
          <FS key={node} title={`Process Inspection - ${node === 'A' ? 'Active' : 'StandBy'}`}>
            <ResultRow3 label="결과" val={d[rk] as R3} action={d[ak] as string}
              onChange={(v)=>set(rk,v)} onActionChange={(v)=>set(ak,v)} />
            {PROCS.map((name,i) => (
              <div key={name} className="grid grid-cols-4 gap-1 items-center">
                <span className="text-[10px] text-gray-400 col-span-1">{name}</span>
                <label className="flex items-center gap-0.5 text-[10px] text-gray-300 cursor-pointer">
                  <input type="radio" checked={d[pk][i].status==='RUN'} onChange={()=>setProc(pk,i,'status','RUN')} className="accent-brand" /> RUN
                </label>
                <label className="flex items-center gap-0.5 text-[10px] text-gray-300 cursor-pointer">
                  <input type="radio" checked={d[pk][i].status==='STOP'} onChange={()=>setProc(pk,i,'status','STOP')} className="accent-brand" /> STOP
                </label>
                <input className="input text-[10px] px-1 py-0.5" placeholder="%CPU" value={d[pk][i].cpu} onChange={e=>setProc(pk,i,'cpu',e.target.value)} />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 mt-1">
              <FL label="DRBD CS"><input className="input text-xs" value={d[csK] as string} onChange={e=>set(csK,e.target.value)} /></FL>
              <FL label="DRBD ro"><input className="input text-xs" value={d[roK] as string} onChange={e=>set(roK,e.target.value)} /></FL>
              <FL label="DRBD ds"><input className="input text-xs" value={d[dsK] as string} onChange={e=>set(dsK,e.target.value)} /></FL>
            </div>
          </FS>
        );
      })}
      {hasRelay(d.serverCfg) && <FS title="Process Inspection - Gateway">
        <ResultRow3 label="결과" val={d.procGResult} action={d.procGAction}
          onChange={v=>set('procGResult',v)} onActionChange={v=>set('procGAction',v)} />
        <div className="flex gap-3">
          {(['RUN','STOP'] as const).map(v=>(
            <label key={v} className="flex items-center gap-1 text-xs cursor-pointer text-gray-300">
              <input type="radio" checked={d.procGStatus===v} onChange={()=>set('procGStatus',v)} className="accent-brand" />{v}
            </label>
          ))}
        </div>
        {d.procGStatus==='STOP' && <input className="input text-xs" placeholder="STOP 원인" value={d.procGStopReason} onChange={e=>set('procGStopReason',e.target.value)} />}
        <FL label="APP Type">
          <div className="flex gap-3 mt-1">
            {[['in-house','In-house'],['market','Market']].map(([v,l])=>(
              <label key={v} className="flex items-center gap-1 text-xs cursor-pointer text-gray-300">
                <input type="radio" checked={d.procGAppType===v} onChange={()=>set('procGAppType',v)} className="accent-brand" />{l}
              </label>
            ))}
          </div>
          {d.procGAppType==='market' && <input className="input text-xs mt-1" placeholder="고객코드" value={d.procGClientCode} onChange={e=>set('procGClientCode',e.target.value)} />}
        </FL>
        <FL label="Port Check">
          <div className="flex gap-3 mt-1">
            {[['normal','정상'],['abnormal','비정상']].map(([v,l])=>(
              <label key={v} className="flex items-center gap-1 text-xs cursor-pointer text-gray-300">
                <input type="radio" checked={d.procGPort===v} onChange={()=>set('procGPort',v)} className="accent-brand" />{l}
              </label>
            ))}
          </div>
        </FL>
      </FS>}
    </>
  );
}

function FormHardware({ d, set, setMount, setMem }: { d: D; set: any; setMount: any; setMem: any }) {
  const nodes = getNodes(d.serverCfg);
  const nodeLabel = (n: 'A'|'S'|'G') => n === 'A' ? 'Active' : n === 'S' ? 'StandBy' : 'Gateway';
  return (
    <>
      <FS title="CPU 점검">
        {nodes.map(node => {
          const rk = `cpu${node}Result` as keyof D;
          const ak = `cpu${node}Action` as keyof D;
          const sk = `cpu${node}Sys` as keyof D;
          const ik = `cpu${node}Idle` as keyof D;
          return (
            <div key={node} className="border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">{nodeLabel(node)}</p>
              <ResultRow3 label="결과" val={d[rk] as R3} action={d[ak] as string} onChange={v=>set(rk,v)} onActionChange={v=>set(ak,v)} />
              <div className="grid grid-cols-2 gap-2">
                <FL label="system"><input className="input text-xs" value={d[sk] as string} onChange={e=>set(sk,e.target.value)} /></FL>
                <FL label="idle"><input className="input text-xs" value={d[ik] as string} onChange={e=>set(ik,e.target.value)} /></FL>
              </div>
            </div>
          );
        })}
      </FS>
      <FS title="HDD 점검">
        {nodes.map(node => {
          const rk = `hdd${node}Result` as keyof D;
          const ak = `hdd${node}Action` as keyof D;
          const mk = `hdd${node}` as 'hddA'|'hddS'|'hddG';
          return (
            <div key={node} className="border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">{node === 'A' ? 'Active' : node === 'S' ? 'StandBy' : 'Gateway'}</p>
              <ResultRow3 label="결과" val={d[rk] as R3} action={d[ak] as string} onChange={v=>set(rk,v)} onActionChange={v=>set(ak,v)} />
              {d[mk].filter((m: MountRow) => d.serverCfg === 'ha_relay' || m.path !== '/drbd').map((m: MountRow, i: number) => (
                <div key={m.path} className="grid grid-cols-5 gap-1">
                  <span className="text-[10px] text-gray-400">{m.path}</span>
                  <input className="input text-[10px] px-1 py-0.5" placeholder="Used" value={m.used} onChange={e=>setMount(mk,i,'used',e.target.value)} />
                  <input className="input text-[10px] px-1 py-0.5" placeholder="Avail" value={m.avail} onChange={e=>setMount(mk,i,'avail',e.target.value)} />
                  <input className="input text-[10px] px-1 py-0.5" placeholder="use%" value={m.usePct} onChange={e=>setMount(mk,i,'usePct',e.target.value)} />
                  <input className="input text-[10px] px-1 py-0.5" placeholder="비고" value={m.note} onChange={e=>setMount(mk,i,'note',e.target.value)} />
                </div>
              ))}
            </div>
          );
        })}
      </FS>
      <FS title="Memory 점검">
        {nodes.map(node => {
          const rk = `mem${node}Result` as keyof D;
          const ak = `mem${node}Action` as keyof D;
          const mk = `mem${node}` as 'memA'|'memS'|'memG';
          const m = d[mk] as MemRow;
          return (
            <div key={node} className="border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">{nodeLabel(node)}</p>
              <ResultRow3 label="결과" val={d[rk] as R3} action={d[ak] as string} onChange={v=>set(rk,v)} onActionChange={v=>set(ak,v)} />
              <div className="grid grid-cols-3 gap-1">
                {(['total','used','free','shared','bufs','cached'] as (keyof MemRow)[]).map(f=>(
                  <FL key={f} label={f}><input className="input text-[10px]" value={m[f]} onChange={e=>setMem(mk,f,e.target.value)} /></FL>
                ))}
              </div>
            </div>
          );
        })}
      </FS>
    </>
  );
}

function FormNTP({ d, set }: { d: D; set: any }) {
  const nodes = getNodes(d.serverCfg);
  const nodeLabel = (n: 'A'|'S'|'G') => n === 'A' ? 'Active' : n === 'S' ? 'StandBy' : 'Gateway';
  const authNodes = nodes.filter(n => n !== 'G') as Array<'A'|'S'>;
  return (
    <>
      <FS title="NTP 점검">
        {nodes.map(node => {
          const rk = `ntp${node}Result` as keyof D;
          const ak = `ntp${node}Action` as keyof D;
          const ik = `ntp${node}Ip` as keyof D;
          const ok = `ntp${node}Ok` as keyof D;
          const ofk = `ntp${node}Offset` as keyof D;
          const runk = `ntp${node}Running` as keyof D;
          return (
            <div key={node} className="border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">{nodeLabel(node)}</p>
              <ResultRow3 label="결과" val={d[rk] as R3} action={d[ak] as string} onChange={v=>set(rk,v)} onActionChange={v=>set(ak,v)} />
              <FL label="IP/URL"><input className="input text-xs" value={d[ik] as string} onChange={e=>set(ik,e.target.value)} /></FL>
              <div className="flex gap-3 items-center">
                <span className="text-[10px] text-gray-400">시간오차:</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer text-gray-300"><input type="radio" checked={d[ok] as boolean} onChange={()=>set(ok,true)} className="accent-brand" />정상</label>
                <label className="flex items-center gap-1 text-xs cursor-pointer text-gray-300"><input type="radio" checked={!(d[ok] as boolean)} onChange={()=>set(ok,false)} className="accent-brand" />오차발생</label>
                {!(d[ok] as boolean) && <input className="input text-xs w-16" placeholder="분" value={d[ofk] as string} onChange={e=>set(ofk,e.target.value)} />}
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-1 text-xs cursor-pointer text-gray-300"><input type="radio" checked={d[runk] as boolean} onChange={()=>set(runk,true)} className="accent-brand" />실행중</label>
                <label className="flex items-center gap-1 text-xs cursor-pointer text-gray-300"><input type="radio" checked={!(d[runk] as boolean)} onChange={()=>set(runk,false)} className="accent-brand" />사용안함</label>
              </div>
            </div>
          );
        })}
      </FS>
      <FS title="System Log 점검">
        {authNodes.map(node => {
          const rk = `log${node}Result` as keyof D;
          const ak = `log${node}Action` as keyof D;
          const authOk = `log${node}AuthOk` as keyof D;
          const authErr = `log${node}AuthErr` as keyof D;
          const syncRun = `log${node}SyncRunning` as keyof D;
          return (
            <div key={node} className="border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-gray-300">{nodeLabel(node)}</p>
              <ResultRow3 label="결과" val={d[rk] as R3} action={d[ak] as string} onChange={v=>set(rk,v)} onActionChange={v=>set(ak,v)} />
              <div className="flex gap-2 items-center text-[10px] text-gray-400">
                <span>인증로그:</span>
                <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={d[authOk] as boolean} onChange={()=>set(authOk,true)} className="accent-brand" />양호</label>
                <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={!(d[authOk] as boolean)} onChange={()=>set(authOk,false)} className="accent-brand" />에러</label>
                {!(d[authOk] as boolean) && <input className="input text-[10px] px-1 flex-1" value={d[authErr] as string} onChange={e=>set(authErr,e.target.value)} />}
              </div>
              <div className="flex gap-2 items-center text-[10px] text-gray-400">
                <span>계정동기화:</span>
                <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={d[syncRun] as boolean} onChange={()=>set(syncRun,true)} className="accent-brand" />실행중</label>
                <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={!(d[syncRun] as boolean)} onChange={()=>set(syncRun,false)} className="accent-brand" />사용안함</label>
              </div>
            </div>
          );
        })}
        {hasRelay(d.serverCfg) && (
          <div className="border border-gray-700 rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-300">Gateway</p>
            <ResultRow3 label="결과" val={d.logGResult} action={d.logGAction} onChange={v=>set('logGResult',v)} onActionChange={v=>set('logGAction',v)} />
            <div className="flex gap-2 items-center text-[10px] text-gray-400">
              <span>access.log:</span>
              <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={d.logGAccessOk} onChange={()=>set('logGAccessOk',true)} className="accent-brand" />양호</label>
              <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={!d.logGAccessOk} onChange={()=>set('logGAccessOk',false)} className="accent-brand" />에러</label>
            </div>
            <div className="flex gap-2 items-center text-[10px] text-gray-400">
              <span>sgex:</span>
              <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={d.logGSgexOk} onChange={()=>set('logGSgexOk',true)} className="accent-brand" />양호</label>
              <label className="flex items-center gap-1 cursor-pointer text-gray-300"><input type="radio" checked={!d.logGSgexOk} onChange={()=>set('logGSgexOk',false)} className="accent-brand" />에러</label>
            </div>
          </div>
        )}
      </FS>
    </>
  );
}

function FormOTP({ d, set, setOTP }: { d: D; set: any; setOTP: any }) {
  return (
    <>
      <FS title="OTP 기기현황">
        {d.otpDevices.map((dev, i) => (
          <div key={i} className="grid grid-cols-5 gap-1">
            <input className="input text-[10px] px-1 py-0.5" placeholder="모델명" value={dev.model} onChange={e=>setOTP(i,'model',e.target.value)} />
            <input className="input text-[10px] px-1 py-0.5 col-span-2" placeholder="일련번호" value={dev.serial} onChange={e=>setOTP(i,'serial',e.target.value)} />
            <input className="input text-[10px] px-1 py-0.5" placeholder="만료일" value={dev.expDate} onChange={e=>setOTP(i,'expDate',e.target.value)} />
            <input className="input text-[10px] px-1 py-0.5" placeholder="수량" value={dev.qty} onChange={e=>setOTP(i,'qty',e.target.value)} />
          </div>
        ))}
      </FS>
      <FS title="기타 버전 정보">
        <div className="space-y-2">
          {([['kernelVer','kernel'],['pgVer','PostgreSQL'],['tomcatVer','Tomcat'],['accountSync','계정동기화여부'],['smsInteg','SMS연동'],['emailInteg','Email연동'],['jarVer','공통jar 버전']] as [keyof D, string][]).map(([k,l])=>(
            <FL key={String(k)} label={l}><input className="input text-xs" value={d[k] as string} onChange={e=>set(k,e.target.value)} /></FL>
          ))}
        </div>
      </FS>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PREVIEW PAGES
// ════════════════════════════════════════════════════════════════════════════════

function PreviewPage1({ d, project }: { d: D; project: Project }) {
  const INSP_TYPES = [['regular','정기점검'],['temporary','임시점검'],['recovery','시스템복구'],['other','기타']];
  return (
    <PdfPage>
      {/* 제목 */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold tracking-wider">MFA(OTP) Server Inspection Report</h1>
      </div>

      {/* 고객정보 */}
      <table className="w-full border-collapse text-xs mb-1">
        <tbody>
          <tr><BH colSpan={6}>고객사정보</BH></tr>
          <tr>
            <BL>고객사명</BL>
            <td colSpan={2} className="border border-gray-400 px-2 py-1">{d.clientName}</td>
            <BL>서 버 버 전</BL>
            <td colSpan={2} className="border border-gray-400 px-2 py-1">
              인증서버: {d.verAuth} &nbsp;&nbsp; 중계서버: {d.verRelay}
            </td>
          </tr>
          <tr>
            <BL>점검구분</BL>
            <td colSpan={5} className="border border-gray-400 px-2 py-1">
              {INSP_TYPES.map(([v,l])=>(
                <span key={v} className="mr-4">{d.inspType===v?'■':'□'}{l}{v==='other'&&d.inspTypeOther?`(${d.inspTypeOther})`:''}</span>
              ))}
            </td>
          </tr>
          <tr>
            <BL>점검장소</BL>
            <td colSpan={5} className="border border-gray-400 px-2 py-1">{d.inspPlace}</td>
          </tr>
          <tr>
            <BL>점검일시</BL>
            <td colSpan={5} className="border border-gray-400 px-2 py-1">
              {d.inspYear}년 {d.inspMonth}월 {d.inspDay}일&nbsp;
              {d.inspStartH}시 {d.inspStartM}분 ~ {d.inspEndH}시 {d.inspEndM}분&nbsp;
              (점검소요시간: {d.durH}시간 {d.durM}분)
            </td>
          </tr>
          <tr>
            <BL>Server License</BL>
            <td className="border border-gray-400 px-2 py-1">{d.license}</td>
            <BL>Current User</BL>
            <td className="border border-gray-400 px-2 py-1">{d.currentUser}</td>
            <BL>OTP 기기수량</BL>
            <td className="border border-gray-400 px-2 py-1">{d.otpCount}</td>
          </tr>
        </tbody>
      </table>

      {/* Server Information */}
      <PdfSectionTitle>Server Information</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-1">
        <thead>
          <tr>
            <BH w="60px">구분</BH><BH w="60px"></BH>
            <BH>HostName</BH><BH>IP Address</BH><BH>O/S</BH><BH>비고</BH>
          </tr>
        </thead>
        <tbody>
          {/* 인증서버 rows - 구성에 따라 다름 */}
          {d.serverCfg === 'ha_relay' ? (
            <>
              <tr>
                <td rowSpan={3} className="border border-gray-400 px-2 py-1 text-center align-middle font-medium">인증서버</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-medium">VIP</td>
                <td className="border border-gray-400 px-2 py-1">{d.authVip.hostname}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authVip.ip}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authVip.os}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authVip.note}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-2 py-1 text-center font-medium">Active</td>
                <td className="border border-gray-400 px-2 py-1">{d.authActive.hostname}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authActive.ip}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authActive.os}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authActive.note}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 px-2 py-1 text-center font-medium">StandBy</td>
                <td className="border border-gray-400 px-2 py-1">{d.authStandby.hostname}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authStandby.ip}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authStandby.os}</td>
                <td className="border border-gray-400 px-2 py-1">{d.authStandby.note}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td className="border border-gray-400 px-2 py-1 text-center font-medium">인증서버</td>
              <td className="border border-gray-400 px-2 py-1 text-center font-medium">Active</td>
              <td className="border border-gray-400 px-2 py-1">{d.authActive.hostname}</td>
              <td className="border border-gray-400 px-2 py-1">{d.authActive.ip}</td>
              <td className="border border-gray-400 px-2 py-1">{d.authActive.os}</td>
              <td className="border border-gray-400 px-2 py-1">{d.authActive.note}</td>
            </tr>
          )}
          {/* 중계서버 row */}
          {hasRelay(d.serverCfg) && (
            <tr>
              <td className="border border-gray-400 px-2 py-1 text-center font-medium">중계서버</td>
              <td className="border border-gray-400 px-2 py-1 text-center font-medium">Gateway</td>
              <td className="border border-gray-400 px-2 py-1">{d.relayGw.hostname}</td>
              <td className="border border-gray-400 px-2 py-1">{d.relayGw.ip}</td>
              <td className="border border-gray-400 px-2 py-1">{d.relayGw.os}</td>
              <td className="border border-gray-400 px-2 py-1">{d.relayGw.note}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Server Summary */}
      <PdfSectionTitle>Server Summary</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-1">
        <thead>
          <tr>
            <BH w="100px">유지보수(확인)대상</BH>
            <BH>점검사항</BH><BH>정상기준</BH><BH>점검결과</BH><BH>비고</BH>
          </tr>
        </thead>
        <tbody>
          {([
            ['sCpu','sCpuNote','CPU 사용량','80% 이하'],
            ['sMem','sMemNote','Memory 사용량','80% 이하'],
            ['sHdd','sHddNote','HDD 사용량','90% 이하'],
            ['sProc','sProcNote','Process 상태','Process 정상'],
            ['sNtp','sNtpNote','시간동기화 여부','현 시간'],
            ['sLogs','sLogsNote','Logs','이상로그 없음'],
          ] as [keyof D, keyof D, string, string][]).map(([rk,nk,label,std], i) => (
            <tr key={label}>
              {i===0 && <td rowSpan={6} className="border border-gray-400 px-2 py-1 text-center align-middle font-medium">OTP 인증시스템</td>}
              <td className="border border-gray-400 px-2 py-1">{label}</td>
              <td className="border border-gray-400 px-2 py-1 text-center text-gray-600">{std}</td>
              <td className={clsx('border border-gray-400 px-2 py-1 text-center font-semibold',
                (d[rk] as RPN)==='pass'?'text-green-700':'text-red-600')}>
                {(d[rk] as RPN)==='pass'?'정상':'비정상'}
              </td>
              <td className="border border-gray-400 px-2 py-1 text-gray-600">{d[nk] as string}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 특이사항 / 패치권고사항 */}
      <table className="w-full border-collapse text-xs mb-1">
        <tbody>
          <tr>
            <BH w="50%">특이사항</BH>
            <BH w="50%">패치권고사항</BH>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 h-24 align-top whitespace-pre-wrap">{d.issues}</td>
            <td className="border border-gray-400 px-2 py-1 h-24 align-top whitespace-pre-wrap">{d.patchRec}</td>
          </tr>
        </tbody>
      </table>

      {/* 유지보수 점검 확인 */}
      <PdfSectionTitle>유지보수 점검 확인</PdfSectionTitle>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td rowSpan={3} className="border border-gray-400 px-2 py-1 text-center font-bold align-middle w-12" style={{writingMode:'vertical-rl' as any, textOrientation:'mixed' as any}}>보수업체</td>
            <BL w="60px">업체명</BL>
            <td className="border border-gray-400 px-2 py-1">{d.vendorCompany}</td>
            <BL w="60px">담당팀</BL>
            <td className="border border-gray-400 px-2 py-1">{d.clientTeam}</td>
          </tr>
          <tr>
            <BL>성명</BL>
            <td className="border border-gray-400 px-2 py-1">
              <div className="flex items-center gap-3">
                <span>{d.vendorName}</span>
                <SignBox sign={d.vendorSign} />
              </div>
            </td>
            <BL>성명</BL>
            <td className="border border-gray-400 px-2 py-1">
              <div className="flex items-center gap-3">
                <span>{d.clientSignName}</span>
                <SignBox sign={d.clientSign} />
              </div>
            </td>
          </tr>
          <tr>
            <BL>연락처</BL>
            <td className="border border-gray-400 px-2 py-1">{d.vendorContact}</td>
            <BL>연락처</BL>
            <td className="border border-gray-400 px-2 py-1">{d.clientContact}</td>
          </tr>
        </tbody>
      </table>
    </PdfPage>
  );
}

function PreviewPage2({ d }: { d: D }) {
  const nodes = getNodes(d.serverCfg);
  const authNodes = nodes.filter(n => n !== 'G') as Array<'A'|'S'>;
  return (
    <PdfPage>
      {/* Process Inspection */}
      <PdfSectionTitle>Process Inspection</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-3">
        <tbody>
          <tr><BH colSpan={2}>Command</BH><td colSpan={5} className="border border-gray-400 px-2 py-1 font-mono">/grippin/bin/mon.sh</td></tr>
          {authNodes.map(node => {
            const rk = `proc${node}Result` as keyof D;
            const ak = `proc${node}Action` as keyof D;
            const pk = `proc${node}` as 'procA'|'procS';
            const csK = `drbd${node}cs` as keyof D;
            const roK = `drbd${node}ro` as keyof D;
            const dsK = `drbd${node}ds` as keyof D;
            return [
              <tr key={`${node}-result`}>
                <td rowSpan={PROCS.length + 3} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">{node}</td>
                <BH>Result</BH>
                <td colSpan={5} className="border border-gray-400 px-2 py-1">
                  <R3Check val={d[rk] as R3} /> &nbsp; (조치사항: {d[ak] as string})
                </td>
              </tr>,
              <tr key={`${node}-header`}>
                <BH>Process</BH><BH>Status</BH><BH>%CPU</BH><BH>%MEM</BH><BH colSpan={2}>비 고</BH>
              </tr>,
              ...d[pk].map((p: ProcRow, i: number) => (
                <tr key={`${node}-${i}`}>
                  <td className="border border-gray-400 px-2 py-0.5">{p.name}</td>
                  <td className={clsx('border border-gray-400 px-2 py-0.5 text-center font-medium', p.status==='RUN'?'text-green-700':'text-red-600')}>{p.status}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-center">{p.cpu}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-center">{p.mem}</td>
                  <td colSpan={2} className="border border-gray-400 px-2 py-0.5">{p.note}</td>
                </tr>
              )),
              <tr key={`${node}-drbd`}>
                <td colSpan={2} className="border border-gray-400 px-2 py-0.5 text-center font-medium bg-gray-50">DRBD</td>
                <td className="border border-gray-400 px-2 py-0.5 text-center">CS: {d[csK] as string}</td>
                <td className="border border-gray-400 px-2 py-0.5 text-center">ro: {d[roK] as string}</td>
                <td colSpan={2} className="border border-gray-400 px-2 py-0.5 text-center">ds: {d[dsK] as string}</td>
              </tr>,
            ];
          })}
          {/* Gateway Process - 중계서버 있을 때만 */}
          {hasRelay(d.serverCfg) && [
            <tr key="g-cmd">
              <td rowSpan={4} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">G</td>
              <BH>Command</BH>
              <td colSpan={5} className="border border-gray-400 px-2 py-1 font-mono">ps -ef | grep sgex, ps -ef | grep httpd</td>
            </tr>,
            <tr key="g-result">
              <BH>Result</BH>
              <td colSpan={5} className="border border-gray-400 px-2 py-1">
                <R3Check val={d.procGResult} /> &nbsp; (조치사항: {d.procGAction})
              </td>
            </tr>,
            <tr key="g-app">
              <BH>APP Type</BH>
              <td colSpan={5} className="border border-gray-400 px-2 py-1">
                {d.procGStatus==='RUN'?'■':'□'}RUN &nbsp; {d.procGStatus==='STOP'?'■':'□'}STOP (원인: {d.procGStopReason})
                <br />
                {d.procGAppType==='in-house'?'■':'□'}In-house &nbsp; {d.procGAppType==='market'?'■':'□'}Market (고객코드: {d.procGClientCode})
              </td>
            </tr>,
            <tr key="g-port">
              <BH>Port Check</BH>
              <td colSpan={5} className="border border-gray-400 px-2 py-1">
                {d.procGPort==='normal'?'■':'□'}정상 &nbsp; {d.procGPort==='abnormal'?'■':'□'}비정상
              </td>
            </tr>,
          ]}
        </tbody>
      </table>

      {/* Hardware Inspection - CPU */}
      <PdfSectionTitle>Hardware Inspection</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-3">
        <tbody>
          <tr><BH colSpan={2}>Command</BH><td colSpan={4} className="border border-gray-400 px-2 py-1 font-mono">top, vmstat</td></tr>
          {nodes.map(node => {
            const rk = `cpu${node}Result` as keyof D;
            const ak = `cpu${node}Action` as keyof D;
            const sk = `cpu${node}Sys` as keyof D;
            const ik = `cpu${node}Idle` as keyof D;
            return [
              <tr key={`cpu-${node}-r`}>
                <td rowSpan={2} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">{node}</td>
                <BH>Result</BH>
                <td colSpan={4} className="border border-gray-400 px-2 py-1"><R3Check val={d[rk] as R3} /> &nbsp; (조치사항: {d[ak] as string})</td>
              </tr>,
              <tr key={`cpu-${node}-v`}>
                <BH>use</BH>
                <td className="border border-gray-400 px-2 py-0.5 text-center"></td>
                <BH>system</BH>
                <td className="border border-gray-400 px-2 py-0.5 text-center">{d[sk] as string}</td>
                <td className="border border-gray-400 px-2 py-0.5 text-center"></td>
              </tr>,
            ];
          })}
        </tbody>
      </table>

    </PdfPage>
  );
}

function PreviewPageHDD({ d }: { d: D }) {
  const nodes = getNodes(d.serverCfg);
  return (
    <PdfPage>
      <PdfSectionTitle>Hardware Inspection — HDD</PdfSectionTitle>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr><BH colSpan={2}>Command</BH><td colSpan={5} className="border border-gray-400 px-2 py-1 font-mono">df -h</td></tr>
          {nodes.map(node => {
            const rk = `hdd${node}Result` as keyof D;
            const ak = `hdd${node}Action` as keyof D;
            const mk = `hdd${node}` as 'hddA'|'hddS'|'hddG';
            const mounts = (d[mk] as MountRow[]).filter(m => d.serverCfg === 'ha_relay' || m.path !== '/drbd');
            return [
              <tr key={`hdd-${node}-r`}>
                <td rowSpan={mounts.length + 2} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">{node}</td>
                <BH>Result</BH>
                <td colSpan={5} className="border border-gray-400 px-2 py-1"><R3Check val={d[rk] as R3} /> &nbsp; (조치사항: {d[ak] as string})</td>
              </tr>,
              <tr key={`hdd-${node}-h`}>
                <BH>Mounted</BH><BH>Used</BH><BH>Available</BH><BH>use%</BH><BH>비고</BH>
              </tr>,
              ...mounts.map((m: MountRow, i: number) => (
                <tr key={`hdd-${node}-${i}`}>
                  <td className="border border-gray-400 px-2 py-0.5">{m.path}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-center">{m.used}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-center">{m.avail}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-center">{m.usePct}</td>
                  <td className="border border-gray-400 px-2 py-0.5">{m.note}</td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </PdfPage>
  );
}

function PreviewPage3({ d }: { d: D }) {
  const nodes = getNodes(d.serverCfg);
  const authNodes = nodes.filter(n => n !== 'G') as Array<'A'|'S'>;
  return (
    <PdfPage>
      {/* Memory */}
      <table className="w-full border-collapse text-xs mb-3">
        <tbody>
          <tr><BH colSpan={2}>Command</BH><td colSpan={7} className="border border-gray-400 px-2 py-1 font-mono">free -g</td></tr>
          {nodes.map(node => {
            const rk = `mem${node}Result` as keyof D;
            const ak = `mem${node}Action` as keyof D;
            const mk = `mem${node}` as 'memA'|'memS'|'memG';
            const m = d[mk] as MemRow;
            return [
              <tr key={`mem-${node}-r`}>
                <td rowSpan={2} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">{node}</td>
                <BH>Result</BH>
                <td colSpan={7} className="border border-gray-400 px-2 py-1"><R3Check val={d[rk] as R3} /> &nbsp; (조치사항: {d[ak] as string})</td>
              </tr>,
              <tr key={`mem-${node}-v`}>
                <BH>Total</BH>
                <td className="border border-gray-400 px-2 py-0.5 text-center">{m.total}</td>
                <BH>used</BH>
                <td className="border border-gray-400 px-2 py-0.5 text-center">{m.used}</td>
                <BH>free</BH>
                <td className="border border-gray-400 px-2 py-0.5 text-center">{m.free}</td>
                <td className="border border-gray-400 px-2 py-0.5 text-center text-gray-500 text-[10px]">shared:{m.shared} bufs:{m.bufs} cached:{m.cached}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>

      {/* NTP Inspection */}
      <PdfSectionTitle>NTP Inspection</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-3">
        <tbody>
          <tr><BH colSpan={2}>Command</BH><td colSpan={4} className="border border-gray-400 px-2 py-1 font-mono">Date, ps -ef | grep ntpd</td></tr>
          {nodes.map(node => {
            const rk = `ntp${node}Result` as keyof D;
            const ak = `ntp${node}Action` as keyof D;
            const ik = `ntp${node}Ip` as keyof D;
            const ok = `ntp${node}Ok` as keyof D;
            const ofk = `ntp${node}Offset` as keyof D;
            const runk = `ntp${node}Running` as keyof D;
            return [
              <tr key={`ntp-${node}-r`}>
                <td rowSpan={3} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">{node}</td>
                <BH>Result</BH>
                <td colSpan={4} className="border border-gray-400 px-2 py-1"><R3Check val={d[rk] as R3} /> &nbsp; (조치사항: {d[ak] as string})</td>
              </tr>,
              <tr key={`ntp-${node}-ip`}>
                <BH>IP/URL</BH>
                <td className="border border-gray-400 px-2 py-0.5">{d[ik] as string}</td>
                <BH>시간오차</BH>
                <td className="border border-gray-400 px-2 py-0.5">
                  {(d[ok] as boolean)?'■':'□'}정상 &nbsp; {!(d[ok] as boolean)?'■':'□'}오차발생({d[ofk] as string}분)
                </td>
              </tr>,
              <tr key={`ntp-${node}-proc`}>
                <BH>process</BH>
                <td colSpan={3} className="border border-gray-400 px-2 py-0.5">
                  {(d[runk] as boolean)?'■':'□'}실행중 &nbsp; {!(d[runk] as boolean)?'■':'□'}사용안함
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>

      {/* System Log Inspection */}
      <PdfSectionTitle>System Log Inspection</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-3">
        <tbody>
          <tr><BH colSpan={2}>Command</BH><td colSpan={2} className="border border-gray-400 px-2 py-1 font-mono">tail -f [log file name]</td></tr>
          {authNodes.map(node => {
            const rk = `log${node}Result` as keyof D;
            const ak = `log${node}Action` as keyof D;
            const authOk = `log${node}AuthOk` as keyof D;
            const authErr = `log${node}AuthErr` as keyof D;
            const syncRun = `log${node}SyncRunning` as keyof D;
            return [
              <tr key={`log-${node}-r`}>
                <td rowSpan={3} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">{node}</td>
                <BH>Result</BH>
                <td colSpan={2} className="border border-gray-400 px-2 py-1"><R3Check val={d[rk] as R3} /> &nbsp; (조치사항: {d[ak] as string})</td>
              </tr>,
              <tr key={`log-${node}-auth`}>
                <td className="border border-gray-400 px-2 py-0.5 text-gray-600">인증로그</td>
                <td className="border border-gray-400 px-2 py-0.5 font-mono text-[10px]">/grippin/logs/auth.log</td>
                <td className="border border-gray-400 px-2 py-0.5">
                  {(d[authOk] as boolean)?'■':'□'}양호 &nbsp; {!(d[authOk] as boolean)?'■':'□'}에러({d[authErr] as string})
                </td>
              </tr>,
              <tr key={`log-${node}-sync`}>
                <td className="border border-gray-400 px-2 py-0.5 text-gray-600">계정동기화</td>
                <td className="border border-gray-400 px-2 py-0.5 font-mono text-[10px]">/grippin/logs/sync.log</td>
                <td className="border border-gray-400 px-2 py-0.5">
                  {(d[syncRun] as boolean)?'■':'□'}실행중 &nbsp; {!(d[syncRun] as boolean)?'■':'□'}사용안함
                </td>
              </tr>,
            ];
          })}
          {/* Gateway logs - 중계서버 있을 때만 */}
          {hasRelay(d.serverCfg) && [
            <tr key="glog-r">
              <td rowSpan={3} className="border border-gray-400 px-1 text-center font-bold align-middle w-8">G</td>
              <BH>Result</BH>
              <td colSpan={2} className="border border-gray-400 px-2 py-1"><R3Check val={d.logGResult} /> &nbsp; (조치사항: {d.logGAction})</td>
            </tr>,
            <tr key="glog-access">
              <td className="border border-gray-400 px-2 py-0.5 text-gray-600">인증로그</td>
              <td className="border border-gray-400 px-2 py-0.5 font-mono text-[10px]">/grippin/motpgw/logs/access.log</td>
              <td className="border border-gray-400 px-2 py-0.5">{d.logGAccessOk?'■':'□'}양호 &nbsp; {!d.logGAccessOk?'■':'□'}에러({d.logGAccessErr})</td>
            </tr>,
            <tr key="glog-sgex">
              <td className="border border-gray-400 px-2 py-0.5 text-gray-600">sgex</td>
              <td className="border border-gray-400 px-2 py-0.5 font-mono text-[10px]">/grippin/motpgw/logs/mgex.log</td>
              <td className="border border-gray-400 px-2 py-0.5">{d.logGSgexOk?'■':'□'}양호 &nbsp; {!d.logGSgexOk?'■':'□'}에러({d.logGSgexErr})</td>
            </tr>,
          ]}
        </tbody>
      </table>

      {/* OTP Registration */}
      <PdfSectionTitle>OTP Registration</PdfSectionTitle>
      <table className="w-full border-collapse text-xs mb-3">
        <thead>
          <tr>
            <BH w="80px">구분</BH>
            <BH>모델명</BH><BH>일련번호</BH><BH>등록일</BH><BH>만료일</BH><BH>수량</BH>
          </tr>
        </thead>
        <tbody>
          {d.otpDevices.map((dev, i) => (
            <tr key={i}>
              {i===0 && <td rowSpan={d.otpDevices.length} className="border border-gray-400 px-2 py-1 text-center align-middle font-medium">OTP기기현황</td>}
              <td className="border border-gray-400 px-2 py-1">{dev.model}</td>
              <td className="border border-gray-400 px-2 py-1 font-mono text-[10px]">{dev.serial}</td>
              <td className="border border-gray-400 px-2 py-1 text-center">{dev.regDate}</td>
              <td className="border border-gray-400 px-2 py-1 text-center">{dev.expDate}</td>
              <td className="border border-gray-400 px-2 py-1 text-center">{dev.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 기타 */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td rowSpan={7} className="border border-gray-400 px-2 py-1 text-center font-bold align-middle w-12">기타</td>
            <td colSpan={2} className="border border-gray-400 px-2 py-1">kernel: {d.kernelVer}</td>
          </tr>
          <tr><td colSpan={2} className="border border-gray-400 px-2 py-1">Postgresql: {d.pgVer}</td></tr>
          <tr><td colSpan={2} className="border border-gray-400 px-2 py-1">tomcat: {d.tomcatVer}</td></tr>
          <tr><td colSpan={2} className="border border-gray-400 px-2 py-1">계정동기화여부: {d.accountSync}</td></tr>
          <tr><td colSpan={2} className="border border-gray-400 px-2 py-1">sms연동여부 및 설정: {d.smsInteg}</td></tr>
          <tr><td colSpan={2} className="border border-gray-400 px-2 py-1">email 연동여부: {d.emailInteg}</td></tr>
          <tr><td colSpan={2} className="border border-gray-400 px-2 py-1">공통jar 버전: {d.jarVer}</td></tr>
        </tbody>
      </table>
    </PdfPage>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ════════════════════════════════════════════════════════════════════════════════

function PdfPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="print-page bg-white shadow-lg w-[210mm] mx-auto p-[12mm] text-gray-900 text-[11px] leading-snug">
      {children}
    </div>
  );
}

function PdfSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center font-bold text-sm underline my-2">{children}</div>
  );
}

function BH({ children, colSpan, w }: { children?: React.ReactNode; colSpan?: number; w?: string }) {
  return (
    <th colSpan={colSpan}
      className="border border-gray-400 px-2 py-1 text-center font-semibold text-xs"
      style={{ backgroundColor: '#dce6f1', width: w }}>
      {children}
    </th>
  );
}

// 서명란: (인) 위에 서명 이미지 오버레이
function SignBox({ sign }: { sign: string }) {
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56 }}>
      {/* (인) 항상 표시 */}
      <span className="text-gray-400 text-xs select-none z-0">(인)</span>
      {/* 서명 이미지: image-rendering: pixelated 방지 위해 smooth 처리 */}
      {sign && (
        <img
          src={sign}
          alt="서명"
          className="absolute inset-0 w-full h-full z-10"
          style={{ objectFit: 'contain', imageRendering: 'auto', mixBlendMode: 'multiply' }}
        />
      )}
    </div>
  );
}

function BL({ children, w }: { children?: React.ReactNode; w?: string }) {
  return (
    <td style={{ backgroundColor: '#dce6f1', width: w }}
      className="border border-gray-400 px-2 py-1 font-semibold text-xs whitespace-nowrap">
      {children}
    </td>
  );
}

function R3Check({ val }: { val: R3 }) {
  return (
    <span>
      {val==='양호'?'■':'□'}양호 &nbsp;
      {val==='점검'?'■':'□'}점검 &nbsp;
      {val==='불량'?'■':'□'}불량
    </span>
  );
}

function ResultRow3({ label, val, action, onChange, onActionChange }:
  { label: string; val: R3; action: string; onChange: (v:R3)=>void; onActionChange:(v:string)=>void }) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <span className="text-[10px] text-gray-400 w-10">{label}:</span>
      {(['양호','점검','불량'] as R3[]).map(v=>(
        <label key={v} className="flex items-center gap-1 text-xs cursor-pointer text-gray-300">
          <input type="radio" checked={val===v} onChange={()=>onChange(v)} className="accent-brand" />{v}
        </label>
      ))}
      <input className="input text-[10px] flex-1 min-w-24" placeholder="조치사항" value={action} onChange={e=>onActionChange(e.target.value)} />
    </div>
  );
}

function FS({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-gray-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
