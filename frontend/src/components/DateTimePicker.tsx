'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from 'lucide-react';

const inp = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all";

const MONTHS_UK = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
];
const DAYS_UK = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

// ── Portal position hook ───────────────────────────────────────────────────────
function useDropdownPosition(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const recalc = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX });
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;
    recalc();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open, recalc]);

  return pos;
}

// ── Date mask helpers ──────────────────────────────────────────────────────────
function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let result = '';
  if (digits.length > 0) result += digits.slice(0, 2);
  if (digits.length > 2) result += '.' + digits.slice(2, 4);
  if (digits.length > 4) result += '.' + digits.slice(4, 8);
  return result;
}

function parseMaskedDate(masked: string): string {
  const parts = masked.split('.');
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return '';
  const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
  if (m < 1 || m > 12) return '';
  const maxDay = new Date(y, m, 0).getDate();
  if (d < 1 || d > maxDay) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

// ── Time mask helpers ──────────────────────────────────────────────────────────
function applyTimeMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  let result = '';
  if (digits.length > 0) result += digits.slice(0, 2);
  if (digits.length > 2) result += ':' + digits.slice(2, 4);
  return result;
}

function parseMaskedTime(masked: string): string {
  const parts = masked.split(':');
  if (parts.length !== 2) return '';
  const [hh, mm] = parts;
  if (hh.length !== 2 || mm.length !== 2) return '';
  const h = parseInt(hh), m = parseInt(mm);
  if (isNaN(h) || isNaN(m)) return '';
  if (h < 0 || h > 23 || m < 0 || m > 59) return '';
  return `${hh}:${mm}`;
}

// ── DatePicker ────────────────────────────────────────────────────────────────
export function DatePicker({
  value, onChange, placeholder = 'ДД.ММ.РРРР',
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(() => formatDisplayDate(value));
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth());

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(wrapperRef, open);

  useEffect(() => {
    setInputText(formatDisplayDate(value));
    if (value) {
      setViewYear(parseInt(value.split('-')[0]));
      setViewMonth(parseInt(value.split('-')[1]) - 1);
    }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedYear = value ? parseInt(value.split('-')[0]) : null;
  const selectedMonth = value ? parseInt(value.split('-')[1]) - 1 : null;
  const selectedDay = value ? parseInt(value.split('-')[2]) : null;

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const newVal = `${viewYear}-${m}-${d}`;
    onChange(newVal);
    setInputText(formatDisplayDate(newVal));
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

      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const masked = applyDateMask(e.target.value);
        setInputText(masked);
        const parsed = parseMaskedDate(masked);
        if (parsed) {
          onChange(parsed);
          setViewYear(parseInt(parsed.split('-')[0]));
          setViewMonth(parseInt(parsed.split('-')[1]) - 1);
        } else if (masked === '') {
          onChange('');
        }
      };

      return (
        <div ref={wrapperRef} className="relative w-full">
        {/* Input row — text field + calendar icon button */}
        <div className={inp + " flex items-center gap-2 pr-3 !py-0"}>
        <input
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        maxLength={10}
        className="flex-1 bg-transparent outline-none py-3 text-sm font-medium text-(--t1) placeholder:text-(--t2)/50 min-w-0"
        />
        <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen(o => !o)}
        className="flex-shrink-0 text-(--t2) hover:text-(--t1) transition-colors"
        >
        <CalendarDays className="w-4 h-4" />
        </button>
        </div>

        {open && typeof window !== 'undefined' && createPortal(
          <div
          ref={dropdownRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-72 bg-(--card) border border-(--brd) rounded-2xl shadow-xl p-4"
          >
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
              onClick={() => day && selectDay(day)}
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

          {value && (
            <button
            type="button"
            onClick={() => { onChange(''); setInputText(''); setOpen(false); }}
            className="mt-3 w-full text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors"
            >
            Очистити
            </button>
          )}
          </div>,
          document.body
        )}
        </div>
      );
}

// ── TimePicker ────────────────────────────────────────────────────────────────
export function TimePicker({
  value, onChange, placeholder = '— : —',
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value || '');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(wrapperRef, open);

  const hours = value ? parseInt(value.split(':')[0]) : null;
  const minutes = value ? parseInt(value.split(':')[1]) : null;

  useEffect(() => {
    setInputText(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setH = (h: number) => {
    const m = String(minutes ?? 0).padStart(2, '0');
    const newVal = `${String(h).padStart(2, '0')}:${m}`;
    onChange(newVal);
    setInputText(newVal);
  };
  const setM = (m: number) => {
    const h = String(hours ?? 0).padStart(2, '0');
    const newVal = `${h}:${String(m).padStart(2, '0')}`;
    onChange(newVal);
    setInputText(newVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyTimeMask(e.target.value);
    setInputText(masked);
    const parsed = parseMaskedTime(masked);
    if (parsed) {
      onChange(parsed);
    } else if (masked === '') {
      onChange('');
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
    <div className={inp + " flex items-center gap-2 pr-3 !py-0"}>
    <input
    type="text"
    value={inputText}
    onChange={handleInputChange}
    onFocus={() => setOpen(true)}
    onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
    placeholder={placeholder}
    maxLength={5}
    className="flex-1 bg-transparent outline-none py-3 text-sm font-medium text-(--t1) placeholder:text-(--t2)/50 min-w-0"
    />
    <button
    type="button"
    tabIndex={-1}
    onClick={() => setOpen(o => !o)}
    className="flex-shrink-0 text-(--t2) hover:text-(--t1) transition-colors"
    >
    <Clock className="w-4 h-4" />
    </button>
    </div>

    {open && typeof window !== 'undefined' && createPortal(
      <div
      ref={dropdownRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-(--card) border border-(--brd) rounded-2xl shadow-xl p-4 w-56"
      >
      <div className="flex gap-3 items-start">
      <div className="flex flex-col flex-1">
      <span className="text-[10px] font-black uppercase text-(--t2) text-center mb-2">Год</span>
      <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
      {Array.from({ length: 24 }, (_, i) => (
        <button key={i} type="button" onClick={() => setH(i)}
        className={`py-1.5 rounded-xl text-sm font-bold transition-all ${hours === i ? 'bg-blue-600 text-white' : 'hover:bg-(--bg) text-(--t1)'}`}>
        {String(i).padStart(2, '0')}
        </button>
      ))}
      </div>
      </div>
      <div className="text-xl font-black text-(--t2) mt-7">:</div>
      <div className="flex flex-col flex-1">
      <span className="text-[10px] font-black uppercase text-(--t2) text-center mb-2">Хв</span>
      <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
      {Array.from({ length: 60 }, (_, i) => (
        <button key={i} type="button" onClick={() => setM(i)}
        className={`py-1.5 rounded-xl text-sm font-bold transition-all ${minutes === i ? 'bg-blue-600 text-white' : 'hover:bg-(--bg) text-(--t1)'}`}>
        {String(i).padStart(2, '0')}
        </button>
      ))}
      </div>
      </div>
      </div>
      {value && (
        <button
        type="button"
        onClick={() => { onChange(''); setInputText(''); setOpen(false); }}
        className="mt-3 w-full text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-red-500 transition-colors"
        >
        Очистити
        </button>
      )}
      </div>,
      document.body
    )}
    </div>
  );
}
