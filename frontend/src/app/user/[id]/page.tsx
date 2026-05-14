//site_turing_CrutchMasters_team-s/frontend/src/app/user/[id]/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  User, Mail, Shield, ChevronRight, UserCircle, ArrowLeft, Loader,
  Users, Crown, ExternalLink, MapPin, MessageCircle, Hash,
  Trophy, Layers, Megaphone, Pin, Clock, CheckCircle2, XCircle,
  AlertCircle, PlayCircle, Calendar, TrendingUp,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

const ROLES = ["user", "jury", "admin"] as const;
type Role = "user" | "jury" | "admin" | "superadmin";

const roleBadgeColor: Record<Role, string> = {
  user:       "bg-gray-500/10 text-gray-500 border-gray-500/20",
  jury:       "bg-purple-500/10 text-purple-500 border-purple-500/20",
  admin:      "bg-orange-500/10 text-orange-500 border-orange-500/20",
  superadmin: "bg-red-500/10 text-red-500 border-red-500/20",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserTeam {
  id: string;
  name: string;
  city_school_org?: string;
  captain_id?: string;
  members_ids?: string[];
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  created_at: string;
  start_at?: string;
}

interface Round {
  id: string;
  name: string;
  status: string;
  created_at: string;
  tournament_id?: string;
}

interface Announcement {
  id: string;
  title: string;
  body?: string;
  is_pinned: boolean;
  created_at: string;
}

interface UserTournament {
  id: string;
  name: string;
  status: string;
  start_at: string;
  end_at?: string;
}

interface UserRound {
  id: string;
  name: string;
  number: number;
  status: string | null;
  start_at: string | null;
  end_at: string | null;
  tournament_id: string;
  tournamentName?: string;
}

interface EvaluationScore {
  submissionId: string;
  roundName: string;
  tournamentName: string;
  totalScore: number;
  updatedAt: string;
  generalComment?: string;
}

interface UserStats {
  tournaments: UserTournament[];
  rounds: UserRound[];
  evaluations: EvaluationScore[];
  avgScore: number;
  loading: boolean;
}

interface JuryTournament {
  id: string;
  name: string;
  status: string;
  start_at: string;
  end_at?: string;
}

interface JuryEvalByTournament {
  tournamentId: string;
  tournamentName: string;
  count: number;
}

interface JuryStats {
  tournaments: JuryTournament[];
  evaluationsCount: number;
  totalAssigned: number;
  totalInProgress: number;
  totalDone: number;
  totalRounds: number;
  evalByTournament: JuryEvalByTournament[];
  loading: boolean;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

type TournamentStatus = "active" | "registration" | "waiting" | "completed" | string;

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  // tournaments
  ongoing:      { label: "В процесі",     color: "bg-green-500/10 text-green-500 border-green-500/20",  icon: <PlayCircle size={10} /> },
  registration: { label: "Реєстрація",    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",    icon: <Users size={10} /> },
  upcoming:     { label: "Очікування",    color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: <Clock size={10} /> },
  finished:     { label: "Завершено",     color: "bg-gray-500/10 text-gray-500 border-gray-500/20",    icon: <CheckCircle2 size={10} /> },
  cancelled:    { label: "Скасовано",     color: "bg-red-500/10 text-red-500 border-red-500/20",       icon: <XCircle size={10} /> },
  // rounds
  active:       { label: "Активний",      color: "bg-green-500/10 text-green-500 border-green-500/20",  icon: <PlayCircle size={10} /> },
  pending:      { label: "Очікування",    color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: <Clock size={10} /> },
  judging:      { label: "Оцінювання",    color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: <Crown size={10} /> },
  judged:       { label: "Оцінено",       color: "bg-gray-500/10 text-gray-500 border-gray-500/20",    icon: <CheckCircle2 size={10} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: <AlertCircle size={10} /> };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${cfg.color}`}>
    {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border ${color}`}>
    <span className="text-lg font-black leading-none">{value}</span>
    <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({
  label,
  count,
  color,
  icon,
  defaultOpen = true,
  maxItems = 5,
  children,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  maxItems?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Each item ~56px tall + 8px gap
  const maxHeight = maxItems * 56 + (maxItems - 1) * 8;
  return (
    <div>
    <button
    type="button"
    onClick={() => setOpen(o => !o)}
    className="w-full flex items-center justify-between gap-2 mb-2 group"
    >
    <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${color}`}>
    {icon} {label}
    </span>
    <span className="flex items-center gap-1.5">
    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border opacity-60 ${color.replace(/text-(\S+)/, "bg-$1/10 text-$1 border-$1/20")}`}>
    {count}
    </span>
    <ChevronRight
    size={12}
    className={`${color} opacity-50 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    />
    </span>
    </button>
    {open && (
      <div
      className="space-y-2 overflow-y-auto pr-1"
      style={{ maxHeight: `${maxHeight}px` }}
      >
      {children}
      </div>
    )}
    </div>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useUserTeams(userId: string | undefined) {
  const [teams, setTeams]     = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const { data: captainTeams } = await supabase
        .from("teams")
        .select("id, name, city_school_org, captain_id, members_ids")
        .eq("captain_id", userId);

        const { data: memberTeams } = await supabase
        .from("teams")
        .select("id, name, city_school_org, captain_id, members_ids")
        .filter("members_ids", "cs", JSON.stringify([userId]));

        const all    = [...(captainTeams ?? []), ...(memberTeams ?? [])];
        const unique = all.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
        setTeams(unique);
      } catch (e) {
        console.error("Failed to fetch user teams:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [userId]);

  return { teams, loading };
}

function useAdminStats(userId: string | undefined, isAdmin: boolean) {
  const [tournaments,   setTournaments]   = useState<Tournament[]>([]);
  const [rounds,        setRounds]        = useState<Round[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(false);

  useEffect(() => {
    if (!userId || !isAdmin) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const [{ data: t }, { data: a }] = await Promise.all([
          supabase
          .from("tournaments")
          .select("id, name, status, created_at, start_at")
          .eq("created_by", userId)
          .order("created_at", { ascending: false }),
                                                             supabase
                                                             .from("announcements")
                                                             .select("id, title, body, is_pinned, created_at")
                                                             .eq("created_by", userId)
                                                             .order("created_at", { ascending: false }),
        ]);

        // rounds не мають created_by — підтягуємо через турніри адміна
        let roundsData: Round[] = [];
        if (t && t.length > 0) {
          const tIds = t.map((x: any) => x.id);
          const { data: r } = await supabase
          .from("rounds")
          .select("id, name, status, created_at, tournament_id")
          .in("tournament_id", tIds)
          .order("created_at", { ascending: false });
          roundsData = r ?? [];
        }

        setTournaments(t ?? []);
        setRounds(roundsData);
        setAnnouncements(a ?? []);
      } catch (e) {
        console.error("Failed to fetch admin stats:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId, isAdmin]);

  return { tournaments, rounds, announcements, loading };
}

function useUserStats(userId: string | undefined, isUser: boolean): UserStats {
  const [tournaments,  setTournaments]  = useState<UserTournament[]>([]);
  const [rounds,       setRounds]       = useState<UserRound[]>([]);
  const [evaluations,  setEvaluations]  = useState<EvaluationScore[]>([]);
  const [avgScore,     setAvgScore]     = useState(0);
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    if (!userId || !isUser) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data: captainTeams } = await supabase
        .from("teams")
        .select("id, tournament_id")
        .eq("captain_id", userId);
        const { data: memberTeams } = await supabase
        .from("teams")
        .select("id, tournament_id")
        .filter("members_ids", "cs", JSON.stringify([userId]));

        const allTeams = [...(captainTeams ?? []), ...(memberTeams ?? [])];
        const uniqueTeams = allTeams.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);

        if (uniqueTeams.length === 0) { setLoading(false); return; }

        const teamIds = uniqueTeams.map(t => t.id);
        const tournamentIds = [...new Set(uniqueTeams.map(t => t.tournament_id).filter(Boolean))] as string[];

        if (tournamentIds.length > 0) {
          const { data: tourData } = await supabase
          .from("tournaments")
          .select("id, name, status, start_at, end_at")
          .in("id", tournamentIds)
          .order("start_at", { ascending: false });
          setTournaments(tourData ?? []);
        }

        const { data: submissionsData } = await supabase
        .from("submissions")
        .select("id, round_id, team_id")
        .in("team_id", teamIds);

        const roundIds = [...new Set((submissionsData ?? []).map(s => s.round_id).filter(Boolean))] as string[];

        if (roundIds.length > 0) {
          const { data: roundData } = await supabase
          .from("rounds")
          .select("id, name, number, status, start_at, end_at, tournament_id")
          .in("id", roundIds)
          .order("start_at", { ascending: false });

          const roundTournamentIds = [...new Set((roundData ?? []).map(r => r.tournament_id).filter(Boolean))] as string[];
          let tournamentMap: Record<string, string> = {};
          if (roundTournamentIds.length > 0) {
            const { data: tData } = await supabase
            .from("tournaments")
            .select("id, name")
            .in("id", roundTournamentIds);
            (tData ?? []).forEach(t => { tournamentMap[t.id] = t.name; });
          }

          setRounds((roundData ?? []).map(r => ({
            ...r,
            tournamentName: tournamentMap[r.tournament_id] ?? "",
          })));

          const submissionIds = (submissionsData ?? []).map(s => s.id);
          if (submissionIds.length > 0) {
            const { data: evalData } = await supabase
            .from("jury_evaluations")
            .select("submission_id, round_id, total_score, updated_at, general_comment")
            .in("submission_id", submissionIds)
            .not("total_score", "is", null)
            .order("updated_at", { ascending: false });

            const roundNameMap: Record<string, string> = {};
            (roundData ?? []).forEach(r => { roundNameMap[r.id] = r.name; });

            const scores: EvaluationScore[] = (evalData ?? []).map(e => ({
              submissionId: e.submission_id,
              roundName: roundNameMap[e.round_id] ?? "Раунд",
              tournamentName: tournamentMap[
                (roundData ?? []).find(r => r.id === e.round_id)?.tournament_id ?? ""
              ] ?? "",
              totalScore: Number(e.total_score),
                                                                         updatedAt: e.updated_at,
                                                                         generalComment: e.general_comment ?? undefined,
            }));

            setEvaluations(scores);
            if (scores.length > 0) {
              const avg = scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length;
              setAvgScore(Math.round(avg * 10) / 10);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch user stats:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [userId, isUser]);

  return { tournaments, rounds, evaluations, avgScore, loading };
}

// Оголошення для user — глобальні (без прив'язки до турніру), просто всі останні
function useUserAnnouncements(userId: string | undefined, isUser: boolean) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (!userId || !isUser) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
        .from("announcements")
        .select("id, title, body, is_pinned, created_at")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
        setAnnouncements(data ?? []);
      } catch (e) {
        console.error("Failed to fetch announcements:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId, isUser]);

  return { announcements, loading };
}

function useJuryStats(userId: string | undefined, isJury: boolean): JuryStats {
  const [tournaments,      setTournaments]      = useState<JuryTournament[]>([]);
  const [evaluationsCount, setEvaluationsCount] = useState(0);
  const [totalAssigned,    setTotalAssigned]    = useState(0);
  const [totalInProgress,  setTotalInProgress]  = useState(0);
  const [totalDone,        setTotalDone]        = useState(0);
  const [totalRounds,      setTotalRounds]      = useState(0);
  const [evalByTournament, setEvalByTournament] = useState<JuryEvalByTournament[]>([]);
  const [loading,          setLoading]          = useState(false);

  useEffect(() => {
    if (!userId || !isJury) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        // 1. Completed evaluations by this jury member
        const { data: evalData } = await supabase
        .from("jury_evaluations")
        .select("submission_id, round_id, total_score")
        .eq("jury_id", userId);

        const doneCount = (evalData ?? []).filter(e => e.total_score !== null).length;
        setEvaluationsCount(doneCount);
        setTotalDone(doneCount);

        // 2. Assigned submissions via jury_submission_assignments
        const { data: assignedSubsData } = await supabase
        .from("jury_submission_assignments")
        .select("submission_id, round_id, tournament_id")
        .eq("jury_id", userId);

        const assignedCount = (assignedSubsData ?? []).length;
        setTotalAssigned(assignedCount);
        setTotalInProgress(Math.max(0, assignedCount - doneCount));

        // 3. Tournaments via jury_assignments
        const { data: assignmentsData } = await supabase
        .from("jury_assignments")
        .select("tournament_id, round_id")
        .eq("jury_id", userId);

        const tournamentIds = [...new Set(
          (assignmentsData ?? []).map(a => a.tournament_id).filter(Boolean)
        )] as string[];

        const roundIds = [...new Set(
          (assignmentsData ?? []).map(a => a.round_id).filter(Boolean)
        )] as string[];
        setTotalRounds(roundIds.length);

        let allTournaments: JuryTournament[] = [];
        let evalByTour: JuryEvalByTournament[] = [];

        if (tournamentIds.length > 0) {
          const { data: tourData } = await supabase
          .from("tournaments")
          .select("id, name, status, start_at, end_at")
          .in("id", tournamentIds)
          .order("start_at", { ascending: false });

          allTournaments = tourData ?? [];

          const tourNameMap: Record<string, string> = {};
          (tourData ?? []).forEach(t => { tourNameMap[t.id] = t.name; });

          // Build eval counts per tournament using assignedSubsData tournament_id
          const countByTour: Record<string, number> = {};
          const doneSubmissionIds = new Set(
            (evalData ?? []).filter(e => e.total_score !== null).map(e => e.submission_id)
          );
          (assignedSubsData ?? []).forEach(a => {
            if (a.tournament_id && doneSubmissionIds.has(a.submission_id)) {
              countByTour[a.tournament_id] = (countByTour[a.tournament_id] ?? 0) + 1;
            }
          });

          // Include ALL tournaments jury is assigned to (1 point per tournament),
          // sorted chronologically by start_at
          evalByTour = (tourData ?? [])
          .slice()
          .sort((a, b) => new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime())
          .map(t => ({
            tournamentId: t.id,
            tournamentName: tourNameMap[t.id] ?? "Турнір",
            count: countByTour[t.id] ?? 0,
          }));
        }

        setTournaments(allTournaments);
        setEvalByTournament(evalByTour);
      } catch (e) {
        console.error("Failed to fetch jury stats:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [userId, isJury]);

  return { tournaments, evaluationsCount, totalAssigned, totalInProgress, totalDone, totalRounds, evalByTournament, loading };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamBadge({ team, userId, onClick }: { team: UserTeam; userId: string; onClick: () => void }) {
  const isCaptain   = team.captain_id === userId;
  const memberCount = team.members_ids?.length ?? 0;

  return (
    <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group text-left"
    >
    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-base flex-shrink-0">
    {team.name.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
    <span className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">
    {team.name}
    </span>
    {isCaptain && (
      <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1">
      <Crown size={8} /> Капітан
      </span>
    )}
    </div>
    <div className="flex items-center gap-3 mt-0.5">
    {team.city_school_org && (
      <span className="text-[10px] font-bold text-(--t2) truncate">{team.city_school_org}</span>
    )}
    <span className="text-[10px] font-bold text-(--t2) flex items-center gap-1 flex-shrink-0">
    <Users size={9} /> {memberCount} уч.
    </span>
    </div>
    </div>
    <ExternalLink size={14} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function TournamentRow({ t, onClick }: { t: Tournament; onClick: () => void }) {
  return (
    <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group text-left"
    >
    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 flex-shrink-0">
    <Trophy size={14} />
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-orange-500 transition-colors">{t.name}</p>
    {t.start_at && (
      <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
      <Calendar size={8} />
      {new Date(t.start_at).toLocaleDateString("uk-UA")}
      </p>
    )}
    </div>
    <StatusBadge status={t.status} />
    </button>
  );
}

function RoundRow({ r, onClick }: { r: Round; onClick: () => void }) {
  return (
    <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group text-left"
    >
    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 flex-shrink-0">
    <Layers size={14} />
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-purple-500 transition-colors">{r.name}</p>
    <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
    <Calendar size={8} />
    {new Date(r.created_at).toLocaleDateString("uk-UA")}
    </p>
    </div>
    <StatusBadge status={r.status} />
    </button>
  );
}

function AnnouncementRow({ a, onClick }: { a: Announcement; onClick: () => void }) {
  return (
    <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group text-left"
    >
    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
    <Megaphone size={14} />
    </div>
    <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-blue-500 transition-colors">{a.title}</p>
    {a.is_pinned && (
      <span className="flex-shrink-0 text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
      <Pin size={7} /> Закріплено
      </span>
    )}
    </div>
    <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
    <Calendar size={8} />
    {new Date(a.created_at).toLocaleDateString("uk-UA")}
    </p>
    </div>
    <ExternalLink size={12} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function UserTournamentRow({ t, onClick }: { t: UserTournament; onClick: () => void }) {
  const statusMap: Record<string, string> = {
    upcoming: "upcoming", registration: "registration", ongoing: "active", finished: "completed",
  };
  return (
    <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group text-left"
    >
    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 flex-shrink-0">
    <Trophy size={14} />
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-orange-500 transition-colors">{t.name}</p>
    {t.start_at && (
      <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
      <Calendar size={8} /> {new Date(t.start_at).toLocaleDateString("uk-UA")}
      </p>
    )}
    </div>
    <StatusBadge status={statusMap[t.status] ?? t.status} />
    </button>
  );
}

function UserRoundRow({ r, onClick }: { r: UserRound; onClick: () => void }) {
  const statusMap: Record<string, string> = {
    pending: "waiting", active: "active", finished: "completed",
  };
  return (
    <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group text-left"
    >
    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 flex-shrink-0">
    <Layers size={14} />
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-purple-500 transition-colors">
    {r.name}
    </p>
    <p className="text-[10px] font-bold text-(--t2) mt-0.5 truncate">
    {r.tournamentName && <span className="opacity-70">{r.tournamentName} · </span>}
    Раунд {r.number}
    </p>
    </div>
    {r.status && <StatusBadge status={statusMap[r.status] ?? r.status} />}
    </button>
  );
}

function ScoreRow({ score }: { score: EvaluationScore }) {
  const pct = Math.min(100, Math.max(0, (score.totalScore / 100) * 100));
  return (
    <div className="p-3 rounded-xl border border-(--brd) bg-(--bg) space-y-2">
    <div className="flex items-center justify-between gap-2">
    <div className="min-w-0">
    <p className="text-sm font-black text-(--t1) truncate">{score.roundName}</p>
    {score.tournamentName && (
      <p className="text-[10px] font-bold text-(--t2) truncate">{score.tournamentName}</p>
    )}
    </div>
    <span className="text-lg font-black text-green-500 flex-shrink-0">{score.totalScore}</span>
    </div>
    <div className="w-full h-1.5 rounded-full bg-(--brd) overflow-hidden">
    <div
    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
    style={{ width: `${pct}%` }}
    />
    </div>
    <div className="flex items-center justify-between">
    {score.generalComment ? (
      <p className="text-[10px] text-(--t2) font-medium italic truncate max-w-[80%]">"{score.generalComment}"</p>
    ) : <span />}
    <p className="text-[9px] font-bold text-(--t2) flex items-center gap-1 flex-shrink-0">
    <Clock size={8} /> {new Date(score.updatedAt).toLocaleDateString("uk-UA")}
    </p>
    </div>
    </div>
  );
}

// ─── User Evaluations Block ───────────────────────────────────────────────────

interface TournamentScoreGroup {
  tournamentName: string;
  scores: EvaluationScore[];
  avgScore: number;
}

function UserScoreDonut({ avg, max = 100 }: { avg: number; max?: number }) {
  const pct    = Math.min(100, Math.max(0, (avg / max) * 100));
  const R      = 40;
  const CIRC   = 2 * Math.PI * R;
  const filled = (pct / 100) * CIRC;

  const color = avg >= 80 ? "#22c55e" : avg >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex-shrink-0">
    <svg width={92} height={92} viewBox="0 0 92 92">
    <circle r={R} cx={46} cy={46} fill="none" stroke="var(--brd,#e5e7eb)" strokeWidth={10} />
    {pct > 0 && (
      <circle
      r={R} cx={46} cy={46}
      fill="none"
      stroke={color}
      strokeWidth={10}
      strokeDasharray={`${filled} ${CIRC - filled}`}
      strokeDashoffset={0}
      strokeLinecap="round"
      style={{ transform: "rotate(-90deg)", transformOrigin: "46px 46px", transition: "stroke-dasharray 0.8s ease" }}
      />
    )}
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
    <span className="text-xl font-black leading-none" style={{ color }}>{avg}</span>
    <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--t2)" }}>з {max}</span>
    </div>
    </div>
  );
}

function UserScoreGrowthBar({ groups }: { groups: TournamentScoreGroup[] }) {
  if (groups.length < 2) return null;
  const max = Math.max(...groups.map(g => g.avgScore), 1);

  return (
    <div className="w-full">
    <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-1.5">
    <TrendingUp size={9} /> Динаміка по турнірах
    </p>
    <div className="flex items-end gap-1.5 h-14">
    {groups.map((g, i) => {
      const h    = Math.max(8, Math.round((g.avgScore / max) * 48));
      const prev = i > 0 ? groups[i - 1].avgScore : null;
      const diff = prev !== null ? g.avgScore - prev : 0;
      const barColor = i === 0
      ? "bg-blue-500/40"
      : diff > 0
      ? "bg-green-500"
      : diff < 0
      ? "bg-red-500"
      : "bg-gray-400";

      return (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <span className="text-[8px] font-black" style={{ color: i === 0 ? "var(--t2)" : diff > 0 ? "#22c55e" : diff < 0 ? "#ef4444" : "var(--t2)" }}>
        {i > 0 && diff !== 0 ? (diff > 0 ? `+${diff}` : `${diff}`) : g.avgScore}
        </span>
        <div
        className={`w-full rounded-t-md transition-all ${barColor}`}
        style={{ height: `${h}px` }}
        />
        <span className="text-[7px] font-bold text-(--t2) truncate w-full text-center leading-tight px-0.5">
        {g.tournamentName.length > 8 ? g.tournamentName.slice(0, 7) + "…" : g.tournamentName}
        </span>
        </div>
      );
    })}
    </div>
    </div>
  );
}

function UserEvaluationsBlock({
  loading,
  evaluations,
  avgScore,
}: {
  loading: boolean;
  evaluations: EvaluationScore[];
  avgScore: number;
}) {
  const [expanded, setExpanded] = useState(false);

  // Group scores by tournament
  const tournamentGroups: TournamentScoreGroup[] = useMemo(() => {
    const map = new Map<string, EvaluationScore[]>();
    evaluations.forEach(e => {
      const key = e.tournamentName || "Без турніру";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([name, scores]) => ({
      tournamentName: name,
      scores,
      avgScore: Math.round((scores.reduce((s, e) => s + e.totalScore, 0) / scores.length) * 10) / 10,
    }));
  }, [evaluations]);

  // Last 3 tournament groups to show collapsed
  const visibleGroups = expanded ? tournamentGroups : tournamentGroups.slice(0, 3);
  const hiddenCount   = tournamentGroups.length - 3;

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2">
    <TrendingUp size={16} className="text-green-500" /> Оцінки
    </h2>
    {!loading && evaluations.length > 0 && (
      <div className="flex items-center gap-2">
      <span className="text-[10px] font-black text-green-500 uppercase tracking-widest px-2.5 py-1 rounded-lg bg-green-500/5 border border-green-500/20">
      Сер. {avgScore}
      </span>
      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
      {evaluations.length}
      </span>
      </div>
    )}
    </div>

    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : evaluations.length === 0 ? (
      <div className="text-center py-6">
      <TrendingUp className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Оцінок ще немає</p>
      </div>
    ) : (
      <div className="space-y-5">

      {/* ── Верхня секція: донат + зростання ── */}
      <div className="flex items-start gap-5">
      <UserScoreDonut avg={avgScore} />
      <div className="flex-1 min-w-0 flex flex-col gap-3">
      <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1">Середня оцінка</p>
      <div className="flex items-end gap-2">
      <span className="text-2xl font-black text-(--t1) leading-none">{avgScore}</span>
      <span className="text-[10px] font-bold text-(--t2) mb-0.5">з 100 балів</span>
      </div>
      <div className="mt-2 w-full h-2 rounded-full bg-(--brd) overflow-hidden">
      <div
      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
      style={{ width: `${Math.min(100, avgScore)}%` }}
      />
      </div>
      </div>
      <UserScoreGrowthBar groups={tournamentGroups} />
      </div>
      </div>

      {/* ── Роздільник ── */}
      <div className="h-px bg-(--brd)" />

      {/* ── Групи по турнірах ── */}
      <div className="space-y-4">
      {visibleGroups.map((group, gi) => (
        <CollapsibleSection
        key={gi}
        label={group.tournamentName}
        count={group.scores.length}
        color="text-(--t1)"
        icon={<Trophy size={9} />}
        defaultOpen={gi === 0}
        >
        <div className="space-y-2 pt-1">
        {group.scores.map((score, i) => (
          <ScoreRow key={`${score.submissionId}-${i}`} score={score} />
        ))}
        </div>
        </CollapsibleSection>
      ))}
      </div>

      {/* ── Кнопка «розгорнути» ── */}
      {hiddenCount > 0 && (
        <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-(--brd) bg-(--bg) hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-500"
        >
        <ChevronRight size={12} className={`transition-transform duration-200 ${expanded ? "rotate-90" : "-rotate-90"}`} />
        {expanded ? "Згорнути" : `Ще ${hiddenCount} ${hiddenCount === 1 ? "турнір" : hiddenCount < 5 ? "турніри" : "турнірів"}`}
        </button>
      )}

      </div>
    )}
    </section>
  );
}

// ─── Jury Chart Components ────────────────────────────────────────────────────

// Кругова діаграма: тільки "Оцінено" vs "Не оцінено" для поточного турніру
function JuryDonutChart({
  assigned,
  done,
}: {
  assigned: number;
  done: number;
}) {
  const total      = assigned || 1;
  const donePct    = Math.min(100, Math.round((done / total) * 100));
  const pendingPct = 100 - donePct;

  const R    = 44;
  const CIRC = 2 * Math.PI * R;

  const segments = [
    { pct: donePct,    color: "#22c55e", label: "Оцінено",     value: done },
    { pct: pendingPct, color: "#e5e7eb", label: "Не оцінено",  value: Math.max(0, assigned - done) },
  ];

  let cumPct = 0;
  const arcs = segments.map(seg => {
    const len    = (seg.pct / 100) * CIRC;
    const offset = -(cumPct / 100) * CIRC;
    cumPct += seg.pct;
    return { ...seg, len, offset };
  });

  return (
    <div className="flex items-center gap-6">
    <div className="relative flex-shrink-0">
    <svg width={100} height={100} viewBox="0 0 100 100">
    <circle r={R} cx={50} cy={50} fill="none" stroke="var(--brd,#e5e7eb)" strokeWidth={12} />
    {arcs.map((a, i) =>
      a.pct > 0 ? (
        <circle
        key={i}
        r={R} cx={50} cy={50}
        fill="none"
        stroke={a.color}
        strokeWidth={12}
        strokeDasharray={`${a.len} ${CIRC - a.len}`}
        strokeDashoffset={a.offset}
        strokeLinecap="butt"
        style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px", transition: "stroke-dasharray 0.7s ease" }}
        />
      ) : null
    )}
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
    <span className="text-xl font-black leading-none" style={{ color: "var(--t1)" }}>{done}</span>
    <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--t2)" }}>з {assigned}</span>
    </div>
    </div>

    <div className="flex flex-col gap-3 min-w-0 flex-1">
    <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
    <span className="text-[11px] font-bold text-(--t2)">Оцінено</span>
    </div>
    <div className="flex items-center gap-2">
    <span className="text-sm font-black text-(--t1) leading-none">{done}</span>
    <span className="inline-flex items-center text-[10px] font-black text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-md leading-none">{donePct}%</span>
    </div>
    </div>
    <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full bg-(--brd) border border-(--brd) flex-shrink-0" />
    <span className="text-[11px] font-bold text-(--t2)">Не оцінено</span>
    </div>
    <div className="flex items-center gap-2">
    <span className="text-sm font-black text-(--t1) leading-none">{Math.max(0, assigned - done)}</span>
    <span className="inline-flex items-center text-[10px] font-black text-(--t2) bg-(--bg) px-1.5 py-0.5 rounded-md border border-(--brd) leading-none">{pendingPct}%</span>
    </div>
    </div>
    </div>
    </div>
  );
}

// Лінійна діаграма з вертикальними «зебра»-смугами по турнірах
function JuryZebraLineChart({ data }: { data: JuryEvalByTournament[] }) {
  const W = 320;
  const H = 110;
  const PAD = { top: 14, right: 12, bottom: 28, left: 24 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const max = Math.max(...data.map(d => d.count), 1);
  const n   = data.length;

  // x/y helpers
  const xOf = (i: number) => PAD.left + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yOf = (v: number) => PAD.top  + chartH - (v / max) * chartH;

  // polyline points
  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.count)}`).join(" ");

  // area path: line down to bottom-right, across bottom, up to bottom-left
  const areaPath =
  `M ${xOf(0)},${yOf(data[0].count)} ` +
  data.slice(1).map((d, i) => `L ${xOf(i + 1)},${yOf(d.count)}`).join(" ") +
  ` L ${xOf(n - 1)},${PAD.top + chartH} L ${xOf(0)},${PAD.top + chartH} Z`;

  // y-axis ticks: 0, mid, max
  const yTicks = [0, Math.round(max / 2), max];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">Немає даних</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
    <svg
    viewBox={`0 0 ${W} ${H}`}
    width="100%"
    style={{ minWidth: 200, display: "block" }}
    preserveAspectRatio="xMidYMid meet"
    >
    <defs>
    <linearGradient id="zebraArea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stopColor="#a855f7" stopOpacity="0.22" />
    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.03" />
    </linearGradient>
    </defs>

    {/* Zebra vertical bands — alternate shading per tournament */}
    {data.map((_, i) => {
      if (i % 2 !== 0) return null;
      const bandW = n > 1 ? chartW / (n - 1) : chartW;
      const x0    = n > 1 ? xOf(i) - bandW / 2 : PAD.left;
      const x1    = n > 1 ? xOf(i) + bandW / 2 : PAD.left + chartW;
      const bw    = Math.max(0, x1 - x0);
      const clampedX = Math.max(PAD.left, x0);
      return (
        <rect
        key={i}
        x={clampedX}
        y={PAD.top}
        width={Math.min(bw, PAD.left + chartW - clampedX)}
        height={chartH}
        fill="rgba(168,85,247,0.055)"
        />
      );
    })}

    {/* Horizontal grid lines */}
    {yTicks.map(v => (
      <line
      key={v}
      x1={PAD.left}
      x2={PAD.left + chartW}
      y1={yOf(v)}
      y2={yOf(v)}
      stroke="rgba(168,85,247,0.15)"
      strokeWidth={0.8}
      strokeDasharray="3 3"
      />
    ))}

    {/* Y-axis labels */}
    {yTicks.map(v => (
      <text
      key={v}
      x={PAD.left - 4}
      y={yOf(v) + 3.5}
      textAnchor="end"
      fontSize={7}
      fill="rgba(168,85,247,0.6)"
      fontWeight="700"
      >
      {v}
      </text>
    ))}

    {/* Vertical zebra dividers */}
    {data.map((_, i) => (
      i > 0 ? (
        <line
        key={i}
        x1={xOf(i)}
        x2={xOf(i)}
        y1={PAD.top}
        y2={PAD.top + chartH}
        stroke="rgba(168,85,247,0.12)"
        strokeWidth={0.8}
        />
      ) : null
    ))}

    {/* Area fill */}
    {n > 1 && (
      <path d={areaPath} fill="url(#zebraArea)" />
    )}

    {/* Line */}
    {n > 1 && (
      <polyline
      points={pts}
      fill="none"
      stroke="#a855f7"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      />
    )}

    {/* Dots */}
    {data.map((d, i) => (
      <circle
      key={i}
      cx={xOf(i)}
      cy={yOf(d.count)}
      r={n === 1 ? 4 : 3}
      fill="#a855f7"
      stroke="white"
      strokeWidth={1.5}
      />
    ))}

    {/* X-axis labels */}
    {data.map((d, i) => {
      const label = d.tournamentName.length > 7 ? d.tournamentName.slice(0, 6) + "…" : d.tournamentName;
      return (
        <text
        key={i}
        x={xOf(i)}
        y={H - 4}
        textAnchor="middle"
        fontSize={6.5}
        fill="rgba(168,85,247,0.55)"
        fontWeight="700"
        >
        {label}
        </text>
      );
    })}
    </svg>
    </div>
  );
}

// ─── Jury Stats Block — дві секції без табів ──────────────────────────────────

function JuryStatsBlock({
  loading,
  totalAssigned,
  totalDone,
  totalRounds,
  tournamentsCount,
  evalByTournament,
  inline = false,
}: {
  loading: boolean;
  totalAssigned: number;
  totalDone: number;
  totalRounds: number;
  tournamentsCount: number;
  evalByTournament: JuryEvalByTournament[];
  inline?: boolean;
}) {
  // % growth: compare last two tournaments on the chart
  const growthPct = useMemo(() => {
    if (evalByTournament.length < 2) return null;
    const prev = evalByTournament[evalByTournament.length - 2].count;
    const last = evalByTournament[evalByTournament.length - 1].count;
    if (prev === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - prev) / prev) * 100);
  }, [evalByTournament]);

  const content = (
    <>
    {/* Header — hidden when inline, card already has context */}
    {!inline && (
      <h2 className="text-sm font-black uppercase tracking-widest text-purple-500 flex items-center gap-2 mb-5">
      <TrendingUp size={16} /> Статистика жюрі
      </h2>
    )}

    {/* ── Summary pills ── */}

    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : (
      <div className="flex gap-0 items-stretch">

      {/* ── Секція 1: Поточний турнір ── */}
      <div className="flex-1 min-w-0 pr-5 flex flex-col gap-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-green-500 flex items-center gap-1.5">
      <PlayCircle size={9} /> Поточний турнір
      </p>
      {totalAssigned === 0 ? (
        <div className="flex items-center gap-2 py-2">
        <TrendingUp className="w-7 h-7 text-(--t2) opacity-30 flex-shrink-0" />
        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider leading-tight">Немає призначених робіт</p>
        </div>
      ) : (
        <JuryDonutChart assigned={totalAssigned} done={totalDone} />
      )}
      </div>

      {/* Вертикальний розділювач */}
      <div className="w-px bg-(--brd) flex-shrink-0 self-stretch mx-1" />

      {/* ── Секція 2: Загальна активність ── */}
      <div className="flex-1 min-w-0 pl-5 flex flex-col gap-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-1.5">
      <TrendingUp size={9} /> Загальна активність
      </p>
      {evalByTournament.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
        <TrendingUp className="w-7 h-7 text-(--t2) opacity-30 flex-shrink-0" />
        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider leading-tight">Оцінок ще немає</p>
        </div>
      ) : (
        <JuryZebraLineChart data={evalByTournament} />
      )}
      </div>

      </div>
    )}
    </>
  );

  if (inline) return <div className="w-full">{content}</div>;

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-purple-500/20 p-6 sm:p-8">
    {content}
    </section>
  );
}

