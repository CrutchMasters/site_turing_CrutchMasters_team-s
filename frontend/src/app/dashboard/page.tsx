//src/app/dashboard/page.tsx
'use client';

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { Trophy, Users, Upload, ExternalLink, ChevronRight, Plus, Loader } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { supabase } from "@/lib/supabase";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface Tournament {
  id: string;
  name: string;
  status: "upcoming" | "registration" | "ongoing" | "finished";
  start_at: string;
  max_teams?: number;
  team_count?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  upcoming:     { label: "Скоро",       color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  registration: { label: "Реєстрація",  color: "bg-green-500/10 text-green-600 border-green-500/30" },
  ongoing:      { label: "Тривають",    color: "bg-blue-600/10 text-blue-600 border-blue-600/30" },
  finished:     { label: "Завершено",   color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DashboardPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [backendMessage, setBackendMessage] = useState("waiting...");
  const [tournaments, setTournaments]       = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [activeFilter, setActiveFilter]     = useState<"all" | "upcoming" | "registration" | "ongoing" | "finished">("all");
  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();
  const { dark } = useTheme();
  const { user, isLoading } = useAuth();
  const { t } = useT();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

    const fetchTournaments = useCallback(async () => {
      setTournamentsLoading(true);
      try {
        const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, start_at, max_teams")
        .in("status", ["upcoming", "registration", "ongoing"])
        .order("start_at", { ascending: true })
        .limit(10);

        if (error) throw error;

        const ids = (data ?? []).map((t: any) => t.id);
        let counts: Record<string, number> = {};
        if (ids.length) {
          const { data: regData } = await supabase
          .from("tournament_teams")
          .select("tournament_id")
          .in("tournament_id", ids);
          (regData ?? []).forEach((r: any) => {
            counts[r.tournament_id] = (counts[r.tournament_id] ?? 0) + 1;
          });
        }

        setTournaments((data ?? []).map((t: any) => ({ ...t, team_count: counts[t.id] ?? 0 })));
      } catch (e) {
        console.error(e);
      } finally {
        setTournamentsLoading(false);
      }
    }, []);

    useEffect(() => {
      if (isLoading || !user) return;

      fetch(`${API_URL}/api/test`)
      .then(r => r.json())
      .then(d => setBackendMessage(d.message))
      .catch(() => setBackendMessage("Disconnected"));

      fetchTournaments();

      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("fuIn"); }),
                                           { threshold: 0.1 }
      );
      revealRefs.current.forEach(r => { if (r) obs.observe(r); });
      return () => obs.disconnect();
    }, [isLoading, user, fetchTournaments]);

    if (isLoading) return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );

    if (!user) return null;

    const isAdmin = user.role === "admin" || user.role === "superadmin";

  const filterLabels: { key: typeof activeFilter; label: string }[] = [
    { key: "all",          label: t.mainPage.filterAll },
    { key: "upcoming",     label: "Скоро" },
    { key: "registration", label: t.mainPage.filterOpen },
    { key: "ongoing",      label: t.mainPage.filterRunning },
  ];

  const filteredTournaments = activeFilter === "all"
  ? tournaments
  : tournaments.filter(t => t.status === activeFilter);

  return (
    <div className="flex h-screen bg-(--bg) text-(--t1) transition-colors duration-300">
    <style jsx global>{`
      @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
      @keyframes cardDrop { from{opacity:0;transform:translateY(-26px) scale(.97)} to{opacity:1;transform:none} }
      .fuIn { animation: fadeUp 340ms cubic-bezier(.22,1,.36,1) both }
      .cdIn { animation: cardDrop 500ms cubic-bezier(.22,1,.36,1) both }
      .spr  { transition: transform 170ms cubic-bezier(.22,1,.36,1),box-shadow 170ms ease,background 150ms ease,color 150ms ease }
      .spr:hover { transform: translateY(-2px) scale(1.025) }
      `}</style>

      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} title={t.mainPage.dashboard} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
      <header className="mb-8 sm:mb-12">
      <div className="flex items-center gap-2 text-[10px] font-black mb-3 uppercase tracking-widest text-(--t2)">
      <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">{t.nav.home}</button>
      <ChevronRight size={10} /><span className="text-(--t1)">{t.mainPage.dashboard}</span>
      </div>
      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-(--t1) uppercase">{t.mainPage.overview}</h1>
      </header>

      <div className="max-w-6xl space-y-6 sm:space-y-8">

      {/* Admin Banner */}
      {isAdmin && (
        <section
        ref={el => { revealRefs.current[0] = el; }}
        className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 relative overflow-hidden bg-(--card) border border-blue-600/30 shadow-xl"
        >
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl sm:rounded-[2.5rem]">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-10 bg-blue-600" />
        <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full blur-2xl opacity-5 bg-blue-400" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/15 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
        <Trophy className="text-blue-600" size={24} />
        </div>
        <div>
        <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-blue-600/10 text-blue-500 border border-blue-500/30 px-2.5 py-1 rounded-lg mb-2">
        {user.role === "superadmin" ? "Superadmin" : "Admin"} panel
        </span>
        <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight leading-tight">
        Управління турнірами
        </h2>
        <p className="text-xs font-bold text-(--t2) mt-1 max-w-sm">
        Створюйте нові турніри, керуйте командами та налаштовуйте параметри змагань
        </p>
        </div>
        </div>
        <button
        onClick={() => router.push("/register_tourney")}
        className="flex-shrink-0 flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 sm:px-8 py-4 hover:bg-blue-700 shadow-lg shadow-blue-600/25 active:scale-95 transition-all w-full sm:w-auto group"
        >
        <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
        Створити турнір
        </button>
        </div>

        <div className="relative z-10 mt-6 pt-5 border-t border-(--brd) flex flex-wrap gap-4 sm:gap-8">
        {[
          { label: "Активних турнірів", value: tournaments.filter(t => t.status === "ongoing").length.toString() },
                   { label: "Відкритих реєстрацій", value: tournaments.filter(t => t.status === "registration").length.toString() },
                   { label: "Всього у базі", value: tournaments.length.toString() },
        ].map(({ label, value }) => (
          <div key={label}>
          <p className="text-[10px] font-black uppercase tracking-wider text-(--t2)">{label}</p>
          <p className="text-lg font-black text-blue-600">{value}</p>
          </div>
        ))}
        </div>
        </section>
      )}

      {/* ── Tournaments table ── */}
      <section ref={el => { revealRefs.current[1] = el; }} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
      <div className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--brd)">
      <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">{t.mainPage.tournamentList}</h2>
      <div className="flex flex-wrap gap-2">
      {filterLabels.map(({ key, label }) => (
        <button
        key={key}
        onClick={() => setActiveFilter(key)}
        className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all spr ${activeFilter === key ? "bg-blue-600 text-white shadow-md" : "bg-(--bg) text-(--t2) border border-(--brd)"}`}
        >
        {label}
        </button>
      ))}
      </div>
      </div>

      {tournamentsLoading ? (
        <div className="flex items-center justify-center py-16">
        <Loader className="w-7 h-7 text-blue-600 animate-spin" />
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="py-16 text-center">
        <Trophy className="w-12 h-12 text-(--t2) opacity-30 mx-auto mb-3" />
        <p className="text-sm font-bold text-(--t2)">Турнірів не знайдено</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
        <tr className="bg-(--bg)/50 border-b border-(--brd)">
        {[t.mainPage.colTournament, t.mainPage.colStatus, t.mainPage.colStart, "Команди", t.mainPage.colActions].map(h => (
          <th key={h} className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2) last:text-right">{h}</th>
        ))}
        </tr>
        </thead>
        <tbody className="text-sm divide-y divide-(--brd)">
        {filteredTournaments.map(tourney => {
          const cfg = STATUS_CONFIG[tourney.status] ?? STATUS_CONFIG.upcoming;
          return (
            <tr key={tourney.id} className="transition-colors hover:bg-(--bg)/30 cursor-pointer" onClick={() => router.push(`/tournaments/${tourney.id}`)}>
            <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-(--t1)">{tourney.name}</td>
            <td className="px-4 sm:px-6 py-4 sm:py-5">
            <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded border ${cfg.color}`}>{cfg.label}</span>
            </td>
            <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-(--t2) text-xs">{fmtDate(tourney.start_at)}</td>
            <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-(--t2) text-xs">
            {tourney.team_count ?? 0}{tourney.max_teams ? ` / ${tourney.max_teams}` : ""}
            </td>
            <td className="px-4 sm:px-6 py-4 sm:py-5 text-right">
            {tourney.status === "registration" ? (
              <button
              onClick={e => { e.stopPropagation(); router.push(`/tournaments/${tourney.id}`); }}
              className="font-black text-[9px] uppercase tracking-tighter px-3 py-2 rounded-lg border border-blue-600 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
              >
              {t.mainPage.actionRegister}
              </button>
            ) : (
              <button
              onClick={e => { e.stopPropagation(); router.push(`/tournaments/${tourney.id}`); }}
              className="p-2 rounded-lg text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors"
              >
              <ExternalLink size={16} />
              </button>
            )}
            </td>
            </tr>
          );
        })}
        </tbody>
        </table>
        </div>
      )}

      <div className="px-4 sm:px-6 py-3 border-t border-(--brd)">
      <button
      onClick={() => router.push("/tournaments")}
      className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
      >
      Всі турніри →
      </button>
      </div>
      </section>

      {/* Team */}
      <section ref={el => { revealRefs.current[2] = el; }} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 relative overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10 bg-blue-600 pointer-events-none" />
      <h2 className="font-black text-lg sm:text-xl mb-6 sm:mb-8 flex items-center gap-3 relative z-10 text-(--t1) uppercase tracking-tight">
      <Users className="text-blue-600" size={24} /> {t.mainPage.currentTournament}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 relative z-10">
      <div className="p-4 sm:p-6 rounded-2xl bg-(--bg) border border-(--brd)">
      <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">{t.mainPage.currentTournament}</p>
      <p className="font-bold text-sm text-(--t1)">—</p>
      </div>
      <div className="p-4 sm:p-6 rounded-2xl bg-(--bg) border border-(--brd)">
      <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">{t.mainPage.task}</p>
      <p className="font-bold text-sm text-(--t1)">—</p>
      </div>
      <div className="p-4 sm:p-6 rounded-2xl bg-blue-600/10 border border-blue-600/20">
      <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-blue-600">{t.mainPage.colStatus}</p>
      <p className="font-bold text-sm text-blue-600 italic">—</p>
      </div>
      </div>
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 sm:pt-8 border-t border-(--brd)">
      <p className="text-xs font-bold text-(--t2) uppercase tracking-widest italic">{t.mainPage.statusChecking}</p>
      <button className="w-full sm:w-auto bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 sm:px-8 py-4 flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
      <Upload size={16} /> {t.mainPage.newVersion}
      </button>
      </div>
      </section>

      </div>
      </div>
      </main>
      </div>
  );
}
