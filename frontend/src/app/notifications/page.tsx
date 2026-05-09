//site_turing_CrutchMasters_team-s/frontend/src/app/notifications/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Bell, Check, X, Users, ChevronRight, Loader,
    CheckCheck, Crown, UserPlus, AlertCircle, Trophy, Star,
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface NotifMeta {
    invitation_id?: string;
    team_id?:       string;
    team_name?:     string;
    inviter_id?:    string;
    inviter_name?:  string;
    new_member?:    string;
    tournament_id?: string;
    tournament_name?: string;
    jury_name?:     string;
}

interface Notification {
    id:         string;
    type:       string;
    title:      string;
    message:    string;
    meta:       string | NotifMeta | null;
    read:       boolean;
    created_at: string;
}

function parseMeta(raw: string | NotifMeta | null): NotifMeta {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch { return {}; }
}

function timeAgo(iso: string): string {
    try {
        const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (diff < 60)    return `${diff}с тому`;
        if (diff < 3600)  return `${Math.floor(diff / 60)}хв тому`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}год тому`;
        return new Date(iso).toLocaleString("uk-UA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
}

const typeConfig: Record<string, { icon: React.ReactNode; border: string; bg: string }> = {
    team_invitation:         { icon: <UserPlus size={16} className="text-blue-500" />,   border: "border-l-blue-500",   bg: "bg-blue-500/10 border-blue-500/20" },
    invitation_accepted:     { icon: <Check    size={16} className="text-green-500" />,  border: "border-l-green-500",  bg: "bg-green-500/10 border-green-500/20" },
    invitation_declined:     { icon: <X        size={16} className="text-red-500" />,    border: "border-l-red-500",    bg: "bg-red-500/10 border-red-500/20" },
    jury_invitation:         { icon: <Star     size={16} className="text-amber-500" />,  border: "border-l-amber-500",  bg: "bg-amber-500/10 border-amber-500/20" },
    jury_invitation_accepted:{ icon: <Check    size={16} className="text-green-500" />,  border: "border-l-green-500",  bg: "bg-green-500/10 border-green-500/20" },
    jury_invitation_declined:{ icon: <X        size={16} className="text-red-500" />,    border: "border-l-red-500",    bg: "bg-red-500/10 border-red-500/20" },
};

export default function NotificationsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const { dark } = useTheme();
    const { user, token, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading]             = useState(true);
    const [responding, setResponding]       = useState<Record<string, "accept" | "decline" | null>>({});
    const [responded, setResponded]         = useState<Record<string, "accepted" | "declined">>({});

    const authHeader = useCallback((): Record<string, string> => {
        const t = (typeof window !== "undefined" && localStorage.getItem("access_token")) || token || "";
        return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
    }, [token]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await fetch(`${API_URL}/api/notifications?limit=50`, { headers: authHeader() });
            const data = await res.json();
            setNotifications(data.notifications ?? []);
        } catch { setNotifications([]); }
        finally { setLoading(false); }
    }, [authHeader]);

    useEffect(() => {
        if (!authLoading && !user) { router.push("/login"); return; }
        if (user) fetchNotifications();
    }, [authLoading, user, router, fetchNotifications]);

    const markAllRead = async () => {
        await fetch(`${API_URL}/api/notifications/mark-read`, {
            method: "POST", headers: authHeader(), body: JSON.stringify({ all: true }),
        });
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const markRead = async (id: string) => {
        await fetch(`${API_URL}/api/notifications/mark-read`, {
            method: "POST", headers: authHeader(), body: JSON.stringify({ ids: [id] }),
        });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    // Відповідь на запрошення в КОМАНДУ
    const respondTeamInvitation = async (notif: Notification, accept: boolean) => {
        const meta = parseMeta(notif.meta);
        const invitationId = meta.invitation_id;
        if (!invitationId) return;
        const key = notif.id;
        setResponding(prev => ({ ...prev, [key]: accept ? "accept" : "decline" }));
        try {
            const res = await fetch(`${API_URL}/api/invitations/respond`, {
                method:  "POST", headers: authHeader(),
                body:    JSON.stringify({ invitation_id: invitationId, accept }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.detail ?? "Помилка відповіді"); return; }
            setResponded(prev => ({ ...prev, [key]: accept ? "accepted" : "declined" }));
            await markRead(notif.id);
        } catch { alert("Помилка з'єднання"); }
        finally { setResponding(prev => ({ ...prev, [key]: null })); }
    };

    // Відповідь на запрошення ЖУРІ до турніру
    const respondJuryInvitation = async (notif: Notification, accept: boolean) => {
        const meta = parseMeta(notif.meta);
        const invitationId = meta.invitation_id;
        if (!invitationId) return;
        const key = notif.id;
        setResponding(prev => ({ ...prev, [key]: accept ? "accept" : "decline" }));
        try {
            const res = await fetch(`${API_URL}/api/jury-invitations/respond`, {
                method:  "POST", headers: authHeader(),
                body:    JSON.stringify({ invitation_id: invitationId, accept }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.detail ?? "Помилка відповіді"); return; }
            setResponded(prev => ({ ...prev, [key]: accept ? "accepted" : "declined" }));
            await markRead(notif.id);
        } catch { alert("Помилка з'єднання"); }
        finally { setResponding(prev => ({ ...prev, [key]: null })); }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (authLoading || !user) {
        return (
            <div className="min-h-screen bg-(--bg) flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
        <style jsx global>{`
            @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
            @keyframes cardDrop { from{opacity:0;transform:translateY(-12px) scale(.98)} to{opacity:1;transform:none} }
            .fuIn { animation: fadeUp   300ms cubic-bezier(.22,1,.36,1) both }
            .cdIn { animation: cardDrop 380ms cubic-bezier(.22,1,.36,1) both }
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
        <MobileHeader
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        title="Сповіщення"
        icon={<Bell size={18} className="text-blue-600" />}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
        <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
        <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
        <ChevronRight size={10} />
        <span className="text-(--t1)">Сповіщення</span>
        </nav>

        <div className="flex items-end justify-between gap-4 mb-8">
        <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-(--t1) uppercase">🔔 Сповіщення</h1>
        <p className="text-(--t2) text-xs font-bold uppercase tracking-widest mt-1">
        {loading ? "Завантаження..." : unreadCount > 0 ? `${unreadCount} непрочитаних` : "Все прочитано"}
        </p>
        </div>
        {unreadCount > 0 && (
            <button onClick={markAllRead}
            className="cdIn flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 border border-(--brd) bg-(--card) rounded-2xl px-4 py-2.5 transition-all hover:border-blue-600/40 active:scale-95">
            <CheckCheck size={14} /> Прочитати всі
            </button>
        )}
        </div>

        {loading ? (
            <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Завантаження...</p>
            </div>
            </div>
        ) : notifications.length === 0 ? (
            <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-16 text-center">
            <Bell className="w-14 h-14 text-(--t2) mx-auto mb-4 opacity-30" />
            <p className="text-lg font-black text-(--t1) mb-2">Немає сповіщень</p>
            <p className="text-(--t2) text-sm">Тут зʼявляться запрошення та оповіщення</p>
            </div>
        ) : (
            <div className="max-w-2xl space-y-3">
            {notifications.map((notif, i) => (
                <NotificationCard
                key={notif.id}
                notif={notif}
                idx={i}
                responded={responded[notif.id]}
                responding={responding[notif.id] ?? null}
                onTeamAccept={() => respondTeamInvitation(notif, true)}
                onTeamDecline={() => respondTeamInvitation(notif, false)}
                onJuryAccept={() => respondJuryInvitation(notif, true)}
                onJuryDecline={() => respondJuryInvitation(notif, false)}
                onMarkRead={() => markRead(notif.id)}
                onGoTeam={(teamId) => router.push(`/teams/${teamId}`)}
                onGoTournament={(tId) => router.push(`/tournaments/${tId}`)}
                />
            ))}
            </div>
        )}
        </div>
        </main>
        </div>
    );
}

