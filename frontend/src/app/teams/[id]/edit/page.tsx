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
import AvatarEditorModal from "@/components/AvatarEditorModal";
import {
    Users, Crown, ChevronRight, ArrowLeft, Loader,
    Save, Send, Pencil,
    UserPlus, UserMinus, Search, Check, AlertCircle, X, Camera, ShieldOff,
} from "lucide-react";

// ─── Ролі, яким заборонено вступати в команди ─────────────────────────────────
const RESTRICTED_ROLES = ["admin", "jury", "superadmin"];

// ─── Discord SVG Icon ─────────────────────────────────────────────────────────
function DiscordIcon({ size = 10, className = "" }: { size?: number; className?: string }) {
    return (
        <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}

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

// ─── Повідомлення про помилку для конкретного юзера у списку результатів ──────
function RoleErrorBadge({ role }: { role: string }) {
    const label =
    role === "jury"
    ? "Журі не можна додавати до команди"
    : role === "admin"
    ? "Адміністраторів не можна додавати до команди"
    : "Цього користувача не можна додавати до команди";
    return (
        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 flex-shrink-0">
        <ShieldOff size={10} />
        {label}
        </span>
    );
}

export default function EditTeamPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const params = useParams();
    const { dark } = useTheme();
    const { user, isLoading: authLoading } = useAuth();
    const { t } = useLanguage();

    const teamId = params.id as string;

    const [team, setTeam] = useState<Team | null>(null);
    const [captain, setCaptain] = useState<TeamMember | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [citySchoolOrg, setCitySchoolOrg] = useState("");
    const [telegramUrl, setTelegramUrl] = useState("");
    const [discordUrl, setDiscordUrl] = useState("");

    const draftKey = teamId ? `team_edit_draft_${teamId}` : null;
    const saveDraft = () => {
        if (!draftKey) return;
        sessionStorage.setItem(draftKey, JSON.stringify({ name, citySchoolOrg, telegramUrl, discordUrl }));
    };
    const clearDraft = () => {
        if (draftKey) sessionStorage.removeItem(draftKey);
    };

        const [teamAvatarUrl, setTeamAvatarUrl] = useState<string | null>(null);
        const [showAvatarModal, setShowAvatarModal] = useState(false);

        const [memberSearch, setMemberSearch] = useState("");
        const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
        const [isSearching, setIsSearching] = useState(false);
        const [removingId, setRemovingId] = useState<string | null>(null);
        const [addingId, setAddingId] = useState<string | null>(null);
        const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
        const [inviteSent, setInviteSent] = useState<string | null>(null);

        // ── Помилка на конкретного юзера (наприклад «jury не можна») ──────────────
        const [perUserError, setPerUserError] = useState<Record<string, string>>({});

        useEffect(() => {
            if (!authLoading && !user) router.push("/login");
        }, [authLoading, user, router]);

            useEffect(() => {
                if (!user || !teamId) return;
                const fetchTeam = async () => {
                    setIsLoading(true);
                    try {
                        const { data: teamData, error: teamErr } = await supabase
                        .from("teams")
                        .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at, avatar_url")
                        .eq("id", teamId)
                        .single();

                        if (teamErr || !teamData) throw new Error(t.editTeam.errLoadTeam);

                        if (teamData.captain_id !== user.id) {
                            router.push(`/teams/${teamId}`);
                            return;
                        }

                        setTeam(teamData);
                        setTeamAvatarUrl(teamData.avatar_url ?? null);

                        const savedDraft = teamId ? sessionStorage.getItem(`team_edit_draft_${teamId}`) : null;
                        if (savedDraft) {
                            try {
                                const draft = JSON.parse(savedDraft);
                                setName(draft.name ?? teamData.name ?? "");
                                setCitySchoolOrg(draft.citySchoolOrg ?? teamData.city_school_org ?? "");
                                setTelegramUrl(draft.telegramUrl ?? teamData.telegram_url ?? "");
                                setDiscordUrl(draft.discordUrl ?? teamData.discord_url ?? "");
                            } catch {
                                setName(teamData.name ?? "");
                                setCitySchoolOrg(teamData.city_school_org ?? "");
                                setTelegramUrl(teamData.telegram_url ?? "");
                                setDiscordUrl(teamData.discord_url ?? "");
                            }
                        } else {
                            setName(teamData.name ?? "");
                            setCitySchoolOrg(teamData.city_school_org ?? "");
                            setTelegramUrl(teamData.telegram_url ?? "");
                            setDiscordUrl(teamData.discord_url ?? "");
                        }

                        const allIds: string[] = [];
                        if (teamData.captain_id) allIds.push(teamData.captain_id);
                        if (teamData.members_ids?.length) allIds.push(...teamData.members_ids);
                        const uniqueIds = [...new Set(allIds)];

                        if (uniqueIds.length > 0) {
                            const { data: accounts, error: accountsErr } = await supabase
                            .from("account")
                            .select("id, username, login, email, role, avatar_url, status")
                            .in("id", uniqueIds);
                            if (accountsErr) {
                                console.warn("[EditTeamPage] Some account rows missing:", accountsErr.message);
                            }

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
            }, [user, teamId]); // eslint-disable-line react-hooks/exhaustive-deps

            const handleSearch = useCallback(async (forceQuery?: string) => {
                const q = (forceQuery ?? memberSearch).trim();
                if (!q) { setSearchResults([]); return; }
                setIsSearching(true);
                setPerUserError({});
                try {
                    const token = localStorage.getItem("access_token");
                    const res = await fetch(
                        `${API_URL}/api/users/search?q=${encodeURIComponent(q)}`,
                                            { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (!res.ok) throw new Error("Search failed");
                    const json = await res.json();
                    const currentIds = new Set([team?.captain_id, ...(team?.members_ids ?? [])]);
                    // Показуємо всіх знайдених юзерів (включно з restricted),
                    // але заблокуємо кнопку "Запросити" для них і покажемо RoleErrorBadge
                    setSearchResults((json.users ?? []).filter((u: TeamMember) => !currentIds.has(u.id)));
                } catch (e) {
                    console.error(e);
                    setSearchResults([]);
                } finally {
                    setIsSearching(false);
                }
            }, [memberSearch, team]);

            useEffect(() => {
                if (!memberSearch.trim()) { setSearchResults([]); setPerUserError({}); return; }
                const timer = setTimeout(() => { handleSearch(memberSearch); }, 400);
                return () => clearTimeout(timer);
            }, [memberSearch]); // eslint-disable-line react-hooks/exhaustive-deps

            const handleAddMember = async (member: TeamMember) => {
                if (!team) return;

                // ── Перевірка ролі — головна захист ──────────────────────────────────
                if (RESTRICTED_ROLES.includes(member.role)) {
                    const roleLabel =
                    member.role === "jury"       ? "Журі"
                    : member.role === "admin"      ? "Адміністратора"
                    : "Суперадміністратора";
                    setPerUserError(prev => ({
                        ...prev,
                        [member.id]: `${roleLabel} не можна додавати до команди`,
                    }));
                    return;
                }

                setAddingId(member.id);
                // Очищаємо попередню помилку для цього юзера якщо є
                setPerUserError(prev => { const n = { ...prev }; delete n[member.id]; return n; });
                try {
                    const token = localStorage.getItem("access_token");
                    const res = await fetch(`${API_URL}/api/invitations/send`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ team_id: team.id, invitee_id: member.id }),
                    });
                    if (!res.ok) {
                        const json = await res.json();
                        throw new Error(json.detail ?? t.editTeam.errAddMember);
                    }
                    setInviteSent(member.id);
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
                    const { data, error } = await supabase.rpc("remove_team_member", {
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
                    clearDraft();
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

            const inputClass = "w-full px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all placeholder:text-(--t2)/50 font-medium";

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
        <div
        id="team-edit-draft-data"
        data-draft={JSON.stringify({ name, citySchoolOrg, telegramUrl, discordUrl })}
        style={{ display: "none" }}
        />
        <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
            @keyframes scaleIn  { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
            @keyframes slideIn  { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:none} }
            @keyframes cdReveal { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
            .fuIn { animation: fadeUp  300ms cubic-bezier(.22,1,.36,1) both }
            .siIn { animation: slideIn 240ms cubic-bezier(.22,1,.36,1) both }
            .modal{ animation: scaleIn 260ms cubic-bezier(.22,1,.36,1) both }
            .cdIn { animation: cdReveal 500ms cubic-bezier(.22,1,.36,1) both }
            `
        }} />

        {/* Remove confirm modal */}
        {confirmRemove && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="modal bg-(--card) border border-(--brd) rounded-2xl p-7 max-w-sm w-full shadow-2xl text-center">
            <div className="w-11 h-11 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <UserMinus size={18} className="text-red-500" />
            </div>
            <h2 className="text-base font-black text-(--t1) mb-1">{t.editTeam.removeMemberTitle}</h2>
            <p className="text-sm text-(--t2) mb-5">
            {t.editTeam.removeMemberConfirm.replace("{name}", confirmRemove.username)}
            </p>
            <div className="flex gap-3">
            <button
            onClick={() => setConfirmRemove(null)}
            disabled={!!removingId}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-(--brd) text-(--t2) hover:bg-(--bg) transition-all"
            >
            {t.editTeam.cancelBtn}
            </button>
            <button
            onClick={() => handleRemoveMember(confirmRemove)}
            disabled={!!removingId}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-all flex items-center justify-center gap-2"
            >
            {removingId ? <Loader size={13} className="animate-spin" /> : <UserMinus size={13} />}
            {t.editTeam.removeMemberBtn}
            </button>
            </div>
            </div>
            </div>
        )}

        {/* Watermark */}
        <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-[0.04]" : "opacity-[0.03]"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(700px,85vw)] object-contain ${dark ? "invert" : ""}`} />
        </div>

        {isMobileSidebarOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
        )}
        <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
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
        <nav className="fuIn flex items-center gap-2 text-[11px] font-bold mb-5 text-(--t2) uppercase tracking-wider">
        <button onClick={() => router.push("/dashboard")} className="hover:text-blue-500 transition-colors">{t.editTeam.breadcrumbHome}</button>
        <ChevronRight size={10} />
        <button onClick={() => router.push("/teams")} className="hover:text-blue-500 transition-colors">{t.editTeam.breadcrumbTeams}</button>
        <ChevronRight size={10} />
        <button onClick={() => router.push(`/teams/${teamId}`)} className="hover:text-blue-500 transition-colors truncate max-w-[120px]">{team?.name}</button>
        <ChevronRight size={10} />
        <span className="text-(--t1)">{t.editTeam.breadcrumbEdit}</span>
        </nav>

        {/* Back + Title row */}
        <div className="fuIn flex items-center gap-4 mb-6">
        <button
        onClick={() => router.push(`/teams/${teamId}`)}
        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-500 transition-colors flex-shrink-0"
        >
        <ArrowLeft size={13} />
        {t.editTeam.backToTeam ?? "Назад до команди"}
        </button>
        <div className="w-px h-6 bg-(--brd) flex-shrink-0" />
        <div>
        <h1 className="text-xl sm:text-2xl font-black text-(--t1) tracking-tight uppercase">{t.editTeam.pageTitle}</h1>
        <p className="text-xs text-(--t2) font-medium mt-0.5">{team?.name}</p>
        </div>
        </div>

        {/* Error banner */}
        {error && (
            <div className="fuIn flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 mb-5 text-red-500 text-sm font-medium">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="flex-shrink-0 hover:opacity-60 transition-opacity">
            <X size={14} />
            </button>
            </div>
        )}

        {/* Main two-column grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start max-w-6xl mx-auto w-full">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

        {/* Merged card: basic info + social links */}
        <div className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">

        {/* Section header */}
        <div className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--brd)">
        <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <Pencil className="text-blue-500" size={16} />
        </div>
        <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">{t.editTeam.basicInfo}</h2>
        </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 space-y-6">
        {/* Avatar + fields */}
        <div className="flex gap-5 items-start">
        <div className="relative flex-shrink-0">
        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-(--brd) bg-(--bg) flex items-center justify-center">
        {teamAvatarUrl
            ? <img src={teamAvatarUrl} alt="team avatar" className="w-full h-full object-cover" />
            : <Users size={28} className="text-(--t2) opacity-30" />
        }
        </div>
        <button
        type="button"
        onClick={() => setShowAvatarModal(true)}
        className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-blue-500 border-2 border-(--card) flex items-center justify-center text-white hover:bg-blue-600 transition-all active:scale-90 shadow-md"
        >
        <Camera size={12} />
        </button>
        {teamAvatarUrl && (
            <button
            type="button"
            onClick={async () => {
                if (!team) return;
                await supabase.from("teams").update({ avatar_url: null }).eq("id", team.id);
                setTeamAvatarUrl(null);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 border-2 border-(--card) flex items-center justify-center text-white hover:bg-red-600 transition-all shadow"
            >
            <X size={9} />
            </button>
        )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
        <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1.5">
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
        <p className="text-[9px] font-bold text-(--t2) mt-1 text-right">{name.length}/64</p>
        </div>
        <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1.5">
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
        </div>
        </div>

        <div className="border-t border-(--brd)" />

        {/* Social links */}
        <div>
        <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
        <Send className="text-sky-500" size={13} />
        </div>
        <h3 className="font-black text-sm text-(--t1) uppercase tracking-tight">
        {t.editTeam.socialLinks ?? "Соціальні посилання"}
        </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1.5">
        <Send size={10} className="text-sky-500" /> Telegram
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
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1.5">
        <DiscordIcon size={10} className="text-indigo-400" /> Discord
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
        </div>
        </div>
        </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

        {/* Captain card */}
        {captain && (
            <div className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-amber-400/30 shadow-xl">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-amber-400/15 bg-amber-400/5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crown size={13} className="text-amber-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{t.editTeam.captainSection}</span>
            </div>
            <div className="p-4">
            <MemberRowDisplay member={captain} isCaptain />
            </div>
            </div>
        )}

        {/* Members card */}
        <div className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--brd)">
        <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <Users size={13} className="text-blue-500" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t1)">{t.editTeam.membersSection}</span>
        </div>
        <span className="text-[10px] font-black text-(--t2) bg-(--bg) border border-(--brd) px-2.5 py-1 rounded-lg">
        {members.length} / 10
        </span>
        </div>

        {/* Members list */}
        <div className="divide-y divide-(--brd)">
        {members.length === 0 ? (
            <div className="px-5 py-8 text-center">
            <Users className="w-10 h-10 text-(--t2) opacity-20 mx-auto mb-3" />
            <p className="text-xs font-bold text-(--t2)">{t.editTeam.noMembers}</p>
            </div>
        ) : (
            members.map((m, i) => (
                <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 fuIn"
                style={{ animationDelay: `${i * 35}ms` }}
                >
                <MemberRowDisplay member={m} />
                <button
                onClick={() => setConfirmRemove(m)}
                disabled={removingId === m.id}
                className="ml-auto flex-shrink-0 p-1.5 rounded-lg bg-red-500/5 border border-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                title="Видалити учасника"
                >
                {removingId === m.id
                    ? <Loader size={12} className="animate-spin" />
                    : <UserMinus size={12} />
                }
                </button>
                </div>
            ))
        )}
        </div>

        {/* Add member search */}
        {members.length < 10 && (
            <div className="px-4 py-4 border-t border-(--brd) bg-(--bg)/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2.5 flex items-center gap-1.5">
            <UserPlus size={11} className="text-blue-500" /> {t.editTeam.addMember}
            </p>
            <div className="flex gap-2">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-3.5 h-3.5" />
            <input
            type="text"
            placeholder={t.editTeam.searchMemberPlaceholder}
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-(--brd) bg-(--card) text-(--t1) focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            />
            </div>
            <button
            onClick={() => handleSearch()}
            disabled={isSearching || !memberSearch.trim()}
            className={`px-3.5 rounded-xl font-black text-[10px] uppercase transition-all active:scale-95 flex items-center ${isSearching || !memberSearch.trim()
                ? "bg-(--brd) text-(--t2) cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            >
            {isSearching
                ? <Loader size={13} className="animate-spin" />
                : <Search size={13} />
            }
            </button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
                <div className="mt-3 space-y-1.5">
                {searchResults.map((person, i) => {
                    const isRestricted = RESTRICTED_ROLES.includes(person.role);
                    const userError = perUserError[person.id];
                    return (
                        <div
                        key={person.id}
                        className={`siIn flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border transition-all ${
                            isRestricted
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-(--card) border-(--brd) hover:border-blue-500/30"
                        }`}
                        style={{ animationDelay: `${i * 35}ms` }}
                        >
                        <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-(--brd) flex items-center justify-center font-black text-blue-500 text-xs flex-shrink-0 overflow-hidden">
                        {person.avatar_url
                            ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (person.username?.charAt(0).toUpperCase() || "?")
                        }
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-black text-(--t1) text-xs truncate">{person.username}</p>
                        <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-bold text-(--t2)">@{person.login}</p>
                        {/* Бейдж ролі */}
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            isRestricted
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-(--bg) text-(--t2) border-(--brd)"
                        }`}>
                        {person.role}
                        </span>
                        </div>
                        </div>
                        {/* Кнопка або заблокований стан */}
                        {isRestricted ? (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red-500/60 bg-red-500/5 border border-red-500/15 rounded-lg px-2 py-1 flex-shrink-0 cursor-not-allowed">
                            <ShieldOff size={10} />
                            Заборонено
                            </span>
                        ) : (
                            <button
                            onClick={() => handleAddMember(person)}
                            disabled={addingId === person.id || inviteSent === person.id}
                            className={`flex-shrink-0 flex items-center gap-1 font-black text-[9px] uppercase tracking-wider rounded-lg px-2.5 py-1.5 transition-all active:scale-95 border ${inviteSent === person.id
                                ? "bg-green-500/10 border-green-500/20 text-green-500 cursor-default"
                                : "bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white"
                            }`}
                            >
                            {addingId === person.id
                                ? <Loader size={11} className="animate-spin" />
                                : inviteSent === person.id
                                ? <><Check size={11} /> Надіслано</>
                                : <><Send size={11} /> Запросити</>
                            }
                            </button>
                        )}
                        </div>

                        {/* Inline помилка (якщо хтось натиснув кнопку попри заборону — подвійний захист) */}
                        {userError && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-500/8 rounded-lg px-2.5 py-1.5">
                            <AlertCircle size={11} />
                            {userError}
                            </div>
                        )}

                        {/* Пояснення для restricted ролі */}
                        {isRestricted && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500/70">
                            <ShieldOff size={10} />
                            {person.role === "jury"
                                ? "Журі не може бути учасником команди"
                                : "Адміністратори не можуть бути учасниками команди"}
                                </div>
                        )}
                        </div>
                    );
                })}
                </div>
            )}

            {searchResults.length === 0 && memberSearch.trim() && !isSearching && (
                <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest mt-3 text-center">
                {t.editTeam.noSearchResults}
                </p>
            )}
            </div>
        )}
        </div>
        </div>
        </div>

        {/* Save button */}
        <div className="fuIn flex items-center justify-between gap-4 max-w-6xl mx-auto w-full mt-5">
        {saveSuccess && (
            <span className="siIn flex items-center gap-2 text-sm font-bold text-green-500">
            <Check size={15} /> {t.editTeam.saved}
            </span>
        )}
        <button
        onClick={handleSave}
        disabled={isSaving || !name.trim()}
        className={`ml-auto flex items-center gap-2 font-black text-sm rounded-2xl px-7 py-3.5 transition-all active:scale-95 shadow-lg ${saveSuccess
            ? "bg-green-500 text-white shadow-green-500/20"
            : isSaving || !name.trim()
            ? "bg-(--brd) text-(--t2) cursor-not-allowed shadow-none"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
        }`}
        >
        {isSaving
            ? <><Loader size={15} className="animate-spin" /> {t.editTeam.saving}</>
            : saveSuccess
            ? <><Check size={15} /> {t.editTeam.saved}</>
            : <><Save size={15} /> {t.editTeam.saveBtn}</>
        }
        </button>
        </div>

        </div>
        </main>

        {/* Avatar editor modal */}
        {showAvatarModal && team && (
            <AvatarEditorModal
            userId={team.id}
            supabase={supabase}
            tableConfig={{ table: "teams", idColumn: "id" }}
            onSave={(url) => { setTeamAvatarUrl(url); setShowAvatarModal(false); }}
            onClose={() => setShowAvatarModal(false)}
            />
        )}
        </div>
    );
}

