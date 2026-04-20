//site_turing_CrutchMasters_team-s/frontend/src/app/teams/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Users, Crown, ChevronRight, ArrowLeft, Loader,
    Shield, Star, Send, MessageSquare, Calendar,
    ExternalLink, Copy, Check,
} from "lucide-react";

interface TeamMember {
    id: string;
    username: string;
    login: string;
    email: string;
    role: string;
    avatar_url?: string;
    status?: string;
}

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
    members_ids?: string[];
    telegram_url?: string;
    discord_url?: string;
    created_at?: string;
    tournament_id?: string;
}

interface Tournament {
    id: string;
    name: string;
    status?: string;
    start_at?: string;
    registration_from?: string;
    registration_to?: string;
}

const gradients = [
    "from-blue-500 to-blue-700",
"from-violet-500 to-violet-700",
"from-emerald-500 to-emerald-700",
"from-orange-500 to-orange-700",
"from-pink-500 to-pink-700",
"from-cyan-500 to-cyan-700",
];

const roleBadge = (role: string) => {
    if (role === "superadmin") return "bg-red-500/10 text-red-500 border-red-500/20";
    if (role === "admin")      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    if (role === "jury")       return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <button onClick={handle} title="Copy ID"
        className="p-1.5 rounded-lg text-(--t2) hover:text-blue-600 hover:bg-blue-600/10 transition-all active:scale-90">
        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
    );
}

