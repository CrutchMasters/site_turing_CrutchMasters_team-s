//site_turing_CrutchMasters_team-s/frontend/src/app/teams/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Users, Search, Plus, ChevronRight, Loader,
    Crown, Shield, User as UserIcon,
} from "lucide-react";

interface Team {
    id: string;
    name: string;
    organization?: string;
    captain_username?: string;
    captain_id?: string;
    member_count?: number;
    created_at?: string;
    status?: string;
}

// ── Mock data (замените на реальный запрос к Supabase/API когда таблица teams будет готова) ──
const MOCK_TEAMS: Team[] = [
    { id: "1", name: "Team Alpha",   organization: "СШ №100",       captain_username: "alex_dev",  captain_id: "u1", member_count: 4, created_at: "2026-01-12", status: "active" },
{ id: "2", name: "Code Ninjas",  organization: "Polytechnic",   captain_username: "ninja_pro", captain_id: "u2", member_count: 3, created_at: "2026-02-01", status: "active" },
{ id: "3", name: "ByteForce",    organization: "IT Academy",     captain_username: "byteking",  captain_id: "u3", member_count: 5, created_at: "2026-02-14", status: "active" },
{ id: "4", name: "Debug Squad",  organization: "КПІ",            captain_username: "debugger",  captain_id: "u4", member_count: 2, created_at: "2026-03-01", status: "active" },
{ id: "5", name: "Stack Wolves", organization: "Kharkiv Uni",   captain_username: "stackwolf", captain_id: "u5", member_count: 4, created_at: "2026-03-20", status: "active" },
{ id: "6", name: "NullPointers", organization: "Online School", captain_username: "nullpro",   captain_id: "u6", member_count: 3, created_at: "2026-04-01", status: "active" },
];

