'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bold, Italic, Underline, List, Quote, Type,
  Zap, Trophy, Clock, Users, Layers, ChevronRight, ArrowLeft, X, CalendarDays,
} from 'lucide-react';

import Sidebar from "@/components/Sidebar";
import { DatePicker, TimePicker } from "@/components/DateTimePicker";
import RoundSettingsPanel, { type RoundData } from "@/components/RoundSettingsPanel";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from '@/lib/supabase';

type AccessState = 'loading' | 'checking' | 'denied' | 'allowed';
const COUNTDOWN_SEC = 5;

const inp = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all";

function DateTimePair({
  label,
  dateVal, onDate,
  timeVal, onTime,
  required,
}: {
  label: string;
  dateVal: string; onDate: (v: string) => void;
  timeVal: string; onTime: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
    {required && (
      <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
      <Zap className="w-2.5 h-2.5 fill-red-500" /> Обов&apos;язково
      </span>
    )}
    </div>
    <DatePicker value={dateVal} onChange={onDate} />
    <TimePicker value={timeVal} onChange={onTime} />
    </div>
  );
}

export default function RegisterTourney() {
  const { dark } = useTheme();
  const { t } = useT();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);

  const [tourneyName, setTourneyName]     = useState('');
  const [description, setDescription]     = useState('');
  const [startDate, setStartDate]         = useState('');
  const [startTime, setStartTime]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [endTime, setEndTime]             = useState('');
  const [regStartDate, setRegStartDate]   = useState('');
  const [regStartTime, setRegStartTime]   = useState('');
  const [regEndDate, setRegEndDate]       = useState('');
  const [regEndTime, setRegEndTime]       = useState('');
  const [teamCount, setTeamCount]         = useState<number>(0);
  const [roundCount, setRoundCount]       = useState<number>(1);
  const [selectedRoundTab, setSelectedRoundTab] = useState<number>(1);
  const [roundsData, setRoundsData]       = useState<Record<number, RoundData>>({});
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (syntax: string, wrap = false) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const selected = description.slice(start, end);
    let newText: string;
    let newCursorStart: number;
    let newCursorEnd: number;
    if (wrap) {
      const wrapped = `${syntax}${selected || 'текст'}${syntax}`;
      newText = description.slice(0, start) + wrapped + description.slice(end);
      newCursorStart = selected ? start : start + syntax.length;
      newCursorEnd   = selected ? start + wrapped.length : start + syntax.length + 4;
    } else {
      const lineStart = description.lastIndexOf('\n', start - 1) + 1;
      const line = description.slice(lineStart, end);
      const alreadyApplied = line.startsWith(syntax);
      const newLine = alreadyApplied ? line.slice(syntax.length) : syntax + line;
      newText = description.slice(0, lineStart) + newLine + description.slice(lineStart + line.length);
      newCursorStart = newCursorEnd = alreadyApplied ? start - syntax.length : start + syntax.length;
    }
    setDescription(newText);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(newCursorStart, newCursorEnd); });
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/login'); return; }
    const allowed = user.role === 'admin' || user.role === 'superadmin';
    if (allowed) setAccessState('allowed');
    else { setAccessState('checking'); setCountdown(COUNTDOWN_SEC); }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (accessState !== 'checking') return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setAccessState('denied'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [accessState]);

  const handleConfirmYes = () => { if (timerRef.current) clearInterval(timerRef.current); setAccessState('denied'); };
  const handleConfirmNo  = () => { if (timerRef.current) clearInterval(timerRef.current); router.push('/login'); };

  // FIX (середній): компенсуємо timezone offset щоб локальний час зберігався як UTC.
  // new Date("2026-05-01T18:00:00") інтерпретується як LOCAL time браузером,
  // але .toISOString() повертає UTC — без компенсації час зміщується на UTC offset.
  const toTimestamp = (date: string, time: string): string | null => {
    if (!date) return null;
    const localStr = `${date}T${time || '00:00'}:00`;
    const localDate = new Date(localStr);
    // Компенсуємо різницю між локальним часом і UTC
    const offsetMs = localDate.getTimezoneOffset() * 60 * 1000;
    return new Date(localDate.getTime() + offsetMs).toISOString();
  };

  const API_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://site-turing-crutchmasters-team-s.onrender.com';

  // БАГ 6 fix: завантажуємо файли раундів через бекенд (service_role),
  // а не напряму через anon key — інакше приватний bucket поверне 403.
  // Повертає signed URL (10 років), який зберігаємо в attachments.
  const uploadFile = async (file: File, roundNumber: number): Promise<string> => {
    const token =
    (typeof window !== 'undefined' && localStorage.getItem('access_token')) || '';
    if (!token) throw new Error('Не вдалося отримати токен авторизації. Спробуйте увійти знову.');

    const form = new FormData();
    form.append('round_number', String(roundNumber));
    form.append('file', file);

    const res = await fetch(`${API_URL}/api/upload/round-file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Помилка завантаження файлу "${file.name}": ${err.detail ?? res.statusText}`);
    }
    const data = await res.json();
    // Бекенд повертає signed_url (довготривалий, service_role)
    return data.signed_url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!tourneyName.trim()) { setSubmitError("Назва турніру є обов'язковою"); return; }
    if (!startDate)          { setSubmitError("Дата старту турніру є обов'язковою"); return; }
    setIsSubmitting(true);
    try {
      // Формуємо масив раундів — файли спочатку завантажуємо в Storage
      const roundsPayload = await Promise.all(
        Array.from({ length: roundCount }, async (_, i) => {
          const n = i + 1;
          const rd = roundsData[n];

          // 1. Посилання (URL-рядки) → тип "link"
          const linkAttachments = (rd?.links ?? [])
          .filter(Boolean)
          .map((url, idx) => ({
            id: `link-${n}-${idx}`,
            name: url,
            url,
            type: 'link' as const,
          }));

          // 2. Файли → завантажуємо в Storage → тип "file"
          const fileAttachments: { id: string; name: string; url: string; type: 'file' }[] = [];
          // Guard: filter only real browser File instances to prevent "arrayBuffer is not a function"
          const rawFiles: File[] = ((rd as any)?.files ?? []).filter(
            (f: unknown) => f instanceof File
          );
          for (let fi = 0; fi < rawFiles.length; fi++) {
            const file = rawFiles[fi];
            const publicUrl = await uploadFile(file, n);
            fileAttachments.push({
              id: `file-${n}-${fi}`,
              name: file.name,
              url: publicUrl,
              type: 'file' as const,
            });
          }

          const attachments = [...linkAttachments, ...fileAttachments];

          return {
            number:       n,
            name:         rd?.name?.trim()                        || `Раунд ${n}`,
                   description:  rd?.description?.trim()                 || null,
                   criteria:     rd?.criteria?.filter(Boolean).join('\n')|| null,
                   technologies: rd?.requirements?.filter(Boolean)       ?? [],
                   start_at:     toTimestamp(rd?.startDate ?? '', rd?.startTime ?? '') ?? null,
                   end_at:       toTimestamp(rd?.deadlineDate ?? '', rd?.deadlineTime ?? '') ?? null,
                   // links — зберігаємо для зворотної сумісності
                   links:        linkAttachments,
                   // attachments — єдине поле що читає сторінка раунду
                   attachments,
                   status: 'pending',
          };
        })
      );

      // Явно передаємо p_rounds_data: null — Postgres вибере 8-параметрову версію
      // (без цього — "ambiguous overload" між 7- та 8-параметровою функцією)
      // Раунди вставляємо окремо нижче через supabase.from("rounds").insert(...)
      // FIX: передаємо p_end_at (кінець турніру) і p_created_by (fallback якщо auth.uid() null)
      const { data: tournamentId, error: rpcError } = await supabase.rpc("create_tournament", {
        p_name:              tourneyName.trim(),
                                                                         p_rules:             description.trim() || null,
                                                                         p_start_at:          toTimestamp(startDate, startTime),
                                                                         p_end_at:            toTimestamp(endDate, endTime) || null,
                                                                         p_registration_from: toTimestamp(regStartDate, regStartTime),
                                                                         p_registration_to:   toTimestamp(regEndDate, regEndTime),
                                                                         p_max_teams:         teamCount > 0 ? teamCount : null,
                                                                         p_rounds:            roundCount,
                                                                         p_rounds_data:       null,
                                                                         p_created_by:        user?.id ?? null,
      });
      if (rpcError) throw new Error(rpcError.message || rpcError.details || JSON.stringify(rpcError));
      if (!tournamentId) throw new Error('Турнір створено, але ID не повернуто');

      // Вставляємо раунди через бекенд (service_role) — anon key не має прав на INSERT в rounds (RLS 401)
      // БАГ 8 fix: перевіряємо ліміт constraint (1-8) перед відправкою
      if (roundsPayload.length > 8) {
        throw new Error('Максимальна кількість раундів — 8');
      }
      const token = (typeof window !== 'undefined' && localStorage.getItem('access_token')) || '';
      const roundsRes = await fetch(`${API_URL}/api/tournaments/${tournamentId}/rounds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rounds: roundsPayload }),
      });
      if (!roundsRes.ok) {
        const err = await roundsRes.json().catch(() => ({}));
        const errMsg: string = err.detail ?? JSON.stringify(err);
        if (errMsg.includes('rounds_number_check') || errMsg.includes('number_check')) {
          throw new Error('Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
        }
        throw new Error(`Турнір створено, але раунди не збережено: ${errMsg}`);
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Помилка створення турніру:', err?.message ?? err);
      // БАГ 8 fix: зрозуміле повідомлення про constraint раундів
      const msg: string = err?.message ?? '';
      if (msg.includes('rounds_number_check') || msg.includes('number_check')) {
        setSubmitError('Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
      } else if (msg.includes('Максимальна кількість раундів')) {
        setSubmitError(msg);
      } else {
        setSubmitError(msg || 'Виникла помилка. Спробуйте ще раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (accessState === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg)">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Checking ── */
  if (accessState === 'checking') {
    const progress = ((COUNTDOWN_SEC - countdown) / COUNTDOWN_SEC) * 100;
    const circumference = 2 * Math.PI * 28;
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-(--bg) text-(--t1)">
      <style>{`
        @keyframes fadeInModal { from{opacity:0;transform:scale(0.95) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes pulse-ring  { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.35)} 70%{box-shadow:0 0 0 14px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        .modal-card{animation:fadeInModal 0.4s cubic-bezier(.22,1,.36,1) both}
        .pulse-btn{animation:pulse-ring 1.4s ease-out infinite}
        `}</style>
        <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-3xl bg-red-500" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-3xl bg-orange-500" />
        </div>
        <div className="modal-card relative z-10 w-full max-w-md mx-4 bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-red-500/30 p-8">
        <div className="flex flex-col items-center mb-6">
        <div className="relative w-20 h-20 mb-4">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="4" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="#ef4444" strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference * (progress / 100)}
        style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-red-500">{countdown}</span>
        </div>
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-center mb-1 text-(--t1)">⚠️ Обмежений доступ</h2>
        <p className="text-sm text-center text-(--t2)">У вас немає прав для перегляду цієї сторінки</p>
        </div>
        <div className="h-px mb-6 bg-(--brd)" />
        <p className="text-base font-black uppercase tracking-tight text-center mb-2 text-(--t1)">Точно хочете переглянути цю сторінку?</p>
        <p className="text-xs text-center mb-6 text-(--t2)">
        Через <span className="font-black text-red-500">{countdown} сек</span> ви автоматично побачите, що чекає на порушників 🐇
        </p>
        <div className="flex gap-3">
        <button onClick={handleConfirmYes} className="pulse-btn flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-red-500 active:scale-95 transition-all">Так, показати</button>
        <button onClick={handleConfirmNo}  className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">Ні, піти</button>
        </div>
        <p className="text-center text-[10px] mt-4 text-(--t2) opacity-50">«Ні» → повернути на сторінку входу</p>
        </div>
        </div>
    );
  }

  /* ── Denied (403) ── */
  if (accessState === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-(--bg) text-(--t1)">
      <style>{`
        @keyframes glitch {
          0%  {clip-path:inset(0 0 95% 0);transform:translate(-4px,0) skewX(-1deg)}
          10% {clip-path:inset(60% 0 30% 0);transform:translate(4px,0) skewX(1deg)}
          20% {clip-path:inset(30% 0 60% 0);transform:translate(-2px,0)}
          30% {clip-path:inset(80% 0 5% 0);transform:translate(3px,0) skewX(-0.5deg)}
          40% {clip-path:inset(10% 0 85% 0);transform:translate(-3px,0)}
          50% {clip-path:inset(50% 0 45% 0);transform:translate(2px,0) skewX(1deg)}
          60% {clip-path:inset(20% 0 70% 0);transform:translate(-4px,0)}
          70% {clip-path:inset(70% 0 10% 0);transform:translate(4px,0) skewX(-1deg)}
          80% {clip-path:inset(40% 0 50% 0);transform:translate(-2px,0)}
          90% {clip-path:inset(5% 0 90% 0);transform:translate(3px,0)}
          100%{clip-path:inset(0 0 95% 0);transform:translate(0,0)}
        }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rabbit-fall { 0%{top:-80px;opacity:0;transform:translateX(-50%) rotate(0deg)} 30%{opacity:1} 100%{top:110%;opacity:0;transform:translateX(-50%) rotate(720deg)} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .glitch-text{position:relative}
        .glitch-text::before,.glitch-text::after{content:attr(data-text);position:absolute;inset:0;font:inherit;text-align:inherit}
        .glitch-text::before{color:#3b82f6;animation:glitch 2.5s infinite steps(1);animation-delay:0.1s}
        .glitch-text::after{color:#8b5cf6;animation:glitch 2.5s infinite steps(1);animation-delay:0.35s}
        .fade-up{animation:fadeSlideUp 0.6s cubic-bezier(.22,1,.36,1) both}
        .fade-up-1{animation:fadeSlideUp 0.6s cubic-bezier(.22,1,.36,1) 0.15s both}
        .fade-up-2{animation:fadeSlideUp 0.6s cubic-bezier(.22,1,.36,1) 0.3s both}
        .rabbit{position:fixed;left:50%;font-size:3rem;animation:rabbit-fall 3s ease-in 0.5s both;z-index:50}
        .scanline{position:fixed;inset:0;pointer-events:none;z-index:40;background:linear-gradient(transparent 50%,rgba(0,0,0,0.03) 50%);background-size:100% 4px}
        .scanline::after{content:'';position:absolute;left:0;right:0;height:60px;background:linear-gradient(transparent,rgba(59,130,246,0.04),transparent);animation:scanline 3s linear infinite}
        `}</style>
        <div className="scanline" />
        <div className="rabbit">🐇</div>
        <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.06] blur-3xl bg-blue-600" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06] blur-3xl bg-purple-600" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="glitch-text text-[120px] sm:text-[160px] font-black leading-none mb-4 select-none fade-up text-(--t1)" data-text="403" style={{ letterSpacing: '-0.05em' }}>403</div>
        <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-2 text-(--t1)">Ах ти хитрий шукач потаємних шляхів,</p>
        <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-8 text-blue-600">привіт від Білого Кролика 🐇</p>
        <p className="fade-up-2 text-xs font-black uppercase tracking-[0.3em] mb-10 text-(--t2)">Ця сторінка тільки для адміністраторів</p>
        <div className="fade-up-2 flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => router.push('/dashboard')} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20">← Повернутись на дашборд</button>
        <button onClick={() => router.push('/')} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">На головну</button>
        </div>
        </div>
        </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *    MAIN FORM (admin only)
   * ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style jsx global>{`
      @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
      @keyframes cardDrop { from{opacity:0;transform:translateY(-26px) scale(.97)} to{opacity:1;transform:none} }
      @keyframes slideInRight { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
      .fuIn  { animation: fadeUp      340ms cubic-bezier(.22,1,.36,1) both }
      .cdIn  { animation: cardDrop    500ms cubic-bezier(.22,1,.36,1) both }
      .sirIn { animation: slideInRight 400ms cubic-bezier(.22,1,.36,1) both }
      `}</style>

      {/* Watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
      <MobileHeader
      onOpenSidebar={() => setIsMobileSidebarOpen(true)}
      title={t.tourney?.create ?? 'Створення турніру'}
      icon={<Trophy size={18} className="text-blue-600" />}
      />

      <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
      <button onClick={() => router.push('/')} className="hover:text-blue-600 transition-colors">Головна</button>
      <ChevronRight size={10} />
      <button onClick={() => router.push('/dashboard')} className="hover:text-blue-600 transition-colors">Дашборд</button>
      <ChevronRight size={10} />
      <span className="text-(--t1)">{t.tourney?.createAdmin ?? 'Створення турніру'}</span>
      </nav>

      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
      <ArrowLeft size={14} /> Назад
      </button>

      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-(--t1) mb-8 sm:mb-10">
      {t.tourney?.createAdmin ?? 'Створення турніру'}
      </h1>

      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          display: none !important;
          opacity: 0 !important;
          width: 0 !important;
        }
        input[type="date"],
        input[type="time"] {
          -moz-appearance: textfield;
        }
        input[type="date"]::-moz-calendar-picker-indicator,
        input[type="time"]::-moz-calendar-picker-indicator {
          display: none !important;
        }
        `}</style>
        <form className="space-y-5" onSubmit={handleSubmit}>

        <div className="flex flex-col xl:flex-row gap-6 items-start w-full">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-5 w-full xl:flex-1 xl:min-w-0">

        {/* BLOCK 1: Загальна інформація */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Trophy size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">
        1. {t.tourney?.general ?? 'Загальна інформація'}
        </span>
        </div>
        <div className="p-6 sm:p-8 space-y-5">
        {/* Назва */}
        <div>
        <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.name ?? 'Назва турніру'}
        </label>
        <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
        <Zap className="w-2.5 h-2.5 fill-red-500" /> Обов'язково
        </span>
        </div>
        <input
        type="text"
        value={tourneyName}
        onChange={e => setTourneyName(e.target.value)}
        placeholder={t.tourney?.namePlaceholder ?? 'Назва турніру...'}
        className={inp}
        />
        </div>
        {/* Опис */}
        <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
        {t.tourney?.desc ?? 'Опис / Правила'}
        </label>
        <div className="border border-(--brd) rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-600 transition-all">
        <div className="border-b border-(--brd) px-4 py-2.5 flex items-center gap-1 bg-(--bg)/60 flex-wrap">
        {([
          { Icon: Bold,      label: 'Жирний',    action: () => applyFormat('**', true)   },
          { Icon: Italic,    label: 'Курсив',    action: () => applyFormat('*',  true)   },
          { Icon: Underline, label: 'Підкресл.', action: () => applyFormat('__', true)   },
          { Icon: List,      label: 'Список',    action: () => applyFormat('- ', false)  },
          { Icon: Quote,     label: 'Цитата',    action: () => applyFormat('> ', false)  },
          { Icon: Type,      label: 'Заголовок', action: () => applyFormat('## ', false) },
        ] as const).map(({ Icon, label, action }) => (
          <button key={label} type="button" onClick={action} title={label}
          className="p-2 rounded-xl hover:bg-(--card) text-(--t2) hover:text-blue-600 transition-all active:scale-90">
          <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        </div>
        <textarea
        ref={textareaRef}
        rows={5}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t.tourney?.descPlaceholder ?? 'Введіть опис турніру...'}
        className="w-full px-5 py-4 outline-none resize-y text-sm bg-transparent text-(--t1) placeholder:text-(--t2)/50"
        />
        </div>
        </div>
        </div>
        </section>

        {/* BLOCK 2: Реєстрація + Дати */}
        <section className="cdIn grid grid-cols-1 md:grid-cols-2 gap-5" style={{ animationDelay: '80ms' }}>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
        <Users size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">Реєстрація команд</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
        <DateTimePair label="Початок реєстрації" dateVal={regStartDate} onDate={setRegStartDate} timeVal={regStartTime} onTime={setRegStartTime} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label="Кінець реєстрації" dateVal={regEndDate} onDate={setRegEndDate} timeVal={regEndTime} onTime={setRegEndTime} />
        </div>
        </div>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Clock size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">Дати старту</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
        <DateTimePair label="Початок турніру" dateVal={startDate} onDate={setStartDate} timeVal={startTime} onTime={setStartTime} required />
        <div className="border-t border-(--brd)" />
        <DateTimePair label="Кінець турніру" dateVal={endDate} onDate={setEndDate} timeVal={endTime} onTime={setEndTime} />
        </div>
        </div>
        </section>

        {/* BLOCK 3: Формат + Команди */}
        <section className="cdIn grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch" style={{ animationDelay: '140ms' }}>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Layers size={14} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">3. Формат</span>
        <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1 whitespace-nowrap">
        <Zap className="w-2 h-2 fill-red-500" /> Обов'язково
        </span>
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Кількість раундів</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">
        Вибрано: <span className="text-blue-500">{roundCount}</span> {roundCount === 1 ? 'раунд' : roundCount < 5 ? 'раунди' : 'раундів'}
        </p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
          <button key={n} type="button"
          onClick={() => { setRoundCount(n); if (selectedRoundTab > n) setSelectedRoundTab(1); }}
          className={`h-10 rounded-xl font-black text-sm border transition-all duration-150 active:scale-90 ${
            n === roundCount
            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30'
            : n <= roundCount
            ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
            : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600'
          }`}>
          {n}
          </button>
        ))}
        </div>
        </div>
        </div>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
        <Users size={14} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">Команди</span>
        <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full whitespace-nowrap">
        {t.common?.optional ?? 'Опціонально'}
        </span>
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Кількість команд</p>
        <div className="flex items-center justify-center gap-3 flex-1">
        <button type="button"
        onClick={() => setTeamCount(Math.max(0, teamCount - 1))}
        className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">−</button>
        <input
        type="number"
        min={0}
        value={teamCount === 0 ? '' : teamCount}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          setTeamCount(isNaN(v) || v < 0 ? 0 : v);
        }}
        placeholder="∞"
        className="w-16 text-center text-2xl font-black bg-transparent outline-none text-(--t1) placeholder:text-(--t2)/60 border-b-2 border-(--brd) focus:border-blue-500 transition-colors tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button"
        onClick={() => setTeamCount(teamCount + 1)}
        className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">+</button>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-center">
        {[0, 8, 16, 32, 64].map(n => (
          <button key={n} type="button" onClick={() => setTeamCount(n)}
          className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest transition-all active:scale-95 ${
            teamCount === n
            ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30'
            : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600'
          }`}>
          {n === 0 ? 'Без ліміту' : n}
          </button>
        ))}
        </div>
        </div>
        </div>

        </section>

        {/* Action buttons */}
        <div className="cdIn flex flex-col sm:flex-row gap-3" style={{ animationDelay: '200ms' }}>
        <button type="submit" disabled={isSubmitting}
        className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {isSubmitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {isSubmitting ? 'Зберігається...' : (t.tourney?.createBtn ?? 'Створити турнір')}
        </button>
        <button type="button" onClick={() => router.back()} disabled={isSubmitting}
        className="flex-1 px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all disabled:opacity-60">
        {t.common?.cancel ?? 'Скасувати'}
        </button>
        </div>

        </div>
        {/* end LEFT COLUMN */}

        {/* ── RIGHT COLUMN ── */}
        <div className="w-full xl:sticky xl:top-6 xl:flex-1 xl:min-w-0">
        <RoundSettingsPanel
        roundCount={roundCount}
        selectedRound={selectedRoundTab}
        onSelectRound={setSelectedRoundTab}
        onRoundsChange={setRoundsData}
        />
        </div>

        </div>
        {/* end MAIN TWO-COLUMN LAYOUT */}

        {/* Error */}
        {submitError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-500">
          ⚠️ {submitError}
          </div>
        )}

        </form>
        </div>
        </main>
        </div>
  );
}
