// src/components/LeaderboardSection.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    Trophy, Loader2, Medal, Crown, Star, Users,
    TrendingUp, Hash, AlertCircle, RefreshCw, Zap,
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

interface Props {
    tournamentId: string;
}

export function LeaderboardSection({ tournamentId }: Props) {
    const router = useRouter();
    const [rounds, setRounds] = useState<Round[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const fetchLeaderboard = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const token =
                (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) || "";
            const headers: Record<string, string> = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/api/tournaments/${tournamentId}/leaderboard`, {
                headers,
            });
            if (!res.ok) throw new Error("Не вдалося завантажити таблицю лідерів");
            const data = await res.json();

            setLeaderboard((prev) => {
                const newEntries: LeaderboardEntry[] = data.leaderboard || [];
                // Визначаємо які команди змінили позицію/бали — підсвітити їх
                const changed = new Set<string>();
                newEntries.forEach((entry) => {
                    const old = prev.find((p) => p.team_id === entry.team_id);
                    if (old && (old.total_score !== entry.total_score || old.place !== entry.place)) {
                        changed.add(entry.team_id);
                    }
                });
                if (changed.size > 0) {
                    setFlashIds(changed);
                    setTimeout(() => setFlashIds(new Set()), 2000);
                }
                return newEntries;
            });

            setRounds(data.rounds || []);
            setLastUpdated(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Помилка завантаження");
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    // Початкове завантаження
    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    // Real-time підписка через Supabase Realtime
    // Слухаємо таблицю jury_evaluations — будь-яка нова/змінена оцінка тригерить рефреш
    // Примітка: jury_evaluations не має tournament_id, тому слухаємо всі зміни і
    // рефрешимо лідербоард тільки цього турніру (API сам фільтрує по tournamentId)
    useEffect(() => {
        const channel = supabase
            .channel(`leaderboard:${tournamentId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "jury_evaluations",
                },
                () => {
                    fetchLeaderboard(true);
                }
            )
            .subscribe((status) => {
                setIsLive(status === "SUBSCRIBED");
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tournamentId, fetchLeaderboard]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="animate-spin text-blue-600" />
                <p className="text-sm text-(--t2) font-bold">Завантаження таблиці...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertCircle size={28} className="text-red-500" />
                <p className="text-(--t2) font-bold text-sm">{error}</p>
                <button
                    onClick={() => fetchLeaderboard()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-(--card) border border-(--brd) text-(--t1) hover:border-blue-600/40 hover:text-blue-600 transition-all font-bold"
                >
                    <RefreshCw size={14} /> Спробувати знову
                </button>
            </div>
        );
    }

    const isEmpty = leaderboard.length === 0;
    const hasScores = leaderboard.some((e) => e.total_score > 0);

    return (
        <div>
            {/* Live-індикатор + час оновлення */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all ${
                        isLive
                            ? "bg-green-500/10 border-green-500/30 text-green-600"
                            : "bg-(--card) border-(--brd) text-(--t2)"
                    }`}>
                        {isLive ? (
                            <>
                                <Zap size={10} className="fill-current" />
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                                Live
                            </>
                        ) : (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                                Офлайн
                            </>
                        )}
                    </div>
                    {lastUpdated && (
                        <span className="text-[11px] text-(--t2) font-medium">
                            Оновлено о {lastUpdated.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => fetchLeaderboard(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-(--brd) text-[11px] font-bold text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all"
                >
                    <RefreshCw size={12} />
                    Оновити
                </button>
            </div>

            {/* Статистика */}
            {!isEmpty && (
                <div className="grid grid-cols-3 gap-3 mb-6">
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

            {/* Топ-3 п'єдестал */}
            {hasScores && leaderboard.length >= 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    {[1, 0, 2].map((idx) => {
                        const entry = leaderboard[idx];
                        if (!entry) return <div key={idx} />;
                        const place = entry.place;
                        const isFlashing = flashIds.has(entry.team_id);
                        return (
                            <div
                                key={entry.team_id}
                                className={`relative rounded-2xl border p-5 flex flex-col items-center gap-2 text-center transition-all duration-500 ${
                                    placeBg[place] || "bg-(--card) border-(--brd)"
                                } ${place === 1 ? "sm:-mt-4 sm:shadow-lg" : ""} ${
                                    isFlashing ? "ring-2 ring-blue-500/50 scale-[1.02]" : ""
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                    place === 1 ? "bg-yellow-500/20" : place === 2 ? "bg-slate-400/20" : "bg-amber-600/20"
                                }`}>
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
                                {isFlashing && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider animate-bounce">
                                        <Zap size={8} className="fill-current" /> Оновлено
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Таблиця */}
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-(--brd) bg-(--bg)">
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) w-12">#</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2)">Команда</th>
                                    {rounds.map((r) => (
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
                                {leaderboard.map((entry) => {
                                    const isTop3 = entry.place <= 3;
                                    const isFirst = entry.place === 1;
                                    const isFlashing = flashIds.has(entry.team_id);
                                    return (
                                        <tr
                                            key={entry.team_id}
                                            onClick={() => router.push(`/teams/${entry.team_id}`)}
                                            className={`border-b border-(--brd) last:border-0 cursor-pointer transition-all duration-500 group ${
                                                isFlashing
                                                    ? "bg-blue-500/10"
                                                    : isFirst
                                                    ? "bg-yellow-500/5 hover:bg-yellow-500/10"
                                                    : "hover:bg-(--bg)"
                                            }`}
                                        >
                                            <td className="px-4 py-4 w-12">
                                                <div className="flex items-center justify-center w-8 h-8">
                                                    <PlaceIcon place={entry.place} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={`font-black text-sm group-hover:text-blue-600 transition-colors ${
                                                        isTop3 ? placeColors[entry.place] || "text-(--t1)" : "text-(--t1)"
                                                    }`}>
                                                        {entry.team_name}
                                                        {isFlashing && (
                                                            <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] font-black text-blue-500 uppercase tracking-wider">
                                                                <Zap size={8} className="fill-current" /> upd
                                                            </span>
                                                        )}
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
                                            {rounds.map((r) => {
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
                                            <td className="px-4 py-4 text-right">
                                                <span className={`font-black text-base ${
                                                    isFirst ? "text-yellow-500" : isTop3 ? placeColors[entry.place] : "text-(--t1)"
                                                }`}>
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

            <p className="mt-4 text-[11px] text-(--t2) font-bold text-center">
                Бали — середнє значення оцінок журі по кожному раунду. Сума по всіх раундах.
            </p>
        </div>
    );
}
