//src/app/tournaments/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Trophy, ChevronRight, Save, ArrowLeft, AlertCircle,
    CheckCircle, Clock, Layers, Zap,
} from "lucide-react";

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    status: "upcoming" | "registration" | "ongoing" | "finished";
    start_at: string;
    registration_from?: string;
    registration_to?: string;
    max_teams?: number;
    rounds?: number;
    created_by?: string;
    created_at?: string;
}

function toDateStr(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toISOString().slice(0, 10);
}
function toTimeStr(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toISOString().slice(11, 16);
}
function toIso(date: string, time: string) {
    if (!date) return null;
    return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

export default function TournamentEditPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const params = useParams();
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { t } = useT();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [error, setError]         = useState("");
    const [success, setSuccess]     = useState("");
    const [tourney, setTourney]     = useState<Tournament | null>(null);

    // Form state
    const [name, setName]           = useState("");
    const [rules, setRules]         = useState("");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [regFromDate, setRegFromDate] = useState("");
    const [regFromTime, setRegFromTime] = useState("");
    const [regToDate, setRegToDate] = useState("");
    const [regToTime, setRegToTime] = useState("");
    const [maxTeams, setMaxTeams]   = useState(0);
    const [rounds, setRounds]       = useState<number | null>(null);
    const [status, setStatus]       = useState<string>("upcoming");

    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
        if (!authLoading && user && !isAdmin) router.push("/tournaments");
    }, [authLoading, user, isAdmin, router]);

        const fetchTourney = useCallback(async () => {
            if (!id) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                .from("tournaments")
                .select("*")
                .eq("id", id)
                .single();
                if (error) throw error;
                setTourney(data);

                // Populate form
                setName(data.name ?? "");
                setRules(data.rules ?? "");
                setStartDate(toDateStr(data.start_at));
                setStartTime(toTimeStr(data.start_at));
                setRegFromDate(toDateStr(data.registration_from));
                setRegFromTime(toTimeStr(data.registration_from));
                setRegToDate(toDateStr(data.registration_to));
                setRegToTime(toTimeStr(data.registration_to));
                setMaxTeams(data.max_teams ?? 0);
                setRounds(data.rounds ?? null);
                setStatus(data.status);
            } catch (e: any) {
                setError(e?.message ?? "Помилка завантаження");
            } finally {
                setLoading(false);
            }
        }, [id]);

        useEffect(() => { fetchTourney(); }, [fetchTourney]);

        // Can edit full info only if NOT ongoing (or within 24h of start)
        const isOngoing = tourney?.status === "ongoing";
        const ongoingWithin24h = isOngoing &&
        tourney && (new Date().getTime() - new Date(tourney.start_at).getTime()) < 24 * 60 * 60 * 1000;
        const canEditFull = tourney?.status === "upcoming" || tourney?.status === "registration";
        const canEditLimited = ongoingWithin24h; // within 24h can only change status to finished
        const isFinished = tourney?.status === "finished";

        const handleSave = async (e: React.FormEvent) => {
            e.preventDefault();
            setError("");
            setSuccess("");

            if (!name.trim()) { setError("Назва обов'язкова"); return; }
            if (!startDate)   { setError("Дата старту обов'язкова"); return; }

            setSaving(true);
            try {
                const payload: Record<string, any> = {
                    name: name.trim(),
                    rules: rules.trim() || null,
                    start_at: toIso(startDate, startTime),
                    registration_from: toIso(regFromDate, regFromTime),
                    registration_to: toIso(regToDate, regToTime),
                    max_teams: maxTeams > 0 ? maxTeams : null,
                    rounds,
                    status,
                };

                // If ongoing & within 24h, only allow status change
                if (canEditLimited && !canEditFull) {
                    delete payload.name;
                    delete payload.rules;
                    delete payload.start_at;
                    delete payload.registration_from;
                    delete payload.registration_to;
                    delete payload.max_teams;
                    delete payload.rounds;
                }

                const { error: upErr } = await supabase
                .from("tournaments")
                .update(payload)
                .eq("id", id);

                if (upErr) throw upErr;
                setSuccess("Зміни збережено ✓");
                await fetchTourney();
            } catch (e: any) {
                setError(e?.message ?? "Помилка збереження");
            } finally {
                setSaving(false);
            }
        };

        const inputCls = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all";
        const labelCls = "block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2";

        if (authLoading || !user || loading) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        if (!tourney || isFinished) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center flex-col gap-4">
                <Trophy size={48} className="text-(--t2) opacity-30" />
                <p className="font-black text-(--t1) uppercase">{isFinished ? "Завершений турнір не можна редагувати" : "Турнір не знайдено"}</p>
                <button onClick={() => router.push(`/tournaments/${id}`)} className="text-blue-600 text-sm font-bold">← Назад</button>
                </div>
            );
        }

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
            <style jsx global>{`
                @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                .fuIn { animation: fadeUp 340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: fadeUp 340ms cubic-bezier(.22,1,.36,1) both }
                `}</style>

                <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
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
                title="Редагування"
                icon={<Trophy size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2) flex-wrap">
                <button onClick={() => router.push("/")} className="hover:text-blue-600">{t.nav.home}</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push("/tournaments")} className="hover:text-blue-600">Турніри</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push(`/tournaments/${id}`)} className="hover:text-blue-600 truncate max-w-[120px]">{tourney.name}</button>
                <ChevronRight size={10} />
                <span className="text-(--t1)">Редагування</span>
                </nav>

                {/* Ongoing notice */}
                {isOngoing && (
                    <div className="mb-6 flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                    <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-amber-500">
                    Турнір розпочато. {canEditLimited
                        ? "Ви можете змінити лише статус (у межах 24 год після старту)."
                        : "Редагування доступне лише в перші 24 год після старту."
                    }
                    </p>
                    </div>
                )}

                <form onSubmit={handleSave} className="max-w-3xl space-y-6">

                {/* ── Section 1: General ── */}
                <section className="cdIn bg-(--card) rounded-[2rem] border border-(--brd) overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Trophy size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">1. Загальна інформація</span>
                </div>

                <div className="p-6 sm:p-8 space-y-5">
                <div>
                <label className={labelCls}>Назва турніру</label>
                <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Назва турніру"
                disabled={canEditLimited && !canEditFull}
                className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                </div>
                <div>
                <label className={labelCls}>Опис / Правила</label>
                <textarea
                value={rules}
                onChange={e => setRules(e.target.value)}
                rows={5}
                placeholder="Опис і правила турніру..."
                disabled={canEditLimited && !canEditFull}
                className={`${inputCls} resize-none disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                </div>
                </div>
                </section>

                {/* ── Section 2: Time ── */}
                <section className="cdIn bg-(--card) rounded-[2rem] border border-(--brd) overflow-hidden shadow-sm" style={{ animationDelay: "60ms" }}>
                <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Clock size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">2. Час та умови</span>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                {/* Start */}
                <div>
                <label className={labelCls}>Дата та час старту</label>
                <div className="grid grid-cols-2 gap-3">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                disabled={canEditLimited && !canEditFull} className={`${inputCls} disabled:opacity-50`} />
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                disabled={canEditLimited && !canEditFull} className={`${inputCls} disabled:opacity-50`} />
                </div>
                </div>

                {/* Reg window */}
                <div>
                <label className={labelCls}>Вікно реєстрації</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-(--brd) bg-(--bg)/50 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Початок</p>
                <input type="date" value={regFromDate} onChange={e => setRegFromDate(e.target.value)}
                disabled={canEditLimited && !canEditFull} className={`${inputCls} disabled:opacity-50`} />
                <input type="time" value={regFromTime} onChange={e => setRegFromTime(e.target.value)}
                disabled={canEditLimited && !canEditFull} className={`${inputCls} disabled:opacity-50`} />
                </div>
                <div className="p-4 rounded-2xl border border-(--brd) bg-(--bg)/50 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Кінець</p>
                <input type="date" value={regToDate} onChange={e => setRegToDate(e.target.value)}
                disabled={canEditLimited && !canEditFull} className={`${inputCls} disabled:opacity-50`} />
                <input type="time" value={regToTime} onChange={e => setRegToTime(e.target.value)}
                disabled={canEditLimited && !canEditFull} className={`${inputCls} disabled:opacity-50`} />
                </div>
                </div>
                </div>

                {/* Max teams */}
                <div>
                <label className={labelCls}>Максимум команд <span className="normal-case font-bold opacity-60">(0 = без ліміту)</span></label>
                <div className="flex items-center overflow-hidden border border-(--brd) rounded-2xl w-fit">
                <button type="button" onClick={() => setMaxTeams(Math.max(0, maxTeams - 1))}
                disabled={canEditLimited && !canEditFull}
                className="w-12 h-12 text-lg flex items-center justify-center bg-(--bg) text-(--t2) hover:text-blue-600 transition-colors border-r border-(--brd) disabled:opacity-50">−</button>
                <input type="number" value={maxTeams} onChange={e => setMaxTeams(Math.max(0, +e.target.value))}
                disabled={canEditLimited && !canEditFull}
                className="w-20 text-center text-sm font-black outline-none h-12 bg-transparent text-(--t1) disabled:opacity-50" />
                <button type="button" onClick={() => setMaxTeams(Math.min(256, maxTeams + 1))}
                disabled={canEditLimited && !canEditFull}
                className="w-12 h-12 text-lg flex items-center justify-center bg-(--bg) text-(--t2) hover:text-blue-600 transition-colors border-l border-(--brd) disabled:opacity-50">+</button>
                </div>
                </div>
                </div>
                </section>

                {/* ── Section 3: Format ── */}
                <section className="cdIn bg-(--card) rounded-[2rem] border border-(--brd) overflow-hidden shadow-sm" style={{ animationDelay: "120ms" }}>
                <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Layers size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">3. Формат</span>
                </div>
                <div className="p-6 sm:p-8 space-y-6">
                {/* Rounds */}
                <div>
                <label className={labelCls}>Кількість раундів</label>
                <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button key={n} type="button" onClick={() => setRounds(n)}
                    disabled={canEditLimited && !canEditFull}
                    className={`w-12 h-12 rounded-2xl font-black text-sm border transition-all active:scale-95 disabled:opacity-50 ${
                        rounds === n ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/25" : "bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50"
                    }`}
                    >{n}</button>
                ))}
                </div>
                </div>

                {/* Status (only change allowed when ongoing) */}
                <div>
                <label className={labelCls}>Статус турніру</label>
                <div className="flex flex-wrap gap-2">
                {(["upcoming", "registration", "ongoing", "finished"] as const).map(s => (
                    <button key={s} type="button" onClick={() => setStatus(s)}
                    // When ongoing within 24h: can only set to "finished"
                    disabled={canEditLimited && !canEditFull && s !== "finished" && s !== tourney.status}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-30 ${
                        status === s
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-(--bg) text-(--t2) border-(--brd) hover:border-blue-600/40"
                    }`}
                    >
                    {s === "upcoming" ? "Скоро" : s === "registration" ? "Реєстрація" : s === "ongoing" ? "Тривають" : "Завершено"}
                    </button>
                ))}
                </div>
                {isOngoing && !canEditLimited && (
                    <p className="mt-2 text-[10px] font-bold text-amber-500">⚠️ Зміна статусу недоступна після перших 24 год</p>
                )}
                </div>
                </div>
                </section>

                {/* Errors & Success */}
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-red-500">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-green-500">{success}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60"
                >
                {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Збереження...</> : <><Save size={15} /> Зберегти зміни</>}
                </button>
                <button
                type="button"
                onClick={() => router.push(`/tournaments/${id}`)}
                disabled={saving}
                className="px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all"
                >
                Скасувати
                </button>
                </div>
                </form>
                </div>
                </main>
                </div>
        );
}
