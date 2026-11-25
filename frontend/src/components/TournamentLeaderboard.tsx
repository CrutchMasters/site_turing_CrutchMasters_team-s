'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Loader, Medal } from "lucide-react";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  score: number;
  rounds_completed: number;
}

interface TournamentLeaderboardProps {
  tournamentId: string | null;
  tournamentName?: string | null;
  locale?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TournamentLeaderboard({
  tournamentId,
  tournamentName,
  locale = "ua",
}: TournamentLeaderboardProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);

    (async () => {
      try {
        // Єдине джерело правди — бекенд (той самий розрахунок, що й на сторінці турніру):
        // середнє за повними оцінками журі, сума за раунди, спільні місця при рівності.
        const res = await fetch(`${API_URL}/api/tournaments/${tournamentId}/leaderboard`);
        if (!res.ok) {
          setEntries([]);
          return;
        }
        const data = await res.json();
        const ranked: LeaderboardEntry[] = (data.leaderboard ?? []).map((e: any) => ({
          rank: e.place,
          team_id: e.team_id,
          team_name: e.team_name,
          score: Math.round(Number(e.total_score) * 10) / 10,
          rounds_completed: e.evaluated_rounds,
        }));
        setEntries(ranked);
      } catch (e) {
        console.error(e);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [tournamentId]);

  const lbl = {
    title:  locale === "en" ? "Leaderboard"             : "Лідерборд",
    empty:  locale === "en" ? "No results yet"          : "Ще немає результатів",
    view:   locale === "en" ? "View tournament"         : "Переглянути турнір",
    rounds: "R",
  };

  const MEDAL_COLOR: Record<number, string> = {
    1: "text-amber-400",
    2: "text-slate-400",
    3: "text-amber-600",
  };

  if (!tournamentId) return null;

  return (
    <div className="rounded-2xl sm:rounded-[2rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">

    {/* ── Header ── */}
    <div className="px-5 py-4 flex items-center gap-3 border-b border-(--brd)">
    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
    <Medal size={15} className="text-amber-500" />
    </div>
    <div className="flex-1 min-w-0">
    <h2 className="font-black text-sm uppercase tracking-tight text-(--t1)">
    {lbl.title}
    </h2>
    {tournamentName && (
      <p className="text-[10px] font-bold text-(--t2) truncate mt-0.5">
      {tournamentName}
      </p>
    )}
    </div>
    </div>

    {/* ── Body ── */}
    <div className="p-3">
    {loading ? (
      <div className="flex items-center justify-center py-8">
      <Loader className="w-5 h-5 text-amber-500 animate-spin" />
      </div>
    ) : entries.length === 0 ? (
      <div className="py-8 text-center">
      <Trophy className="w-8 h-8 text-(--t2) opacity-20 mx-auto mb-2" />
      <p className="text-xs font-bold text-(--t2)">{lbl.empty}</p>
      </div>
    ) : (
      <div className="space-y-1">
      {entries.slice(0, 10).map(entry => (
        <div
        key={entry.team_id}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors
          ${entry.rank === 1
            ? "bg-amber-500/8 border border-amber-500/20"
            : "hover:bg-(--bg)"
          }`}
          >
          {/* Rank / Medal */}
          <div className="w-5 flex-shrink-0 flex items-center justify-center">
          {entry.rank <= 3 ? (
            <Medal size={14} className={MEDAL_COLOR[entry.rank]} />
          ) : (
            <span className="text-[11px] font-black text-(--t2) tabular-nums">
            {entry.rank}
            </span>
          )}
          </div>

          {/* Team name */}
          <span
          className={`flex-1 min-w-0 text-xs font-black truncate
            ${entry.rank === 1 ? "text-amber-500" : "text-(--t1)"}`}
            >
            {entry.team_name}
            </span>

            {/* Rounds badge */}
            <span className="text-[9px] font-black text-(--t2) bg-(--bg) border border-(--brd) px-1.5 py-0.5 rounded-md tabular-nums flex-shrink-0">
            {entry.rounds_completed}{lbl.rounds}
            </span>

            {/* Score */}
            <span
            className={`text-xs font-black tabular-nums flex-shrink-0 w-9 text-right
              ${entry.rank === 1 ? "text-amber-500" : "text-(--t1)"}`}
              >
              {entry.score}
              </span>
              </div>
      ))}
      </div>
    )}
    </div>

    {/* ── Footer ── */}
    <div className="px-5 py-3 border-t border-(--brd)">
    <button
    onClick={() => router.push(`/tournaments/${tournamentId}`)}
    className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:underline"
    >
    {lbl.view} →
    </button>
    </div>
    </div>
  );
}
