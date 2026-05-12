// src/app/tournaments/[id]/leaderboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Trophy, ChevronLeft, Loader2, Medal, Crown,
    Star, Users, AlertCircle, TrendingUp, Hash,
} from "lucide-react";

const API_URL =
    typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : "https://site-turing-crutchmasters-team-s.onrender.com";

interface Round {
    id: string;
    name: string;
    number: number;
    status: string;
}

interface LeaderboardEntry {
    place: number;
    team_id: string;
    team_name: string;
    city_school_org?: string;
    captain_username?: string;
    round_scores: Record<string, number | null>;
    total_score: number;
    evaluated_rounds: number;
}

interface Tournament {
    id: string;
    name: string;
    status: string;
}

const placeColors: Record<number, string> = {
    1: "text-yellow-500",
    2: "text-slate-400",
    3: "text-amber-600",
};

const placeBg: Record<number, string> = {
    1: "bg-yellow-500/10 border-yellow-500/30",
    2: "bg-slate-400/10 border-slate-400/30",
    3: "bg-amber-600/10 border-amber-600/30",
};

const PlaceIcon = ({ place }: { place: number }) => {
    if (place === 1) return <Crown size={16} className="text-yellow-500" />;
    if (place === 2) return <Medal size={16} className="text-slate-400" />;
    if (place === 3) return <Medal size={16} className="text-amber-600" />;
    return <span className="text-xs font-black text-(--t2)">#{place}</span>;
};