// ─── Jury Tournaments Block (замінює старий "2в Jury турніри") ────────────────

const JURY_STATUS_MAP: Record<string, string> = {
  active: "active", ongoing: "active",
  registration: "registration",
  upcoming: "waiting", waiting: "waiting",
  completed: "completed", finished: "completed",
};

function JuryTournamentCard({
  t,
  variant,
  onClick,
}: {
  t: JuryTournament;
  variant: "active" | "registered" | "completed";
  onClick: () => void;
}) {
  const styles = {
    active:     { border: "border-green-500/30 hover:border-green-500/60", bg: "hover:bg-green-500/5", icon: "bg-green-500/10 border-green-500/20 text-green-500", pulse: true },
    registered: { border: "border-blue-500/20 hover:border-blue-500/40",   bg: "hover:bg-blue-500/5",  icon: "bg-blue-500/10 border-blue-500/20 text-blue-500",   pulse: false },
    completed:  { border: "border-(--brd) hover:border-gray-500/30",       bg: "hover:bg-gray-500/5",  icon: "bg-gray-500/10 border-gray-500/20 text-(--t2)",     pulse: false },
  };
  const s = styles[variant];

  return (
    <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg} bg-(--bg) transition-all group text-left`}
    >
    <div className={`relative w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${s.icon}`}>
    <Trophy size={14} />
    {s.pulse && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-(--card)">
      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
      </span>
    )}
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-purple-500 transition-colors">
    {t.name}
    </p>
    {t.start_at && (
      <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
      <Calendar size={8} />
      {new Date(t.start_at).toLocaleDateString("uk-UA")}
      {t.end_at && ` — ${new Date(t.end_at).toLocaleDateString("uk-UA")}`}
      </p>
    )}
    </div>
    <StatusBadge status={JURY_STATUS_MAP[t.status] ?? t.status} />
    </button>
  );
}

function JuryTournamentsBlock({
  loading,
  tournaments,
  onTournamentClick,
}: {
  loading: boolean;
  tournaments: JuryTournament[];
  onTournamentClick: (id: string) => void;
}) {
  const active     = tournaments.filter(t => ["active", "ongoing"].includes(t.status));
  const registered = tournaments.filter(t => ["registration", "upcoming", "waiting"].includes(t.status));
  const completed  = tournaments.filter(t => ["completed", "finished"].includes(t.status));

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2">
    <Trophy size={16} className="text-orange-500" /> Турніри жюрі
    </h2>
    {!loading && tournaments.length > 0 && (
      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
      {tournaments.length}
      </span>
    )}
    </div>

    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : tournaments.length === 0 ? (
      <div className="text-center py-6">
      <Trophy className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">
      Не брав участь у турнірах як жюрі
      </p>
      </div>
    ) : (
      <div className="space-y-5">

      {/* Актуальний */}
      {active.length > 0 && (
        <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-2 flex items-center gap-1.5">
        <PlayCircle size={9} /> Актуальний
        </p>
        <div className="space-y-2">
        {active.map(t => (
          <JuryTournamentCard key={t.id} t={t} variant="active" onClick={() => onTournamentClick(t.id)} />
        ))}
        </div>
        </div>
      )}

      {/* Зареєстрований */}
      {registered.length > 0 && (
        <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-1.5">
        <Users size={9} /> Зареєстрований
        </p>
        <div className="space-y-2">
        {registered.map(t => (
          <JuryTournamentCard key={t.id} t={t} variant="registered" onClick={() => onTournamentClick(t.id)} />
        ))}
        </div>
        </div>
      )}

      {/* Завершено */}
      {completed.length > 0 && (
        <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) mb-2 flex items-center gap-1.5">
        <CheckCircle2 size={9} /> Завершено
        </p>
        <div className="space-y-2">
        {completed.map(t => (
          <JuryTournamentCard key={t.id} t={t} variant="completed" onClick={() => onTournamentClick(t.id)} />
        ))}
        </div>
        </div>
      )}

      </div>
    )}
    </section>
  );
}

const USER_STATUS_MAP: Record<string, string> = {
  active: "active", ongoing: "active",
  registration: "registration",
  upcoming: "waiting", waiting: "waiting",
  completed: "completed", finished: "completed",
};

function UserTournamentCard({
  t,
  variant,
  onClick,
}: {
  t: UserTournament;
  variant: "active" | "registered" | "completed";
  onClick: () => void;
}) {
  const styles = {
    active:     { border: "border-green-500/30 hover:border-green-500/60", bg: "hover:bg-green-500/5",  icon: "bg-green-500/10 border-green-500/20 text-green-500",  pulse: true },
    registered: { border: "border-blue-500/20 hover:border-blue-500/40",   bg: "hover:bg-blue-500/5",   icon: "bg-blue-500/10 border-blue-500/20 text-blue-500",    pulse: false },
    completed:  { border: "border-(--brd) hover:border-gray-500/30",       bg: "hover:bg-gray-500/5",   icon: "bg-gray-500/10 border-gray-500/20 text-(--t2)",      pulse: false },
  };
  const s = styles[variant];
  const statusMap: Record<string, string> = {
    upcoming: "upcoming", registration: "registration", ongoing: "active", finished: "completed",
  };
  return (
    <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg} bg-(--bg) transition-all group text-left`}
    >
    <div className={`relative w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${s.icon}`}>
    <Trophy size={14} />
    {s.pulse && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-(--card)">
      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
      </span>
    )}
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-orange-500 transition-colors">{t.name}</p>
    {t.start_at && (
      <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
      <Calendar size={8} />
      {new Date(t.start_at).toLocaleDateString("uk-UA")}
      </p>
    )}
    </div>
    <StatusBadge status={statusMap[t.status] ?? t.status} />
    </button>
  );
}

