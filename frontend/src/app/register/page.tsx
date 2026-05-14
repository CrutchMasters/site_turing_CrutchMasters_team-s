'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Trophy, Clock, Users, Layers, ChevronRight, ArrowLeft, X, ImageIcon, Upload, AlertCircle, CheckCircle,
} from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import BannerEditorModal from '@/components/BannerEditorModal';

import Sidebar from "@/components/Sidebar";
import { DatePicker, TimePicker } from "@/components/DateTimePicker";
import RoundSettingsPanel, { type RoundData } from "@/components/RoundSettingsPanel";
import TournamentTimeline, { type RoundSlice } from "@/components/TournamentTimeline";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useT } from "@/context/LanguageContext";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { localToIso } from "@/lib/datetime";
import { supabase } from '@/lib/supabase';
import { authedSupabase } from '@/lib/supabase';

async function getToken(): Promise<string> {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : '';
  await authedSupabase(stored || null);
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

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="relative flex items-start gap-2 mt-1.5">
      <span className="absolute -top-1.5 left-4 w-0 h-0
        border-l-[6px] border-l-transparent
        border-r-[6px] border-r-transparent
        border-b-[6px] border-b-red-500/80" />
      <div className="flex items-center gap-1.5 w-full px-3 py-2 rounded-xl
        bg-red-500/10 border border-red-500/40 text-red-500 text-[11px] font-bold
        shadow-sm shadow-red-500/10">
        <AlertCircle size={12} className="flex-shrink-0" />
        <span>{msg}</span>
      </div>
    </div>
  );
}

// ── Mobile Tab Bar ─────────────────────────────────────────────────────────────
type MobileTab = 'general' | 'rounds';