export default function LeaderboardPage() {
    const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar } = useSidebar();
  const router = useRouter();
    const params = useParams();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [rounds, setRounds] = useState<Round[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id && !authLoading) fetchLeaderboard();
    }, [id, authLoading]);

    async function fetchLeaderboard() {
        setLoading(true);
        setError(null);
        try {
            const token = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) || "";
            const headers: Record<string, string> = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API_URL}/api/tournaments/${id}/leaderboard`, {
                headers,
            });
            if (!res.ok) throw new Error("Не вдалося завантажити таблицю лідерів");
            const data = await res.json();
            setTournament(data.tournament);
            setRounds(data.rounds || []);
            setLeaderboard(data.leaderboard || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Помилка завантаження");
        } finally {
            setLoading(false);
        }
    }

    /* ── loading ── */
    if (authLoading || loading) return (
        <div className="flex h-screen bg-(--bg)">
            <Sidebar />
            <main className="flex-1 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-(--t2)" />
            </main>
        </div>
    );

    /* ── error ── */
    if (error) return (
        <div className="flex h-screen bg-(--bg)">
            <Sidebar />
            <main className="flex-1 flex flex-col items-center justify-center gap-4">
                <AlertCircle size={28} className="text-red-500" />
                <p className="text-(--t2) font-bold">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm bg-(--card) border border-(--brd) text-(--t1) hover:border-blue-600/40 hover:text-blue-600 transition-all font-bold"
                >
                    <ChevronLeft size={16} /> Назад
                </button>
            </main>
        </div>
    );

    const isEmpty = leaderboard.length === 0;

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
            {/* bg logo */}
            <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
            </div>

            {/* mobile sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
                <Sidebar />
            </div>

            <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
                <MobileHeader
                    onOpenSidebar={openMobile}
                    title="Таблиця лідерів"
                    icon={<Trophy size={18} className="text-yellow-500" />}
                />

                <div className="p-6 max-w-5xl w-full mx-auto">
                    {/* back */}
                    <button
                        onClick={() => router.push(`/tournaments/${id}`)}
                        className="mb-6 flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors group"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        {tournament?.name || "Назад до турніру"}
                    </button>

                    {/* header */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                            <Trophy size={20} className="text-yellow-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-(--t1)">Таблиця лідерів</h1>
                            {tournament && (
                                <p className="text-sm text-(--t2) font-bold">{tournament.name}</p>
                            )}
                        </div>
                    </div>

                    {/* stats row */}
                    {!isEmpty && (
                        <div className="grid grid-cols-3 gap-3 mb-8">
                            <div className="bg-(--card) border border-(--brd) rounded-2xl p-4 flex flex-col gap-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Команд</div>
                                <div className="text-2xl font-black text-(--t1) flex items-center gap-2">
                                    <Users size={16} className="text-blue-600" />
                                    {leaderboard.length}
                                </div>
                            </div>
                            <div className="bg-(--card) border border-(--brd) rounded-2xl p-4 flex flex-col gap-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Раундів</div>
                                <div className="text-2xl font-black text-(--t1) flex items-center gap-2">
                                    <Hash size={16} className="text-blue-600" />
                                    {rounds.length}
                                </div>
                            </div>
                            <div className="bg-(--card) border border-(--brd) rounded-2xl p-4 flex flex-col gap-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Лідер</div>
                                <div className="text-sm font-black text-yellow-500 truncate">
                                    {leaderboard[0]?.team_name || "—"}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* top-3 podium (тільки якщо є оцінки) */}
                    {leaderboard.filter(e => e.total_score > 0).length >= 1 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                            {[1, 0, 2].map((idx) => {
                                const entry = leaderboard[idx];
                                if (!entry) return <div key={idx} />;
                                const place = entry.place;
                                return (
                                    <div
                                        key={entry.team_id}
                                        className={`relative rounded-2xl border p-5 flex flex-col items-center gap-2 text-center transition-all ${placeBg[place] || "bg-(--card) border-(--brd)"} ${place === 1 ? "sm:-mt-4 sm:shadow-lg" : ""}`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${place === 1 ? "bg-yellow-500/20" : place === 2 ? "bg-slate-400/20" : "bg-amber-600/20"}`}>
                                            <PlaceIcon place={place} />
                                        </div>
                                        <div className="font-black text-sm text-(--t1) leading-tight">{entry.team_name}</div>
                                        {entry.city_school_org && (
                                            <div className="text-[11px] text-(--t2) font-bold">{entry.city_school_org}</div>
                                        )}
                                        <div className={`text-2xl font-black mt-1 ${placeColors[place] || "text-(--t1)"}`}>
                                            {entry.total_score.toFixed(1)}
                                        </div>
                                        <div className="text-[10px] text-(--t2) font-black uppercase tracking-wider">балів</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* main table */}
                    {isEmpty ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-(--card) border border-(--brd) flex items-center justify-center">
                                <TrendingUp size={24} className="text-(--t2) opacity-50" />
                            </div>
                            <p className="font-black text-(--t1)">Результатів ще немає</p>
                            <p className="text-sm text-(--t2) font-bold max-w-xs">
                                Таблиця лідерів з&apos;явиться після того, як журі оцінять роботи команд
                            </p>
                        </div>
                    ) : (
                        <div className="bg-(--card) border border-(--brd) rounded-2xl overflow-hidden">
                            {/* table header */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-(--brd) bg-(--bg)">
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) w-12">#</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2)">Команда</th>
                                            {rounds.map(r => (
                                                <th key={r.id} className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) whitespace-nowrap">
                                                    {r.name || `Р.${r.number}`}
                                                </th>
                                            ))}
                                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) whitespace-nowrap">
                                                Сума
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((entry, i) => {
                                            const isTop3 = entry.place <= 3;
                                            const isFirst = entry.place === 1;
                                            return (
                                                <tr
                                                    key={entry.team_id}
                                                    onClick={() => router.push(`/teams/${entry.team_id}`)}
                                                    className={`border-b border-(--brd) last:border-0 cursor-pointer transition-colors group
                                                        ${isFirst ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-(--bg)"}
                                                    `}
                                                >
                                                    {/* place */}
                                                    <td className="px-4 py-4 w-12">
                                                        <div className="flex items-center justify-center w-8 h-8">
                                                            <PlaceIcon place={entry.place} />
                                                        </div>
                                                    </td>

                                                    {/* team info */}
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className={`font-black text-sm group-hover:text-blue-600 transition-colors ${isTop3 ? placeColors[entry.place] || "text-(--t1)" : "text-(--t1)"}`}>
                                                                {entry.team_name}
                                                            </span>
                                                            {entry.captain_username && (
                                                                <span className="text-[11px] text-(--t2) font-bold flex items-center gap-1">
                                                                    <Star size={9} />
                                                                    {entry.captain_username}
                                                                </span>
                                                            )}
                                                            {entry.city_school_org && (
                                                                <span className="text-[11px] text-(--t2) font-medium">{entry.city_school_org}</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* round scores */}
                                                    {rounds.map(r => {
                                                        const score = entry.round_scores[r.id];
                                                        return (
                                                            <td key={r.id} className="px-3 py-4 text-center">
                                                                {score !== null && score !== undefined ? (
                                                                    <span className="font-black text-sm text-(--t1)">
                                                                        {score.toFixed(1)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-(--t2) text-xs font-bold">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                    {/* total */}
                                                    <td className="px-4 py-4 text-right">
                                                        <span className={`font-black text-base ${isFirst ? "text-yellow-500" : isTop3 ? placeColors[entry.place] : "text-(--t1)"}`}>
                                                            {entry.total_score.toFixed(1)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* note */}
                    <p className="mt-4 text-[11px] text-(--t2) font-bold text-center">
                        Бали — середнє значення оцінок журі по кожному раунду. Сума по всіх раундах.
                    </p>
                </div>
            </main>
        </div>
    );
}
