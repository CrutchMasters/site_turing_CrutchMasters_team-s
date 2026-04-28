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
    Crown, Star, Send, MessageSquare, Calendar, Pencil, Trash2,
    AlertCircle,
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

const gradients = [
    "from-blue-500 to-blue-700",
"from-violet-500 to-violet-700",
"from-emerald-500 to-emerald-700",
"from-orange-500 to-orange-700",
"from-pink-500 to-pink-700",
"from-cyan-500 to-cyan-700",
];

export default function TeamsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { dark } = useTheme();
    const { user, isLoading } = useAuth();
    const { t, locale } = useT();

    // --- Search state ---
    const [searchQuery, setSearchQuery] = useState("");
    const [allTeams, setAllTeams]       = useState<Team[]>([]);
    const [filtered, setFiltered]       = useState<Team[]>([]);
    const [loadingAll, setLoadingAll]   = useState(true);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- My Teams state ---
    const [myTeams, setMyTeams]           = useState<Team[]>([]);
    const [loadingMy, setLoadingMy]       = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
    const [isDeleting, setIsDeleting]     = useState(false);
    const [deleteError, setDeleteError]   = useState("");

    // Auth guard
    useEffect(() => {
        if (!isLoading && !user) router.push("/login");
    }, [isLoading, user, router]);

        // Fetch all teams
        useEffect(() => {
            if (!user) return;
            const fetchTeams = async () => {
                setLoadingAll(true);
                try {
                    const { data: teamsData, error } = await supabase
                    .from("teams")
                    .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at")
                    .order("created_at", { ascending: false });
                    if (error) throw error;

                    const rawTeams: Team[] = teamsData ?? [];
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
                    const enriched: Team[] = rawTeams.map(team => ({
                        ...team,
                        captain_username: team.captain_id ? captainMap[team.captain_id]?.username : undefined,
                        captain_login:    team.captain_id ? captainMap[team.captain_id]?.login    : undefined,
                    }));
                    setAllTeams(enriched);
                    setFiltered(enriched);
                } catch (err) {
                    console.error("Failed to fetch teams:", err);
                } finally {
                    setLoadingAll(false);
                }
            };
            fetchTeams();
        }, [user]);

        // Fetch my teams (captain)
        const fetchMyTeams = async () => {
            if (!user) return;
            setLoadingMy(true);
            try {
                const { data, error } = await supabase
                .from("teams")
                .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at")
                .eq("captain_id", user.id)
                .order("created_at", { ascending: false });
                if (error) throw error;
                setMyTeams(data ?? []);
            } catch (e) {
                console.error("Failed to fetch my teams:", e);
            } finally {
                setLoadingMy(false);
            }
        };
        useEffect(() => { fetchMyTeams(); }, [user]);

        // Filter search
        useEffect(() => {
            if (!searchQuery.trim()) { setFiltered(allTeams); return; }
            const q = searchQuery.toLowerCase();
            setFiltered(
                allTeams.filter(team =>
                team.name.toLowerCase().includes(q) ||
                team.city_school_org?.toLowerCase().includes(q) ||
                team.captain_username?.toLowerCase().includes(q) ||
                team.captain_login?.toLowerCase().includes(q)
                )
            );
        }, [searchQuery, allTeams]);

        const handleDelete = async () => {
            if (!deleteTarget) return;
            setIsDeleting(true);
            setDeleteError("");
            try {
                const { error } = await supabase.rpc("delete_team", {
                    p_team_id: deleteTarget.id,
                });

                if (error) throw error;

                await fetchMyTeams();
                setAllTeams(prev => prev.filter(t => t.id !== deleteTarget.id));
                setDeleteTarget(null);
            } catch (e: any) {
                console.error("[DELETE] caught:", e);
                setDeleteError(e.message ?? "Помилка видалення");
            } finally {
                setIsDeleting(false);
            }
        };

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
                @keyframes scaleIn  { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
                .fuIn { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: cardDrop 400ms cubic-bezier(.22,1,.36,1) both }
                .spr  { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease, background 150ms ease }
                .spr:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 8px 24px rgba(37,99,235,0.12); }
                .modal-in { animation: scaleIn 280ms cubic-bezier(.22,1,.36,1) both }
                `}</style>

                {/* Delete modal */}
                {deleteTarget && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-(--bg)/70 backdrop-blur-md p-4">
                    <div className="modal-in bg-(--card) border border-red-500/30 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} className="text-red-500" />
                    </div>
                    <h2 className="text-lg font-black text-(--t1) uppercase tracking-tight mb-2">Видалити команду?</h2>
                    <p className="text-sm text-(--t2) mb-1">Ви впевнені, що хочете видалити команду</p>
                    <p className="text-sm font-black text-(--t1) mb-6">«{deleteTarget.name}»?</p>
                    {deleteError && (
                        <div className="flex items-center gap-2 text-[11px] font-bold text-red-500 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-2 mb-4">
                        <AlertCircle size={13} /> {deleteError}
                        </div>
                    )}
                    <div className="flex gap-3">
                    <button
                    onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                    disabled={isDeleting}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) transition-all active:scale-95 disabled:opacity-50"
                    >
                    Скасувати
                    </button>
                    <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                    >
                    {isDeleting ? <><Loader size={13} className="animate-spin" /> Видалення...</> : <><Trash2 size={13} /> Видалити</>}
                    </button>
                    </div>
                    </div>
                    </div>
                )}

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

                {/* Page title */}
                <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight mb-8">
                {t.teams.title}
                </h1>

                {/* Two-column layout */}
                <div className="max-w-6xl flex flex-col xl:flex-row gap-6 items-start">

                {/* ── LEFT: Search panel ── */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                {/* Panel header */}
                <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
                <Search size={15} className="text-blue-600" />
                </div>
                <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-(--t1)">{t.teams.title}</h2>
                <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                {loadingAll ? t.common.loading : `${filtered.length} ${t.teams.total}`}
                </p>
                </div>
                </div>

                {/* Search input */}
                <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-4 sm:p-6">
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
                <p className="mt-3 text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                {t.teams.searchHint}
                </p>
                </div>

                {/* Results */}
                {loadingAll ? (
                    <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-4">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">{t.common.loading}</p>
                    </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 text-center">
                    <Users className="w-16 h-16 text-(--t2) mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-black text-(--t1) mb-2">{t.teams.notFound}</p>
                    <p className="text-(--t2) text-sm">{searchQuery ? t.common.na : t.teams.notFoundHint}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((team, idx) => (
                        <SearchTeamCard
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

                {/* ── RIGHT: My Teams panel ── */}
                <div className="w-full xl:w-[420px] flex-shrink-0 flex flex-col gap-4">
                {/* Panel header */}
                <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Star size={15} className="text-amber-500 fill-amber-500" />
                </div>
                <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-(--t1)">
                {locale === "en" ? "My Teams" : "Мої команди"}
                </h2>
                <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">
                {loadingMy
                    ? (locale === "en" ? "Loading..." : "Завантаження...")
                    : `${locale === "en" ? "Captain of" : "Капітан"} ${myTeams.length} ${locale === "en" ? "team(s)" : `команд${myTeams.length === 1 ? "и" : ""}`}`}
                    </p>
                    </div>
                    </div>

                    {/* My Teams list */}
                    <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-xl border border-(--brd) p-4 sm:p-6 flex flex-col gap-3">
                    {loadingMy ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader className="w-7 h-7 text-blue-600 animate-spin" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">
                        {locale === "en" ? "Loading..." : "Завантаження..."}
                        </p>
                        </div>
                    ) : myTeams.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center mb-3">
                        <Star size={24} className="text-amber-500/50" />
                        </div>
                        <p className="text-sm font-black text-(--t1) mb-1">
                        {locale === "en" ? "No teams yet" : "Ви ще не маєте команд"}
                        </p>
                        <p className="text-[11px] text-(--t2)">
                        {locale === "en" ? "Create your first team below!" : "Створіть свою першу команду!"}
                        </p>
                        </div>
                    ) : (
                        myTeams.map((team, idx) => (
                            <MyTeamRow
                            key={team.id}
                            team={team}
                            idx={idx}
                            onOpen={() => router.push(`/teams/${team.id}`)}
                            onEdit={() => router.push(`/teams/${team.id}/edit`)}
                            onDelete={() => { setDeleteError(""); setDeleteTarget(team); }}
                            />
                        ))
                    )}

                    {/* Create button — always at the bottom */}
                    <button
                    onClick={() => router.push("/register_team")}
                    className="mt-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-5 py-4 hover:bg-blue-700 shadow-lg shadow-blue-600/25 active:scale-95 transition-all w-full group"
                    >
                    <Plus size={15} className="group-hover:rotate-90 transition-transform duration-300" />
                    {t.teams.create}
                    </button>
                    </div>
                    </div>

                    </div>
                    </div>
                    </main>
                    </div>
        );
}

// ── Search Team Card ────────────────────────────────────────────────────────
function SearchTeamCard({
    team, idx, currentUserId, locale, captainLabel, onOpen,
}: {
    team: Team; idx: number; currentUserId: string;
    locale: string; captainLabel: string; onOpen: () => void;
}) {
    const isMyTeam = team.captain_id === currentUserId;
    const memberCount = team.members_ids?.length ?? 0;
    const myLabel = locale === "ru" ? "Моя" : locale === "en" ? "Mine" : "Моя";
    const membersLabel = locale === "ru" ? "уч." : locale === "en" ? "mbr." : "уч.";
    const localeMap: Record<string, string> = { ua: "uk-UA", ru: "ru-RU", en: "en-US" };
    const gradient = gradients[idx % gradients.length];

    return (
        <div
        className="fuIn spr bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) overflow-hidden cursor-pointer group hover:border-blue-600/50 hover:shadow-lg hover:shadow-blue-600/10 transition-all"
        style={{ animationDelay: `${idx * 60}ms` }}
        onClick={onOpen}
        >
        <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />
        <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-md`}>
        {team.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
        <h3 className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">
        {team.name}
        </h3>
        {isMyTeam && (
            <span className="text-[7px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5">
            <Crown size={7} /> {myLabel}
            </span>
        )}
        </div>
        {team.city_school_org && (
            <p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider mt-0.5 truncate">{team.city_school_org}</p>
        )}
        </div>
        </div>
        <div className="flex items-center gap-3 pt-2.5 border-t border-(--brd)">
        <div className="flex items-center gap-1 text-(--t2)">
        <Users size={11} />
        <span className="text-[9px] font-black uppercase">{memberCount} {membersLabel}</span>
        </div>
        {team.captain_username && (
            <div className="flex items-center gap-1 text-(--t2) min-w-0">
            <Crown size={11} className="flex-shrink-0" />
            <span className="text-[9px] font-bold truncate">@{team.captain_login ?? team.captain_username}</span>
            </div>
        )}
        {team.created_at && (
            <div className="ml-auto text-[8px] font-bold text-(--t2) uppercase flex-shrink-0">
            {new Date(team.created_at).toLocaleDateString(localeMap[locale] ?? "uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </div>
        )}
        </div>
        </div>
        </div>
    );
}

// ── My Team Row (compact, inside the right panel) ───────────────────────────
function MyTeamRow({
    team, idx, onOpen, onEdit, onDelete,
}: {
    team: Team; idx: number;
    onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
    const gradient = gradients[idx % gradients.length];
    const memberCount = team.members_ids?.length ?? 0;

    return (
        <div className="fuIn flex items-center gap-3 bg-(--bg) rounded-2xl border border-(--brd) p-3 group hover:border-blue-600/30 transition-all" style={{ animationDelay: `${idx * 70}ms` }}>
        <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-base flex-shrink-0 cursor-pointer shadow-md`}
        onClick={onOpen}
        >
        {team.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center gap-1.5">
        <p className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">{team.name}</p>
        <span className="text-[7px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5">
        <Crown size={7} /> Капітан
        </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
        <span className="flex items-center gap-1 text-[9px] font-bold text-(--t2)">
        <Users size={10} /> {memberCount}
        </span>
        {team.telegram_url && <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20">TG</span>}
        {team.discord_url  && <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">DC</span>}
        </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
        <button
        onClick={onEdit}
        className="w-8 h-8 flex items-center justify-center rounded-xl border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) hover:text-(--t1) transition-all active:scale-95"
        title="Редагувати"
        >
        <Pencil size={13} />
        </button>
        <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/5 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
        title="Видалити"
        >
        <Trash2 size={13} />
        </button>
        </div>
        </div>
    );
}