function UserTournamentsGroupedBlock({
  loading,
  tournaments,
  onTournamentClick,
}: {
  loading: boolean;
  tournaments: UserTournament[];
  onTournamentClick: (id: string) => void;
}) {
  const active     = tournaments.filter(t => ["active", "ongoing"].includes(t.status));
  const registered = tournaments.filter(t => ["registration", "upcoming", "waiting"].includes(t.status));
  const completed  = tournaments.filter(t => ["completed", "finished"].includes(t.status));

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2">
    <Trophy size={16} className="text-orange-500" /> Турніри
    </h2>
    {!loading && tournaments.length > 0 && (
      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
      {tournaments.length}
      </span>
    )}
    </div>
    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : tournaments.length === 0 ? (
      <div className="text-center py-6">
      <Trophy className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не бере участь у турнірах</p>
      </div>
    ) : (
      <div className="space-y-5">
      {active.length > 0 && (
        <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-2 flex items-center gap-1.5">
        <PlayCircle size={9} /> Актуальний
        </p>
        <div className="space-y-2">
        {active.map(t => (
          <UserTournamentCard key={t.id} t={t} variant="active" onClick={() => onTournamentClick(t.id)} />
        ))}
        </div>
        </div>
      )}
      {registered.length > 0 && (
        <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-1.5">
        <Users size={9} /> Зареєстрований
        </p>
        <div className="space-y-2">
        {registered.map(t => (
          <UserTournamentCard key={t.id} t={t} variant="registered" onClick={() => onTournamentClick(t.id)} />
        ))}
        </div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) mb-2 flex items-center gap-1.5">
        <CheckCircle2 size={9} /> Завершено
        </p>
        <div className="space-y-2">
        {completed.map(t => (
          <UserTournamentCard key={t.id} t={t} variant="completed" onClick={() => onTournamentClick(t.id)} />
        ))}
        </div>
        </div>
      )}
      </div>
    )}
    </section>
  );
}