// ── Notification card ─────────────────────────────────────────────────────────
function NotificationCard({
    notif, idx, responded, responding,
    onTeamAccept, onTeamDecline, onJuryAccept, onJuryDecline,
    onMarkRead, onGoTeam, onGoTournament,
}: {
    notif: Notification; idx: number;
    responded: "accepted" | "declined" | undefined;
    responding: "accept" | "decline" | null;
    onTeamAccept: () => void; onTeamDecline: () => void;
    onJuryAccept: () => void; onJuryDecline: () => void;
    onMarkRead: () => void;
    onGoTeam: (id: string) => void;
    onGoTournament: (id: string) => void;
}) {
    const meta         = parseMeta(notif.meta);
    const isTeamInvite = notif.type === "team_invitation";
    const isJuryInvite = notif.type === "jury_invitation";
    const cfg          = typeConfig[notif.type] ?? { icon: <Bell size={16} className="text-(--t2)" />, border: "border-l-gray-400", bg: "bg-(--bg) border-(--brd)" };

    return (
        <div
        className={`fuIn cdIn bg-(--card) rounded-2xl border border-(--brd) border-l-4 ${cfg.border} p-5 sm:p-6 transition-all ${!notif.read ? "shadow-sm" : "opacity-70"}`}
        style={{ animationDelay: `${idx * 50}ms` }}
        >
        <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg}`}>
        {cfg.icon}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
        <p className={`text-sm font-black uppercase tracking-wide ${notif.read ? "text-(--t2)" : "text-(--t1)"}`}>
        {notif.title}
        </p>
        <p className="text-[11px] font-bold text-(--t2) mt-1 leading-relaxed">{notif.message}</p>
        </div>
        {!notif.read && (
            <button onClick={onMarkRead} title="Позначити як прочитане"
            className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5 hover:bg-blue-700 transition-colors" />
        )}
        </div>

        {/* Team link */}
        {meta.team_id && (
            <button onClick={() => onGoTeam(meta.team_id!)}
            className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors">
            <Users size={11} /> {meta.team_name} <ChevronRight size={10} />
            </button>
        )}

        {/* Tournament link */}
        {meta.tournament_id && !isTeamInvite && (
            <button onClick={() => onGoTournament(meta.tournament_id!)}
            className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors">
            <Trophy size={11} /> {meta.tournament_name} <ChevronRight size={10} />
            </button>
        )}

        {/* Inviter info */}
        {(isTeamInvite || isJuryInvite) && meta.inviter_name && (
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-(--t2) flex items-center gap-1">
            <Crown size={9} className="text-amber-500" /> Від: {meta.inviter_name}
            </p>
        )}

        {/* Timestamp */}
        <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-60">
        {timeAgo(notif.created_at)}
        </p>

        {/* Team invitation actions */}
        {isTeamInvite && !responded && (
            <div className="flex items-center gap-2 mt-4">
            <button onClick={onTeamAccept} disabled={!!responding}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60 shadow-md shadow-blue-600/25">
            {responding === "accept" ? <><Loader size={12} className="animate-spin" /> Прийняття...</> : <><Check size={12} /> Прийняти</>}
            </button>
            <button onClick={onTeamDecline} disabled={!!responding}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[11px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all disabled:opacity-60">
            {responding === "decline" ? <><Loader size={12} className="animate-spin" /> Відхилення...</> : <><X size={12} /> Відхилити</>}
            </button>
            </div>
        )}

        {/* Jury invitation actions */}
        {isJuryInvite && !responded && (
            <div className="flex items-center gap-2 mt-4">
            <button onClick={onJuryAccept} disabled={!!responding}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-black text-[11px] uppercase tracking-widest hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60 shadow-md shadow-amber-500/25">
            {responding === "accept" ? <><Loader size={12} className="animate-spin" /> Прийняття...</> : <><Star size={12} /> Прийняти участь</>}
            </button>
            <button onClick={onJuryDecline} disabled={!!responding}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[11px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all disabled:opacity-60">
            {responding === "decline" ? <><Loader size={12} className="animate-spin" /> Відхилення...</> : <><X size={12} /> Відхилити</>}
            </button>
            </div>
        )}

        {/* Result badge */}
        {(isTeamInvite || isJuryInvite) && responded && (
            <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                responded === "accepted"
                ? "bg-green-500/10 text-green-500 border-green-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}>
            {responded === "accepted" ? <><Check size={11} /> Прийнято</> : <><X size={11} /> Відхилено</>}
            </div>
        )}
        </div>
        </div>
        </div>
    );
}