function MobileTabBar({
  active,
  onChange,
  roundsHaveErrors,
}: {
  active: MobileTab;
  onChange: (t: MobileTab) => void;
  roundsHaveErrors?: boolean;
}) {
  return (
    <div className="xl:hidden sticky top-0 z-20 bg-(--bg)/90 backdrop-blur-md border-b border-(--brd) px-4 py-2">
      <div className="flex gap-1.5 bg-(--card) p-1.5 rounded-2xl border border-(--brd)">
        {([
          { key: 'general', label: 'Загальне', icon: <Trophy size={13} /> },
          { key: 'rounds',  label: 'Раунди',  icon: <Layers size={13} />, badge: roundsHaveErrors },
        ] as { key: MobileTab; label: string; icon: React.ReactNode; badge?: boolean }[]).map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              active === tab.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-(--t2) hover:text-(--t1) hover:bg-(--bg)'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && active !== tab.key && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-(--card)" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RegisterTourney() {
  const { dark } = useTheme();
  const { t } = useT();
  const { user, isLoading } = useAuth();
  const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar } = useSidebar();
  const router = useRouter();

  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);

  // ── Mobile tab state ────────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<MobileTab>('general');

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
  const [fieldErrors, setFieldErrors]     = useState<Record<string, string>>({});
  const [success, setSuccess]             = useState('');
  const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSuccess = (msg: string) => {
    setSuccess(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(''), 4500);
  };
  const clearFieldError = (key: string) => {
    setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };
  const [bannerUrl, setBannerUrl]         = useState('');
  const [bannerError, setBannerError]     = useState('');
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);

  const [externalRoundDates, setExternalRoundDates] = useState<
  Record<number, Partial<Pick<RoundData, "startDate"|"startTime"|"deadlineDate"|"deadlineTime"|"judgingDeadlineDate"|"judgingDeadlineTime">>>
  >({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRoundTimelineChange = useCallback((num: number, patch: Partial<RoundSlice>) => {
    setRoundsData(prev => ({
      ...prev,
      [num]: {
        ...(prev[num] ?? {
          name: `Раунд ${num}`, description: "", startDate: "", startTime: "",
          deadlineDate: "", deadlineTime: "", judgingDeadlineDate: "", judgingDeadlineTime: "",
          evalStartDate: "", evalStartTime: "",
          evalEndDate: "", evalEndTime: "", requirements: [], criteria: [], links: [], files: [],
        }),
        ...(patch.startDate    !== undefined ? { startDate:    patch.startDate }    : {}),
                           ...(patch.startTime    !== undefined ? { startTime:    patch.startTime }    : {}),
                           ...(patch.deadlineDate !== undefined ? { deadlineDate: patch.deadlineDate } : {}),
                           ...(patch.deadlineTime !== undefined ? { deadlineTime: patch.deadlineTime } : {}),
      },
    }));
    setExternalRoundDates(prev => ({
      ...prev,
      [num]: {
        ...(prev[num] ?? {}),
                                   ...(patch.startDate    !== undefined ? { startDate:    patch.startDate }    : {}),
                                   ...(patch.startTime    !== undefined ? { startTime:    patch.startTime }    : {}),
                                   ...(patch.deadlineDate !== undefined ? { deadlineDate: patch.deadlineDate } : {}),
                                   ...(patch.deadlineTime !== undefined ? { deadlineTime: patch.deadlineTime } : {}),
      },
    }));
  }, []);

  const timelineErrors = React.useMemo(() => {
    const errs: string[] = [];
    const parseLocalDt = (date: string, time: string) => {
      if (!date) return null;
      const [y, mo, d] = date.split('-').map(Number);
      const [h = 0, m = 0] = (time ?? '').split(':').map(Number);
      return new Date(y, mo - 1, d, h, m).getTime();
    };
    const rf = parseLocalDt(regStartDate, regStartTime);
    const rt = parseLocalDt(regEndDate,   regEndTime);
    const ts = parseLocalDt(startDate,    startTime);
    const te = parseLocalDt(endDate,      endTime);

    if (rf && ts && rf >= ts)
      errs.push('Реєстрація повинна починатися раніше за старт турніру.');
    if (rt && ts && rt > ts)
      errs.push('Реєстрація повинна закінчуватися не пізніше старту турніру.');
    if (rf && rt && rf >= rt)
      errs.push('Початок реєстрації повинен бути раніше за кінець реєстрації.');
    if (ts && te && ts >= te)
      errs.push('Початок турніру повинен бути раніше за кінець турніру.');

    const roundSlices = Array.from({ length: roundCount }, (_, i) => {
      const n = i + 1;
      const rd = roundsData[n];
      return {
        n,
        start: parseLocalDt(rd?.startDate ?? '', rd?.startTime ?? ''),
        end:   parseLocalDt(rd?.deadlineDate ?? '', rd?.deadlineTime ?? ''),
        jd:    parseLocalDt(rd?.judgingDeadlineDate ?? '', rd?.judgingDeadlineTime ?? ''),
      };
    }).filter(r => r.start || r.end || r.jd);

    for (const r of roundSlices) {
      if (r.start && r.end && r.start >= r.end)
        errs.push(`Раунд ${r.n}: початок повинен бути раніше за дедлайн здачі.`);
      if (ts && r.start && r.start < ts)
        errs.push(`Раунд ${r.n}: не може починатися раніше за старт турніру.`);
      if (te && r.end && r.end > te)
        errs.push(`Раунд ${r.n}: дедлайн здачі виходить за межі турніру.`);
      if (r.jd) {
        if (r.end && r.jd <= r.end)
          errs.push(`Раунд ${r.n}: дедлайн оцінювання повинен бути пізніше за дедлайн здачі.`);
        if (te && r.jd > te)
          errs.push(`Раунд ${r.n}: дедлайн оцінювання виходить за межі турніру.`);
      }
    }
    for (let i = 0; i < roundSlices.length - 1; i++) {
      const cur = roundSlices[i];
      const nxt = roundSlices[i + 1];
      const curEffectiveEnd = cur.jd ?? cur.end;
      if (curEffectiveEnd && nxt.start && curEffectiveEnd > nxt.start) {
        const boundary = cur.jd ? 'дедлайн оцінювання' : 'дедлайн здачі';
        errs.push(`Раунд ${nxt.n} починається до завершення раунду ${cur.n} (${boundary}).`);
      }
    }
    return errs;
  }, [regStartDate, regStartTime, regEndDate, regEndTime,
      startDate, startTime, endDate, endTime,
      roundCount, roundsData]);

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

  const toTimestamp = localToIso;

  const API_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://site-turing-crutchmasters-team-s.onrender.com';

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
    return data.signed_url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const fe: Record<string, string> = {};
    let hasErr = false;
    const addErr = (key: string, msg: string) => { if (!fe[key]) fe[key] = msg; hasErr = true; };

    if (!tourneyName.trim()) addErr('name', t.tourney?.errNameRequired ?? "Назва турніру є обов'язковою");
    if (!startDate)          addErr('startDate', t.tourney?.errStartRequired ?? 'Дата старту турніру є обов\'язковою');

    const parseLocalDt = (date: string, time: string) => {
      if (!date) return null;
      const [y, mo, d] = date.split('-').map(Number);
      const [h = 0, m = 0] = (time ?? '').split(':').map(Number);
      return new Date(y, mo - 1, d, h, m).getTime();
    };

    const rf = parseLocalDt(regStartDate, regStartTime);
    const rt = parseLocalDt(regEndDate,   regEndTime);
    const ts = parseLocalDt(startDate,    startTime);
    const te = parseLocalDt(endDate,      endTime);

    if (rf && ts && rf >= ts)
      addErr('regStartDate', 'Реєстрація повинна починатися раніше за старт турніру.');
    if (rt && ts && rt > ts)
      addErr('regEndDate', 'Реєстрація повинна закінчуватися не пізніше старту турніру (вони не можуть перетинатися).');
    if (rf && rt && rf >= rt)
      addErr('regStartDate', fe['regStartDate'] ?? 'Початок реєстрації повинен бути раніше за кінець реєстрації.');
    if (ts && te && ts >= te)
      addErr('startDate', fe['startDate'] ?? 'Початок турніру повинен бути раніше за кінець турніру.');

    const roundSlices = Array.from({ length: roundCount }, (_, i) => {
      const n = i + 1;
      const rd = roundsData[n];
      return {
        n,
        start: parseLocalDt(rd?.startDate ?? '', rd?.startTime ?? ''),
        end:   parseLocalDt(rd?.deadlineDate ?? '', rd?.deadlineTime ?? ''),
      };
    }).filter(r => r.start || r.end);

    for (const r of roundSlices) {
      if (r.start && r.end && r.start >= r.end)
        addErr(`round_${r.n}_start`, `Раунд ${r.n}: початок повинен бути раніше за дедлайн.`);
      if (ts && r.start && r.start < ts)
        addErr(`round_${r.n}_start`, fe[`round_${r.n}_start`] ?? `Раунд ${r.n}: початок раунду не може бути раніше за старт турніру.`);
      if (te && r.end && r.end > te)
        addErr(`round_${r.n}_end`, `Раунд ${r.n}: дедлайн раунду не може виходити за межі турніру.`);
    }
    for (let i = 0; i < roundSlices.length - 1; i++) {
      const cur = roundSlices[i];
      const nxt = roundSlices[i + 1];
      if (cur.end && nxt.start && cur.end > nxt.start)
        addErr(`round_${nxt.n}_start`, `Раунд ${nxt.n} починається до завершення раунду ${cur.n}. Раунди не можуть перекриватися.`);
    }

    // Якщо помилки в раундах — перемикаємо таб
    const hasRoundErrors = Object.keys(fe).some(k => k.startsWith('round_'));
    if (hasRoundErrors) setMobileTab('rounds');
    else if (hasErr)    setMobileTab('general');

    if (hasErr) { setFieldErrors(fe); return; }

    setIsSubmitting(true);
    try {
      const { data: existing, error: checkError } = await supabase
      .from("tournaments")
      .select("id")
      .ilike("name", tourneyName.trim())
      .limit(1);
      if (!checkError && existing && existing.length > 0) {
        setFieldErrors({ name: (t.tourney?.errDuplicate ?? 'Турнір з назвою "{name}" вже існує. Оберіть іншу назву.').replace('{name}', tourneyName.trim()) });
        setIsSubmitting(false);
        return;
      }

      const roundsPayload = await Promise.all(
        Array.from({ length: roundCount }, async (_, i) => {
          const n = i + 1;
          const rd = roundsData[n];

          const linkAttachments = (rd?.links ?? [])
          .filter(Boolean)
          .map((url, idx) => ({
            id: `link-${n}-${idx}`,
            name: url,
            url,
            type: 'link' as const,
          }));

          const fileAttachments: { id: string; name: string; url: string; type: 'file' }[] = [];
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
                   start_at:         toTimestamp(rd?.startDate ?? '', rd?.startTime ?? '') ?? null,
                   end_at:           toTimestamp(rd?.deadlineDate ?? '', rd?.deadlineTime ?? '') ?? null,
                   judging_deadline: toTimestamp(rd?.judgingDeadlineDate ?? '', rd?.judgingDeadlineTime ?? '') ?? null,
                   links:        linkAttachments,
                   attachments,
                   status: 'pending',
          };
        })
      );

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
                                                                         p_banner_url:        bannerUrl.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message || rpcError.details || JSON.stringify(rpcError));
      if (!tournamentId) throw new Error(t.tourney?.errNoId ?? 'Турнір створено, але ID не повернуто');

      if (bannerUrl.trim()) {
        await supabase.from('tournaments').update({ banner_url: bannerUrl.trim() }).eq('id', tournamentId);
      }

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

        try {
          const rollbackToken = await getToken();
          if (rollbackToken) {
            await fetch(`${API_URL}/api/tournaments/${tournamentId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${rollbackToken}` },
            });
          }
        } catch {}

        if (errMsg.includes('rounds_number_check') || errMsg.includes('number_check')) {
          throw new Error(t.tourney?.errRoundNumber ?? 'Номер раунду має бути від 1 до 8. Перевірте кількість раундів.');
        }
        throw new Error((t.tourney?.errRoundsSave ?? 'Помилка збереження раундів: {detail}').replace('{detail}', errMsg));
      }

      router.push('/tournaments?created=1');
    } catch (err: any) {
      console.error('Помилка створення турніру:', err?.message ?? err);
      const msg: string = err?.message ?? '';
      if (msg.includes('rounds_number_check') || msg.includes('number_check')) {
        setFieldErrors({ general: t.tourney?.errRoundNumber ?? 'Номер раунду має бути від 1 до 8. Перевірте кількість раундів.' });
      } else {
        setFieldErrors({ general: msg || (t.tourney?.errGeneric ?? 'Виникла помилка. Спробуйте ще раз.') });
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg) text-(--t1)">
      <div className="bg-(--card) border border-(--brd) rounded-3xl p-8 max-w-sm w-full mx-4 flex flex-col gap-5 shadow-2xl">
      <Trophy size={32} className="text-blue-600 mx-auto" />
      <p className="text-center text-sm font-black uppercase tracking-widest text-(--t1)">Перевірка доступу...</p>
      <div className="flex gap-3">
      <button onClick={handleConfirmNo} className="flex-1 px-4 py-3 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) transition-all">Скасувати</button>
      <button onClick={handleConfirmYes} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-1">Підтвердити ({countdown})</button>
      </div>
      </div>
      </div>
    );
  }

  /* ── Denied ── */
  if (accessState === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-(--bg) text-(--t1)">
      <style>{`
        @keyframes glitch1{0%,100%{clip-path:inset(0 0 95% 0);transform:translate(-2px,0)}25%{clip-path:inset(40% 0 40% 0);transform:translate(2px,0)}50%{clip-path:inset(80% 0 5% 0);transform:translate(-1px,0)}75%{clip-path:inset(10% 0 70% 0);transform:translate(1px,0)}}
        @keyframes glitch2{0%,100%{clip-path:inset(80% 0 2% 0);transform:translate(2px,0)}25%{clip-path:inset(5% 0 80% 0);transform:translate(-2px,0)}50%{clip-path:inset(50% 0 30% 0);transform:translate(1px,0)}75%{clip-path:inset(20% 0 60% 0);transform:translate(-1px,0)}}
        @keyframes fadeUpItem{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
        @keyframes scanline{0%{top:-60px}100%{top:100%}}
        @keyframes rabbitHop{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-20px) rotate(5deg)}}
        .glitch-text{position:relative}.glitch-text::before,.glitch-text::after{content:attr(data-text);position:absolute;inset:0;color:inherit}
        .glitch-text::before{animation:glitch1 3s infinite;color:#3b82f6;opacity:0.7}
        .glitch-text::after{animation:glitch2 3s infinite 0.1s;color:#8b5cf6;opacity:0.7}
        .fade-up{animation:fadeUpItem 0.6s cubic-bezier(.22,1,.36,1) both}
        .fade-up-1{animation:fadeUpItem 0.6s 0.15s cubic-bezier(.22,1,.36,1) both}
        .fade-up-2{animation:fadeUpItem 0.6s 0.3s cubic-bezier(.22,1,.36,1) both}
        .rabbit{position:fixed;bottom:40px;right:40px;font-size:3rem;animation:rabbitHop 1.5s ease-in-out infinite;filter:drop-shadow(0 0 20px rgba(59,130,246,0.4));pointer-events:none;z-index:50}
        .scanline{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:1}
        .scanline::after{content:'';position:absolute;left:0;right:0;height:60px;background:linear-gradient(transparent,rgba(59,130,246,0.04),transparent);animation:scanline 3s linear infinite}
        `}</style>
        <div className="scanline" />
        <div className="rabbit">🐇</div>
        <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="glitch-text text-[120px] sm:text-[160px] font-black leading-none mb-4 select-none fade-up text-(--t1)" data-text="403" style={{ letterSpacing: '-0.05em' }}>403</div>
        <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-2 text-(--t1)">{t.tourney?.deniedTitle ?? 'Ах ти хитрий шукач потаємних шляхів,'}</p>
        <p className="fade-up-1 text-lg sm:text-2xl font-black uppercase tracking-tight mb-8 text-blue-600">{t.tourney?.deniedSubtitle ?? 'привіт від Білого Кролика 🐇'}</p>
        <p className="fade-up-2 text-xs font-black uppercase tracking-[0.3em] mb-10 text-(--t2)">{t.tourney?.deniedDesc ?? 'Ця сторінка тільки для адміністраторів'}</p>
        <div className="fade-up-2 flex flex-col sm:flex-row gap-3 justify-center">
        <a href={'/dashboard'} onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20">{t.tourney?.deniedBackDashboard ?? '← Повернутись на дашборд'}</a>
        <a href={'/'} onClick={(e) => { e.preventDefault(); router.push('/'); }} className="px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) text-(--t2) bg-(--bg) active:scale-95 transition-all hover:opacity-80">{t.tourney?.deniedBackHome ?? 'На головну'}</a>
        </div>
        </div>
        </div>
    );
  }

  /* ── Has round-level field errors for badge indicator ── */
  const roundsHaveFieldErrors = Object.keys(fieldErrors).some(k => k.startsWith('round_') || k === 'criteria');

  /* ════════════════════════════════════════════════════════════════════════
   *    MAIN FORM (admin only)
   * ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style>{`
      @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
      @keyframes cardDrop { from{opacity:0;transform:translateY(-26px) scale(.97)} to{opacity:1;transform:none} }
      @keyframes slideDown { from{opacity:0;transform:translateY(-24px) scale(.97)} to{opacity:1;transform:none} }
      @keyframes slideInRight { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
      .fuIn  { animation: fadeUp      340ms cubic-bezier(.22,1,.36,1) both }
      .cdIn  { animation: cardDrop    500ms cubic-bezier(.22,1,.36,1) both }
      .sirIn { animation: slideInRight 400ms cubic-bezier(.22,1,.36,1) both }
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator { display: none !important; opacity: 0 !important; width: 0 !important; }
      input[type="date"], input[type="time"] { -moz-appearance: textfield; }
      `}</style>

      {/* Watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => closeMobileSidebar()} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">

      {/* ── Fixed top success toast ── */}
      {success && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3.5
          bg-green-600 text-white rounded-2xl shadow-2xl shadow-green-600/30 text-sm font-black
          uppercase tracking-wide pointer-events-none select-none"
          style={{ animation: 'slideDown 350ms cubic-bezier(.22,1,.36,1) both' }}>
          <CheckCircle size={16} className="flex-shrink-0" />
          {success}
        </div>
      )}

      {/* ── Fixed top general server-error toast ── */}
      {fieldErrors.general && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3.5
          bg-red-600 text-white rounded-2xl shadow-2xl shadow-red-600/30 text-sm font-black
          uppercase tracking-wide max-w-[90vw]"
          style={{ animation: 'slideDown 350ms cubic-bezier(.22,1,.36,1) both' }}>
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">{fieldErrors.general}</span>
          <button onClick={() => clearFieldError('general')} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      <MobileHeader
      onOpenSidebar={openMobile}
      title={t.tourney?.create ?? 'Створення турніру'}
      icon={<Trophy size={18} className="text-blue-600" />}
      />

      {/* ── MOBILE TAB BAR (hidden on xl+) ── */}
      <MobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        roundsHaveErrors={roundsHaveFieldErrors}
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

      {/* ════════════════════════════════════════════════════════
       *  FORM — two-column on xl+, tab-based on smaller screens
       * ════════════════════════════════════════════════════════ */}
      <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex flex-col xl:flex-row gap-6 items-start w-full">

        {/* ── LEFT COLUMN (always visible on xl; tab "general" on mobile) ── */}
        <div className={`flex flex-col gap-5 w-full xl:flex-1 xl:min-w-0 ${mobileTab !== 'general' ? 'hidden xl:flex' : ''}`}>

        {/* BLOCK 1: Загальна інформація */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
        <Trophy size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.tourney?.block1 ?? '1. Загальна інформація'}</span>
        </div>
        <div className="p-6 sm:p-8 space-y-5">
        <div>
        <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.tourney?.nameLabel ?? 'Назва турніру'}</label>
        <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
        <Zap className="w-2.5 h-2.5 fill-red-500" /> {t.tourney?.required ?? "Обов'язково"}
        </span>
        </div>
        <input
        type="text"
        value={tourneyName}
        onChange={e => { setTourneyName(e.target.value); clearFieldError('name'); }}
        placeholder={t.tourney?.namePlaceholder ?? 'Назва турніру...'}
        className={inp}
        />
        <FieldError msg={fieldErrors.name} />
        </div>
        <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">{t.tourney?.rulesLabel ?? 'Опис / Правила'}</label>
        <RichTextEditor
        value={description}
        onChange={setDescription}
        placeholder={t.tourney?.rulesPlaceholder ?? 'Введіть опис та правила турніру...'}
        rows={7}
        />
        </div>
        </div>
        </section>

        {/* BLOCK BANNER */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: '40ms' }}>
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
        <ImageIcon size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.tourney?.bannerBlock ?? 'Банер турніру'}</span>
        </div>
        <div className="p-6 sm:p-8 space-y-4">
        {bannerUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-(--brd) group">
          <img src={bannerUrl} alt="Banner preview" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
          <button type="button" onClick={() => { setBannerError(""); setBannerEditorOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-white/90 text-gray-900 rounded-xl text-xs font-black uppercase tracking-wide shadow-lg hover:bg-white transition-all">
          <Upload size={14} />
          {t.tourney?.bannerChange ?? 'Змінити'}
          </button>
          </div>
          <button type="button" onClick={() => setBannerUrl('')}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
          <X size={13} />
          </button>
          </div>
        ) : (
          <button type="button" onClick={() => setBannerEditorOpen(true)}
          className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-(--brd) hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <ImageIcon size={22} className="text-purple-500" />
          </div>
          <div className="text-center">
          <p className="text-sm font-black text-(--t1)">{t.tourney?.bannerUpload ?? 'Завантажити банер'}</p>
          <p className="text-[11px] text-(--t2) mt-0.5">{t.tourney?.bannerHint ?? 'PNG, JPG, WEBP — рекомендований розмір 1200×400'}</p>
          </div>
          </button>
        )}
        {bannerError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-xs font-bold">
          <AlertCircle size={14} /> {bannerError}
          </div>
        )}
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
        <DateTimePair label={t.tourney?.regStart ?? 'Початок реєстрації'} dateVal={regStartDate} onDate={v => { setRegStartDate(v); clearFieldError('regStartDate'); }} timeVal={regStartTime} onTime={setRegStartTime} />
        <FieldError msg={fieldErrors.regStartDate} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label={t.tourney?.regEnd ?? 'Кінець реєстрації'} dateVal={regEndDate} onDate={v => { setRegEndDate(v); clearFieldError('regEndDate'); }} timeVal={regEndTime} onTime={setRegEndTime} />
        <FieldError msg={fieldErrors.regEndDate} />
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
        <DateTimePair label={t.tourney?.tourStart ?? 'Початок турніру'} dateVal={startDate} onDate={v => { setStartDate(v); clearFieldError('startDate'); }} timeVal={startTime} onTime={setStartTime} required requiredLabel={t.tourney?.required} />
        <FieldError msg={fieldErrors.startDate} />
        <div className="border-t border-(--brd)" />
        <DateTimePair label={t.tourney?.tourEnd ?? 'Кінець турніру'} dateVal={endDate} onDate={setEndDate} timeVal={endTime} onTime={setEndTime} />
        </div>
        </div>
        </section>

        {/* TIMELINE — горизонтальний скрол на мобілі */}
        <section className="cdIn" style={{ animationDelay: '110ms' }}>
        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden p-5">
        <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ minWidth: 480 }}>
        <TournamentTimeline
        regFromDate={regStartDate} setRegFromDate={setRegStartDate}
        regFromTime={regStartTime} setRegFromTime={setRegStartTime}
        regToDate={regEndDate}     setRegToDate={setRegEndDate}
        regToTime={regEndTime}     setRegToTime={setRegEndTime}
        startDate={startDate}      setStartDate={setStartDate}
        startTime={startTime}      setStartTime={setStartTime}
        endDate={endDate}          setEndDate={setEndDate}
        endTime={endTime}          setEndTime={setEndTime}
        rounds={Array.from({ length: roundCount }, (_, i) => {
          const n  = i + 1;
          const rd = roundsData[n];
          return {
            number:              n,
            startDate:           rd?.startDate           ?? "",
            startTime:           rd?.startTime           ?? "",
            deadlineDate:        rd?.deadlineDate        ?? "",
            deadlineTime:        rd?.deadlineTime        ?? "",
            judgingDeadlineDate: rd?.judgingDeadlineDate ?? "",
            judgingDeadlineTime: rd?.judgingDeadlineTime ?? "",
          } satisfies RoundSlice;
        })}
        onRoundChange={handleRoundTimelineChange}
        errors={timelineErrors}
        />
        </div>
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

        {/* Зведена плашка помилок */}
        {Object.entries(fieldErrors).filter(([k]) => k !== 'general').length > 0 && (
          <div className="flex flex-col gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-xs font-black uppercase tracking-widest text-red-500">Виправте помилки перед створенням</p>
            </div>
            <ul className="flex flex-col gap-1 pl-1">
              {Object.entries(fieldErrors)
                .filter(([k]) => k !== 'general')
                .map(([key, msg]) => (
                  <li key={key} className="flex items-start gap-1.5 text-xs font-bold text-red-400">
                    <span className="mt-0.5 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    {msg}
                  </li>
                ))
              }
            </ul>
          </div>
        )}

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

        {/* ── RIGHT COLUMN (always visible on xl; tab "rounds" on mobile) ── */}
        <div className={`w-full xl:sticky xl:top-6 xl:flex-1 xl:min-w-0 ${mobileTab !== 'rounds' ? 'hidden xl:block' : ''}`}>
        <RoundSettingsPanel
        roundCount={roundCount}
        selectedRound={selectedRoundTab}
        onSelectRound={setSelectedRoundTab}
        onRoundsChange={setRoundsData}
        externalData={externalRoundDates}
        labels={t.roundPanel}
        />
        </div>

      </div>
      {/* end MAIN TWO-COLUMN LAYOUT */}

      </form>
      </div>
      </main>
      </div>

      {/* Banner Editor Modal */}
      {bannerEditorOpen && (
        <BannerEditorModal
        entityId="temp-banner"
        currentBannerUrl={bannerUrl || undefined}
        onSave={(url) => { setBannerUrl(url); setBannerError(''); }}
        onClose={() => setBannerEditorOpen(false)}
        supabase={supabase}
        apiUpload={async (blob) => {
          const token = await getToken();
          if (!token) throw new Error('Не вдалося отримати токен авторизації. Спробуйте увійти знову.');
          const form = new FormData();
          form.append('file', blob, 'banner.webp');
          const res = await fetch(`${API_URL}/api/upload/tournament-banner-temp`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? res.statusText);
          }
          const data = await res.json();
          return data.public_url as string;
        }}
        />
      )}
      </>
  );
}
