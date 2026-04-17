'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bold, Italic, Underline, List, Quote, Type,
  Zap, Trophy, Clock, Users, Layers, ChevronRight, ArrowLeft,
} from 'lucide-react';

import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from '@supabase/supabase-js';


type AccessState = 'loading' | 'checking' | 'denied' | 'allowed';

const COUNTDOWN_SEC = 5;

export default function RegisterTourney() {
  const { dark } = useTheme();
  const { t } = useT();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    }
  ), []);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const DRAFT_KEY = 'register_tourney_draft';
  const DRAFT_TTL = 5 * 60 * 1000; // 5 хвилин

  const loadDraft = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const { data, savedAt } = JSON.parse(raw);
      if (Date.now() - savedAt > DRAFT_TTL) { localStorage.removeItem(DRAFT_KEY); return null; }
      return data;
    } catch { return null; }
  };

  const draft = useMemo(() => loadDraft(), []);

  const [teamCount, setTeamCount] = useState<number>(draft?.teamCount ?? 0);
  const [roundCount, setRoundCount] = useState<number | null>(draft?.roundCount ?? null);

  // form fields
  const [tourneyName, setTourneyName] = useState(draft?.tourneyName ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');

  // datetime states: [date, time]
  const [startDate, setStartDate]   = useState(draft?.startDate ?? '');
  const [startTime, setStartTime]   = useState(draft?.startTime ?? '');
  const [regStartDate, setRegStartDate] = useState(draft?.regStartDate ?? '');
  const [regStartTime, setRegStartTime] = useState(draft?.regStartTime ?? '');
  const [regEndDate, setRegEndDate] = useState(draft?.regEndDate ?? '');
  const [regEndTime, setRegEndTime] = useState(draft?.regEndTime ?? '');

  // submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('register_tourney_draft');
      if (!raw) return false;
      const { savedAt } = JSON.parse(raw);
      return Date.now() - savedAt < 5 * 60 * 1000;
    } catch { return false; }
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Toolbar formatting ──
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
      // Bold (**text**), Italic (*text*), Underline (__text__)
      const wrapped = `${syntax}${selected || 'текст'}${syntax}`;
      newText = description.slice(0, start) + wrapped + description.slice(end);
      newCursorStart = selected ? start : start + syntax.length;
      newCursorEnd   = selected ? start + wrapped.length : start + syntax.length + 4;
    } else {
      // List (- ), Quote (> ), Heading (## )
      const lineStart = description.lastIndexOf('\n', start - 1) + 1;
      const line = description.slice(lineStart, end);
      const alreadyApplied = line.startsWith(syntax);
      const newLine = alreadyApplied ? line.slice(syntax.length) : syntax + line;
      newText = description.slice(0, lineStart) + newLine + description.slice(lineStart + line.length);
      newCursorStart = newCursorEnd = alreadyApplied
      ? start - syntax.length
      : start + syntax.length;
    }

    setDescription(newText);
    // Відновити фокус і позицію курсора
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCursorStart, newCursorEnd);
    });
  };

  // ── Draft persistence (5 хвилин) ──
  const saveDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      savedAt: Date.now(),
                                                   data: { tourneyName, description, startDate, startTime, regStartDate, regStartTime, regEndDate, regEndTime, teamCount, roundCount },
    }));
  }, [tourneyName, description, startDate, startTime, regStartDate, regStartTime, regEndDate, regEndTime, teamCount, roundCount]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') localStorage.removeItem(DRAFT_KEY);
  };

    useEffect(() => {
      saveDraft();
    }, [saveDraft]);

    useEffect(() => {
      if (isLoading) return;
      if (!user) { router.push('/login'); return; }
      const allowed = user.role === 'admin' || user.role === 'superadmin';
    if (allowed) { setAccessState('allowed'); }
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

    // ── Combine date + time into ISO timestamptz ──
    const toTimestamp = (date: string, time: string): string | null => {
      if (!date) return null;
      const t = time || '00:00';
      return new Date(`${date}T${t}:00`).toISOString();
    };

    // ── Submit handler ──
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!tourneyName.trim()) {
        setSubmitError('Назва турніру є обов\'язковою');
        return;
      }
      if (!startDate) {
        setSubmitError('Дата старту турніру є обов\'язковою');
        return;
      }
      if (!roundCount) {
        setSubmitError('Оберіть кількість раундів');
        return;
      }

      const start_at = toTimestamp(startDate, startTime);
      const registration_from = toTimestamp(regStartDate, regStartTime);
      const registration_to = toTimestamp(regEndDate, regEndTime);

      setIsSubmitting(true);
      try {
        const { data, error } = await supabase.rpc('create_tournament', {
          p_name: tourneyName.trim(),
                                                   p_rules: description.trim() || null,
                                                   p_start_at: start_at,
                                                   p_registration_from: registration_from,
                                                   p_registration_to: registration_to,
                                                   p_max_teams: teamCount > 0 ? teamCount : null,
                                                   p_rounds: roundCount,
        });

        if (error) throw error;

        clearDraft();
        setDraftRestored(false);
        router.push('/dashboard');
      } catch (err: any) {
        console.error('Помилка створення турніру:', err);
        setSubmitError(err?.message ?? 'Виникла помилка. Спробуйте ще раз.');
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

    /* ── Checking (unauthorized warning) ── */
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
          <h2 className="text-xl font-black uppercase tracking-tight text-center mb-1 text-(--t1)">
          ⚠️ Обмежений доступ
          </h2>
          <p className="text-sm text-center text-(--t2)">У вас немає прав для перегляду цієї сторінки</p>
          </div>
          <div className="h-px mb-6 bg-(--brd)" />
          <p className="text-base font-black uppercase tracking-tight text-center mb-2 text-(--t1)">
          Точно хочете переглянути цю сторінку?
          </p>
          <p className="text-xs text-center mb-6 text-(--t2)">
          Через <span className="font-black text-red-500">{countdown} сек</span> ви автоматично побачите, що чекає на порушників 🐇
          </p>
          <div className="flex gap-3">
          <button onClick={handleConfirmYes}
          className="pulse-btn flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-red-500 active:scale-95 transition-all">
          Так, показати
          </button>
          <button onClick={handleConfirmNo}
          className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">
          Ні, піти
          </button>
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
          .rabbit-falling{position:absolute;font-size:3rem;left:50%;animation:rabbit-fall 4s ease-in infinite}
          .scanline{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(59,130,246,0.3),transparent);animation:scanline 4s linear infinite;pointer-events:none}
          .fade-up{animation:fadeSlideUp 0.7s cubic-bezier(.22,1,.36,1) both}
          .fade-up-1{animation:fadeSlideUp 0.7s cubic-bezier(.22,1,.36,1) 0.15s both}
          .fade-up-2{animation:fadeSlideUp 0.7s cubic-bezier(.22,1,.36,1) 0.30s both}
          `}</style>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl bg-blue-500" />
          <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full opacity-10 blur-3xl bg-violet-500" />
          </div>
          <div className="scanline" />
          <span className="rabbit-falling select-none" aria-hidden="true">🐇</span>
          <div className="relative z-10 text-center px-6 max-w-lg">
          <div className="glitch-text text-[120px] sm:text-[160px] font-black leading-none mb-4 select-none fade-up text-(--t1)" data-text="403" style={{ letterSpacing: '-0.05em' }}>403</div>
          <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-2 text-(--t1)">Ах ти хитрий шукач потаємних шляхів,</p>
          <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-8 text-blue-600">привіт від Білого Кролика 🐇</p>
          <p className="fade-up-2 text-xs font-black uppercase tracking-[0.3em] mb-10 text-(--t2)">Ця сторінка тільки для адміністраторів</p>
          <div className="fade-up-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => router.push('/dashboard')}
          className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20">
          ← Повернутись на дашборд
          </button>
          <button onClick={() => router.push('/')}
          className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">
          На головну
          </button>
          </div>
          </div>
          </div>
      );
    }

    /* ── Main form (admin only) ── */
    return (
      <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
      <style jsx global>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes cardDrop { from{opacity:0;transform:translateY(-26px) scale(.97)} to{opacity:1;transform:none} }
        .fuIn { animation: fadeUp 340ms cubic-bezier(.22,1,.36,1) both }
        .cdIn { animation: cardDrop 500ms cubic-bezier(.22,1,.36,1) both }
        `}</style>

        {/* Background watermark */}
        <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
        </div>

        {isMobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
        )}

        <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar />
        </div>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        title={t.tourney?.create ?? 'Створення турніру'}
        icon={<Trophy size={18} className="text-blue-600" />}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
        <button onClick={() => router.push('/')} className="hover:text-blue-600 transition-colors">Головна</button>
        <ChevronRight size={10} />
        <button onClick={() => router.push('/dashboard')} className="hover:text-blue-600 transition-colors">Дашборд</button>
        <ChevronRight size={10} />
        <span className="text-(--t1)">{t.tourney?.createAdmin ?? 'Створення турніру'}</span>
        </nav>

        <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors"
        >
        <ArrowLeft size={14} /> Назад
        </button>

        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-(--t1) mb-8 sm:mb-10">
        {t.tourney?.createAdmin ?? 'Створення турніру'}
        </h1>

        <form className="max-w-4xl space-y-6" onSubmit={handleSubmit}>

        {/* ── Section 1: General ── */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Trophy size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">
        1. {t.tourney?.general ?? 'Загальна інформація'}
        </span>
        </div>

        {/* Tournament name */}
        <div className="p-6 sm:p-8 border-b border-(--brd)">
        <div className="flex justify-between items-center mb-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.name ?? 'Назва турніру'}
        </label>
        <span className="text-[10px] font-black uppercase text-red-500 flex items-center gap-1">
        <Zap className="w-3 h-3 fill-red-500" />
        {t.common?.required ?? "Обов'язково"}
        </span>
        </div>
        <input
        type="text"
        value={tourneyName}
        onChange={e => setTourneyName(e.target.value)}
        placeholder={t.tourney?.namePlaceholder ?? 'Назва турніру...'}
        className="w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all"
        />
        </div>

        {/* Description */}
        <div className="p-6 sm:p-8">
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3">
        {t.tourney?.desc ?? 'Опис / Правила'}
        </label>
        <div className="border border-(--brd) rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-600 transition-all">
        <div className="border-b border-(--brd) px-4 py-2.5 flex items-center gap-1 bg-(--bg)/60 flex-wrap">
        {([
          { Icon: Bold,      label: 'Жирний',    action: () => applyFormat('**', true)  },
          { Icon: Italic,    label: 'Курсив',    action: () => applyFormat('*',  true)  },
          { Icon: Underline, label: 'Підкресл.', action: () => applyFormat('__', true)  },
          { Icon: List,      label: 'Список',    action: () => applyFormat('- ', false) },
          { Icon: Quote,     label: 'Цитата',    action: () => applyFormat('> ', false) },
          { Icon: Type,      label: 'Заголовок', action: () => applyFormat('## ', false)},
        ] as const).map(({ Icon, label, action }) => (
          <button key={label} type="button" onClick={action} title={label}
          className="p-2 rounded-xl hover:bg-(--card) text-(--t2) hover:text-blue-600 transition-all active:scale-90">
          <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        </div>
        <textarea
        ref={textareaRef}
        rows={4}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t.tourney?.descPlaceholder ?? 'Введіть опис турніру...'}
        className="w-full px-5 py-4 outline-none resize-y text-sm bg-transparent text-(--t1) placeholder:text-(--t2)/50"
        />
        </div>
        </div>
        </section>

        {/* ── Section 2: Time & Conditions ── */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Clock size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">
        2. {t.tourney?.time ?? 'Час та Умови'}
        </span>
        </div>

        {/* Start datetime */}
        <div className="p-6 sm:p-8 border-b border-(--brd)">
        <div className="flex justify-between items-center mb-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.start ?? 'Дата та час старту турніру'}
        </label>
        <span className="text-[10px] font-black uppercase text-red-500 flex items-center gap-1">
        <Zap className="w-3 h-3 fill-red-500" />
        {t.common?.required ?? "Обов'язково"}
        </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-60">Дата</span>
        <input
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        className="w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all"
        />
        </div>
        <div className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-60">Час</span>
        <input
        type="time"
        value={startTime}
        onChange={e => setStartTime(e.target.value)}
        className="w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all"
        />
        </div>
        </div>
        </div>

        {/* Registration window */}
        <div className="p-6 sm:p-8 border-b border-(--brd)">
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-4">
        {t.tourney?.registration ?? 'Вікно реєстрації команд'}
        </label>
        <div className="grid md:grid-cols-2 gap-4">
        {/* Registration start */}
        <div className="rounded-2xl p-4 border border-(--brd) bg-(--bg)/50 space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-70">Початок реєстрації</p>
        <input
        type="date"
        value={regStartDate}
        onChange={e => setRegStartDate(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all"
        />
        <input
        type="time"
        value={regStartTime}
        onChange={e => setRegStartTime(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all"
        />
        </div>
        {/* Registration end */}
        <div className="rounded-2xl p-4 border border-(--brd) bg-(--bg)/50 space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-70">Кінець реєстрації</p>
        <input
        type="date"
        value={regEndDate}
        onChange={e => setRegEndDate(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all"
        />
        <input
        type="time"
        value={regEndTime}
        onChange={e => setRegEndTime(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 outline-none transition-all"
        />
        </div>
        </div>
        </div>

        {/* Max teams */}
        <div className="p-6 sm:p-8">
        <div className="flex justify-between items-center mb-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.maxTeams ?? 'Максимальна кількість команд'}
        </label>
        <span className="text-[10px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2.5 py-1 rounded-full">
        {t.common?.optional ?? 'Опціонально'}
        </span>
        </div>

        <div className="flex items-center overflow-hidden border border-(--brd) rounded-2xl w-fit">
        <button type="button"
        onClick={() => setTeamCount(Math.max(0, teamCount - 1))}
        className="w-12 h-12 text-lg flex items-center justify-center bg-(--bg) text-(--t2) hover:text-blue-600 transition-colors border-r border-(--brd)">
        −
        </button>
        <input
        type="number"
        value={teamCount}
        onChange={e => setTeamCount(Math.max(0, +e.target.value))}
        className="w-20 text-center text-sm font-black outline-none h-12 bg-transparent text-(--t1)"
        />
        <button type="button"
        onClick={() => setTeamCount(Math.min(256, teamCount + 1))}
        className="w-12 h-12 text-lg flex items-center justify-center bg-(--bg) text-(--t2) hover:text-blue-600 transition-colors border-l border-(--brd)">
        +
        </button>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
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
        </section>

        {/* ── Section 3: Format ── */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Layers size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">
        3. {t.tourney?.format ?? 'Формат'}
        </span>
        </div>

        <div className="p-6 sm:p-8">
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-4">
        {t.tourney?.rounds ?? 'Кількість раундів'}{' '}
        <span className="normal-case font-bold opacity-60 ml-1">({t.tourney?.min1 ?? 'Мінімально — 1, максимально — 8'})</span>
        </label>
        <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
          <button
          key={n}
          type="button"
          onClick={() => setRoundCount(n)}
          className={`w-12 h-12 rounded-2xl font-black text-sm uppercase tracking-widest border transition-all active:scale-95 ${
            roundCount === n
            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/25'
            : 'bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600'
          }`}
          >
          {n}
          </button>
        ))}
        </div>
        {roundCount && (
          <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-600">
          Обрано: {roundCount} {roundCount === 1 ? 'раунд' : roundCount < 5 ? 'раунди' : 'раундів'}
          {roundCount > 1 && <span className="text-(--t2) font-bold ml-2">(Bo{roundCount})</span>}
          </p>
        )}
        </div>
        </section>

        {/* ── Draft restored banner ── */}
        {draftRestored && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-blue-500">
          💾 Відновлено незбережений чернетку
          </p>
          <button
          type="button"
          onClick={() => {
            clearDraft();
            setTourneyName(''); setDescription('');
            setStartDate(''); setStartTime('');
            setRegStartDate(''); setRegStartTime('');
            setRegEndDate(''); setRegEndTime('');
            setTeamCount(0); setRoundCount(null);
            setDraftRestored(false);
          }}
          className="text-[10px] font-black uppercase tracking-widest text-blue-500 border border-blue-500/40 px-3 py-1.5 rounded-xl hover:bg-blue-500/20 transition-all whitespace-nowrap"
          >
          Очистити
          </button>
          </div>
        )}

        {/* ── Error message ── */}
        {submitError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-500">
          ⚠️ {submitError}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <button
        type="submit"
        disabled={isSubmitting}
        className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
        >
        {isSubmitting && (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {isSubmitting ? 'Зберігається...' : (t.tourney?.createBtn ?? 'Створити турнір')}
        </button>
        <button
        type="button"
        onClick={() => router.back()}
        disabled={isSubmitting}
        className="px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all disabled:opacity-60"
        >
        {t.common?.cancel ?? 'Скасувати'}
        </button>
        </div>

        </form>
        </div>
        </main>
        </div>
    );
}