// ─── Collapsible section with status tabs ─────────────────────────────────────

type AnyItem = Tournament | Round;

function StatusFilterSection<T extends AnyItem>({
  title,
  icon,
  items,
  loading,
  emptyText,
  renderItem,
  accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  loading: boolean;
  emptyText: string;
  renderItem: (item: T) => React.ReactNode;
  accentColor: string;
}) {
  const STATUSES = ["all", "active", "registration", "waiting", "completed"] as const;
  const [activeTab, setActiveTab] = useState<string>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    STATUSES.slice(1).forEach(s => { c[s] = items.filter(i => i.status === s).length; });
    return c;
  }, [items]);

  const filtered = activeTab === "all" ? items : items.filter(i => i.status === activeTab);

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-5">
    <h2 className={`text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2 ${accentColor}`}>
    {icon} {title}
    </h2>
    {!loading && items.length > 0 && (
      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
      {items.length}
      </span>
    )}
    </div>

    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : items.length === 0 ? (
      <div className="text-center py-6">
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">{emptyText}</p>
      </div>
    ) : (
      <>
      <div className="flex gap-1.5 flex-wrap mb-4">
      {STATUSES.map(s => (
        <button
        key={s}
        onClick={() => setActiveTab(s)}
        className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all ${
          activeTab === s
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-(--bg) text-(--t2) border-(--brd) hover:border-blue-600/40"
        }`}
        >
        {s === "all" ? "Всі" : statusConfig[s]?.label ?? s}
        {counts[s] > 0 && <span className="ml-1 opacity-70">{counts[s]}</span>}
        </button>
      ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider py-3 text-center">
        Немає в цьому статусі
        </p>
      ) : (
        <div className="space-y-2">
        {filtered.map(item => renderItem(item))}
        </div>
      )}
      </>
    )}
    </section>
  );
}

// ─── Admin Tournaments Block (grouped by status, like JuryTournamentsBlock) ───

function AdminTournamentCard({
  t,
  variant,
  onClick,
}: {
  t: Tournament;
  variant: "active" | "registered" | "completed";
  onClick: () => void;
}) {
  const styles = {
    active:     { border: "border-green-500/30 hover:border-green-500/60", bg: "hover:bg-green-500/5",  icon: "bg-green-500/10 border-green-500/20 text-green-500",  pulse: true },
    registered: { border: "border-blue-500/20 hover:border-blue-500/40",   bg: "hover:bg-blue-500/5",   icon: "bg-blue-500/10 border-blue-500/20 text-blue-500",    pulse: false },
    completed:  { border: "border-(--brd) hover:border-gray-500/30",       bg: "hover:bg-gray-500/5",   icon: "bg-gray-500/10 border-gray-500/20 text-(--t2)",      pulse: false },
  };
  const s = styles[variant];
  return (
    <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg} bg-(--bg) transition-all group text-left`}
    >
    <div className={`relative w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${s.icon}`}>
    <Trophy size={14} />
    {s.pulse && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-(--card)">
      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
      </span>
    )}
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-black text-(--t1) truncate group-hover:text-orange-500 transition-colors">{t.name}</p>
    {t.start_at && (
      <p className="text-[10px] font-bold text-(--t2) mt-0.5 flex items-center gap-1">
      <Calendar size={8} />
      {new Date(t.start_at).toLocaleDateString("uk-UA")}
      </p>
    )}
    </div>
    <StatusBadge status={t.status} />
    </button>
  );
}

