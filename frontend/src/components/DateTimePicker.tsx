'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from 'lucide-react';

const inp = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all";

const MONTHS_UK = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
];
const DAYS_UK = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

// ── DatePicker ────────────────────────────────────────────────────────────────
export function DatePicker({
  value, onChange, placeholder = 'ДД.ММ.РРРР',
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split('-')[0]));
      setViewMonth(parseInt(value.split('-')[1]) - 1);
    }
  }, [value]);

  const selectedYear = value ? parseInt(value.split('-')[0]) : null;
  const selectedMonth = value ? parseInt(value.split('-')[1]) - 1 : null;
  const selectedDay = value ? parseInt(value.split('-')[2]) : null;

  // Build calendar grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = (firstDow === 0 ? 6 : firstDow - 1); // Mon-based
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const select = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const displayValue = value
    ? `${String(selectedDay).padStart(2,'0')}.${String((selectedMonth??0)+1).padStart(2,'0')}.${selectedYear}`
    : '';

  return (
    <div ref={ref} className="relative w-full">
      {/* Input */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={inp + " flex items-center justify-between cursor-pointer text-left"}
      >
        <span className={displayValue ? 'text-(--t1)' : 'text-(--t2)/50'}>{displayValue || placeholder}</span>
        <CalendarDays className="w-4 h-4 text-(--t2) flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-72 bg-(--card) border border-(--brd) rounded-2xl shadow-xl p-4 left-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-(--bg) text-(--t2) hover:text-(--t1) transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-(--t1)">{MONTHS_UK[viewMonth]}</span>
              <input
                type="number"
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                className="w-16 text-center text-sm font-black bg-(--bg) border border-(--brd) rounded-lg px-1 py-0.5 text-(--t1) outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-(--bg) text-(--t2) hover:text-(--t1) transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_UK.map(d => (
              <div key={d} className="text-center text-[10px] font-black uppercase text-(--t2) py-1">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              const isSelected = day !== null && day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear;
              const isToday = day !== null && new Date().getDate() === day && new Date().getMonth() === viewMonth && new Date().getFullYear() === viewYear;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={day === null}
                  onClick={() => day && select(day)}
                  className={`h-8 w-full rounded-xl text-xs font-bold transition-all active:scale-90 ${
                    day === null ? '' :
                    isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' :
                    isToday ? 'border border-blue-500/50 text-blue-500 hover:bg-blue-500/10' :
                    'hover:bg-(--bg) text-(--t1)'
                  }`}
                >
                  {day ?? ''}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-3 w-full text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors"
            >
              Очистити
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── TimePicker ────────────────────────────────────────────────────────────────
export function TimePicker({
  value, onChange, placeholder = '— : —',
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hours = value ? parseInt(value.split(':')[0]) : null;
  const minutes = value ? parseInt(value.split(':')[1]) : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setH = (h: number) => {
    const m = String(minutes ?? 0).padStart(2, '0');
    onChange(`${String(h).padStart(2,'0')}:${m}`);
  };
  const setM = (m: number) => {
    const h = String(hours ?? 0).padStart(2, '0');
    onChange(`${h}:${String(m).padStart(2,'0')}`);
  };

  const displayValue = value
    ? `${String(hours).padStart(2,'0')} : ${String(minutes).padStart(2,'0')}`
    : '';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={inp + " flex items-center justify-between cursor-pointer text-left"}
      >
        <span className={displayValue ? 'text-(--t1)' : 'text-(--t2)/50'}>{displayValue || placeholder}</span>
        <Clock className="w-4 h-4 text-(--t2) flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 bg-(--card) border border-(--brd) rounded-2xl shadow-xl p-4 left-0 w-56">
          <div className="flex gap-3 items-start">
            {/* Hours */}
            <div className="flex flex-col flex-1">
              <span className="text-[10px] font-black uppercase text-(--t2) text-center mb-2">Год</span>
              <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setH(i)}
                    className={`py-1.5 rounded-xl text-sm font-bold transition-all ${
                      hours === i ? 'bg-blue-600 text-white' : 'hover:bg-(--bg) text-(--t1)'
                    }`}
                  >
                    {String(i).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xl font-black text-(--t2) mt-7">:</div>
            {/* Minutes */}
            <div className="flex flex-col flex-1">
              <span className="text-[10px] font-black uppercase text-(--t2) text-center mb-2">Хв</span>
              <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {Array.from({ length: 60 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setM(i)}
                    className={`py-1.5 rounded-xl text-sm font-bold transition-all ${
                      minutes === i ? 'bg-blue-600 text-white' : 'hover:bg-(--bg) text-(--t1)'
                    }`}
                  >
                    {String(i).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-3 w-full text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors"
            >
              Очистити
            </button>
          )}
        </div>
      )}
    </div>
  );
}
