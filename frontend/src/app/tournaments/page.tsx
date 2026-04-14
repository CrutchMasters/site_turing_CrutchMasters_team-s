//src/app/tournaments/page.tsx
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
    Trophy, ChevronRight, Clock, Users, Calendar,
    Zap, Lock, CheckCircle, Search, Filter, Loader,
} from "lucide-react";

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    status: "upcoming" | "registration" | "ongoing" | "finished";
    start_at: string;
    registration_from?: string;
    registration_to?: string;
    max_teams?: number;
    rounds?: number;
    created_by?: string;
    created_at?: string;
    team_count?: number;
}

const STATUS_CONFIG = {
    upcoming:     { label: "Скоро",       color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
    registration: { label: "Реєстрація",  color: "bg-green-500/10 text-green-500 border-green-500/30" },
    ongoing:      { label: "Тривають",    color: "bg-blue-600/10 text-blue-600 border-blue-600/30" },
    finished:     { label: "Завершено",   color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" });
}

export default function TournamentsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { t } = useT();
    const { dark } = useTheme();

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading]         = useState(true);
    const [filter, setFilter]           = useState<"all" | "upcoming" | "registration" | "ongoing" | "finished">("all");
    const [searchQ, setSearchQ]         = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

        useEffect(() => {
            if (!user) return;
            fetchTournaments();
        }, [user]);

        const fetchTournaments = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                .from("tournaments")
                .select("*")
                .order("start_at", { ascending: true });

                if (error) throw error;

                // Compute team_count per tournament from teams table
                const ids = (data ?? []).map((item: any) => item.id);
                let counts: Record<string, number> = {};
                if (ids.length) {
                    const { data: teamsData, error: teamsError } = await supabase
                    .from("teams")
                    .select("tournament_id")
                    .in("tournament_id", ids);

                    if (teamsError) {
                        console.error("teams fetch error:", teamsError);
                    } else {
                        (teamsData ?? []).forEach((row: any) => {
                            counts[row.tournament_id] = (counts[row.tournament_id] ?? 0) + 1;
                        });
                    }
                }

                setTournaments(
                    (data ?? []).map((item: any) => ({ ...item, team_count: counts[item.id] ?? 0 }))
                );
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        const filtered = tournaments.filter(tourney => {
            const matchFilter = filter === "all" || tourney.status === filter;
            const matchSearch = !searchQ || tourney.name.toLowerCase().includes(searchQ.toLowerCase());
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
            <style jsx global>{`
                @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                .fuIn { animation: fadeUp 340ms cubic-bezier(.22,1,.36,1) both }
                .card-hover { transition: transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, border-color 200ms ease; }
                .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.4); }
                `}</style>

                {/* Watermark */}
                <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
                </div>

                {isMobileSidebarOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
                )}
                <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
                <Sidebar />
                </div>

                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <MobileHeader
                onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                title="Турніри"
                icon={<Trophy size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
                <button onClick={() => router.push("/")} className="hover:text-blue-600">{t.nav.home}</button>
                <ChevronRight size={10} />
                <span className="text-(--t1)">Турніри</span>
                </nav>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight">Турніри</h1>
                <p className="text-xs font-bold text-(--t2) mt-1 uppercase tracking-widest">Актуальні змагання</p>
                </div>
                {isAdmin && (
                    <button
                    onClick={() => router.push("/register_tourney")}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap"
                    >
                    <Trophy size={15} /> Створити турнір
                    </button>
                )}
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) w-4 h-4" />
                <input
                type="text"
                placeholder="Пошук турніру..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-(--brd) bg-(--card) text-(--t1) outline-none focus:ring-2 focus:ring-blue-500/30 text-sm font-medium"
                />
                </div>
                <div className="flex gap-2 flex-wrap">
                {(["all", "upcoming", "registration", "ongoing", "finished"] as const).map(f => (
                    <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                        filter === f
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-(--card) text-(--t2) border-(--brd) hover:border-blue-600/40"
                    }`}
                    >
                    {f === "all" ? "Всі" : STATUS_CONFIG[f].label}
                    </button>
                ))}
                </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-(--card) rounded-[2rem] border border-(--brd) p-16 text-center">
                    <Trophy className="w-14 h-14 text-(--t2) mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-black text-(--t1) mb-1">Турнірів не знайдено</p>
                    <p className="text-sm text-(--t2)">Спробуйте змінити фільтр або пошуковий запит</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((tourney, idx) => {
                        const cfg = STATUS_CONFIG[tourney.status] ?? STATUS_CONFIG.upcoming;
                        const spotsLeft = tourney.max_teams ? tourney.max_teams - (tourney.team_count ?? 0) : null;
                        const isFull = spotsLeft !== null && spotsLeft <= 0;
                        return (
                            <div
                            key={tourney.id}
                            onClick={() => router.push(`/tournaments/${tourney.id}`)}
                            className="fuIn card-hover bg-(--card) border border-(--brd) rounded-[1.75rem] p-6 cursor-pointer flex flex-col gap-4"
                            style={{ animationDelay: `${idx * 40}ms` }}
                            >
                            {/* Top */}
                            <div className="flex items-start justify-between gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
                            <Trophy size={22} className="text-blue-600" />
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${cfg.color}`}>
                            {cfg.label}
                            </span>
                            </div>

                            {/* Name */}
                            <div>
                            <h2 className="font-black text-(--t1) text-base leading-snug mb-1">{tourney.name}</h2>
                            {tourney.rules && (
                                <p className="text-xs text-(--t2) line-clamp-2 leading-relaxed">{tourney.rules}</p>
                            )}
                            </div>

                            {/* Meta */}
                            <div className="flex flex-col gap-2 mt-auto">
                            <div className="flex items-center gap-2 text-(--t2)">
                            <Calendar size={13} className="flex-shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{fmtDate(tourney.start_at)}</span>
                            </div>
                            {tourney.registration_to && (
                                <div className="flex items-center gap-2 text-(--t2)">
                                <Clock size={13} className="flex-shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Реєстрація до {fmtDate(tourney.registration_to)}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-(--t2)">
                            <Users size={13} className="flex-shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                            {tourney.team_count ?? 0} команд{tourney.max_teams ? ` / ${tourney.max_teams}` : ""}
                            {isFull && <span className="ml-2 text-red-500">• Заповнено</span>}
                            </span>
                            </div>
                            {tourney.rounds && (
                                <div className="flex items-center gap-2 text-(--t2)">
                                <Zap size={13} className="flex-shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{tourney.rounds} раундів</span>
                                </div>
                            )}
                            </div>

                            {/* CTA */}
                            <div className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-all ${
                                tourney.status === "registration" && !isFull
                                ? "bg-blue-600/10 text-blue-600 border border-blue-600/30"
                                : "bg-(--bg) text-(--t2) border border-(--brd)"
                            }`}>
                            {tourney.status === "registration" && !isFull
                                ? "Зареєструватись →"
                                : tourney.status === "ongoing"
                                ? "Переглянути →"
                                : tourney.status === "finished"
                                ? "Результати →"
                                : "Детальніше →"
                            }
                            </div>
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
