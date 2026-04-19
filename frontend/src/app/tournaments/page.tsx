"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { Trophy, Users, Calendar, Zap, Loader } from "lucide-react";

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

const STATUS_CONFIG: Record<TournamentStatus, { label: string; color: string }> = {
    upcoming:     { label: "Скоро",      color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
    registration: { label: "Реєстрація", color: "bg-green-500/10 text-green-500 border-green-500/30" },
    ongoing:      { label: "Тривають",   color: "bg-blue-600/10 text-blue-600 border-blue-600/30" },
    finished:     { label: "Завершено",  color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

// Use DB status directly; only fall back to date logic if DB value is missing
function resolveStatus(
    dbStatus: string | null | undefined,
    t: Pick<Tournament, "start_at" | "registration_from" | "registration_to">
): TournamentStatus {
    const valid: TournamentStatus[] = ["upcoming", "registration", "ongoing", "finished"];
    if (dbStatus && valid.includes(dbStatus as TournamentStatus)) {
        return dbStatus as TournamentStatus;
    }
    const now = Date.now();
    const start   = t.start_at           ? new Date(t.start_at).getTime()          : null;
    const regFrom = t.registration_from  ? new Date(t.registration_from).getTime() : null;
    const regTo   = t.registration_to    ? new Date(t.registration_to).getTime()   : null;
    if (start && now >= start) return "ongoing";
    if (regFrom && regTo && now >= regFrom && now <= regTo) return "registration";
    return "upcoming";
}

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" });
}

export default function TournamentsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | TournamentStatus>("all");
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
                // Fetch tournaments including the status column from DB
                const { data: tourData, error: tErr } = await supabase
                .from("tournaments")
                .select("id, name, rules, start_at, registration_from, registration_to, max_teams, rounds, status")
                .order("start_at", { ascending: true });
                if (tErr) throw tErr;

                // Count registered teams per tournament via teams.tournament_id
                // (tournament_teams table does not exist in this project)
                const ids = (tourData ?? []).map((t: any) => t.id);
                const countMap: Record<string, number> = {};

                if (ids.length > 0) {
                    const { data: teamsData, error: teErr } = await supabase
                    .from("teams")
                    .select("tournament_id")
                    .not("tournament_id", "is", null)
                    .in("tournament_id", ids);
                    if (teErr) throw teErr;

                    (teamsData ?? []).forEach((team: any) => {
                        countMap[team.tournament_id] = (countMap[team.tournament_id] ?? 0) + 1;
                    });
                }

                const mapped: Tournament[] = (tourData ?? []).map((item: any) => ({
                    id:                item.id,
                    name:              item.name,
                    rules:             item.rules,
                    start_at:          item.start_at,
                    registration_from: item.registration_from,
                    registration_to:   item.registration_to,
                    max_teams:         item.max_teams,
                    rounds:            item.rounds,
                    team_count:        countMap[item.id] ?? 0,
                    status:            resolveStatus(item.status, item),
                }));

                setTournaments(mapped);
            } catch (e: any) {
                console.error(e);
                setError(e?.message ?? "Невідома помилка");
            } finally {
                setLoading(false);
            }
        };

        const filtered = tournaments.filter(t => {
            const matchFilter = filter === "all" || t.status === filter;
            const matchSearch = !searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase());
            return matchFilter && matchSearch;
        });

        if (authLoading || !user) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        const isAdmin = user.role === "admin" || user.role === "superadmin";

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
            <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
            <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
            </div>

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

            <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-black">Турніри</h1>
            {isAdmin && (
                <button
                onClick={() => router.push("/register_tourney")}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
                >
                Створити
                </button>
            )}
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "upcoming", "registration", "ongoing", "finished"] as const).map(f => (
                <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${
                    filter === f
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-(--card) text-(--t2) border-(--brd) hover:border-blue-600/40"
                }`}
                >
                {f === "all" ? "Всі" : STATUS_CONFIG[f].label}
                </button>
            ))}
            </div>

            <input
            type="text"
            placeholder="Пошук..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full mb-4 px-4 py-2 rounded-xl border border-(--brd) bg-(--card) text-(--t1) text-sm outline-none focus:border-blue-600/60 transition"
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
                <p className="font-bold">Турнірів не знайдено</p>
                {tournaments.length > 0 && filter !== "all" && (
                    <button onClick={() => setFilter("all")} className="mt-2 text-blue-600 text-sm font-bold">
                    Показати всі
                    </button>
                )}
                </div>
            ) : (
                <div className="grid gap-4">
                {filtered.map(tournament => {
                    const spotsLeft = tournament.max_teams
                    ? tournament.max_teams - tournament.team_count
                    : null;
                    const statusCfg = STATUS_CONFIG[tournament.status];

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
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${statusCfg.color}`}>
                        {statusCfg.label}
                        </span>
                        </div>

                        <div className="flex gap-4 mt-3 text-xs text-(--t2) font-bold flex-wrap">
                        <span className="flex items-center gap-1">
                        <Calendar size={13} /> {fmtDate(tournament.start_at)}
                        </span>
                        <span className="flex items-center gap-1">
                        <Users size={13} />
                        {tournament.team_count}{tournament.max_teams && ` / ${tournament.max_teams}`}
                        </span>
                        {tournament.rounds && (
                            <span className="flex items-center gap-1">
                            <Zap size={13} /> {tournament.rounds} раундів
                            </span>
                        )}
                        </div>

                        {spotsLeft !== null && spotsLeft <= 0 && (
                            <div className="mt-2 text-red-500 text-[10px] font-black uppercase tracking-wide">Місць немає</div>
                        )}
                        {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                            <div className="mt-2 text-amber-500 text-[10px] font-black uppercase tracking-wide">Залишилось {spotsLeft} місць</div>
                        )}
                        </div>
                    );
                })}
                </div>
            )}
            </div>
            </main>
            </div>
        );
}