function MemberRowDisplay({ member, isCaptain }: { member: TeamMember; isCaptain?: boolean }) {
    const router = useRouter();
    const letter = (member.username || member.login || "?").charAt(0).toUpperCase();
    return (
        <button
        type="button"
        onClick={() => {
            if (typeof window !== "undefined" && member.id) {
                const pathParts = window.location.pathname.split("/");
                const tid = pathParts[pathParts.indexOf("teams") + 1];
                if (tid) {
                    const draftEl = document.getElementById("team-edit-draft-data");
                    if (draftEl) {
                        sessionStorage.setItem(`team_edit_draft_${tid}`, draftEl.dataset.draft || "{}");
                    }
                }
            }
            router.push(`/user/${member.id}`);
        }}
        className="flex items-center gap-3 flex-1 min-w-0 text-left group hover:opacity-80 transition-opacity cursor-pointer"
        title={`Перейти до профілю ${member.username}`}
        >
        <div className="w-9 h-9 rounded-full bg-blue-500/10 border-2 border-(--brd) group-hover:border-blue-500/40 transition-colors flex items-center justify-center font-black text-blue-500 text-sm flex-shrink-0 overflow-hidden">
        {member.avatar_url
            ? <img src={member.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            : letter
        }
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
        <p className="font-black text-(--t1) text-sm truncate group-hover:text-blue-500 transition-colors">{member.username}</p>
        {isCaptain && <Crown size={10} className="text-amber-500 flex-shrink-0" />}
        </div>
        <p className="text-[10px] font-bold text-(--t2)">@{member.login}</p>
        </div>
        </button>
    );
}
