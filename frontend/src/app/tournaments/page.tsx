"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { Trophy, Users, Calendar, Zap, Loader, ChevronDown, ChevronRight } from "lucide-react";

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
    team_count: number;
}

const STATUS_COLORS: Record<TournamentStatus, string> = {
    upcoming:     "bg-amber-500/10 text-amber-500 border-amber-500/30",
    registration: "bg-green-500/10 text-green-500 border-green-500/30",
    ongoing:      "bg-blue-600/10 text-blue-600 border-blue-600/30",
    finished:     "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const SECTION_STYLES: Record<TournamentStatus, { header: string; dot: string }> = {
    upcoming:     { header: "bg-amber-500/10 text-amber-500 border-amber-500/20",  dot: "bg-amber-500" },
    registration: { header: "bg-green-500/10 text-green-500 border-green-500/20",  dot: "bg-green-500" },
    ongoing:      { header: "bg-blue-600/10 text-blue-600 border-blue-600/20",     dot: "bg-blue-500" },
    finished:     { header: "bg-gray-500/10 text-gray-400 border-gray-500/15",     dot: "bg-gray-500" },
};

function computeStatus(t: Pick<Tournament, "start_at" | "registration_from" | "registration_to">): TournamentStatus {
    const now = Date.now();
    const start   = t.start_at           ? new Date(t.start_at).getTime()           : null;
    const regFrom = t.registration_from  ? new Date(t.registration_from).getTime()  : null;
    const regTo   = t.registration_to    ? new Date(t.registration_to).getTime()    : null;

    if (start && now > start) return "finished";
    if (regFrom && regTo && now >= regFrom && now <= regTo) return "registration";
    return "upcoming";
}

function fmtDate(iso?: string, locale?: string) {
    if (!iso) return "—";
    const localeMap: Record<string, string> = { ua: "uk-UA", ru: "ru-RU", en: "en-US" };
    return new Date(iso).toLocaleDateString(localeMap[locale ?? "ua"] ?? "uk-UA", { day: "numeric", month: "short", year: "numeric" });
}

// Compact sidebar tournament row
function SidebarTournamentRow({ tournament, onClick, locale, t }: {
    tournament: Tournament;
    onClick: () => void;
    locale?: string;
    t: any;
}) {
    return (
        <button
        onClick={onClick}
        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-(--bg) transition-all group"
        >
        <p className="text-xs font-black text-(--t1) group-hover:text-blue-600 transition-colors truncate leading-tight">
        {tournament.name}
        </p>
        <p className="text-[10px] text-(--t2) font-bold mt-0.5 flex items-center gap-1.5">
        <Calendar size={9} />
        {fmtDate(tournament.start_at, locale)}
        {tournament.max_teams && (
            <>
            <span className="opacity-40">·</span>
            <Users size={9} />
            {tournament.team_count}/{tournament.max_teams}
            </>
        )}
        </p>
        </button>
    );
}

// Collapsible sidebar section
function SidebarSection({ status, tournaments, onSelect, locale, t, statusLabel }: {
    status: TournamentStatus;
    tournaments: Tournament[];
    onSelect: (id: string) => void;
    locale?: string;
    t: any;
    statusLabel: string;
}) {
    const [open, setOpen] = useState(true);
    const styles = SECTION_STYLES[status];

    return (
        <div className="border border-(--brd) rounded-2xl overflow-hidden">
        {/* Section header */}
        <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-(--brd)/60 ${styles.header} transition-all`}
        >
        <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${styles.dot} ${status === "ongoing" ? "animate-pulse" : ""}`} />
        <span className="text-[10px] font-black uppercase tracking-widest">{statusLabel}</span>
        <span className="text-[10px] font-black opacity-60">({tournaments.length})</span>
        </div>
        {open
            ? <ChevronDown size={12} className="opacity-60" />
            : <ChevronRight size={12} className="opacity-60" />
        }
        </button>

        {/* Items */}
        {open && (
            <div className="p-1.5 bg-(--card) space-y-0.5">
            {tournaments.length === 0 ? (
                <p className="text-[10px] text-(--t2) font-bold text-center py-3 opacity-50">—</p>
            ) : (
                tournaments.map(trn => (
                    <SidebarTournamentRow
                    key={trn.id}
                    tournament={trn}
                    onClick={() => onSelect(trn.id)}
                    locale={locale}
                    t={t}
                    />
                ))
            )}
            </div>
        )}
        </div>
    );
}