function AdminTournamentsBlock({
  loading,
  tournaments,
  onTournamentClick,
}: {
  loading: boolean;
  tournaments: Tournament[];
  onTournamentClick: (id: string) => void;
}) {
  const active     = tournaments.filter(t => t.status === "ongoing");
  const registered = tournaments.filter(t => t.status === "registration" || t.status === "upcoming");
  const completed  = tournaments.filter(t => t.status === "finished" || t.status === "cancelled");

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2">
    <Trophy size={16} className="text-orange-500" /> Створені турніри
    </h2>
    {!loading && tournaments.length > 0 && (
      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
      {tournaments.length}
      </span>
    )}
    </div>
    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : tournaments.length === 0 ? (
      <div className="text-center py-6">
      <Trophy className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Турнірів не створено</p>
      </div>
    ) : (
      <div className="space-y-5">
      {active.length > 0 && (
        <CollapsibleSection label="Актуальний" count={active.length} color="text-green-500" icon={<PlayCircle size={9} />} defaultOpen={true}>
        {active.map(t => <AdminTournamentCard key={t.id} t={t} variant="active" onClick={() => onTournamentClick(t.id)} />)}
        </CollapsibleSection>
      )}
      {registered.length > 0 && (
        <CollapsibleSection label="Зареєстрований" count={registered.length} color="text-blue-500" icon={<Users size={9} />} defaultOpen={false}>
        {registered.map(t => <AdminTournamentCard key={t.id} t={t} variant="registered" onClick={() => onTournamentClick(t.id)} />)}
        </CollapsibleSection>
      )}
      {completed.length > 0 && (
        <CollapsibleSection label="Завершено" count={completed.length} color="text-(--t2)" icon={<CheckCircle2 size={9} />} defaultOpen={false}>
        {completed.map(t => <AdminTournamentCard key={t.id} t={t} variant="completed" onClick={() => onTournamentClick(t.id)} />)}
        </CollapsibleSection>
      )}
      </div>
    )}
    </section>
  );
}

