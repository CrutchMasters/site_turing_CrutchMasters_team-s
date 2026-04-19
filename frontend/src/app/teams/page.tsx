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
    Crown, Star,
} from "lucide-react";

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
    captain_username?: string;
    captain_login?: string;
    members_ids?: string[];
    telegram_url?: string;
    discord_url?: string;
    created_at?: string;
}

export default function TeamsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { dark } = useTheme();
    const { user, isLoading } = useAuth();
    const { t, locale } = useT();

    const [searchQuery, setSearchQuery] = useState("");
    const [teams, setTeams]             = useState<Team[]>([]);
    const [filtered, setFiltered]       = useState<Team[]>([]);
    const [loading, setLoading]         = useState(true);
    const [hasMyTeam, setHasMyTeam]     = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isLoading && !user) router.push("/login");
    }, [isLoading, user, router]);

        // Fetch all teams from Supabase with captain info joined
        useEffect(() => {
            if (!user) return;

            const fetchTeams = async () => {
                setLoading(true);
                try {
                    // Fetch teams
                    const { data: teamsData, error } = await supabase
                    .from("teams")
                    .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at")
                    .order("created_at", { ascending: false });

                    if (error) throw error;

                    const rawTeams: Team[] = teamsData ?? [];

                    // Collect unique captain ids to batch-fetch usernames
                    const captainIds = [...new Set(rawTeams.map(t => t.captain_id).filter(Boolean))] as string[];

                    let captainMap: Record<string, { username: string; login: string }> = {};
                    if (captainIds.length > 0) {
                        const { data: accounts } = await supabase
                        .from("account")
                        .select("id, username, login")
                        .in("id", captainIds);

                        (accounts ?? []).forEach(a => {
                            captainMap[a.id] = { username: a.username, login: a.login };
                        });
                    }

                    // Merge captain info into teams
                    const enriched: Team[] = rawTeams.map(team => ({
                        ...team,
                        captain_username: team.captain_id ? captainMap[team.captain_id]?.username : undefined,
                        captain_login:    team.captain_id ? captainMap[team.captain_id]?.login    : undefined,
                    }));

                    setTeams(enriched);
                    setFiltered(enriched);

                    // Check if current user is captain of any team
                    setHasMyTeam(enriched.some(t => t.captain_id === user.id));
                } catch (err) {
                    console.error("Failed to fetch teams:", err);
                } finally {
                    setLoading(false);
                }
            };

            fetchTeams();
        }, [user]);

        // Filter on search query change
        useEffect(() => {
            if (!searchQuery.trim()) {
                setFiltered(teams);
                return;
            }
            const q = searchQuery.toLowerCase();
            setFiltered(
                teams.filter(
                    team =>
                    team.name.toLowerCase().includes(q) ||
                    team.city_school_org?.toLowerCase().includes(q) ||
                    team.captain_username?.toLowerCase().includes(q) ||
                    team.captain_login?.toLowerCase().includes(q)
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

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style jsx global>{`
                @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                @keyframes cardDrop { from{opacity:0;transform:translateY(-20px) scale(.97)} to{opacity:1;transform:none} }
                .fuIn { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: cardDrop 400ms cubic-bezier(.22,1,.36,1) both }
                .spr  { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease, background 150ms ease }
                .spr:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 8px 24px rgba(37,99,235,0.12); }
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
                title={t.teams.title}
                icon={<Users size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">
                {t.nav.home}
                </button>
                <ChevronRight size={10} />
                <span className="text-(--t1)">{t.teams.title}</span>
                </nav>

                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
                <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-(--t1) uppercase">
                 {t.teams.title}
                </h1>
                <p className="text-(--t2) text-xs font-bold uppercase tracking-widest mt-1">
                {loading ? t.common.loading : `${filtered.length} ${t.teams.total}`}
                </p>
                </div>

                <div className="flex gap-3 flex-col sm:flex-row w-full sm:w-auto">
                {/* "My teams" button — shown only if user is captain of at least one team */}
                {hasMyTeam && (
                    <button
                    onClick={() => router.push("/my_teams")}
                    className="cdIn flex items-center justify-center gap-2 bg-(--card) border border-amber-500/40 text-amber-500 font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-4 hover:bg-amber-500/10 active:scale-95 transition-all w-full sm:w-auto"
                    >
                    <Star size={15} className="fill-amber-500" />
                    {locale === "ru" ? "Мои команды" : locale === "en" ? "My teams" : "Мої команди"}
                    </button>
                )}

                <button
                onClick={() => router.push("/register_team")}
                className="cdIn flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-4 hover:bg-blue-700 shadow-lg shadow-blue-600/25 active:scale-95 transition-all w-full sm:w-auto group"
                >
                <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                {t.teams.create}
                </button>
                </div>
                </div>

                {/* Search bar */}
                <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-5 sm:p-6 mb-6">
                <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-5 h-5" />
                <input
                ref={searchInputRef}
                type="text"
                placeholder={t.teams.searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm transition-all"
                />
                </div>
                <p className="mt-2 text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                {t.teams.searchHint}
                </p>
                </div>

                {/* Loading state */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-4">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">{t.common.loading}</p>
                    </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 sm:p-16 text-center">
                    <Users className="w-16 h-16 text-(--t2) mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-black text-(--t1) mb-2">{t.teams.notFound}</p>
                    <p className="text-(--t2) text-sm">
                    {searchQuery ? t.common.na : t.teams.notFoundHint}
                    </p>
                    <button
                    onClick={() => router.push("/register_team")}
                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3 hover:bg-blue-700 transition-all active:scale-95"
                    >
                    <Plus size={14} /> {t.teams.create}
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
                        locale={locale}
                        captainLabel={t.teams.captain}
                        onOpen={() => router.push(`/teams/${team.id}`)}
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
    locale,
    captainLabel,
    onOpen,
}: {
    team: Team;
    idx: number;
    currentUserId: string;
    locale: string;
    captainLabel: string;
    onOpen: () => void;
}) {
    const isMyTeam = team.captain_id === currentUserId;
    const memberCount = team.members_ids?.length ?? 0;
    const myLabel = locale === "ru" ? "Моя" : locale === "en" ? "Mine" : "Моя";
    const membersLabel = locale === "ru" ? "уч." : locale === "en" ? "mbr." : "уч.";
    const localeMap: Record<string, string> = { ua: "uk-UA", ru: "ru-RU", en: "en-US" };
    const dateLocale = localeMap[locale] ?? "uk-UA";

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
        {/* Top accent bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

        <div className="p-5 sm:p-6">
        {/* Avatar + name */}
        <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md`}>
        {team.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-black text-(--t1) text-base truncate group-hover:text-blue-600 transition-colors">
        {team.name}
        </h3>
        {isMyTeam && (
            <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1">
            <Crown size={8} /> {myLabel}
            </span>
        )}
        </div>
        {team.city_school_org && (
            <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mt-0.5 truncate">
            {team.city_school_org}
            </p>
        )}
        </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-3 border-t border-(--brd)">
        <div className="flex items-center gap-1.5 text-(--t2)">
        <Users size={13} />
        <span className="text-[10px] font-black uppercase tracking-wider">
        {memberCount} {membersLabel}
        </span>
        </div>

        {team.captain_username && (
            <div className="flex items-center gap-1.5 text-(--t2) min-w-0">
            <Crown size={13} className="flex-shrink-0" />
            <span className="text-[10px] font-bold truncate">
            @{team.captain_login ?? team.captain_username}
            </span>
            </div>
        )}

        {team.created_at && (
            <div className="ml-auto text-[9px] font-bold text-(--t2) uppercase tracking-wider flex-shrink-0">
            {new Date(team.created_at).toLocaleDateString(dateLocale, {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
            })}
            </div>
        )}
        </div>

        {/* Social links row */}
        {(team.telegram_url || team.discord_url) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-(--brd)">
            {team.telegram_url && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                TG
                </span>
            )}
            {team.discord_url && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                DC
                </span>
            )}
            </div>
        )}
        </div>
        </div>
    );
}
