//site_turing_CrutchMasters_team-s/frontend/src/app/teams/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { API_URL } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Users, Crown, ChevronRight, ArrowLeft, Loader,
    Save, Send, MessageSquare, Pencil, Trash2,
    UserPlus, UserMinus, Search, Check, AlertCircle, X,
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
}

export default function EditTeamPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const params = useParams();
    const { dark } = useTheme();
    const { user, isLoading: authLoading } = useAuth();
    const { t } = useLanguage();

    const teamId = params.id as string;

    // Data states
    const [team, setTeam] = useState<Team | null>(null);
    const [captain, setCaptain] = useState<TeamMember | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState("");
    const [citySchoolOrg, setCitySchoolOrg] = useState("");
    const [telegramUrl, setTelegramUrl] = useState("");
    const [discordUrl, setDiscordUrl] = useState("");

    // Member management
    const [memberSearch, setMemberSearch] = useState("");
    const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
    const [inviteSent, setInviteSent] = useState<string | null>(null);

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
                    const { data: teamData, error: teamErr } = await supabase
                    .from("teams")
                    .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at")
                    .eq("id", teamId)
                    .single();

                    if (teamErr || !teamData) throw new Error(t.editTeam.errLoadTeam);

                    // Only captain can edit
                    if (teamData.captain_id !== user.id) {
                        router.push(`/teams/${teamId}`);
                        return;
                    }

                    setTeam(teamData);
                    setName(teamData.name ?? "");
                    setCitySchoolOrg(teamData.city_school_org ?? "");
                    setTelegramUrl(teamData.telegram_url ?? "");
                    setDiscordUrl(teamData.discord_url ?? "");

                    // Fetch members
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
                    setError(e.message ?? t.editTeam.errLoadFailed);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchTeam();
        }, [user, teamId]);

        // Search users to add
        const handleSearch = useCallback(async (forceQuery?: string) => {
            const q = (forceQuery ?? memberSearch).trim();
            if (!q) { setSearchResults([]); return; }
            setIsSearching(true);
            try {
                const q = memberSearch.trim();
                const token = localStorage.getItem("access_token");
                const res = await fetch(
                    `${API_URL}/api/users/search?q=${encodeURIComponent(q)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) throw new Error("Search failed");
                const json = await res.json();

                const currentIds = new Set([
                    team?.captain_id,
                    ...(team?.members_ids ?? []),
                ]);
                setSearchResults((json.users ?? []).filter((u: TeamMember) => !currentIds.has(u.id)));
            } catch (e) {
                console.error(e);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, [memberSearch, team]);

        // Auto-search with 400ms debounce when user types
        useEffect(() => {
            if (!memberSearch.trim()) { setSearchResults([]); return; }
            const timer = setTimeout(() => { handleSearch(memberSearch); }, 400);
            return () => clearTimeout(timer);
        }, [memberSearch]); // eslint-disable-line react-hooks/exhaustive-deps

        const handleAddMember = async (member: TeamMember) => {
            if (!team) return;
            setAddingId(member.id);
            try {
                const token = localStorage.getItem("access_token");
                const res = await fetch(`${API_URL}/api/invitations/send`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        team_id: team.id,
                        invitee_id: member.id,
                    }),
                });
                if (!res.ok) {
                    const json = await res.json();
                    throw new Error(json.detail ?? t.editTeam.errAddMember);
                }
                // Запрошення відправлено — прибираємо зі списку пошуку
                setSearchResults(prev => prev.filter(u => u.id !== member.id));
            } catch (e: any) {
                setError(e.message ?? t.editTeam.errAddMember);
            } finally {
                setAddingId(null);
            }
        };

        const handleRemoveMember = useCallback(async (member: TeamMember) => {
            if (!team) return;
            setRemovingId(member.id);
            try {
                const { data, error } = await supabase
                .rpc("remove_team_member", {
                    p_team_id: team.id,
                    p_member_id: member.id,
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                const newIds: string[] = (data.members_ids ?? []);
                setTeam(prev => prev ? { ...prev, members_ids: newIds } : prev);
                setMembers(prev => prev.filter(m => m.id !== member.id));
                setConfirmRemove(null);
            } catch (e: any) {
                setError(e.message ?? t.editTeam.errRemoveMember);
            } finally {
                setRemovingId(null);
            }
        }, [team, t]);

        const handleSave = async () => {
            if (!team || !name.trim()) return;
            setIsSaving(true);
            setError(null);
            try {
                const { error } = await supabase
                .from("teams")
                .update({
                    name: name.trim(),
                        city_school_org: citySchoolOrg.trim() || null,
                        telegram_url: telegramUrl.trim() || null,
                        discord_url: discordUrl.trim() || null,
                })
                .eq("id", team.id);
                if (error) throw error;
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2500);
            } catch (e: any) {
                setError(e.message ?? t.editTeam.errSave);
            } finally {
                setIsSaving(false);
            }
        };

        if (authLoading || isLoading) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        if (!user) return null;

        const inputClass = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg)/60 text-(--t1) focus:ring-2 focus:ring-blue-500 focus:bg-(--card) outline-none text-sm transition-all placeholder:text-(--t2)/50";

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
        <style jsx global>{`
            @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
            @keyframes cardDrop { from{opacity:0;transform:translateY(-16px) scale(.97)} to{opacity:1;transform:none} }
            @keyframes scaleIn  { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
            @keyframes slideIn  { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:none} }
            .fuIn  { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
            .cdIn  { animation: cardDrop 420ms cubic-bezier(.22,1,.36,1) both }
            .siIn  { animation: slideIn  260ms cubic-bezier(.22,1,.36,1) both }
            .modal { animation: scaleIn  280ms cubic-bezier(.22,1,.36,1) both }
            .spr   { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease }
            .spr:hover { transform: translateY(-2px) scale(1.015); }
            `}</style>

            {/* Remove confirm modal */}
            {confirmRemove && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-(--bg)/70 backdrop-blur-md p-4">
                <div className="modal bg-(--card) border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <UserMinus size={20} className="text-red-500" />
                </div>
                <h2 className="text-base font-black text-(--t1) uppercase mb-1">{t.editTeam.removeMemberTitle}</h2>
                <p className="text-sm text-(--t2) mb-5">
                {t.editTeam.removeMemberConfirm.replace("{name}", confirmRemove.username)}
                </p>
                <div className="flex gap-3">
                <button
                onClick={() => setConfirmRemove(null)}
                disabled={!!removingId}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) transition-all active:scale-95"
                >
                {t.editTeam.cancelBtn}
                </button>
                <button
                onClick={() => handleRemoveMember(confirmRemove)}
                disabled={!!removingId}
                className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                {removingId ? <Loader size={13} className="animate-spin" /> : <UserMinus size={13} />}
                {t.editTeam.removeMemberBtn}
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
            title={t.editTeam.mobileTitle}
            icon={<Pencil size={18} className="text-blue-600" />}
            />

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
            <button onClick={() => router.push("/dashboard")} className="hover:text-blue-600 transition-colors">{t.editTeam.breadcrumbHome}</button>
            <ChevronRight size={10} />
            <button onClick={() => router.push("/teams")} className="hover:text-blue-600 transition-colors">{t.editTeam.breadcrumbTeams}</button>
            <ChevronRight size={10} />
            <button onClick={() => router.push(`/teams/${teamId}`)} className="hover:text-blue-600 transition-colors truncate max-w-[120px]">{team?.name}</button>
            <ChevronRight size={10} />
            <span className="text-(--t1)">{t.editTeam.breadcrumbEdit}</span>
            </nav>

            {/* Page header */}
            <div className="fuIn flex items-center gap-4 mb-8">
            <button
            onClick={() => router.push(`/teams/${teamId}`)}
            className="p-2.5 rounded-xl bg-(--card) border border-(--brd) text-(--t2) hover:text-blue-600 hover:border-blue-600/30 transition-all active:scale-95"
            >
            <ArrowLeft size={16} />
            </button>
            <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-(--t1) uppercase">
            {t.editTeam.pageTitle}
            </h1>
            <p className="text-(--t2) text-xs font-bold uppercase tracking-widest mt-0.5">
            {team?.name}
            </p>
            </div>
            </div>

            {error && (
                <div className="fuIn flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 mb-6 text-red-500 text-xs font-bold uppercase tracking-wide">
                <AlertCircle size={15} />
                {error}
                <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
                </div>
            )}

            <div className="max-w-3xl space-y-6">

            {/* ─── Basic Info ─── */}
            <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd)">
            <Pencil size={14} className="text-blue-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-(--t1)">{t.editTeam.basicInfo}</h2>
            </div>
            <div className="p-6 sm:p-8 space-y-4">
            <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
            {t.editTeam.teamNameLabel} <span className="text-red-500">*</span>
            </label>
            <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t.editTeam.teamNamePlaceholder}
            className={inputClass}
            maxLength={64}
            />
            <p className="text-[9px] font-bold text-(--t2) uppercase tracking-wider mt-1.5 text-right">
            {name.length}/64
            </p>
            </div>

            <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
            {t.editTeam.citySchoolOrg}
            </label>
            <input
            type="text"
            value={citySchoolOrg}
            onChange={e => setCitySchoolOrg(e.target.value)}
            placeholder={t.editTeam.citySchoolOrgPlaceholder}
            className={inputClass}
            maxLength={128}
            />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
            <Send size={11} className="text-sky-500" /> Telegram
            </label>
            <input
            type="url"
            value={telegramUrl}
            onChange={e => setTelegramUrl(e.target.value)}
            placeholder="https://t.me/..."
            className={inputClass}
            />
            </div>
            <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
            <MessageSquare size={11} className="text-indigo-500" /> Discord
            </label>
            <input
            type="url"
            value={discordUrl}
            onChange={e => setDiscordUrl(e.target.value)}
            placeholder="https://discord.gg/..."
            className={inputClass}
            />
            </div>
            </div>

            <div className="flex justify-end pt-2">
            <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest rounded-2xl px-8 py-3.5 transition-all active:scale-95 ${
                saveSuccess
                ? "bg-green-600 text-white"
                : isSaving || !name.trim()
                ? "bg-(--brd) text-(--t2) cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            }`}
            >
            {isSaving ? (
                <><Loader size={14} className="animate-spin" /> {t.editTeam.saving}</>
            ) : saveSuccess ? (
                <><Check size={14} /> {t.editTeam.saved}</>
            ) : (
                <><Save size={14} /> {t.editTeam.saveBtn}</>
            )}
            </button>
            </div>
            </div>
            </section>

            {/* ─── Captain ─── */}
            {captain && (
                <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-amber-500/20 shadow-sm overflow-hidden" style={{ animationDelay: "60ms" }}>
                <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-amber-500/10 bg-amber-500/5">
                <Crown size={14} className="text-amber-500" />
                <h2 className="text-xs font-black uppercase tracking-widest text-amber-500">{t.editTeam.captainSection}</h2>
                </div>
                <div className="p-6 sm:p-8">
                <MemberRowDisplay member={captain} isCaptain />
                </div>
                </section>
            )}

            {/* ─── Members ─── */}
            <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm overflow-hidden" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-(--brd)">
            <div className="flex items-center gap-3">
            <Users size={14} className="text-blue-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-(--t1)">{t.editTeam.membersSection}</h2>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
            {members.length} / 10
            </span>
            </div>

            {/* Current members list */}
            <div className="divide-y divide-(--brd)">
            {members.length === 0 ? (
                <div className="px-6 sm:px-8 py-10 text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">{t.editTeam.noMembers}</p>
                </div>
            ) : (
                members.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3 px-6 sm:px-8 py-4 fuIn" style={{ animationDelay: `${i * 40}ms` }}>
                    <MemberRowDisplay member={m} />
                    <button
                    onClick={() => setConfirmRemove(m)}
                    disabled={removingId === m.id}
                    className="ml-auto flex-shrink-0 p-2 rounded-xl bg-red-500/5 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                    title="Видалити учасника"
                    >
                    {removingId === m.id
                        ? <Loader size={13} className="animate-spin" />
                        : <UserMinus size={13} />
                    }
                    </button>
                    </div>
                ))
            )}
            </div>

            {/* Add member search */}
            {members.length < 10 && (
                <div className="px-6 sm:px-8 py-5 border-t border-(--brd) bg-(--bg)/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3 flex items-center gap-2">
                <UserPlus size={12} className="text-blue-600" /> {t.editTeam.addMember}
                </p>
                <div className="flex gap-2">
                <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-4 h-4" />
                <input
                type="text"
                placeholder={t.editTeam.searchMemberPlaceholder}
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-(--brd) bg-(--card) text-(--t1) focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                />
                </div>
                <button
                onClick={handleSearch}
                disabled={isSearching || !memberSearch.trim()}
                className={`px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 ${
                    isSearching || !memberSearch.trim()
                    ? "bg-(--brd) text-(--t2) cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                >
                {isSearching ? <Loader size={13} className="animate-spin" /> : <Search size={13} />}
                </button>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                    <div className="mt-3 space-y-2">
                    {searchResults.map((person, i) => (
                        <div
                        key={person.id}
                        className="siIn flex items-center gap-3 px-4 py-3 rounded-xl bg-(--card) border border-(--brd) hover:border-blue-600/30 transition-all"
                        style={{ animationDelay: `${i * 40}ms` }}
                        >
                        <div className="w-9 h-9 rounded-full bg-blue-600/10 border-2 border-(--brd) flex items-center justify-center font-black text-blue-600 text-sm flex-shrink-0">
                        {person.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-black text-(--t1) text-sm truncate">{person.username}</p>
                        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">@{person.login}</p>
                        </div>
                        <button
                        onClick={() => handleAddMember(person)}
                        disabled={addingId === person.id || inviteSent === person.id}
                        className={`flex-shrink-0 flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest rounded-xl px-3 py-2 transition-all active:scale-95 border ${
                            inviteSent === person.id
                            ? "bg-green-500/10 border-green-500/30 text-green-500 cursor-default"
                            : "bg-blue-600/10 border-blue-600/20 text-blue-600 hover:bg-blue-600 hover:text-white"
                        }`}
                        >
                        {addingId === person.id
                            ? <Loader size={12} className="animate-spin" />
                            : inviteSent === person.id
                            ? <><Check size={12} /> Запрошення надіслано</>
                            : <><Send size={12} /> Запросити</>
                        }
                        </button>
                        </div>
                    ))}
                    </div>
                )}

                {searchResults.length === 0 && memberSearch.trim() && !isSearching && (
                    <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest mt-3 text-center">
                    {t.editTeam.noSearchResults}
                    </p>
                )}
                </div>
            )}
            </section>

            {/* ─── Back button ─── */}
            <div className="fuIn pb-4" style={{ animationDelay: "200ms" }}>
            <button
            onClick={() => router.push(`/teams/${teamId}`)}
            className="flex items-center gap-2 text-(--t2) font-black text-xs uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
            <ArrowLeft size={14} /> {t.editTeam.backToTeam}
            </button>
            </div>

            </div>
            </div>
            </main>
            </div>
    );
}

function MemberRowDisplay({ member, isCaptain }: { member: TeamMember; isCaptain?: boolean }) {
    const letter = (member.username || member.login || "?").charAt(0).toUpperCase();
    return (
        <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-blue-600/10 border-2 border-(--brd) flex items-center justify-center font-black text-blue-600 flex-shrink-0 overflow-hidden">
        {member.avatar_url
            ? <img src={member.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            : letter
        }
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <p className="font-black text-(--t1) text-sm truncate">{member.username}</p>
        {isCaptain && <Crown size={11} className="text-amber-500 flex-shrink-0" />}
        </div>
        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">@{member.login}</p>
        </div>
        </div>
    );
}
