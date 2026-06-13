'use client';

import { useState, useRef, useEffect } from 'react';
import {
  format, parse, isValid,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths,
  isSameDay, isSameMonth, isToday, isBefore, isAfter,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import clsx from 'clsx';

interface DatePickerProps {
  value: string;           // 'yyyy-MM-dd' or ''
  onChange: (v: string) => void;
  placeholder?: string;
  rangeStart?: string;     // highlight range
  rangeEnd?: string;
  disabled?: boolean;
}

export default function DatePicker({
  value, onChange, placeholder = '날짜 선택', rangeStart, rangeEnd, disabled,
}: DatePickerProps) {
  const [open,        setOpen]        = useState(false);
  const [viewDate,    setViewDate]    = useState<Date>(() => {
    if (value) { const d = parse(value, 'yyyy-MM-dd', new Date()); if (isValid(d)) return d; }
    return new Date();
  });
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // value 변경 시 viewDate 동기화
  useEffect(() => {
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(d)) setViewDate(d);
    }
  }, [value]);

  const selected  = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const rStart    = rangeStart ? parse(rangeStart, 'yyyy-MM-dd', new Date()) : null;
  const rEnd      = rangeEnd   ? parse(rangeEnd,   'yyyy-MM-dd', new Date()) : null;

  // 달력 날짜 배열 (앞뒤 빈칸 포함 6주)
  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewDate),     { weekStartsOn: 1 }),
  });

  const pickDay = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const displayLabel = selected && isValid(selected)
    ? format(selected, 'yyyy.MM.dd', { locale: ko })
    : null;

  return (
    <div ref={ref} className="relative">
      {/* 트리거 버튼 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={clsx(
          'group flex items-center gap-1.5 w-full px-2 py-1 rounded-lg text-xs transition-colors text-left',
          open
            ? 'bg-white/[0.07] text-gray-200'
            : 'bg-transparent hover:bg-white/[0.05] text-gray-400',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        <CalendarDays className={clsx(
          'w-3.5 h-3.5 flex-shrink-0 transition-colors',
          displayLabel ? 'text-brand' : 'text-gray-600 group-hover:text-gray-400',
        )} />
        <span className={clsx('flex-1 truncate', displayLabel ? 'text-gray-200' : 'text-gray-600')}>
          {displayLabel ?? placeholder}
        </span>
        {displayLabel && (
          <span
            onClick={clear}
            className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* 달력 팝오버 */}
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-xl shadow-2xl select-none"
          style={{
            background: '#0f1623',
            border: '1px solid rgba(255,255,255,0.1)',
            width: '260px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
            <button
              onClick={() => setViewDate(d => subMonths(d, 1))}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-gray-200">
              {format(viewDate, 'yyyy년 M월', { locale: ko })}
            </span>
            <button
              onClick={() => setViewDate(d => addMonths(d, 1))}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 px-2 pt-2 pb-1">
            {['월', '화', '수', '목', '금', '토', '일'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-600 py-1">{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
            {calDays.map(day => {
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelected     = selected && isValid(selected) && isSameDay(day, selected);
              const isTodayDate    = isToday(day);
              const inRange        = rStart && isValid(rStart) && rEnd && isValid(rEnd)
                ? isAfter(day, rStart) && isBefore(day, rEnd)
                : false;
              const isRangeStart   = rStart && isValid(rStart) && isSameDay(day, rStart);
              const isRangeEnd     = rEnd   && isValid(rEnd)   && isSameDay(day, rEnd);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => pickDay(day)}
                  className={clsx(
                    'relative flex items-center justify-center text-[11px] h-8 rounded-lg transition-colors font-medium',
                    !isCurrentMonth && 'text-gray-700',
                    isCurrentMonth && !isSelected && !inRange && !isRangeStart && !isRangeEnd && 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200',
                    (inRange) && 'bg-brand/10 text-brand rounded-none',
                    (isRangeStart && !isSelected) && 'bg-brand/10 text-brand rounded-l-lg rounded-r-none',
                    (isRangeEnd   && !isSelected) && 'bg-brand/10 text-brand rounded-r-lg rounded-l-none',
                    isSelected && 'bg-brand text-white shadow-lg shadow-brand/30 z-10',
                    isTodayDate && !isSelected && 'ring-1 ring-brand/40',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* 오늘 바로가기 */}
          <div className="border-t border-white/[0.06] px-3 py-2 flex justify-between items-center">
            <button
              onClick={() => pickDay(new Date())}
              className="text-[11px] text-brand hover:text-brand/80 transition-colors font-medium"
            >
              오늘
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