export default function TournamentsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const { t, locale } = useT();

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

        useEffect(() => {
            if (!user) return;
            fetchTournaments();
        }, [user]);

        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data: tournamentsData, error: tErr } = await supabase
                .from("tournaments")
                .select("id, name, rules, start_at, registration_from, registration_to, max_teams, rounds")
                .order("start_at", { ascending: true });

                if (tErr) throw tErr;

                const { data: teamsData, error: teErr } = await supabase
                .from("teams")
                .select("tournament_id")
                .not("tournament_id", "is", null);

                if (teErr) throw teErr;

                const countMap: Record<string, number> = {};
                (teamsData ?? []).forEach((team: any) => {
                    if (team.tournament_id) {
                        countMap[team.tournament_id] = (countMap[team.tournament_id] ?? 0) + 1;
                    }
                });

                const mapped: Tournament[] = (tournamentsData ?? []).map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    rules: item.rules,
                    start_at: item.start_at,
                    registration_from: item.registration_from,
                    registration_to: item.registration_to,
                    max_teams: item.max_teams,
                    rounds: item.rounds,
                    team_count: countMap[item.id] ?? 0,
                    status: item.status ?? computeStatus(item),
                }));

                setTournaments(mapped);
            } catch (e: any) {
                console.error(e);
                setError(e?.message ?? "Невідома помилка");
            } finally {
                setLoading(false);
            }
        };

        const filtered = tournaments.filter(trn =>
        !searchQ || trn.name.toLowerCase().includes(searchQ.toLowerCase())
        );

        // Group by status for main list (all, just search-filtered)
        // Group by status for right sidebar
        const byStatus = (status: TournamentStatus) =>
        tournaments.filter(trn => trn.status === status);

        if (authLoading || !user) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        const isAdmin = user.role === "admin" || user.role === "superadmin";

        const sidebarSections: { status: TournamentStatus; label: string }[] = [
            { status: "registration", label: t.tournaments.filterRegistration },
            { status: "ongoing",      label: t.tournaments.filterOngoing      },
            { status: "upcoming",     label: t.tournaments.filterUpcoming     },
            { status: "finished",     label: t.tournaments.filterFinished     },
        ];

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">

            {/* Background logo */}
            <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
            <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
            </div>

            {/* Mobile sidebar overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
            )}
            <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
            <Sidebar />
            </div>

            <main className="flex-1 flex flex-col overflow-hidden">
            <MobileHeader
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            title="Турніри"
            icon={<Trophy size={18} className="text-blue-600" />}
            />

            <div className="flex-1 overflow-y-auto">
            <div className="flex gap-0 h-full">

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-black">{t.tournaments.title}</h1>
            {isAdmin && (
                <button
                onClick={() => router.push("/register_tourney")}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
                >
                {t.tournaments.create}
                </button>
            )}
            </div>

            {/* Search */}
            <input
            type="text"
            placeholder={t.tournaments.searchPlaceholder}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full mb-5 px-4 py-2.5 rounded-xl border border-(--brd) bg-(--card) text-(--t1) text-sm outline-none focus:border-blue-600/60 transition"
            />

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-sm font-bold">
                Помилка: {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                <Loader className="animate-spin text-blue-600" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-(--t2)">
                <Trophy size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-bold">{t.tournaments.notFound}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                {filtered.map(tournament => {
                    const spotsLeft = tournament.max_teams
                    ? tournament.max_teams - tournament.team_count
                    : null;
                    const statusLabel =
                    tournament.status === "upcoming"     ? t.tournaments.statusUpcoming :
                    tournament.status === "registration" ? t.tournaments.statusRegistration :
                    tournament.status === "ongoing"      ? t.tournaments.statusOngoing :
                    t.tournaments.statusFinished;
                    const statusColor = STATUS_COLORS[tournament.status];

                    return (
                        <div
                        key={tournament.id}
                        onClick={() => router.push(`/tournaments/${tournament.id}`)}
                        className="p-5 border border-(--brd) rounded-2xl cursor-pointer bg-(--card) hover:border-blue-600/40 hover:shadow-lg transition-all group"
                        >
                        <div className="flex items-start justify-between gap-3">
                        <h2 className="font-black text-base text-(--t1) group-hover:text-blue-600 transition-colors">
                        {tournament.name}
                        </h2>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${statusColor}`}>
                        {statusLabel}
                        </span>
                        </div>

                        <div className="flex gap-4 mt-3 text-xs text-(--t2) font-bold flex-wrap">
                        <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {fmtDate(tournament.start_at, locale)}
                        </span>
                        <span className="flex items-center gap-1">
                        <Users size={13} />
                        {tournament.team_count}
                        {tournament.max_teams && ` / ${tournament.max_teams}`}
                        </span>
                        {tournament.rounds && (
                            <span className="flex items-center gap-1">
                            <Zap size={13} /> {tournament.rounds} {t.tournaments.rounds}
                            </span>
                        )}
                        </div>

                        {spotsLeft !== null && spotsLeft <= 0 && (
                            <div className="mt-2 text-red-500 text-[10px] font-black uppercase tracking-wide">
                            {t.tournaments.noSpots}
                            </div>
                        )}
                        {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                            <div className="mt-2 text-amber-500 text-[10px] font-black uppercase tracking-wide">
                            {t.tournaments.spotsLeft.replace("{n}", String(spotsLeft))}
                            </div>
                        )}
                        </div>
                    );
                })}
                </div>
            )}
            </div>

            {/* ── Right sidebar: grouped by status ── */}
            <aside className="hidden xl:flex flex-col w-72 flex-shrink-0 border-l border-(--brd) bg-(--card)/40 overflow-y-auto">
            {/* Sidebar header */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-(--brd) sticky top-0 bg-(--card)/80 backdrop-blur-sm z-10">
            <Trophy size={15} className="text-blue-600" />
            <span className="text-xs font-black uppercase tracking-widest text-(--t1)">
            {t.tournaments.title}
            </span>
            </div>

            <div className="p-3 space-y-3 flex-1">
            {loading ? (
                <div className="flex justify-center py-10">
                <Loader size={18} className="animate-spin text-blue-600" />
                </div>
            ) : (
                sidebarSections.map(({ status, label }) => (
                    <SidebarSection
                    key={status}
                    status={status}
                    tournaments={byStatus(status)}
                    onSelect={id => router.push(`/tournaments/${id}`)}
                    locale={locale}
                    t={t}
                    statusLabel={label}
                    />
                ))
            )}
            </div>
            </aside>

            </div>
            </div>
            </main>
            </div>
        );
}
