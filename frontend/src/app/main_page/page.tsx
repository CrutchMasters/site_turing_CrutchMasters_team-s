//site_turing_CrutchMasters_team-s/frontend/src/app/main_page/page.tsx
'use client';

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { Trophy, Users, Upload, ExternalLink, ChevronRight } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";

const API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

export default function DashboardPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [backendMessage, setBackendMessage] = useState("waiting...");
  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();
  const { dark } = useTheme();
  const { user, isLoading } = useAuth();
  const { t } = useT();

  useEffect(() => {
    if (isLoading || !user) return;
    fetch(`${API_URL}/api/test`)
      .then(r => r.json())
      .then(d => setBackendMessage(d.message))
      .catch(() => setBackendMessage("Disconnected"));

    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("fuIn"); }),
      { threshold: 0.1 }
    );
    revealRefs.current.forEach(r => { if (r) obs.observe(r); });
    return () => obs.disconnect();
  }, [isLoading, user]);

  if (isLoading) return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  const filterLabels = [t.mainPage.filterAll, t.mainPage.filterOpen, t.mainPage.filterRunning];

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
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
            {/* Tournaments */}
            <section ref={el => { revealRefs.current[0] = el; }} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
              <div className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--brd)">
                <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">🏆 {t.mainPage.tournamentList}</h2>
                <div className="flex flex-wrap gap-2">
                  {filterLabels.map((l, i) => (
                    <button key={l} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all spr ${i === 0 ? "bg-blue-600 text-white shadow-md" : "bg-(--bg) text-(--t2) border border-(--brd)"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-(--bg)/50 border-b border-(--brd)">
                      {[t.mainPage.colTournament, t.mainPage.colStatus, t.mainPage.colStart].map(h => (
                        <th key={h} className="px-4 sm:px-8 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2)">{h}</th>
                      ))}
                      <th className="px-4 sm:px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right text-(--t2)">{t.mainPage.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-(--brd)">
                    <TournamentRow title="Хакатон 2026" status="Running" statusType="warning" date="12.01.2026" actionLabel={t.mainPage.actionOpen} />
                    <TournamentRow title="Summer Jam"   status="Open"    statusType="info"    date="02.01.2026" actionLabel={t.mainPage.actionRegister} isSpecialAction />
                  </tbody>
                </table>
              </div>
            </section>

            {/* Team */}
            <section ref={el => { revealRefs.current[1] = el; }} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 relative overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
              <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10 bg-blue-600 pointer-events-none" />
              <h2 className="font-black text-lg sm:text-xl mb-6 sm:mb-8 flex items-center gap-3 relative z-10 text-(--t1) uppercase tracking-tight">
                <Users className="text-blue-600" size={24} /> Team Alpha
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 relative z-10">
                <div className="p-4 sm:p-6 rounded-2xl bg-(--bg) border border-(--brd)">
                  <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">{t.mainPage.currentTournament}</p>
                  <p className="font-bold text-sm text-(--t1)">Весняний хакатон</p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-(--bg) border border-(--brd)">
                  <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">{t.mainPage.task}</p>
                  <p className="font-bold text-sm text-(--t1)">API Auth System</p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-blue-600/10 border border-blue-600/20">
                  <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-blue-600">{t.mainPage.colStatus}</p>
                  <p className="font-bold text-sm text-blue-600 italic">v2_final.zip</p>
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

function TournamentRow({ title, status, statusType, date, isSpecialAction, actionLabel }: {
  title: string; status: string; statusType: string; date: string; isSpecialAction?: boolean; actionLabel: string;
}) {
  const colors = (({ warning: "bg-amber-500/10 text-amber-600 border-amber-500/30", info: "bg-blue-600/10 text-blue-600 border-blue-600/30" } as any)[statusType]) ?? "";
  return (
    <tr className="transition-colors hover:bg-(--bg)/30">
      <td className="px-4 sm:px-8 py-4 sm:py-5 font-bold text-(--t1)">{title}</td>
      <td className="px-4 sm:px-8 py-4 sm:py-5"><span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded border ${colors}`}>{status}</span></td>
      <td className="px-4 sm:px-8 py-4 sm:py-5 font-bold text-(--t2) text-xs">{date}</td>
      <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
        {isSpecialAction
          ? <button className="font-black text-[9px] uppercase tracking-tighter px-3 py-2 rounded-lg border border-blue-600 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">{actionLabel}</button>
          : <button className="p-2 rounded-lg text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors"><ExternalLink size={16} /></button>
        }
      </td>
    </tr>
  );
}
