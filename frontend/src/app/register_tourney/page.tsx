'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Trophy, Clock, Users, Layers, ChevronRight, ArrowLeft, X, CalendarDays,
} from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';

import Sidebar from "@/components/Sidebar";
import { DatePicker, TimePicker } from "@/components/DateTimePicker";
import RoundSettingsPanel, { type RoundData } from "@/components/RoundSettingsPanel";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { localToIso } from "@/lib/datetime";
import { supabase } from '@/lib/supabase';
import { authedSupabase } from '@/lib/supabase';

/** Возвращает свежий токен: из localStorage → silentRefresh через authedSupabase */
async function getToken(): Promise<string> {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : '';
  // authedSupabase сам рефрешит если токен истёк — получаем клиент и читаем токен из localStorage снова
  await authedSupabase(stored || null);
  // После authedSupabase localStorage уже содержит свежий токен
  return typeof window !== 'undefined' ? (localStorage.getItem('access_token') ?? '') : '';
}

type AccessState = 'loading' | 'checking' | 'denied' | 'allowed';
const COUNTDOWN_SEC = 5;

const inp = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all";

function DateTimePair({
  label,
  dateVal, onDate,
  timeVal, onTime,
  required,
  requiredLabel,
}: {
  label: string;
  dateVal: string; onDate: (v: string) => void;
  timeVal: string; onTime: (v: string) => void;
  required?: boolean;
  requiredLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
    {required && (
      <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
      <Zap className="w-2.5 h-2.5 fill-red-500" /> {requiredLabel ?? "Обов'язково"}
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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // localToIso: локальний час браузера → ISO UTC для збереження в БД (нульовий пояс).
  const toTimestamp = localToIso;;

  const API_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://site-turing-crutchmasters-team-s.onrender.com';

  // БАГ 6 fix: завантажуємо файли раундів через бекенд (service_role),
  // а не напряму через anon key — інакше приватний bucket поверне 403.
  // Повертає signed URL (10 років), який зберігаємо в attachments.
  const uploadFile = async (file: File, roundNumber: number): Promise<string> => {
    const token = await getToken();
    if (!token) throw new Error('Не вдалося отримати токен авторизації. Спробуйте увійти знову. [upload]');

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
    if (!tourneyName.trim()) { setSubmitError(t.tourney?.errNameRequired ?? "Назва турніру є обов'язковою"); return; }
    if (!startDate)          { setSubmitError(t.tourney?.errStartRequired ?? "Дата старту турніру є обов'язковою"); return; }
    setIsSubmitting(true);
    try {
      // Перевірка дублікату назви
      const { data: existing, error: checkError } = await supabase
      .from("tournaments")
      .select("id")
      .ilike("name", tourneyName.trim())
      .limit(1);
      if (!checkError && existing && existing.length > 0) {
        setSubmitError((t.tourney?.errDuplicate ?? 'Турнір з назвою "{name}" вже існує. Оберіть іншу назву.').replace('{name}', tourneyName.trim()));
        setIsSubmitting(false);
        return;
      }

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
          // Guard: розпаковуємо FileItem { file: File, name, size, type } або голий File
          const rawFiles: File[] = ((rd as any)?.files ?? [])
          .map((f: unknown): File | null => {
            if (f instanceof File) return f;
            if (f && typeof f === 'object' && (f as any).file instanceof File)
              return (f as any).file as File;
            return null;
          })
          .filter((f: File | null): f is File => f !== null);
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
      if (!tournamentId) throw new Error(t.tourney?.errNoId ?? 'Турнір створено, але ID не повернуто');

      // Вставляємо раунди через бекенд (service_role) — anon key не має прав на INSERT в rounds (RLS 401)
      // БАГ 8 fix: перевіряємо ліміт constraint (1-8) перед відправкою
      if (roundsPayload.length > 8) {
        throw new Error(t.tourney?.errMaxRounds ?? 'Максимальна кількість раундів — 8');
      }
      const token = await getToken();
      if (!token) throw new Error(t.tourney?.errNoToken ?? 'Не вдалося отримати токен авторизації. Спробуйте увійти знову.');
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
          throw new Error(t.tourney?.errRoundNumber ?? 'Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
        }
        throw new Error((t.tourney?.errRoundsSave ?? 'Турнір створено, але раунди не збережено: {detail}').replace('{detail}', errMsg));
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Помилка створення турніру:', err?.message ?? err);
      // БАГ 8 fix: зрозуміле повідомлення про constraint раундів
      const msg: string = err?.message ?? '';
      if (msg.includes('rounds_number_check') || msg.includes('number_check')) {
        setSubmitError(t.tourney?.errRoundNumber ?? 'Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
      } else if (msg.includes('Максимальна кількість раундів') || msg.includes('Maximum number of rounds') || msg.includes('Максимальное количество')) {
        setSubmitError(msg);
      } else {
        setSubmitError(msg || (t.tourney?.errGeneric ?? 'Виникла помилка. Спробуйте ще раз.'));
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
        <h2 className="text-xl font-black uppercase tracking-tight text-center mb-1 text-(--t1)">{t.tourney?.accessDeniedTitle ?? '⚠️ Обмежений доступ'}</h2>
        <p className="text-sm text-center text-(--t2)">{t.tourney?.accessDeniedDesc ?? 'У вас немає прав для перегляду цієї сторінки'}</p>
        </div>
        <div className="h-px mb-6 bg-(--brd)" />
        <p className="text-base font-black uppercase tracking-tight text-center mb-2 text-(--t1)">{t.tourney?.accessDeniedQuestion ?? 'Точно хочете переглянути цю сторінку?'}</p>
        <p className="text-xs text-center mb-6 text-(--t2)">
        {(t.tourney?.accessDeniedCountdown ?? 'Через {sec} сек ви автоматично побачите, що чекає на порушників 🐇').replace('{sec}', String(countdown))}
        </p>
        <div className="flex gap-3">
        <button onClick={handleConfirmYes} className="pulse-btn flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-red-500 active:scale-95 transition-all">{t.tourney?.accessDeniedYes ?? 'Так, показати'}</button>
        <button onClick={handleConfirmNo}  className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">{t.tourney?.accessDeniedNo ?? 'Ні, піти'}</button>
        </div>
        <p className="text-center text-[10px] mt-4 text-(--t2) opacity-50">{t.tourney?.accessDeniedNoHint ?? '«Ні» → повернути на сторінку входу'}</p>
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
      <a href={'/'} onClick={(e) => { e.preventDefault(); router.push('/'); }} className="hover:text-blue-600 transition-colors">{t.tourney?.home ?? 'Головна'}</a>
      <ChevronRight size={10} />
      <a href={'/dashboard'} onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }} className="hover:text-blue-600 transition-colors">{t.tourney?.dashboard ?? 'Дашборд'}</a>
      <ChevronRight size={10} />
      <span className="text-(--t1)">{t.tourney?.createAdmin ?? 'Створення турніру'}</span>
      </nav>

      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
      <ArrowLeft size={14} /> {t.tourney?.back ?? 'Назад'}
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
        <Zap className="w-2.5 h-2.5 fill-red-500" /> {t.tourney?.required ?? "Обов'язково"}
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
        <RichTextEditor
        value={description}
        onChange={setDescription}
        placeholder={t.tourney?.descPlaceholder ?? 'Введіть опис турніру...'}
        rows={7}
        />
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
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.tourney?.regTeams ?? 'Реєстрація команд'}</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
        <DateTimePair label={t.tourney?.regStart ?? 'Початок реєстрації'} dateVal={regStartDate} onDate={setRegStartDate} timeVal={regStartTime} onTime={setRegStartTime} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label={t.tourney?.regEnd ?? 'Кінець реєстрації'} dateVal={regEndDate} onDate={setRegEndDate} timeVal={regEndTime} onTime={setRegEndTime} />
        </div>
        </div>

        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Clock size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.tourney?.startDates ?? 'Дати старту'}</span>
        </div>
        <div className="p-6 space-y-4 flex-1">
        <DateTimePair label={t.tourney?.tourStart ?? 'Початок турніру'} dateVal={startDate} onDate={setStartDate} timeVal={startTime} onTime={setStartTime} required requiredLabel={t.tourney?.required} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label={t.tourney?.tourEnd ?? 'Кінець турніру'} dateVal={endDate} onDate={setEndDate} timeVal={endTime} onTime={setEndTime} />
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
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">{t.tourney?.block3format ?? '3. Формат'}</span>
        <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1 whitespace-nowrap">
        <Zap className="w-2 h-2 fill-red-500" /> {t.tourney?.required ?? "Обов'язково"}
        </span>
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.tourney?.roundCount ?? 'Кількість раундів'}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">
        {t.tourney?.roundSelected ?? 'Вибрано:'} <span className="text-blue-500">{roundCount}</span> {roundCount === 1 ? (t.tourney?.roundWord_1 ?? 'раунд') : roundCount < 5 ? (t.tourney?.roundWord_2 ?? 'раунди') : (t.tourney?.roundWord_5 ?? 'раундів')}
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
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">{t.tourney?.teamCount ?? 'Команди'}</span>
        <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full whitespace-nowrap">
        {t.common?.optional ?? 'Опціонально'}
        </span>
        </div>
        <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.tourney?.teamCount ?? 'Кількість команд'}</p>
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
          {n === 0 ? (t.tourney?.noLimit ?? 'Без ліміту') : n}
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
        {isSubmitting ? (t.tourney?.saving ?? 'Зберігається...') : (t.tourney?.createBtn ?? 'Створити турнір')}
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
        labels={t.roundPanel}
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
