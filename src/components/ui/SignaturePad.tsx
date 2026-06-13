'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2, PenLine, X, Check } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

// ── 실제 서명 캔버스 (모달 안에서 사용) ──────────────────────────────
function Canvas({ onConfirm, onCancel, initial }: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  initial: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const last      = useRef({ x: 0, y: 0 });
  const dpr       = useRef(1);
  const hasDrawn  = useRef(false);

  // 캔버스 초기화 (DPR 스케일 적용)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio   = window.devicePixelRatio || 1;
    dpr.current   = ratio;
    canvas.width  = canvas.offsetWidth  * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = '#111827';

    // 이전 서명 복원
    if (initial) {
      const img   = new Image();
      img.onload  = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      img.src     = initial;
      hasDrawn.current = true;
    }
  }, [initial]);

  const getPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const src    = 'touches' in e ? e.touches[0] : (e as MouseEvent);
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current  = true;
      last.current     = getPos(e);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d')!;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      last.current     = pos;
      hasDrawn.current = true;
    };
    const onUp = () => { drawing.current = false; };

    canvas.addEventListener('mousedown',  onDown, { passive: false });
    canvas.addEventListener('mousemove',  onMove, { passive: false });
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove',  onMove, { passive: false });
    canvas.addEventListener('touchend',   onUp);
    return () => {
      canvas.removeEventListener('mousedown',  onDown);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('mouseup',    onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove',  onMove);
      canvas.removeEventListener('touchend',   onUp);
    };
  }, [getPos]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = dpr.current;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width / r, canvas.height / r);
    hasDrawn.current = false;
  };

  const confirm = () => {
    if (!canvasRef.current) return;
    onConfirm(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">전자서명</span>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 안내 */}
      <p className="text-xs text-gray-400 text-center pt-4 px-4">아래 영역에 마우스 또는 손가락으로 서명해 주세요</p>

      {/* 서명 캔버스 */}
      <div className="flex-1 mx-5 my-3 relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        />
        {/* 서명 가이드 라인 */}
        <div className="absolute bottom-10 left-8 right-8 border-b border-gray-300 pointer-events-none" />
        <div className="absolute bottom-3 left-8 text-[10px] text-gray-300 pointer-events-none select-none">Sign here</div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3 px-5 pb-5">
        <button onClick={clear}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 text-sm transition-colors">
          <Trash2 className="w-4 h-4" /> 지우기
        </button>
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm transition-colors">
          취소
        </button>
        <button onClick={confirm}
          className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
          <Check className="w-4 h-4" /> 서명 완료
        </button>
      </div>
    </div>
  );
}

// ── 외부에 노출되는 SignaturePad (트리거 + 모달) ─────────────────────
export default function SignaturePad({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);

  const handleConfirm = (dataUrl: string) => {
    onChange(dataUrl);
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <>
      {/* 트리거 버튼 */}
      <div className="space-y-1">
        {label && (
          <label className="text-[10px] text-gray-500 flex items-center gap-1">
            <PenLine className="w-3 h-3" /> {label}
          </label>
        )}
        <button
          onClick={() => setOpen(true)}
          className="w-full h-16 rounded-lg border border-dashed border-gray-600 hover:border-brand hover:bg-brand/5 transition-colors relative overflow-hidden bg-white group"
        >
          {value ? (
            <>
              <img
                src={value}
                alt="서명"
                className="w-full h-full object-contain p-1"
                style={{ imageRendering: 'auto', mixBlendMode: 'multiply' }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-[10px] text-gray-600 bg-white/80 px-2 py-0.5 rounded">클릭하여 수정</span>
              </div>
            </>
          ) : (
            <span className="text-gray-400 text-xs flex items-center justify-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> 클릭하여 서명
            </span>
          )}
        </button>
        {value && (
          <button onClick={clear} className="text-[10px] text-gray-500 hover:text-red-400 flex items-center gap-0.5 transition-colors">
            <Trash2 className="w-3 h-3" /> 서명 지우기
          </button>
        )}
      </div>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 백드롭 */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          {/* 모달 패널 */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg"
               style={{ height: 420 }}>
            <Canvas
              onConfirm={handleConfirm}
              onCancel={() => setOpen(false)}
              initial={value}
            />
          </div>
        </div>
      )}
    </>
  );
}
