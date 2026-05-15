'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Loader, Medal } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
        // 1. Команды турнира — через teams.tournament_id (не tournament_teams!)
        const { data: teams, error: teamsErr } = await supabase
        .from("teams")
        .select("id, name")
        .eq("tournament_id", tournamentId)
        .limit(50);

        if (teamsErr || !teams || teams.length === 0) {
          setEntries([]);
          return;
        }

        const teamIds = teams.map((t: any) => t.id);

        // 2. Сабмишены команд (только финальные — не черновики)
        const { data: submissions } = await supabase
        .from("submissions")
        .select("id, team_id, round_id")
        .in("team_id", teamIds)
        .eq("is_draft", false);

        if (!submissions || submissions.length === 0) {
          // Команды есть, но сабмишенов нет — показываем команды с 0 очков
          const ranked: LeaderboardEntry[] = teams
          .map((t: any, i: number) => ({
            rank: i + 1,
            team_id: t.id,
            team_name: t.name,
            score: 0,
            rounds_completed: 0,
          }));
          setEntries(ranked);
          return;
        }

        const submissionIds = submissions.map((s: any) => s.id);

        // 3. Оценки жюри по этим сабмишенам
        const { data: evaluations } = await supabase
        .from("jury_evaluations")
        .select("submission_id, total_score")
        .in("submission_id", submissionIds);

        // Средний балл жюри по каждому сабмишену
        const submissionAvgScore: Record<string, number> = {};
        const submissionScoreCount: Record<string, { sum: number; count: number }> = {};

        (evaluations ?? []).forEach((e: any) => {
          if (e.total_score == null) return;
          if (!submissionScoreCount[e.submission_id]) {
            submissionScoreCount[e.submission_id] = { sum: 0, count: 0 };
          }
          submissionScoreCount[e.submission_id].sum   += Number(e.total_score);
          submissionScoreCount[e.submission_id].count += 1;
        });

        Object.entries(submissionScoreCount).forEach(([sid, { sum, count }]) => {
          submissionAvgScore[sid] = count > 0 ? sum / count : 0;
        });

        // Суммируем по командам
        const scoreMap: Record<string, { score: number; rounds: Set<string> }> = {};

        submissions.forEach((s: any) => {
          if (!scoreMap[s.team_id]) scoreMap[s.team_id] = { score: 0, rounds: new Set() };
          const avg = submissionAvgScore[s.id] ?? 0;
          scoreMap[s.team_id].score += avg;
          if (s.round_id) scoreMap[s.team_id].rounds.add(s.round_id);
        });

          const ranked: LeaderboardEntry[] = teams
          .map((t: any) => {
            const sm = scoreMap[t.id] ?? { score: 0, rounds: new Set() };
            return {
              team_id: t.id,
              team_name: t.name,
              score: Math.round(sm.score * 10) / 10,
               rounds_completed: sm.rounds.size,
               rank: 0,
            };
          })
          .sort((a, b) => b.score - a.score || b.rounds_completed - a.rounds_completed)
          .map((e, i) => ({ ...e, rank: i + 1 }));

          setEntries(ranked);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tournamentId]);

  const lbl = {
    title:  locale === "en" ? "Leaderboard"             : locale === "ru" ? "Лидерборд"           : "Лідерборд",
    empty:  locale === "en" ? "No results yet"          : locale === "ru" ? "Результатов пока нет" : "Ще немає результатів",
    view:   locale === "en" ? "View tournament"         : locale === "ru" ? "Открыть турнир"       : "Переглянути турнір",
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
