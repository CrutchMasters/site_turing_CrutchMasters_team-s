// src/app/rounds/[id]/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase, authedSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import {
    Clock, Calendar, ChevronLeft, Flag, FileText,
    AlertCircle, CheckCircle2, Loader2, Send, BookOpen,
    Edit3, Star, Users, Eye, ShieldAlert, Info,
    Lock, UserX, Crown, Gavel, Shield, ClipboardCheck,
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

/* ─── types ─────────────────────────────────────────────── */

interface Round {
    id: string;
    tournament_id: string;
    name: string;
    description?: string;
    start_at?: string;
    end_at?: string;
    status?: string;
}

interface Tournament {
    id: string;
    name: string;
    created_by: string;
}

interface MySubmission {
    id: string;
    is_draft: boolean;
    status: string;
    submitted_at?: string;
}

/* ─── helpers ──────────────────────────────────────────── */

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function useCountdown(endAt?: string) {
    const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    useEffect(() => {
        if (!endAt) return;
        const tick = () => {
            const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
            setTime({
                days:    Math.floor(diff / 86400000),
                    hours:   Math.floor((diff % 86400000) / 3600000),
                    minutes: Math.floor((diff % 3600000) / 60000),
                    seconds: Math.floor((diff % 60000) / 1000),
            });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endAt]);
    return time;
}

/* ─── sub-components ───────────────────────────────────── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-(--card) border border-(--brd) rounded-2xl p-6 ${className}`}>
        {children}
        </div>
    );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 flex-shrink-0">
        {icon}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-(--t2)">{children}</span>
        </div>
    );
}

function TimeBlock({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-1.5 flex-1">
        <div className={`w-full py-4 rounded-2xl border flex items-center justify-center ${urgent ? "bg-red-500/10 border-red-500/25" : "bg-(--bg) border-(--brd)"}`}>
        <span
        className={`text-3xl font-black tabular-nums ${urgent ? "text-red-500" : "text-(--t1)"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
        >
        {String(value).padStart(2, "0")}
        </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
        </div>
    );
}

function InfoBanner({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-700 dark:text-yellow-400 text-sm font-bold">
        <span className="flex-shrink-0 mt-0.5">{icon ?? <Info size={16} />}</span>
        <span>{children}</span>
        </div>
    );
}

function ViewOnlyBanner({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-(--brd)/50 border border-(--brd) text-(--t2) text-sm font-bold">
        <Eye size={16} className="flex-shrink-0 mt-0.5" />
        <span>{children}</span>
        </div>
    );
}

/* ─── main page ─────────────────────────────────────────── */

export default function RoundPage() {
    const params        = useParams();
    const router        = useRouter();
    const searchParams  = useSearchParams();
    const { user, token, isLoading: authLoading } = useAuth();
    const { dark }      = useTheme();
    const id            = params?.id as string;

    const [round,           setRound]           = useState<Round | null>(null);
    const [tournament,      setTournament]       = useState<Tournament | null>(null);
    const [mySubmission,    setMySubmission]     = useState<MySubmission | null>(null);
    // null = ещё не проверяли, true/false = результат
    const [isJuryInvited,   setIsJuryInvited]    = useState<boolean | null>(null);
    const [isCaptain,       setIsCaptain]        = useState<boolean>(false);
    const [loading,         setLoading]          = useState(true);
    // отдельный флаг чтобы не блокировать основной рендер
    const [juryChecking,    setJuryChecking]     = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const justSubmitted = searchParams?.get("submitted") === "1";
    const countdown = useCountdown(round?.end_at);

    /* ── 1. Fetch round + tournament ── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Берём самый свежий токен: сначала из localStorage (может быть свежее
            // чем React-стейт если рефреш случился между рендерами), затем из стейта.
            // authedSupabase сам сделает silentRefresh если токен истёк.
            const freshToken = (typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null) ?? token ?? null;
            const client = await authedSupabase(freshToken);

            // Используем maybeSingle() — не бросает исключение если запись не найдена
            const { data: roundData, error: roundErr } = await client
            .from("rounds")
            .select("*")
            .eq("id", id)
            .maybeSingle();

            if (roundErr) {
                console.error("rounds fetch error:", roundErr.message, roundErr.details, roundErr.hint);
                // Если JWT истёк и silentRefresh не помог — редиректим на логин
                if (roundErr.message?.includes("JWT expired") || roundErr.message?.includes("invalid JWT")) {
                    router.push("/login");
                    return;
                }
                throw roundErr;
            }
            if (!roundData) {
                // Раунд не найден — просто выходим, round останется null → покажем 404
                return;
            }
            setRound(roundData);

            // Tournament — не критичен для отображения раунда, не бросаем исключение
            if (roundData.tournament_id) {
                const { data: tournData, error: tournErr } = await client
                .from("tournaments")
                .select("id, created_by, name")
                .eq("id", roundData.tournament_id)
                .maybeSingle();
                if (tournErr) {
                    console.warn("tournaments fetch error:", tournErr.message, tournErr.details);
                }
                if (tournData) setTournament(tournData);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
            console.error("fetchData error:", msg);
        } finally {
            setLoading(false);
        }
    }, [id, token]);

    /* ── 2. Fetch user-specific data (после того как round+tournament загружены) ── */
    const fetchUserData = useCallback(async (tournamentId: string) => {
        if (!user) return;
        // Всегда берём самый свежий токен из localStorage
        const freshToken = (typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null) ?? token ?? null;
        if (!freshToken) return;

        // Проверяем капитанство (для role === "user").
        // Не фильтруем жёстко по tournament_id — при создании команды он null,
        // проставляется только после регистрации на турнир через отдельный эндпоинт.
        // Ищем: есть ли у юзера команда зарегистрированная на этот турнир;
        // если нет — fallback: любая команда где он капитан (бэкенд сам отклонит).
        if (user.role === "user") {
            try {
                const { data: teamRows } = await (await authedSupabase(freshToken))
                .from("teams")
                .select("id, tournament_id")
                .eq("captain_id", user.id)
                .limit(20);
                const rows = teamRows ?? [];
                const inTournament = rows.some(t => t.tournament_id === tournamentId);
                setIsCaptain(inTournament || rows.length > 0);
            } catch {
                setIsCaptain(false);
            }
        }

        // Проверяем приглашение журі
        // Таблица: jury_tournament_invitations, поля: jury_id, tournament_id, status
        if (user.role === "jury") {
            setJuryChecking(true);
            try {
                const { data: invRow } = await (await authedSupabase(freshToken))
                .from("jury_tournament_invitations")
                .select("id")
                .eq("jury_id", user.id)
                .eq("tournament_id", tournamentId)
                .eq("status", "accepted")
                .maybeSingle();
                setIsJuryInvited(!!invRow);
            } catch {
                setIsJuryInvited(false);
            } finally {
                setJuryChecking(false);
            }
        }

        // Ищем существующую submission
        try {
            const res = await fetch(`${API_URL}/api/rounds/${id}/submission`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const json = await res.json();
                if (json.submission) setMySubmission(json.submission);
            }
        } catch { /* silent */ }

    }, [user, token, id]);

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

        useEffect(() => {
            if (!authLoading && user && id) fetchData();
        }, [id, authLoading, user, fetchData]);

            // Запускаем fetchUserData только когда tournament уже загружен
            useEffect(() => {
                if (!authLoading && user && tournament?.id) {
                    fetchUserData(tournament.id);
                }
            }, [authLoading, user, tournament?.id, fetchUserData]);

            /* ── derived ── */
            const role         = user?.role ?? null;
            const isSuperAdmin = role === "superadmin";
            const isAdmin      = role === "admin";
            const isJury       = role === "jury";
            const isUser       = role === "user";
            const isOwner      = !!user && !!tournament && tournament.created_by === user.id;

            const roundActive  = round?.status === "active";
            const roundDraft   = round?.status === "draft";
            const now          = Date.now();
            const endTs        = round?.end_at ? new Date(round.end_at).getTime() : 0;
            const startTs      = round?.start_at ? new Date(round.start_at).getTime() : 0;
            let progressPct    = 0;
            if (endTs > 0 && startTs > 0 && endTs > startTs)
                progressPct = Math.min(100, Math.max(0, ((now - startTs) / (endTs - startTs)) * 100));
    const isUrgent = progressPct > 80;
    const isEnded  = endTs > 0 && now > endTs;

    /* ── loading guards ── */
    if (authLoading || loading) return (
        <div className="flex min-h-screen bg-(--bg)">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-(--t2)" />
        </main>
        </div>
    );

    if (!round) return (
        <div className="flex min-h-screen bg-(--bg)">
        <Sidebar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <AlertCircle size={28} className="text-(--t2)" />
        <p className="text-(--t2) font-bold">Раунд не знайдено</p>
        <button onClick={() => router.back()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm bg-(--card) border border-(--brd) text-(--t1) hover:border-blue-600/40 hover:text-blue-600 transition-all font-bold">
        <ChevronLeft size={16} /> Назад
        </button>
        </main>
        </div>
    );

    /* ─────────────────────────────────────────────────────
     *      ROLE-BASED ACTIONS PANEL
     *      ───────────────────────────────────────────────────── */
    const renderActionsPanel = () => {

        /* ── SUPERADMIN ── */
        if (isSuperAdmin) {
            return (
                <Card>
                <SectionLabel icon={<Crown size={13} />}>Панель суперадміна</SectionLabel>
                <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 text-xs font-bold">
                <Crown size={13} className="flex-shrink-0" />
                Суперадмін — повний доступ до всіх функцій
                </div>
                <a href={`/jury/rounds/${id}/evaluate`} onClick={(e) => { e.preventDefault(); router.push(`/jury/rounds/${id}/evaluate`); }}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all">
                <Gavel size={15} /> Оцінити роботи
                </a>
                <a href={`/rounds/${id}/submit`} onClick={(e) => { e.preventDefault(); router.push(`/rounds/${id}/submit`); }}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest border border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 active:scale-[0.98] transition-all">
                <Send size={15} /> Здати роботу
                </a>
                <a href={`/jury/rounds/${id}/distribute`} onClick={(e) => { e.preventDefault(); router.push(`/jury/rounds/${id}/distribute`); }}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest border border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 active:scale-[0.98] transition-all">
                <Users size={15} /> Розподілити завдання
                </a>
                <a href={`/tournaments/${round.tournament_id}/edit`} onClick={(e) => { e.preventDefault(); router.push(`/tournaments/${round.tournament_id}/edit`); }}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest border border-(--brd) bg-(--card) text-(--t1) hover:border-blue-600/40 hover:text-blue-600 active:scale-[0.98] transition-all">
                <Edit3 size={15} /> Редагувати турнір
                </a>
                </div>
                </Card>
            );
        }

        /* ── ADMIN ── */
        if (isAdmin) {
            if (isOwner) {
                return (
                    <Card>
                    <SectionLabel icon={<ShieldAlert size={13} />}>Панель адміна</SectionLabel>
                    <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 text-xs font-bold">
                    <ShieldAlert size={13} className="flex-shrink-0" />
                    Ви власник цього турніру
                    </div>
                    <a href={`/rounds/${id}/edit`} onClick={(e) => { e.preventDefault(); router.push(`/rounds/${id}/edit`); }}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all">
                    <Edit3 size={15} /> Редагувати раунд
                    </a>
                    <a href={`/jury/rounds/${id}/distribute`} onClick={(e) => { e.preventDefault(); router.push(`/jury/rounds/${id}/distribute`); }}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest border border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 active:scale-[0.98] transition-all">
                    <Users size={15} /> Розподілити завдання
                    </a>
                    </div>
                    </Card>
                );
            }
            // Адмін, не власник
            return (
                <Card>
                <SectionLabel icon={<ShieldAlert size={13} />}>Панель адміна</SectionLabel>
                <ViewOnlyBanner>
                Ви адмін, але не є власником цього турніру. Управління та редагування недоступні — це чужий турнір.
                </ViewOnlyBanner>
                </Card>
            );
        }

        /* ── JURY ── */
        if (isJury) {
            // Ідёт перевірка запрошення
            if (juryChecking || isJuryInvited === null) {
                return (
                    <Card>
                    <SectionLabel icon={<Gavel size={13} />}>Панель журі</SectionLabel>
                    <div className="flex items-center gap-2 text-(--t2) text-sm font-bold">
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    Перевірка запрошення...
                    </div>
                    </Card>
                );
            }

            if (isJuryInvited) {
                return (
                    <Card>
                    <SectionLabel icon={<Gavel size={13} />}>Панель журі</SectionLabel>
                    <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-bold">
                    <CheckCircle2 size={13} className="flex-shrink-0" />
                    Ви запрошені як журі для цього турніру
                    </div>
                    {roundActive ? (
                        <a href={`/jury/rounds/${id}/evaluate`} onClick={(e) => { e.preventDefault(); router.push(`/jury/rounds/${id}/evaluate`); }}
                        className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all">
                        <Gavel size={15} /> Оцінити роботи
                        </a>
                    ) : (
                        <InfoBanner icon={<Clock size={16} />}>
                        Оцінювання буде доступне після початку активної фази раунду.
                        Поточний статус: <b>{round.status ?? "невідомо"}</b>
                        </InfoBanner>
                    )}
                    </div>
                    </Card>
                );
            }

            // Не запрошений
            return (
                <Card>
                <SectionLabel icon={<Gavel size={13} />}>Панель журі</SectionLabel>
                <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
                <UserX size={13} className="flex-shrink-0" />
                Вас не запрошено як журі для цього турніру
                </div>
                <ViewOnlyBanner>
                Оцінювання недоступне. Зверніться до організатора, якщо вважаєте це помилкою.
                </ViewOnlyBanner>
                </div>
                </Card>
            );
        }

        /* ── USER ── */
        if (isUser) {
            // Раунд — чернетка
            if (roundDraft) {
                return (
                    <Card>
                    <SectionLabel icon={<Flag size={13} />}>Здача роботи</SectionLabel>
                    <InfoBanner icon={<Lock size={16} />}>
                    Цей раунд ще не розпочато. Здача стане доступна після того, як організатор активує раунд.
                    </InfoBanner>
                    </Card>
                );
            }

            // Раунд завершено
            if (isEnded || round.status === "closed" || round.status === "finished") {
                return (
                    <Card>
                    <SectionLabel icon={<Flag size={13} />}>Здача роботи</SectionLabel>
                    {mySubmission && !mySubmission.is_draft ? (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-sm font-bold">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        Вашу роботу здано. Статус:&nbsp;<b>{mySubmission.status}</b>
                        </div>
                    ) : mySubmission?.is_draft ? (
                        <InfoBanner icon={<AlertCircle size={16} />}>
                        Дедлайн минув. Ваша чернетка не була підтверджена як фінальна здача.
                        </InfoBanner>
                    ) : (
                        <InfoBanner icon={<AlertCircle size={16} />}>
                        Дедлайн минув. Здача нових робіт більше не приймається.
                        </InfoBanner>
                    )}
                    </Card>
                );
            }

            // Раунд активний
            if (roundActive) {
                if (!isCaptain) {
                    return (
                        <Card>
                        <SectionLabel icon={<Flag size={13} />}>Здача роботи</SectionLabel>
                        <InfoBanner icon={<Users size={16} />}>
                        Здавати роботу може лише капітан команди. Якщо ви капітан і бачите це — зверніться до організатора.
                        </InfoBanner>
                        </Card>
                    );
                }

                return (
                    <Card>
                    <SectionLabel icon={<Flag size={13} />}>Здача роботи</SectionLabel>
                    <div className="flex flex-col gap-3">
                    {mySubmission && (
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold ${
                            mySubmission.is_draft
                            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600"
                            : "bg-green-500/10 border-green-500/20 text-green-600"
                        }`}>
                        {mySubmission.is_draft
                            ? <><BookOpen size={13} className="flex-shrink-0" />&nbsp;Є збережена чернетка</>
                            : <><CheckCircle2 size={13} className="flex-shrink-0" />&nbsp;Роботу здано · {fmtDate(mySubmission.submitted_at)}</>
                        }
                        </div>
                    )}
                    {justSubmitted && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-bold">
                        <CheckCircle2 size={13} className="flex-shrink-0" /> Роботу успішно здано!
                        </div>
                    )}
                    <a href={`/rounds/${id}/submit`} onClick={(e) => { e.preventDefault(); router.push(`/rounds/${id}/submit`); }}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all">
                    <Send size={15} />
                    {mySubmission ? "Оновити здачу" : "Здати роботу"}
                    </a>
                    </div>
                    </Card>
                );
            }

            // Будь-який інший статус
            return (
                <Card>
                <SectionLabel icon={<Flag size={13} />}>Здача роботи</SectionLabel>
                <ViewOnlyBanner>
                Здача недоступна. Статус раунду: <b>{round.status ?? "невідомо"}</b>
                </ViewOnlyBanner>
                </Card>
            );
        }

        // Не авторизований
        return (
            <Card>
            <SectionLabel icon={<Flag size={13} />}>Здача роботи</SectionLabel>
            <InfoBanner icon={<AlertCircle size={16} />}>
            Для участі необхідно{" "}
            <a href={"/login"} onClick={(e) => { e.preventDefault(); router.push("/login"); }} className="underline font-black">
            увійти в акаунт
            </a>.
            </InfoBanner>
            </Card>
        );
    };

    /* ─── render ─────────────────────────────────────────── */
    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
        <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
        </div>

        <Sidebar />

        {isMobileSidebarOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)} />
        )}

        <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
        <MobileHeader
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        title={round.name}
        icon={<Flag size={18} className="text-blue-600" />}
        />

        <div className="p-6 max-w-5xl w-full mx-auto">

        {/* back */}
        <button
        href={`/tournaments/${round!.tournament_id}`} onClick={(e) => { e.preventDefault(); router.push(`/tournaments/${round!.tournament_id}`); }}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors group"
        >
        <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        Назад до турніру
        </button>

        {/* badges + title */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-600/20">
        Раунд
        </span>
        <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${
            round.status === "active"    ? "bg-green-500/10 text-green-600 border-green-500/20"
            : round.status === "draft"   ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            : "bg-(--brd) text-(--t2) border-(--brd)"
        }`}>
        {round.status === "active"    ? "Активний"
            : round.status === "draft"   ? "Чернетка"
            : round.status === "closed"  ? "Закрито"
            : round.status === "finished"? "Завершено"
            : round.status ?? "Невідомо"}
            </span>
            {tournament && (
                <span className="text-[11px] font-bold text-(--t2)">{tournament.name}</span>
            )}
            </div>

            <h1 className="text-2xl font-black text-(--t1) leading-tight mb-8">
            {round.name}
            </h1>

            {/* main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── LEFT ── */}
            <div className="flex flex-col gap-4">

            {/* Опис раунду */}
            <Card className="overflow-hidden min-w-0">
            <SectionLabel icon={<FileText size={13} />}>Опис раунду</SectionLabel>
            {round.description ? (
                <div className="overflow-hidden w-full min-w-0">
                <MarkdownRenderer content={round.description} className="break-words" />
                </div>
            ) : (
                <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-(--bg) border border-(--brd)">
                <Info size={15} className="flex-shrink-0 mt-0.5 text-(--t2)" />
                <p className="text-sm text-(--t2) font-medium leading-relaxed">
                Автор турніру не додав опис до цього раунду. Деталі та вимоги можуть бути надані окремо.
                </p>
                </div>
            )}
            </Card>

            </div>

            {/* ── RIGHT ── */}
            <div className="flex flex-col gap-4">
            {/* Дедлайн — вище панелі дій */}
            <Card>
            <SectionLabel icon={<Clock size={13} />}>
            Дедлайн {isEnded ? "(завершено)" : `до ${fmtDate(round.end_at)}`}
            </SectionLabel>

            <div className="flex items-end gap-2 mb-5">
            <TimeBlock value={countdown.days}    label="днів"  urgent={isUrgent} />
            <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
            <TimeBlock value={countdown.hours}   label="год"   urgent={isUrgent} />
            <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
            <TimeBlock value={countdown.minutes} label="хв"    urgent={isUrgent} />
            <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
            <TimeBlock value={countdown.seconds} label="сек"   urgent={isUrgent} />
            </div>

            {endTs > 0 && (
                <>
                <div className="relative h-2 rounded-full bg-(--brd) overflow-hidden mb-1">
                <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                style={{
                    width: `${progressPct}%`,
                    background: isUrgent
                    ? "linear-gradient(90deg,#f97316,#ef4444)"
                    : "linear-gradient(90deg,#2563eb,#1d4ed8)",
                           minWidth: progressPct > 0 ? 8 : 0,
                }}
                />
                {progressPct > 0 && progressPct < 100 && (
                    <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-(--card) transition-all duration-1000"
                    style={{
                        left: `calc(${progressPct}% - 8px)`,
                                                          background: isUrgent ? "#ef4444" : "#2563eb",
                                                          boxShadow: `0 0 0 3px ${isUrgent ? "rgba(239,68,68,0.25)" : "rgba(37,99,235,0.25)"}`,
                    }}
                    />
                )}
                </div>
                <div className="flex items-center justify-between">
                <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
                <Calendar size={12} /> {round.start_at ? fmtDate(round.start_at) : "Старт не вказано"}
                </span>
                <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
                {fmtDate(round.end_at)} <Calendar size={12} />
                </span>
                </div>
                </>
            )}
            </Card>

            {renderActionsPanel()}
            </div>

            </div>{/* end grid */}
            </div>{/* end p-6 container */}
            </main>
            </div>
    );
}