export default function TeamsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { dark } = useTheme();
    const { user, isLoading } = useAuth();
    const { t } = useT();

    const [searchQuery, setSearchQuery]   = useState("");
    const [teams, setTeams]               = useState<Team[]>(MOCK_TEAMS);
    const [filtered, setFiltered]         = useState<Team[]>(MOCK_TEAMS);
    const [isSearching, setIsSearching]   = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isLoading && !user) router.push("/login");
    }, [isLoading, user, router]);

        // Filter teams on query change
        useEffect(() => {
            if (!searchQuery.trim()) {
                setFiltered(teams);
                return;
            }
            const q = searchQuery.toLowerCase();
            setFiltered(
                teams.filter(
                    t =>
                    t.name.toLowerCase().includes(q) ||
                    t.organization?.toLowerCase().includes(q) ||
                    t.captain_username?.toLowerCase().includes(q)
                )
            );
        }, [searchQuery, teams]);

        if (isLoading || !user) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        const memberCountLabel = (n?: number) =>
        n === 1 ? "1 учасник" : `${n ?? 0} учасників`;

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style jsx global>{`
                @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                @keyframes cardDrop { from{opacity:0;transform:translateY(-20px) scale(.97)} to{opacity:1;transform:none} }
                .fuIn  { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn  { animation: cardDrop 400ms cubic-bezier(.22,1,.36,1) both }
                .spr   { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease, background 150ms ease }
                .spr:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 8px 24px rgba(37,99,235,0.12); }
                `}</style>

                {/* Watermark */}
                <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img
                src="/logo_background1.png"
                alt=""
                className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`}
                />
                </div>

                {/* Mobile sidebar overlay */}
                {isMobileSidebarOpen && (
                    <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    />
                )}

                <div
                className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${
                    isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}
                >
                <Sidebar />
                </div>

                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <MobileHeader
                onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                title="Команди"
                icon={<Users size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">
                {t.nav.home}
                </button>
                <ChevronRight size={10} />
                <span className="text-(--t1)">Команди</span>
                </nav>

                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
                <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-(--t1) uppercase">
                🏅 Команди
                </h1>
                <p className="text-(--t2) text-xs font-bold uppercase tracking-widest mt-1">
                {filtered.length} команд у системі
                </p>
                </div>

                <button
                onClick={() => router.push("/register_team")}
                className="cdIn flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-4 hover:bg-blue-700 shadow-lg shadow-blue-600/25 active:scale-95 transition-all w-full sm:w-auto group"
                >
                <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                Створити команду
                </button>
                </div>

                {/* Search bar */}
                <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-5 sm:p-6 mb-6">
                <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-5 h-5" />
                <input
                ref={searchInputRef}
                type="text"
                placeholder="Пошук по назві, організації або капітану..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm transition-all"
                />
                </div>
                <p className="mt-2 text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                Введіть назву команди, організацію або логін капітана
                </p>
                </div>

                {/* Teams grid */}
                {filtered.length === 0 ? (
                    <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 sm:p-16 text-center">
                    <Users className="w-16 h-16 text-(--t2) mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-black text-(--t1) mb-2">Команд не знайдено</p>
                    <p className="text-(--t2) text-sm">Спробуйте змінити запит або створіть першу команду</p>
                    <button
                    onClick={() => router.push("/register_team")}
                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3 hover:bg-blue-700 transition-all active:scale-95"
                    >
                    <Plus size={14} /> Створити команду
                    </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {filtered.map((team, idx) => (
                        <TeamCard
                        key={team.id}
                        team={team}
                        idx={idx}
                        currentUserId={user.id}
                        onOpen={() => {
                            // TODO: router.push(`/teams/${team.id}`) when team detail page is ready
                        }}
                        />
                    ))}
                    </div>
                )}
                </div>
                </main>
                </div>
        );
}

// ── Team Card ────────────────────────────────────────────────────────────────
function TeamCard({
    team,
    idx,
    currentUserId,
    onOpen,
}: {
    team: Team;
    idx: number;
    currentUserId: string;
    onOpen: () => void;
}) {
    const isMyTeam = team.captain_id === currentUserId;

    const avatarLetter = team.name.charAt(0).toUpperCase();

    // Unique gradient per team based on idx
    const gradients = [
        "from-blue-500 to-blue-700",
        "from-violet-500 to-violet-700",
        "from-emerald-500 to-emerald-700",
        "from-orange-500 to-orange-700",
        "from-pink-500 to-pink-700",
        "from-cyan-500 to-cyan-700",
    ];
    const gradient = gradients[idx % gradients.length];

    return (
        <div
        className="fuIn spr bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) overflow-hidden cursor-pointer group"
        style={{ animationDelay: `${idx * 60}ms` }}
        onClick={onOpen}
        >
        {/* Card top accent */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

        <div className="p-5 sm:p-6">
        {/* Avatar + name row */}
        <div className="flex items-start gap-4 mb-4">
        <div
        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md`}
        >
        {avatarLetter}
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-black text-(--t1) text-base truncate group-hover:text-blue-600 transition-colors">
        {team.name}
        </h3>
        {isMyTeam && (
            <span className="text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-md flex-shrink-0">
            Моя
            </span>
        )}
        </div>
        {team.organization && (
            <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mt-0.5 truncate">
            {team.organization}
            </p>
        )}
        </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-3 border-t border-(--brd)">
        <div className="flex items-center gap-1.5 text-(--t2)">
        <Users size={13} />
        <span className="text-[10px] font-black uppercase tracking-wider">
        {team.member_count ?? 0} уч.
        </span>
        </div>

        {team.captain_username && (
            <div className="flex items-center gap-1.5 text-(--t2) min-w-0">
            <Crown size={13} className="flex-shrink-0" />
            <span className="text-[10px] font-bold truncate">
            {team.captain_username}
            </span>
            </div>
        )}

        {team.created_at && (
            <div className="ml-auto text-[9px] font-bold text-(--t2) uppercase tracking-wider flex-shrink-0">
            {new Date(team.created_at).toLocaleDateString("uk-UA", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
            })}
            </div>
        )}
        </div>
        </div>
        </div>
    );
}