export default function TeamProfilePage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const params = useParams();
    const { dark } = useTheme();
    const { user, isLoading: authLoading } = useAuth();

    const [team, setTeam]           = useState<Team | null>(null);
    const [captain, setCaptain]     = useState<TeamMember | null>(null);
    const [members, setMembers]     = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [tournament, setTournament] = useState<Tournament | null>(null);

    const teamId = params.id as string;

    // Auth guard
    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

        // Fetch team data
        useEffect(() => {
            if (!user || !teamId) return;

            const fetchTeam = async () => {
                setIsLoading(true);
                try {
                    // Fetch team
                    const { data: teamData, error: teamErr } = await supabase
                    .from("teams")
                    .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at, tournament_id")
                    .eq("id", teamId)
                    .single();

                    if (teamErr || !teamData) throw new Error("Team not found");
                    setTeam(teamData);

                    // Fetch tournament if team is registered
                    if (teamData.tournament_id) {
                        const { data: tourData } = await supabase
                        .from("tournaments")
                        .select("id, name, status, start_at, registration_from, registration_to")
                        .eq("id", teamData.tournament_id)
                        .single();
                        if (tourData) setTournament(tourData);
                    }

                    // Collect all user IDs to fetch (captain + members)
                    const allIds: string[] = [];
                    if (teamData.captain_id) allIds.push(teamData.captain_id);
                    if (teamData.members_ids?.length) allIds.push(...teamData.members_ids);
                    const uniqueIds = [...new Set(allIds)];

                    if (uniqueIds.length > 0) {
                        const { data: accounts } = await supabase
                        .from("account")
                        .select("id, username, login, email, role, avatar_url, status")
                        .in("id", uniqueIds);

                        const accountMap: Record<string, TeamMember> = {};
                        (accounts ?? []).forEach(a => { accountMap[a.id] = a; });

                        if (teamData.captain_id && accountMap[teamData.captain_id]) {
                            setCaptain(accountMap[teamData.captain_id]);
                        }

                        const memberList = (teamData.members_ids ?? [])
                        .map((id: string) => accountMap[id])
                        .filter(Boolean);
                        setMembers(memberList);
                    }
                } catch (e: any) {
                    setError(e.message ?? "Failed to load team");
                } finally {
                    setIsLoading(false);
                }
            };

            fetchTeam();
        }, [user, teamId]);

        const isMyTeam  = team?.captain_id === user?.id;
        const gradient  = gradients[teamId ? teamId.charCodeAt(0) % gradients.length : 0];
        const initial   = team?.name?.charAt(0).toUpperCase() ?? "?";
        const allMembers = captain ? [captain, ...members.filter(m => m.id !== captain.id)] : members;

        if (authLoading || (!user && !authLoading)) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style jsx global>{`
                @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                @keyframes cardDrop { from{opacity:0;transform:translateY(-16px) scale(.97)} to{opacity:1;transform:none} }
                @keyframes shimmer  { from{background-position:-200% 0} to{background-position:200% 0} }
                .fuIn { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: cardDrop 420ms cubic-bezier(.22,1,.36,1) both }
                .spr  { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease }
                .spr:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 8px 24px rgba(37,99,235,0.12); }
                .skeleton {
                    background: linear-gradient(90deg, var(--brd) 25%, var(--bg) 50%, var(--brd) 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 0.75rem;
                }
                `}</style>

                {/* Watermark */}
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
                <MobileHeader
                onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                title={team?.name ?? "Команда"}
                icon={<Users size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push("/teams")} className="hover:text-blue-600 transition-colors">Команди</button>
                <ChevronRight size={10} />
                <span className="text-(--t1) truncate max-w-[120px]">{isLoading ? "..." : team?.name ?? "Профіль"}</span>
                </nav>

                <button
                onClick={() => router.back()}
                className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors"
                >
                <ArrowLeft size={14} /> Назад
                </button>

                {/* Error state */}
                {error && (
                    <div className="max-w-2xl bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 text-center">
                    <Users className="w-16 h-16 text-(--t2) mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-black text-(--t1) mb-2">Команду не знайдено</p>
                    <p className="text-(--t2) text-sm">{error}</p>
                    <button
                    onClick={() => router.push("/teams")}
                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3 hover:bg-blue-700 transition-all active:scale-95"
                    >
                    ← До списку команд
                    </button>
                    </div>
                )}

                {/* Loading skeleton */}
                {isLoading && !error && (
                    <div className="max-w-3xl space-y-5">
                    <div className="skeleton h-48 w-full" />
                    <div className="skeleton h-32 w-full" />
                    <div className="skeleton h-64 w-full" />
                    </div>
                )}

                {/* Team profile */}
                {!isLoading && !error && team && (
                    <div className="max-w-3xl space-y-5">

                    {/* Hero card */}
                    <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-xl overflow-hidden">
                    {/* Gradient top bar */}
                    <div className={`h-2 w-full bg-gradient-to-r ${gradient}`} />

                    <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    {/* Avatar */}
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-3xl sm:text-4xl flex-shrink-0 shadow-lg`}>
                    {initial}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight">
                    {team.name}
                    </h1>
                    {isMyTeam && (
                        <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Star size={9} className="fill-amber-500" /> Моя команда
                        </span>
                    )}
                    </div>

                    {team.city_school_org && (
                        <p className="text-sm font-bold text-(--t2) uppercase tracking-wider mb-3">{team.city_school_org}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-(--t2)">
                    <Users size={14} />
                    <span className="text-[11px] font-black uppercase tracking-wider">
                    {allMembers.length} учасник{allMembers.length === 1 ? "" : "ів"}
                    </span>
                    </div>
                    {team.created_at && (
                        <div className="flex items-center gap-1.5 text-(--t2)">
                        <Calendar size={14} />
                        <span className="text-[11px] font-black uppercase tracking-wider">
                        {new Date(team.created_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                        </div>
                    )}
                    </div>
                    </div>
                    </div>

                    {/* ID row */}
                    <div className="mt-5 pt-4 border-t border-(--brd) flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">ID:</span>
                    <span className="text-[10px] font-bold text-(--t2) font-mono">{team.id}</span>
                    <CopyButton text={team.id} />
                    </div>
                    </div>
                    </section>

                    {/* Social links */}
                    {(team.telegram_url || team.discord_url) && (
                        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm p-6 sm:p-8" style={{ animationDelay: "60ms" }}>
                        <h2 className="text-xs font-black uppercase tracking-widest text-(--t2) mb-4">Соціальні мережі</h2>
                        <div className="flex flex-wrap gap-3">
                        {team.telegram_url && (
                            <a
                            href={team.telegram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="spr flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-500 font-black text-xs uppercase tracking-widest hover:bg-sky-500/20 transition-all active:scale-95"
                            >
                            <Send size={14} /> Telegram
                            <ExternalLink size={11} className="opacity-60" />
                            </a>
                        )}
                        {team.discord_url && (
                            <a
                            href={team.discord_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="spr flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 font-black text-xs uppercase tracking-widest hover:bg-indigo-500/20 transition-all active:scale-95"
                            >
                            <MessageSquare size={14} /> Discord
                            <ExternalLink size={11} className="opacity-60" />
                            </a>
                        )}
                        </div>
                        </section>
                    )}


                    {/* Tournament */}
                    {tournament && (
                        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-amber-500/20 shadow-sm overflow-hidden" style={{ animationDelay: "75ms" }}>
                        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-amber-500/5">
                        <Shield size={14} className="text-amber-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-amber-500">Турнір</h2>
                        </div>
                        <div className="p-6 sm:p-8">
                        <button
                        onClick={() => router.push(`/tournaments/${tournament.id}`)}
                        className="w-full flex items-center gap-4 group text-left"
                        >
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
                        <Shield size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-(--t1) text-sm truncate group-hover:text-amber-500 transition-colors">
                        {tournament.name}
                        </span>
                        {tournament.status && (
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 ${
                                tournament.status === "active" || tournament.status === "ongoing"
                                ? "text-green-500 bg-green-500/10 border-green-500/20"
                                : tournament.status === "registration"
                                ? "text-purple-500 bg-purple-500/10 border-purple-500/20"
                                : tournament.status === "upcoming"
                                ? "text-blue-500 bg-blue-500/10 border-blue-500/20"
                                : "text-(--t2) bg-(--bg) border-(--brd)"
                            }`}>
                            {tournament.status === "active" || tournament.status === "ongoing" ? "Активний"
                                : tournament.status === "registration" ? "Реєстрація"
                                : tournament.status === "upcoming" ? "Очікується"
                                : tournament.status === "finished" ? "Завершено"
                                : tournament.status}
                                </span>
                        )}
                        </div>
                        {tournament.start_at && (
                            <p className="text-[10px] font-bold text-(--t2)">
                            Початок: {new Date(tournament.start_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" })}
                            </p>
                        )}
                        </div>
                        <ExternalLink size={14} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        </div>
                        </section>
                    )}

                    {/* Captain card */}
                    {captain && (
                        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-amber-500/20 shadow-sm overflow-hidden" style={{ animationDelay: "90ms" }}>
                        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-amber-500/5">
                        <Crown size={14} className="text-amber-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-amber-500">Капітан команди</h2>
                        </div>
                        <div className="p-6 sm:p-8">
                        <MemberRow member={captain} isCaptain onClick={() => router.push(captain.id === user?.id ? "/profile" : `/user/${captain.id}`)} />
                        </div>
                        </section>
                    )}

                    {/* Members */}
                    <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm overflow-hidden" style={{ animationDelay: "130ms" }}>
                    <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-(--brd)">
                    <div className="flex items-center gap-3">
                    <Users size={14} className="text-blue-600" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-(--t1)">Учасники</h2>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
                    {members.length} / 10
                    </span>
                    </div>
                    <div className="divide-y divide-(--brd)">
                    {members.length === 0 ? (
                        <div className="px-6 sm:px-8 py-10 text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Учасників ще немає</p>
                        </div>
                    ) : (
                        members.map((m, i) => (
                            <div key={m.id} className="px-6 sm:px-8 py-4 fuIn" style={{ animationDelay: `${150 + i * 50}ms` }}>
                            <MemberRow
                            member={m}
                            onClick={() => router.push(m.id === user?.id ? "/profile" : `/user/${m.id}`)}
                            />
                            </div>
                        ))
                    )}
                    </div>
                    </section>

                    {/* Edit button — only for captain */}
                    {isMyTeam && (
                        <div className="fuIn pt-2" style={{ animationDelay: "300ms" }}>
                        <button
                        onClick={() => router.push(`/teams/${teamId}/edit`)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-(--card) border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-2xl px-8 py-4 hover:bg-(--bg) hover:text-(--t1) transition-all active:scale-95"
                        >
                        Редагувати команду
                        </button>
                        </div>
                    )}
                    </div>
                )}
                </div>
                </main>
                </div>
        );
}

function MemberRow({ member, isCaptain, onClick }: { member: TeamMember; isCaptain?: boolean; onClick?: () => void }) {
    const letter = (member.username || member.login || "?").charAt(0).toUpperCase();
    return (
        <div
        className="flex items-center gap-4 cursor-pointer group"
        onClick={onClick}
        >
        <div className="w-10 h-10 rounded-full bg-blue-600/10 border-2 border-(--brd) flex items-center justify-center font-black text-blue-600 flex-shrink-0 overflow-hidden group-hover:border-blue-600/40 transition-colors">
        {member.avatar_url
            ? <img src={member.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            : letter
        }
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <p className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">
        {member.username}
        </p>
        {isCaptain && (
            <Crown size={11} className="text-amber-500 flex-shrink-0" />
        )}
        </div>
        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">@{member.login}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
            roleBadge(member.role)
        }`}>
        {member.role}
        </span>
        {member.status === "active" && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Активний" />
        )}
        <ChevronRight size={14} className="text-(--t2) group-hover:text-blue-600 transition-colors" />
        </div>
        </div>
    );
}