function AdminRoundsBlock({
  loading,
  rounds,
  onRoundClick,
}: {
  loading: boolean;
  rounds: Round[];
  onRoundClick: (id: string) => void;
}) {
  const active    = rounds.filter(r => r.status === "active");
  const waiting   = rounds.filter(r => r.status === "pending");
  const judging   = rounds.filter(r => r.status === "judging");
  const completed = rounds.filter(r => r.status === "judged");

  return (
    <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
    <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2">
    <Layers size={16} className="text-purple-500" /> Створені раунди
    </h2>
    {!loading && rounds.length > 0 && (
      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
      {rounds.length}
      </span>
    )}
    </div>
    {loading ? (
      <div className="flex items-center gap-2 text-(--t2) py-2">
      <Loader size={14} className="animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
      </div>
    ) : rounds.length === 0 ? (
      <div className="text-center py-6">
      <Layers className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
      <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Раундів не створено</p>
      </div>
    ) : (
      <div className="space-y-5">
      {active.length > 0 && (
        <CollapsibleSection label="Активний" count={active.length} color="text-green-500" icon={<PlayCircle size={9} />} defaultOpen={true}>
        {active.map(r => <RoundRow key={r.id} r={r} onClick={() => onRoundClick(r.id)} />)}
        </CollapsibleSection>
      )}
      {waiting.length > 0 && (
        <CollapsibleSection label="Очікування" count={waiting.length} color="text-amber-500" icon={<Clock size={9} />} defaultOpen={false}>
        {waiting.map(r => <RoundRow key={r.id} r={r} onClick={() => onRoundClick(r.id)} />)}
        </CollapsibleSection>
      )}
      {judging.length > 0 && (
        <CollapsibleSection label="Оцінювання" count={judging.length} color="text-purple-500" icon={<Crown size={9} />} defaultOpen={false}>
        {judging.map(r => <RoundRow key={r.id} r={r} onClick={() => onRoundClick(r.id)} />)}
        </CollapsibleSection>
      )}
      {completed.length > 0 && (
        <CollapsibleSection label="Завершено" count={completed.length} color="text-(--t2)" icon={<CheckCircle2 size={9} />} defaultOpen={false}>
        {completed.map(r => <RoundRow key={r.id} r={r} onClick={() => onRoundClick(r.id)} />)}
        </CollapsibleSection>
      )}
      </div>
    )}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicUserProfile() {
  const { dark } = useTheme();
  const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar } = useSidebar();
  const router  = useRouter();
  const params  = useParams();
  const { user: currentUser, isLoading: authLoading } = useAuth();

  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [selectedRole, setSelectedRole]     = useState<Role>("user");
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleMsg, setRoleMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isSuperAdmin  = useMemo(() => currentUser?.role === "superadmin", [currentUser?.role]);
  const isAdmin       = useMemo(() => currentUser?.role === "admin" || currentUser?.role === "superadmin", [currentUser?.role]);
  const isOwnProfile  = currentUser?.id === params.id;

  const profileIsAdmin = profileUser?.role === "admin" || profileUser?.role === "superadmin";

  const { teams: userTeams, loading: teamsLoading } = useUserTeams(
    profileIsAdmin ? undefined : (params.id as string | undefined)
  );

  const { tournaments, rounds, announcements, loading: statsLoading } = useAdminStats(
    params.id as string | undefined,
    profileIsAdmin
  );

  const profileIsUser = !profileIsAdmin && profileUser?.role !== "jury";
  const profileIsJury = profileUser?.role === "jury";

  const {
    tournaments: juryTournaments,
    evaluationsCount: juryEvaluationsCount,
    totalAssigned: juryTotalAssigned,
    totalInProgress: juryTotalInProgress,
    totalDone: juryTotalDone,
    totalRounds: juryTotalRounds,
    evalByTournament: juryEvalByTournament,
    loading: juryStatsLoading,
  } = useJuryStats(params.id as string | undefined, profileIsJury);

  const {
    tournaments: userTournaments,
    rounds: userRounds,
    evaluations: userEvaluations,
    avgScore: userAvgScore,
    loading: userStatsLoading,
  } = useUserStats(params.id as string | undefined, profileIsUser);

  const {
    announcements: userAnnouncements,
    loading: userAnnouncementsLoading,
  } = useUserAnnouncements(params.id as string | undefined, profileIsUser);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { router.push("/login"); return; }

    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
        .from("account")
        .select("id, username, login, email, role, status, avatar_url, full_name, city_school, telegram, discord")
        .eq("id", params.id)
        .single();

        if (error) throw error;
        setProfileUser(data);
        setSelectedRole((data.role as Role) ?? "user");
      } catch {
        setError("User not found");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [params.id, authLoading, currentUser, router]);

  const handleRoleChange = async () => {
    if (!isSuperAdmin || !profileUser) return;
    setIsChangingRole(true);
    setRoleMsg(null);

    try {
      const { error: supabaseError } = await supabase
      .from("account")
      .update({ role: selectedRole })
      .eq("id", profileUser.id);

      if (supabaseError) throw new Error(supabaseError.message);

      setProfileUser((prev: any) => ({ ...prev, role: selectedRole }));
      setRoleMsg({ type: "ok", text: `Role changed to ${selectedRole}` });
    } catch (e: any) {
      setRoleMsg({ type: "err", text: e.message });
    } finally {
      setIsChangingRole(false);
    }
  };

  // ── Loading states ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>
      {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => closeMobileSidebar()} />}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <Sidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <MobileHeader onOpenSidebar={openMobile} title="Profile" icon={<UserCircle size={18} className="text-blue-600" />} />
      <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
      </main>
      </div>
    );
  }

  if (!currentUser) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
    <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
    </div>

    {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => closeMobileSidebar()} />}
    <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
    <Sidebar />
    </div>

    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
    <MobileHeader onOpenSidebar={openMobile} title="Profile" icon={<UserCircle size={18} className="text-blue-600" />} />

    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
    <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
    <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Home</button>
    <ChevronRight size={10} />
    <button onClick={() => router.push("/search")} className="hover:text-blue-600 transition-colors">Search</button>
    <ChevronRight size={10} />
    <span className="text-(--t1)">Profile</span>
    </nav>

    <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
    <ArrowLeft size={14} /> Back
    </button>

    {error ? (
      <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 text-center">
      <p className="text-lg font-black text-(--t1) mb-2">{error}</p>
      <p className="text-(--t2) text-sm">The user you are looking for does not exist</p>
      </div>
    ) : profileUser ? (
      <div className={profileIsJury || profileIsAdmin || profileIsUser ? "max-w-6xl mx-auto" : "max-w-2xl mx-auto"}>

      {/* ── JURY: two-column grid layout ────────────────────────── */}
      {profileIsJury ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* LEFT COLUMN */}
        <div className="space-y-6">

        {/* ── 1. Profile card ─────────────────────────────────────── */}
        <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-(--t1) hidden md:block">
        <Shield size={240} />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <div className="relative flex-shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md overflow-hidden">
        {profileUser.avatar_url ? (
          <img src={profileUser.avatar_url} alt={profileUser.username} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl font-black text-blue-600">
          {profileUser.username?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
        </div>
        {profileUser.status === "active" && (
          <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
        )}
        </div>

        <div className="flex-1 space-y-3 z-10 w-full text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-black text-(--t1) uppercase tracking-tight">{profileUser.username}</h1>
        {profileIsAdmin && (
          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user} flex items-center gap-1`}>
          <Shield size={9} /> {profileUser.role}
          </span>
        )}
        {isOwnProfile && (
          <span className="inline-block text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">
          Your profile
          </span>
        )}
        </div>

        <div className="mt-4 space-y-2.5 text-sm text-left">
        <p className="flex items-center gap-3 font-medium">
        <User size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Login:</span>
        <span className="font-bold">{profileUser.login}</span>
        </p>
        {isAdmin && (
          <p className="flex items-center gap-3 font-medium">
          <Mail size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Email:</span>
          <span className="font-bold break-all">{profileUser.email}</span>
          </p>
        )}
        <p className="flex items-center gap-3 font-medium">
        <Shield size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Role:</span>
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user}`}>
        {profileUser.role ?? "user"}
        </span>
        </p>
        {profileUser.full_name && (
          <p className="flex items-center gap-3 font-medium">
          <User size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">ПІБ:</span>
          <span className="font-bold">{profileUser.full_name}</span>
          </p>
        )}
        {profileUser.city_school && (
          <p className="flex items-center gap-3 font-medium">
          <MapPin size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Місто/школа:</span>
          <span className="font-bold">{profileUser.city_school}</span>
          </p>
        )}
        {isAdmin && profileUser.telegram && (
          <p className="flex items-center gap-3 font-medium">
          <MessageCircle size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Telegram:</span>
          <span className="font-bold">{profileUser.telegram}</span>
          </p>
        )}
        {isAdmin && profileUser.discord && (
          <p className="flex items-center gap-3 font-medium">
          <Hash size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Discord:</span>
          <span className="font-bold">{profileUser.discord}</span>
          </p>
        )}
        </div>

        {profileIsJury && (
          <div className="pt-3 border-t border-(--brd) flex flex-wrap gap-2">
          <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-purple-500/5 border-purple-500/20 text-purple-500 min-w-[60px]">
          <span className="text-base font-black leading-none">{juryTournaments.length}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Турніри</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-blue-500/5 border-blue-500/20 text-blue-500 min-w-[60px]">
          <span className="text-base font-black leading-none">{juryTotalRounds}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Раунди</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-green-500/5 border-green-500/20 text-green-500 min-w-[60px]">
          <span className="text-base font-black leading-none">{juryTotalDone}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Робіт</span>
          </div>
          {juryEvalByTournament.length >= 2 && (() => {
            const prev = juryEvalByTournament[juryEvalByTournament.length - 2].count;
            const last = juryEvalByTournament[juryEvalByTournament.length - 1].count;
            const pct  = prev === 0 ? (last > 0 ? 100 : 0) : Math.round(((last - prev) / prev) * 100);
            return (
              <div className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border min-w-[60px] ${pct > 0 ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : pct < 0 ? "bg-red-500/5 border-red-500/20 text-red-500" : "bg-(--bg) border-(--brd) text-(--t2)"}`}>
              <span className="text-base font-black leading-none">{pct > 0 ? "+" : ""}{pct}%</span>
              <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Зростання</span>
              </div>
            );
          })()}
          </div>
        )}
        </div>
        </div>
        </section>

        {/* ── 2б. Jury stats (діаграми) — окремий блок ─────── */}
        {profileIsJury && (
          <JuryStatsBlock
          loading={juryStatsLoading}
          totalAssigned={juryTotalAssigned}
          totalInProgress={juryTotalInProgress}
          totalDone={juryTotalDone}
          totalRounds={juryTotalRounds}
          tournamentsCount={juryTournaments.length}
          evalByTournament={juryEvalByTournament}
          />
        )}

        </div>

        <div className="space-y-6">
        <JuryTournamentsBlock
        loading={juryStatsLoading}
        tournaments={juryTournaments}
        onTournamentClick={(id) => router.push(`/tournaments/${id}`)}
        />
        </div>

        </div>
      ) : profileIsAdmin ? (

        /* ══════════════════════════════════════════════════════════
         *          ADMIN — two-column grid layout
         *          ══════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">

        {/* ── A1. Profile card ── */}
        <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-orange-500 hidden md:block">
        <Shield size={240} />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <div className="relative flex-shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-orange-500/10 flex items-center justify-center border-4 border-(--brd) shadow-md overflow-hidden">
        {profileUser.avatar_url ? (
          <img src={profileUser.avatar_url} alt={profileUser.username} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl font-black text-orange-500">
          {profileUser.username?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
        </div>
        {profileUser.status === "active" && (
          <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
        )}
        </div>

        <div className="flex-1 space-y-3 z-10 w-full text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-black text-(--t1) uppercase tracking-tight">{profileUser.username}</h1>
        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user} flex items-center gap-1`}>
        <Shield size={9} /> {profileUser.role}
        </span>
        {isOwnProfile && (
          <span className="inline-block text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">
          Your profile
          </span>
        )}
        </div>

        <div className="mt-4 space-y-2.5 text-sm text-left">
        <p className="flex items-center gap-3 font-medium">
        <User size={16} className="text-orange-500 flex-shrink-0" />
        <span className="text-(--t2)">Login:</span>
        <span className="font-bold">{profileUser.login}</span>
        </p>
        {isAdmin && (
          <p className="flex items-center gap-3 font-medium">
          <Mail size={16} className="text-orange-500 flex-shrink-0" />
          <span className="text-(--t2)">Email:</span>
          <span className="font-bold break-all">{profileUser.email}</span>
          </p>
        )}
        <p className="flex items-center gap-3 font-medium">
        <Shield size={16} className="text-orange-500 flex-shrink-0" />
        <span className="text-(--t2)">Role:</span>
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user}`}>
        {profileUser.role ?? "admin"}
        </span>
        </p>
        {profileUser.full_name && (
          <p className="flex items-center gap-3 font-medium">
          <User size={16} className="text-orange-500 flex-shrink-0" />
          <span className="text-(--t2)">ПІБ:</span>
          <span className="font-bold">{profileUser.full_name}</span>
          </p>
        )}
        {profileUser.city_school && (
          <p className="flex items-center gap-3 font-medium">
          <MapPin size={16} className="text-orange-500 flex-shrink-0" />
          <span className="text-(--t2)">Місто/школа:</span>
          <span className="font-bold">{profileUser.city_school}</span>
          </p>
        )}
        {isAdmin && profileUser.telegram && (
          <p className="flex items-center gap-3 font-medium">
          <MessageCircle size={16} className="text-orange-500 flex-shrink-0" />
          <span className="text-(--t2)">Telegram:</span>
          <span className="font-bold">{profileUser.telegram}</span>
          </p>
        )}
        {isAdmin && profileUser.discord && (
          <p className="flex items-center gap-3 font-medium">
          <Hash size={16} className="text-orange-500 flex-shrink-0" />
          <span className="text-(--t2)">Discord:</span>
          <span className="font-bold">{profileUser.discord}</span>
          </p>
        )}
        </div>

        {/* Quick stat pills in header */}
        <div className="pt-3 border-t border-(--brd) flex flex-wrap gap-2">
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-orange-500/5 border-orange-500/20 text-orange-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{tournaments.length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Турніри</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-purple-500/5 border-purple-500/20 text-purple-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{rounds.length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Раунди</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-blue-500/5 border-blue-500/20 text-blue-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{announcements.length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Оголошення</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-amber-500/5 border-amber-500/20 text-amber-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{announcements.filter(a => a.is_pinned).length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Закріплені</span>
        </div>
        </div>
        </div>
        </div>
        </section>

        {/* ── A3. Оголошення ── */}
        <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
        <Megaphone size={16} /> Оголошення
        </h2>
        {!statsLoading && announcements.length > 0 && (
          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
          {announcements.length}
          </span>
        )}
        </div>
        {statsLoading ? (
          <div className="flex items-center gap-2 text-(--t2) py-2">
          <Loader size={14} className="animate-spin" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-6">
          <Megaphone className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
          <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Оголошень немає</p>
          </div>
        ) : (
          <>
          {announcements.filter(a => a.is_pinned).length > 0 && (
            <div className="mb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1">
            <Pin size={9} /> Закріплені
            </p>
            <div className="space-y-2">
            {announcements.filter(a => a.is_pinned).map(a => (
              <AnnouncementRow key={a.id} a={a} onClick={() => router.push(`/announcements/${a.id}`)} />
            ))}
            </div>
            </div>
          )}
          {announcements.filter(a => !a.is_pinned).length > 0 && (
            <div>
            {announcements.filter(a => a.is_pinned).length > 0 && (
              <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) mb-2">Інші</p>
            )}
            <div className="space-y-2">
            {announcements.filter(a => !a.is_pinned).map(a => (
              <AnnouncementRow key={a.id} a={a} onClick={() => router.push(`/announcements/${a.id}`)} />
            ))}
            </div>
            </div>
          )}
          </>
        )}
        </section>

        {/* ── A4. Role management ── */}
        {isSuperAdmin && !isOwnProfile && profileUser.role !== "superadmin" && (
          <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-red-500/30 p-6 sm:p-8">
          <h2 className="text-sm font-black mb-1 uppercase tracking-widest text-red-500 flex items-center gap-2">
          <Shield size={16} /> Role Management
          </h2>
          <p className="text-[10px] text-(--t2) font-bold uppercase tracking-wider mb-5">Only superadmin can change roles</p>
          <div className="flex flex-col gap-3 max-w-xs">
          <div>
          <label className="text-[10px] font-bold text-(--t2) uppercase tracking-wider block mb-2">Select New Role</label>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as Role)} disabled={isChangingRole}
          className="w-full px-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold uppercase tracking-widest text-(--t1) focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          </div>
          <button onClick={handleRoleChange} disabled={isChangingRole || selectedRole === profileUser.role}
          className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${isChangingRole || selectedRole === profileUser.role ? "bg-(--brd) text-(--t2) cursor-not-allowed" : "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20"}`}>
          {isChangingRole ? <><Loader size={14} className="animate-spin" /> Changing...</> : <><Shield size={14} /> Change Role</>}
          </button>
          </div>
          {roleMsg && (
            <div className={`mt-4 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${roleMsg.type === "ok" ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
            {roleMsg.text}
            </div>
          )}
          </section>
        )}

        {!isSuperAdmin && !isOwnProfile && (
          <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
          <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">Only superadmin users can change roles</p>
          </section>
        )}

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">

        {/* ── A5. Створені турніри ── */}
        <AdminTournamentsBlock
        loading={statsLoading}
        tournaments={tournaments}
        onTournamentClick={(id) => router.push(`/tournaments/${id}`)}
        />

        {/* ── A6. Створені раунди ── */}
        <AdminRoundsBlock
        loading={statsLoading}
        rounds={rounds}
        onRoundClick={(id) => router.push(`/rounds/${id}`)}
        />

        </div>
        </div>

      ) : (

        /* ══════════════════════════════════════════════════════════
         *          USER — two-column grid layout
         *          ══════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">

        {/* ── U1. Profile card ── */}
        <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none text-blue-600 hidden md:block">
        <UserCircle size={240} />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <div className="relative flex-shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600/10 flex items-center justify-center border-4 border-(--brd) shadow-md overflow-hidden">
        {profileUser.avatar_url ? (
          <img src={profileUser.avatar_url} alt={profileUser.username} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl font-black text-blue-600">
          {profileUser.username?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
        </div>
        {profileUser.status === "active" && (
          <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-(--card) rounded-full shadow-sm" />
        )}
        </div>

        <div className="flex-1 space-y-3 z-10 w-full text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-black text-(--t1) uppercase tracking-tight">{profileUser.username}</h1>
        {isOwnProfile && (
          <span className="inline-block text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">
          Your profile
          </span>
        )}
        </div>

        <div className="mt-4 space-y-2.5 text-sm text-left">
        <p className="flex items-center gap-3 font-medium">
        <User size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Login:</span>
        <span className="font-bold">{profileUser.login}</span>
        </p>
        {isAdmin && (
          <p className="flex items-center gap-3 font-medium">
          <Mail size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Email:</span>
          <span className="font-bold break-all">{profileUser.email}</span>
          </p>
        )}
        <p className="flex items-center gap-3 font-medium">
        <Shield size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-(--t2)">Role:</span>
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${roleBadgeColor[profileUser.role as Role] ?? roleBadgeColor.user}`}>
        {profileUser.role ?? "user"}
        </span>
        </p>
        {profileUser.full_name && (
          <p className="flex items-center gap-3 font-medium">
          <User size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">ПІБ:</span>
          <span className="font-bold">{profileUser.full_name}</span>
          </p>
        )}
        {profileUser.city_school && (
          <p className="flex items-center gap-3 font-medium">
          <MapPin size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Місто/школа:</span>
          <span className="font-bold">{profileUser.city_school}</span>
          </p>
        )}
        {isAdmin && profileUser.telegram && (
          <p className="flex items-center gap-3 font-medium">
          <MessageCircle size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Telegram:</span>
          <span className="font-bold">{profileUser.telegram}</span>
          </p>
        )}
        {isAdmin && profileUser.discord && (
          <p className="flex items-center gap-3 font-medium">
          <Hash size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-(--t2)">Discord:</span>
          <span className="font-bold">{profileUser.discord}</span>
          </p>
        )}
        </div>

        {/* Quick stat pills in header */}
        <div className="pt-3 border-t border-(--brd) flex flex-wrap gap-2">
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-orange-500/5 border-orange-500/20 text-orange-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{userTournaments.length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Турніри</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-purple-500/5 border-purple-500/20 text-purple-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{userRounds.length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Раунди</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-green-500/5 border-green-500/20 text-green-500 min-w-[60px]">
        <span className="text-base font-black leading-none">{userEvaluations.length}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Оцінок</span>
        </div>
        {userEvaluations.length > 0 && (
          <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border bg-blue-500/5 border-blue-500/20 text-blue-500 min-w-[60px]">
          <span className="text-base font-black leading-none">{userAvgScore}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider opacity-70 whitespace-nowrap">Сер. бал</span>
          </div>
        )}
        </div>
        </div>
        </div>
        </section>

        {/* ── U2. Команди ── */}
        <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-(--t1) flex items-center gap-2">
        <Users size={16} className="text-blue-600" /> Команди
        </h2>
        {!teamsLoading && userTeams.length > 0 && (
          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
          {userTeams.length}
          </span>
        )}
        </div>
        {teamsLoading ? (
          <div className="flex items-center gap-2 text-(--t2) py-2">
          <Loader size={14} className="animate-spin" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Завантаження...</span>
          </div>
        ) : userTeams.length === 0 ? (
          <div className="text-center py-6">
          <Users className="w-10 h-10 text-(--t2) mx-auto mb-3 opacity-30" />
          <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider">Не перебуває в жодній команді</p>
          </div>
        ) : (
          <div className="space-y-2">
          {userTeams.map(team => (
            <TeamBadge key={team.id} team={team} userId={profileUser.id} onClick={() => router.push(`/teams/${team.id}`)} />
          ))}
          </div>
        )}
        </section>

        {/* ── U4. Role management (superadmin only) ── */}
        {isSuperAdmin && !isOwnProfile && profileUser.role !== "superadmin" && (
          <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-red-500/30 p-6 sm:p-8">
          <h2 className="text-sm font-black mb-1 uppercase tracking-widest text-red-500 flex items-center gap-2">
          <Shield size={16} /> Role Management
          </h2>
          <p className="text-[10px] text-(--t2) font-bold uppercase tracking-wider mb-5">Only superadmin can change roles</p>
          <div className="flex flex-col gap-3 max-w-xs">
          <div>
          <label className="text-[10px] font-bold text-(--t2) uppercase tracking-wider block mb-2">Select New Role</label>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as Role)} disabled={isChangingRole}
          className="w-full px-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold uppercase tracking-widest text-(--t1) focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          </div>
          <button onClick={handleRoleChange} disabled={isChangingRole || selectedRole === profileUser.role}
          className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${isChangingRole || selectedRole === profileUser.role ? "bg-(--brd) text-(--t2) cursor-not-allowed" : "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20"}`}>
          {isChangingRole ? <><Loader size={14} className="animate-spin" /> Changing...</> : <><Shield size={14} /> Change Role</>}
          </button>
          </div>
          {roleMsg && (
            <div className={`mt-4 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${roleMsg.type === "ok" ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
            {roleMsg.text}
            </div>
          )}
          </section>
        )}

        {!isSuperAdmin && !isOwnProfile && (
          <section className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) p-6 sm:p-8">
          <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">Only superadmin users can change roles</p>
          </section>
        )}

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">

        {/* ── U5. Турніри (grouped by status) ── */}
        <UserTournamentsGroupedBlock
        loading={userStatsLoading}
        tournaments={userTournaments}
        onTournamentClick={(id) => router.push(`/tournaments/${id}`)}
        />

        {/* ── U6. Оцінки (з діаграмою, динамікою і групами по турнірах) ── */}
        <UserEvaluationsBlock
        loading={userStatsLoading}
        evaluations={userEvaluations}
        avgScore={userAvgScore}
        />

        </div>
        </div>

      )}

      </div>
    ) : null}
    </div>
    </main>
    </div>
  );
}
