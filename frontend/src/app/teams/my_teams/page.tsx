//site_turing_CrutchMasters_team-s/frontend/src/app/my_teams/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Users, Crown, ChevronRight, Plus, Loader,
    Star, Send, MessageSquare, Calendar, Pencil, Trash2,
    AlertCircle,
} from "lucide-react";

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
    members_ids?: string[];
    telegram_url?: string;
    discord_url?: string;
    created_at?: string;
    member_count?: number;
}

const gradients = [
    "from-blue-500 to-blue-700",
"from-violet-500 to-violet-700",
"from-emerald-500 to-emerald-700",
"from-orange-500 to-orange-700",
"from-pink-500 to-pink-700",
"from-cyan-500 to-cyan-700",
];

export default function MyTeamsPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const { dark } = useTheme();
    const { user, isLoading: authLoading } = useAuth();

    const [teams, setTeams]         = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
    const [isDeleting, setIsDeleting]     = useState(false);
    const [deleteError, setDeleteError]   = useState("");

    // Auth guard
    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

        // Fetch my teams (where I'm captain)
        useEffect(() => {
            if (!user) return;

            const fetchMyTeams = async () => {
                setIsLoading(true);
                try {
                    const { data, error } = await supabase
                    .from("teams")
                    .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at")
                    .eq("captain_id", user.id)
                    .order("created_at", { ascending: false });

                    if (error) throw error;
                    setTeams(data ?? []);
                } catch (e) {
                    console.error("Failed to fetch my teams:", e);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchMyTeams();
        }, [user]);

        const handleDelete = async () => {
            if (!deleteTarget) return;
            setIsDeleting(true);
            setDeleteError("");
            try {
                const { error } = await supabase
                .from("teams")
                .delete()
                .eq("id", deleteTarget.id);
                if (error) throw error;
                setTeams(prev => prev.filter(t => t.id !== deleteTarget.id));
                setDeleteTarget(null);
            } catch (e: any) {
                setDeleteError(e.message ?? "Помилка видалення");
            } finally {
                setIsDeleting(false);
            }
        };

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
                @keyframes cardDrop { from{opacity:0;transform:translateY(-20px) scale(.97)} to{opacity:1;transform:none} }
                @keyframes scaleIn  { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
                .fuIn { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: cardDrop 400ms cubic-bezier(.22,1,.36,1) both }
                .spr  { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease }
                .spr:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 8px 24px rgba(37,99,235,0.12); }
                .modal-in { animation: scaleIn 280ms cubic-bezier(.22,1,.36,1) both }
                `}</style>

                {/* Delete confirmation modal */}
                {deleteTarget && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-(--bg)/70 backdrop-blur-md p-4">
                    <div className="modal-in bg-(--card) border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} className="text-red-500" />
                    </div>
                    <h2 className="text-lg font-black text-(--t1) uppercase mb-2">Видалити команду?</h2>
                    <p className="text-sm text-(--t2) mb-1">
                    Ви впевнені, що хочете видалити команду
                    </p>
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
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
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
                title="Мої команди"
                icon={<Star size={18} className="text-amber-500 fill-amber-500" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push("/teams")} className="hover:text-blue-600 transition-colors">Команди</button>
                <ChevronRight size={10} />
                <span className="text-(--t1)">Мої команди</span>
                </nav>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
                <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-(--t1) uppercase flex items-center gap-3">
                <Star size={26} className="text-amber-500 fill-amber-500" />
                Мої команди
                </h1>
                <p className="text-(--t2) text-xs font-bold uppercase tracking-widest mt-1">
                {isLoading ? "Завантаження..." : `Ви є капітаном ${teams.length} команд${teams.length === 1 ? "и" : ""}`}
                </p>
                </div>
                <button
                onClick={() => router.push("/register_team")}
                className="cdIn flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-4 hover:bg-blue-700 shadow-lg shadow-blue-600/25 active:scale-95 transition-all w-full sm:w-auto group"
                >
                <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                Нова команда
                </button>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Завантаження команд...</p>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && teams.length === 0 && (
                    <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 sm:p-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                    <Star size={36} className="text-amber-500/50" />
                    </div>
                    <p className="text-lg font-black text-(--t1) mb-2">Ви ще не маєте команд</p>
                    <p className="text-(--t2) text-sm mb-6">Створіть свою першу команду і станьте капітаном!</p>
                    <button
                    onClick={() => router.push("/register_team")}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3 hover:bg-blue-700 transition-all active:scale-95"
                    >
                    <Plus size={14} /> Створити команду
                    </button>
                    </div>
                )}

                {/* Teams grid */}
                {!isLoading && teams.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {teams.map((team, idx) => (
                        <MyTeamCard
                        key={team.id}
                        team={team}
                        idx={idx}
                        onOpen={() => router.push(`/teams/${team.id}`)}
                        onEdit={() => router.push(`/teams/${team.id}/edit`)}
                        onDelete={() => { setDeleteError(""); setDeleteTarget(team); }}
                        />
                    ))}
                    </div>
                )}
                </div>
                </main>
                </div>
        );
}

function MyTeamCard({
    team, idx, onOpen, onEdit, onDelete
}: {
    team: Team;
    idx: number;
    onOpen: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const gradient = gradients[idx % gradients.length];
    const memberCount = team.members_ids?.length ?? 0;
    const initial = team.name.charAt(0).toUpperCase();

    return (
        <div
        className="fuIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) overflow-hidden group"
        style={{ animationDelay: `${idx * 70}ms` }}
        >
        {/* Gradient top bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

        <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
        <div
        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-md cursor-pointer`}
        onClick={onOpen}
        >
        {initial}
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <h3
        className="font-black text-(--t1) text-lg cursor-pointer hover:text-blue-600 transition-colors"
        onClick={onOpen}
        >
        {team.name}
        </h3>
        <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0">
        <Crown size={8} /> Капітан
        </span>
        </div>
        {team.city_school_org && (
            <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mt-0.5">{team.city_school_org}</p>
        )}
        </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 py-3 border-t border-(--brd)">
        <div className="flex items-center gap-1.5 text-(--t2)">
        <Users size={13} />
        <span className="text-[10px] font-black uppercase tracking-wider">{memberCount} учасників</span>
        </div>
        {team.created_at && (
            <div className="flex items-center gap-1.5 text-(--t2)">
            <Calendar size={13} />
            <span className="text-[10px] font-bold">
            {new Date(team.created_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </span>
            </div>
        )}
        {/* Social badges */}
        <div className="flex items-center gap-1.5 ml-auto">
        {team.telegram_url && (
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center gap-1">
            <Send size={9} /> TG
            </span>
        )}
        {team.discord_url && (
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center gap-1">
            <MessageSquare size={9} /> DC
            </span>
        )}
        </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
        <button
        onClick={onOpen}
        className="spr flex-1 flex items-center justify-center gap-2 bg-blue-600/10 border border-blue-600/20 text-blue-600 font-black text-[10px] uppercase tracking-widest rounded-xl py-2.5 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
        >
        <Users size={13} /> Переглянути
        </button>
        <button
        onClick={onEdit}
        className="spr flex items-center justify-center gap-1.5 bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest rounded-xl px-4 py-2.5 hover:bg-(--card) hover:text-(--t1) transition-all active:scale-95"
        title="Редагувати"
        >
        <Pencil size={13} />
        </button>
        <button
        onClick={onDelete}
        className="spr flex items-center justify-center gap-1.5 bg-red-500/5 border border-red-500/20 text-red-500 font-black text-[10px] uppercase tracking-widest rounded-xl px-4 py-2.5 hover:bg-red-500 hover:text-white transition-all active:scale-95"
        title="Видалити"
        >
        <Trash2 size={13} />
        </button>
        </div>
        </div>
        </div>
    );
}
