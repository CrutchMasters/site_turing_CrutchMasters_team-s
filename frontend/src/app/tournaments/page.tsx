"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Trophy, Users, Calendar, Zap, Loader, Search, Plus,
    ChevronRight, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

type TournamentStatus = "upcoming" | "registration" | "ongoing" | "finished";

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    start_at: string;
    registration_from?: string;
    registration_to?: string;
    max_teams?: number;
    rounds?: number;
    status: TournamentStatus;
    end_at?: string;
    team_count: number;
}

function computeStatus(tt: Pick<Tournament, "start_at" | "registration_from" | "registration_to">): TournamentStatus {
    const now     = Date.now();
    const start   = tt.start_at           ? new Date(tt.start_at).getTime()           : null;
    const regFrom = tt.registration_from  ? new Date(tt.registration_from).getTime()  : null;
    const regTo   = tt.registration_to    ? new Date(tt.registration_to).getTime()    : null;
    // реєстрація відкрита
    if (regFrom && regTo && now >= regFrom && now <= regTo) return "registration";
    // турнір розпочався — якщо є кінець реєстрації і він минув, турнір в процесі
    // завершеним вважаємо тільки якщо явно вказано статус у БД
    if (start && now >= start) return "ongoing";
    return "upcoming";
}

function fmtDate(iso?: string, locale?: string) {
    if (!iso) return "—";
    const lm: Record<string, string> = { ua: "uk-UA", en: "en-US" };
    return new Date(iso).toLocaleString(lm[locale ?? "ua"] ?? "uk-UA", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// ─── Section right panel ──────────────────────────────────────────────────────
interface SectionConfig {
    key: TournamentStatus;
    label: string;
    accent: string;       // tailwind text colour
    accentBg: string;     // tailwind bg colour  (badge bg)
    accentBorder: string; // tailwind border colour
    dot: string;          // tailwind bg colour for the dot
    defaultOpen: boolean;
}

const BASE_SECTIONS: Omit<SectionConfig, "label">[] = [
    { key: "ongoing",      accent: "text-blue-500",   accentBg: "bg-blue-500/10",   accentBorder: "border-blue-500/20",   dot: "bg-blue-500",   defaultOpen: true  },
    { key: "registration", accent: "text-green-500",  accentBg: "bg-green-500/10",  accentBorder: "border-green-500/20",  dot: "bg-green-500",  defaultOpen: true  },
    { key: "upcoming",     accent: "text-amber-500",  accentBg: "bg-amber-500/10",  accentBorder: "border-amber-500/20",  dot: "bg-amber-500",  defaultOpen: true  },
    { key: "finished",     accent: "text-gray-400",   accentBg: "bg-gray-500/10",   accentBorder: "border-gray-500/20",  dot: "bg-gray-500",   defaultOpen: false },
];

function getSections(t: any): SectionConfig[] {
    const labels: Record<string, string> = {
        ongoing:      t.tournaments?.statusOngoing      ?? "В процесі",
        registration: t.tournaments?.statusRegistration ?? "Реєстрація",
        upcoming:     t.tournaments?.statusUpcoming     ?? "Скоро",
        finished:     t.tournaments?.statusFinished     ?? "Завершено",
    };
    return BASE_SECTIONS.map(s => ({ ...s, label: labels[s.key] }));
}

// ─── Compact row inside the right panel ───────────────────────────────────────
function TournamentRow({
    tt, locale, cfg, onClick,
}: {
    tt: Tournament; locale: string; cfg: SectionConfig; onClick: () => void;
}) {
    const spotsLeft = tt.max_teams ? tt.max_teams - tt.team_count : null;

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.accentBorder} ${cfg.accentBg} hover:brightness-110 transition-all active:scale-[0.99] group text-left`}
        >
            {/* coloured dot */}
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

            {/* name */}
            <span className="flex-1 text-sm font-bold text-(--t1) group-hover:text-blue-600 transition-colors truncate">
                {tt.name}
            </span>

            {/* meta */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        {spotsLeft} місць
                    </span>
                )}
                <span className="text-[10px] font-bold text-(--t2) tabular-nums">
                    {fmtDate(tt.start_at, locale)}
                </span>
                <ExternalLink size={12} className="text-(--t2) opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </button>
    );
}

// ─── Collapsible section block ─────────────────────────────────────────────────
function SectionBlock({
    cfg, items, locale, onOpen,
}: {
    cfg: SectionConfig; items: Tournament[]; locale: string; onOpen: (id: string) => void;
}) {
    const [open, setOpen] = useState(cfg.defaultOpen);
    if (items.length === 0) return null;

    return (
        <div className="mb-2">
            {/* header */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl hover:bg-(--bg) transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.accent}`}>
                        {cfg.label}
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${cfg.accentBg} ${cfg.accent} ${cfg.accentBorder}`}>
                        {items.length}
                    </span>
                </div>
                {open
                    ? <ChevronUp   size={13} className="text-(--t2)" />
                    : <ChevronDown size={13} className="text-(--t2)" />
                }
            </button>

            {/* rows */}
            {open && (
                <div className="mt-0.5 flex flex-col gap-0.5">
                    {items.map(tt => (
                        <TournamentRow
                            key={tt.id}
                            tt={tt}
                            locale={locale}
                            cfg={cfg}
                            onClick={() => onOpen(tt.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Active tournament card (main list) ───────────────────────────────────────
function TournamentCard({
    tt, locale, cfg, onClick,
}: {
    tt: Tournament; locale: string; cfg: SectionConfig; onClick: () => void;
}) {
    const spotsLeft = tt.max_teams ? tt.max_teams - tt.team_count : null;
    const spotsAlmostFull = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 5;

    return (
        <button
            onClick={onClick}
            className="w-full text-left rounded-2xl border border-(--brd) bg-(--card) p-4 sm:p-5 flex flex-col gap-3 hover:scale-[1.01] hover:border-blue-600/40 active:scale-[0.99] transition-all group shadow-sm"
        >
            {/* Top row: dot + name + status badge */}
            <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} animate-pulse`} />
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border whitespace-nowrap ${cfg.accentBg} ${cfg.accent} ${cfg.accentBorder} flex-shrink-0`}>
                    {cfg.label}
                </span>
                {spotsAlmostFull && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex-shrink-0">
                        {spotsLeft} місць
                    </span>
                )}
                <ExternalLink size={12} className="ml-auto text-(--t2) opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>

            {/* Tournament name */}
            <p className={`text-base font-black text-(--t1) leading-tight group-hover:${cfg.accent} transition-colors truncate`}>
                {tt.name}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-(--t2) uppercase tracking-wider">
                <span className="flex items-center gap-1">
                    <Calendar size={11} className="flex-shrink-0" />
                    {fmtDate(tt.start_at, locale)}
                </span>
                <span className="flex items-center gap-1">
                    <Users size={11} className="flex-shrink-0" />
                    {tt.team_count}{tt.max_teams ? `/${tt.max_teams}` : ""} команд
                </span>
                {tt.rounds && (
                    <span className="flex items-center gap-1">
                        <Zap size={11} className="flex-shrink-0" />
                        {tt.rounds} раундів
                    </span>
                )}
            </div>
        </button>
    );
}

// ─── Active tournaments list (below search) ────────────────────────────────────
function ActiveTournamentsList({
    tournaments, locale, searchQ, onOpen, t,
}: {
    tournaments: Tournament[]; locale: string; searchQ: string; onOpen: (id: string) => void; t: any;
}) {
    const SECTIONS = getSections(t);
    const active = tournaments.filter(tt =>
        (tt.status === "ongoing" || tt.status === "registration") &&
        (!searchQ || tt.name.toLowerCase().includes(searchQ.toLowerCase()))
    );

    if (active.length === 0) return null;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Zap size={13} className="text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
                    {t.tournaments?.statusOngoing ?? "Актуальні турніри"}
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    {active.length}
                </span>
            </div>
            <div className="flex flex-col gap-2">
                {active.map(tt => {
                    const cfg = SECTIONS.find(s => s.key === tt.status) ?? SECTIONS[0];
                    return (
                        <TournamentCard
                            key={tt.id}
                            tt={tt}
                            locale={locale}
                            cfg={cfg}
                            onClick={() => onOpen(tt.id)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TournamentsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const { t, locale } = useT();

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState<string | null>(null);
    const [searchQ, setSearchQ]         = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;
        fetchTournaments();
    }, [user]);

    const fetchTournaments = async () => {
        setLoading(true); setError(null);
        try {
            const { data: tData, error: tErr } = await supabase
                .from("tournaments")
                .select("id, name, rules, start_at, end_at, registration_from, registration_to, max_teams, rounds, status")
                .order("start_at", { ascending: true });
            if (tErr) throw tErr;

            const { data: teData, error: teErr } = await supabase
                .from("teams").select("tournament_id").not("tournament_id", "is", null);
            if (teErr) throw teErr;

            const countMap: Record<string, number> = {};
            (teData ?? []).forEach((row: any) => {
                if (row.tournament_id)
                    countMap[row.tournament_id] = (countMap[row.tournament_id] ?? 0) + 1;
            });

            setTournaments((tData ?? []).map((item: any) => ({
                id:                item.id,
                name:              item.name,
                rules:             item.rules,
                start_at:          item.start_at,
                registration_from: item.registration_from,
                registration_to:   item.registration_to,
                max_teams:         item.max_teams,
                rounds:            item.rounds,
                team_count:        countMap[item.id] ?? 0,
                status:            item.status ?? computeStatus(item),
            })));
        } catch (e: any) {
            setError(e?.message ?? "Невідома помилка");
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    const byStatus = (status: TournamentStatus) =>
        tournaments.filter(tt =>
            tt.status === status &&
            (!searchQ || tt.name.toLowerCase().includes(searchQ.toLowerCase()))
        );

    // counts (unfiltered by search for header stats)
    const total    = tournaments.length;
    const active   = tournaments.filter(tt => tt.status === "ongoing" || tt.status === "registration").length;
    const openReg  = tournaments.filter(tt => tt.status === "registration").length;

    if (authLoading || !user) return (
        <div className="min-h-screen bg-(--bg) flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style jsx global>{`
                @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
                @keyframes scaleIn { from{opacity:0;transform:scale(.96)}       to{opacity:1;transform:scale(1)} }
                .fuIn { animation: fadeUp  340ms cubic-bezier(.22,1,.36,1) both }
                .scIn { animation: scaleIn 300ms cubic-bezier(.22,1,.36,1) both }
            `}</style>

            {/* Watermark */}
            <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
            </div>

            {/* Mobile overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                     onClick={() => setIsMobileSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
                <Sidebar />
            </div>

            {/* Main */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <MobileHeader
                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                    title={t.tournaments?.title ?? "Турніри"}
                    icon={<Trophy size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 lg:p-10 relative z-10">

                    {/* Breadcrumb */}
                    <nav className="fuIn flex items-center gap-2 text-[10px] font-black mb-4 sm:mb-6 uppercase tracking-widest text-(--t2)">
                        <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">
                            {t.nav?.home ?? "Home"}
                        </button>
                        <ChevronRight size={10} />
                        <span className="text-(--t1)">{t.tournaments?.title ?? "Турніри"}</span>
                    </nav>

                    {/* Page title */}
                    <h1 className="fuIn text-xl sm:text-2xl lg:text-3xl font-black text-(--t1) uppercase tracking-tight mb-5 sm:mb-8"
                        style={{ animationDelay: "40ms" }}>
                        {t.tournaments?.title ?? "Турніри"}
                    </h1>

                    {/* ── Two-column layout ─────────────────────────────────────── */}
                    <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 items-start max-w-7xl mx-auto">

                        {/* ════ LEFT: search + results ════ */}
                        <div className="w-full flex-1 min-w-0 flex flex-col gap-4 sm:gap-5 fuIn" style={{ animationDelay: "80ms" }}>

                            {/* Panel label */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
                                        <Search size={15} className="text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) truncate">
                                            {t.tournaments?.title ?? "Турніри"}
                                        </h2>
                                        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                                            {loading ? (t.common?.loading ?? "Завантаження...") : `${total} турнірів`}
                                        </p>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => router.push("/register_tourney")}
                                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-lg shadow-blue-600/25 active:scale-95 transition-all group flex-shrink-0"
                                    >
                                        <Plus size={13} className="group-hover:rotate-90 transition-transform duration-300" />
                                        {t.tournaments?.create ?? "Створити"}
                                    </button>
                                )}
                            </div>

                            {/* Search box */}
                            <div className="scIn bg-(--card) rounded-2xl sm:rounded-[2rem] shadow-xl border border-(--brd) p-3 sm:p-6"
                                 style={{ animationDelay: "100ms" }}>
                                <div className="relative">
                                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-4 h-4 sm:w-5 sm:h-5" />
                                    <input
                                        type="text"
                                        placeholder={t.tournaments?.searchPlaceholder ?? "Пошук турнірів…"}
                                        value={searchQ}
                                        onChange={e => setSearchQ(e.target.value)}
                                        className="w-full pl-10 sm:pl-12 pr-4 sm:pr-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm transition-all"
                                    />
                                </div>
                                {searchQ && (
                                    <p className="mt-2 text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                                        {tournaments.filter(tt => tt.name.toLowerCase().includes(searchQ.toLowerCase())).length} результатів
                                    </p>
                                )}
                            </div>

                            {/* Active tournaments */}
                            {!loading && (
                                <ActiveTournamentsList
                                    tournaments={tournaments}
                                    locale={locale}
                                    searchQ={searchQ}
                                    onOpen={id => router.push(`/tournaments/${id}`)}
                                    t={t}
                                />
                            )}

                            {/* Error */}
                            {error && (
                                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 text-sm font-bold">
                                    Помилка: {error}
                                </div>
                            )}

                            {/* Loading */}
                            {loading && (
                                <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-4">
                                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">
                                        {t.common?.loading ?? "Завантаження..."}
                                    </p>
                                </div>
                            )}

                            {/* Empty state */}
                            {!loading && !error && tournaments.length === 0 && (
                                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-10 sm:p-16 text-center">
                                    <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-(--t2) mx-auto mb-4 opacity-30" />
                                    <p className="text-base sm:text-lg font-black text-(--t1) mb-2">Немає турнірів</p>
                                    <p className="text-sm text-(--t2)">Поки що турнірів не заплановано</p>
                                </div>
                            )}
                        </div>

                        {/* ════ RIGHT: sections panel ════ */}
                        {!loading && tournaments.length > 0 && (
                            <MobileOverviewPanel
                                byStatus={byStatus}
                                locale={locale}
                                searchQ={searchQ}
                                onOpen={id => router.push(`/tournaments/${id}`)}
                                t={t}
                            />
                        )}

                    </div>

                </div>
            </main>
        </div>
    );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
    label, value, color, bg, border,
}: {
    label: string; value: number; color: string; bg: string; border: string;
}) {
    return (
        <div className={`${bg} border ${border} rounded-2xl px-4 py-3 flex flex-col items-center text-center`}>
            <span className={`text-2xl font-black leading-none ${color}`}>{value}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-(--t2) mt-1">{label}</span>
        </div>
    );
}

// ─── Mobile-friendly Overview Panel ──────────────────────────────────────────
function MobileOverviewPanel({
    byStatus, locale, searchQ, onOpen, t,
}: {
    byStatus: (s: TournamentStatus) => Tournament[];
    locale: string;
    searchQ: string;
    onOpen: (id: string) => void;
    t: any;
}) {
    const SECTIONS = getSections(t);
    // На xl — завжди відкрито, на мобілі — закрито за замовчуванням
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1280;

    const cardContent = (
        <>
            {SECTIONS.map(cfg => (
                <SectionBlock
                    key={cfg.key}
                    cfg={cfg}
                    items={byStatus(cfg.key)}
                    locale={locale}
                    onOpen={onOpen}
                />
            ))}
            {searchQ && SECTIONS.every(cfg => byStatus(cfg.key).length === 0) && (
                <div className="py-8 text-center">
                    <Trophy size={28} className="mx-auto mb-2 text-(--t2) opacity-30" />
                    <p className="text-sm font-bold text-(--t2)">{t.tournaments?.notFound ?? "Нічого не знайдено"}</p>
                </div>
            )}
        </>
    );

    return (
        <div className="w-full xl:w-[400px] flex-shrink-0 fuIn" style={{ animationDelay: "120ms" }}>

            {/* Header — тапабельний на мобілі, просто заголовок на xl */}
            <button
                className="w-full flex items-center justify-between gap-3 mb-3"
                onClick={() => setMobileOpen(v => !v)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Trophy size={15} className="text-amber-500" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-sm font-black uppercase tracking-widest text-(--t1)">{t.tournaments?.overview ?? "Огляд"}</h2>
                        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">{t.tournaments?.byStatus ?? "За статусом"}</p>
                    </div>
                </div>
                <span className="xl:hidden text-(--t2)">
                    {mobileOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
            </button>

            {/* На мобілі — показуємо тільки якщо відкрито */}
            <div className="xl:hidden">
                {mobileOpen && (
                    <div className="bg-(--card) rounded-2xl shadow-xl border border-(--brd) p-4 flex flex-col gap-1">
                        {cardContent}
                    </div>
                )}
            </div>

            {/* На xl — завжди видима */}
            <div className="hidden xl:block">
                <div className="scIn bg-(--card) rounded-[2rem] shadow-xl border border-(--brd) p-5 flex flex-col gap-1"
                     style={{ animationDelay: "140ms" }}>
                    {cardContent}
                </div>
            </div>

        </div>
    );
}