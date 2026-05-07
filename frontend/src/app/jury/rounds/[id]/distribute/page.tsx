// src/app/jury/rounds/[id]/distribute/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    ChevronLeft, ChevronRight, Loader2, AlertCircle,
    CheckCircle2, Shuffle, Users, FileText, RefreshCw,
    UserCheck, UserX, Shield,
} from "lucide-react";

const API_URL =
    typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : "https://site-turing-crutchmasters-team-s.onrender.com";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JuryMember {
    id: string;
    username: string;
    login?: string;
    avatar_url?: string;
}

interface SubmissionRow {
    id: string;
    team_name: string;
    team_org?: string;
    submitted_at?: string;
}

interface RoundInfo {
    id: string;
    number: number;
    name: string;
    tournament_id: string;
    tournament_name?: string;
}

// ── Cell component ────────────────────────────────────────────────────────────

function AssignCell({
    assigned,
    pending,
    onToggle,
}: {
    assigned: boolean;
    pending: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            disabled={pending}
            title={assigned ? "Зняти призначення" : "Призначити"}
            className={`
                w-8 h-8 rounded-lg border flex items-center justify-center transition-all
                ${pending ? "opacity-40 cursor-wait" : "cursor-pointer active:scale-90"}
                ${assigned
                    ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-700"
                    : "bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-500/60 hover:text-blue-500"
                }
            `}
        >
            {pending
                ? <Loader2 size={12} className="animate-spin" />
                : assigned
                    ? <UserCheck size={12} />
                    : <span className="text-[10px] font-black">+</span>
            }
        </button>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DistributePage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const roundId = params?.id as string;

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [round, setRound] = useState<RoundInfo | null>(null);
    const [jury, setJury] = useState<JuryMember[]>([]);
    const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
    // Set of "jury_id|submission_id" strings
    const [assignments, setAssignments] = useState<Set<string>>(new Set());
    // Set of "jury_id|submission_id" pending operations
    const [pending, setPending] = useState<Set<string>>(new Set());

    const [pageLoading, setPageLoading] = useState(true);
    const [redistributing, setRedistributing] = useState(false);
    const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    // ── Auth guard ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !user) { router.push("/login"); return; }
        if (!authLoading && user && !isAdmin) { router.push("/dashboard"); }
    }, [authLoading, user, isAdmin, router]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!roundId || !user || !isAdmin) return;
        setPageLoading(true);
        try {
            const freshToken = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) ?? "";

            // Round info
            const { data: roundData } = await supabase
                .from("rounds")
                .select("id, number, name, tournament_id")
                .eq("id", roundId)
                .single();
            if (!roundData) throw new Error("Раунд не знайдено");

            let tournamentName = "";
            if (roundData.tournament_id) {
                const { data: tData } = await supabase
                    .from("tournaments").select("name").eq("id", roundData.tournament_id).single();
                tournamentName = tData?.name ?? "";
            }
            setRound({ ...roundData, tournament_name: tournamentName });

            // Distribution matrix
            const res = await fetch(`${API_URL}/api/rounds/${roundId}/distribution`, {
                headers: { Authorization: `Bearer ${freshToken}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? `HTTP ${res.status}`);
            }
            const data = await res.json();

            setJury(data.jury ?? []);
            setSubmissions(data.submissions ?? []);
            const aSet = new Set<string>(
                (data.assignments ?? []).map((a: any) => `${a.jury_id}|${a.submission_id}`)
            );
            setAssignments(aSet);
        } catch (e: any) {
            showToast("err", e?.message ?? "Помилка завантаження");
        } finally {
            setPageLoading(false);
        }
    }, [roundId, user, isAdmin]);

    useEffect(() => {
        if (!authLoading && user && isAdmin) fetchData();
    }, [authLoading, user, isAdmin]);

    // ── Toggle single assignment ──────────────────────────────────────────────
    const toggleAssignment = async (juryId: string, subId: string) => {
        const key = `${juryId}|${subId}`;
        const isAssigned = assignments.has(key);
        const action = isAssigned ? "remove" : "add";

        setPending(prev => new Set(prev).add(key));
        try {
            const freshToken = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) ?? "";
            const res = await fetch(`${API_URL}/api/rounds/${roundId}/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${freshToken}`,
                },
                body: JSON.stringify({ jury_id: juryId, submission_id: subId, action }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? `HTTP ${res.status}`);
            }
            setAssignments(prev => {
                const next = new Set(prev);
                action === "add" ? next.add(key) : next.delete(key);
                return next;
            });
        } catch (e: any) {
            showToast("err", e?.message ?? "Помилка оновлення");
        } finally {
            setPending(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
    };

    // ── Auto redistribute ─────────────────────────────────────────────────────
    const handleRedistribute = async () => {
        if (!isAdmin || !roundId) return;
        setRedistributing(true);
        try {
            const freshToken = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) ?? "";
            const res = await fetch(`${API_URL}/api/rounds/${roundId}/redistribute`, {
                method: "POST",
                headers: { Authorization: `Bearer ${freshToken}` },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.detail ?? `HTTP ${res.status}`);
            showToast("ok", `Розподілено ${json.submissions} робіт між ${json.jury_count} журі`);
            await fetchData();
        } catch (e: any) {
            showToast("err", e?.message ?? "Помилка перерозподілу");
        } finally {
            setRedistributing(false);
        }
    };

    // ── Toast helper ──────────────────────────────────────────────────────────
    const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const showToast = (type: "ok" | "err", text: string) => {
        setToast({ type, text });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalPossible = jury.length * submissions.length;
    const assignedCount = assignments.size;

    // Per-submission: count how many jury assigned
    const subAssignCounts = Object.fromEntries(
        submissions.map(s => [
            s.id,
            jury.filter(j => assignments.has(`${j.id}|${s.id}`)).length,
        ])
    );
    const unassignedSubs = submissions.filter(s => subAssignCounts[s.id] === 0).length;

    // ── Render guards ─────────────────────────────────────────────────────────
    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            {/* Mobile sidebar overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
            )}
            <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
                <Sidebar />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <MobileHeader
                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                    title="Розподіл робіт"
                    icon={<Shuffle size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">

                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-[10px] font-black mb-5 uppercase tracking-widest text-(--t2) flex-wrap">
                        <a href={"/"} onClick={(e) => { e.preventDefault(); router.push("/"); }} className="hover:text-blue-600 transition-colors">Головна</a>
                        <ChevronRight size={10} />
                        <button onClick={() => round && router.push(`/tournaments/${round.tournament_id}`)} className="hover:text-blue-600 transition-colors truncate max-w-[100px]">
                            {round?.tournament_name ?? "Турнір"}
                        </button>
                        <ChevronRight size={10} />
                        <button onClick={() => round && router.push(`/jury/rounds/${round.id}/evaluate`)} className="hover:text-blue-600 transition-colors">
                            {round ? `Раунд ${round.number}` : "..."} — Оцінювання
                        </button>
                        <ChevronRight size={10} />
                        <span className="text-(--t1)">Розподіл</span>
                    </nav>

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 flex-wrap">
                        <button
                            onClick={() => round && router.push(`/jury/rounds/${round.id}/evaluate`)}
                            className="flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors group"
                        >
                            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                            Назад до оцінювання
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl sm:text-2xl font-black text-(--t1) uppercase tracking-tight">
                                🗂️ Ручний розподіл робіт
                            </h1>
                            {round && (
                                <p className="text-[11px] font-bold text-(--t2) uppercase tracking-widest mt-0.5">
                                    {round.tournament_name} · Раунд {round.number}: {round.name}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchData}
                                disabled={pageLoading}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-500/40 hover:text-blue-500 transition-all disabled:opacity-40"
                            >
                                <RefreshCw size={11} className={pageLoading ? "animate-spin" : ""} />
                                Оновити
                            </button>
                            <button
                                onClick={handleRedistribute}
                                disabled={redistributing || pageLoading}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-500/20 transition-all disabled:opacity-40"
                            >
                                {redistributing
                                    ? <><Loader2 size={11} className="animate-spin" /> Розподіл...</>
                                    : <><Shuffle size={11} /> Авто-розподіл</>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Toast */}
                    {toast && (
                        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${
                            toast.type === "ok"
                                ? "bg-green-500/10 border-green-500/30 text-green-600"
                                : "bg-red-500/10 border-red-500/30 text-red-500"
                        }`}>
                            {toast.type === "ok" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            {toast.text}
                        </div>
                    )}

                    {pageLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Завантаження матриці...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Stats row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                {[
                                    { label: "Журі",            value: jury.length,       icon: <Users size={14} />,    color: "text-(--t1)" },
                                    { label: "Роботи",          value: submissions.length, icon: <FileText size={14} />, color: "text-blue-600" },
                                    { label: "Призначень",      value: assignedCount,      icon: <UserCheck size={14} />,color: "text-green-500" },
                                    { label: "Без журі",        value: unassignedSubs,     icon: <UserX size={14} />,    color: unassignedSubs > 0 ? "text-red-500" : "text-green-500" },
                                ].map(({ label, value, icon, color }) => (
                                    <div key={label} className="bg-(--card) border border-(--brd) rounded-2xl p-4 flex flex-col gap-2">
                                        <div className={`flex items-center gap-2 text-(--t2)`}>{icon}<span className="text-[9px] font-black uppercase tracking-widest">{label}</span></div>
                                        <span className={`text-2xl font-black ${color}`}>{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 mb-3 text-[10px] font-black uppercase tracking-widest text-(--t2)">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-md bg-blue-600 border border-blue-500 flex items-center justify-center"><UserCheck size={10} className="text-white" /></div>
                                    Призначено
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-md bg-(--bg) border border-(--brd)" />
                                    Не призначено
                                </div>
                            </div>

                            {/* Empty states */}
                            {jury.length === 0 && (
                                <div className="bg-(--card) border border-(--brd) rounded-2xl p-10 text-center">
                                    <Shield size={28} className="mx-auto text-(--t2) opacity-30 mb-3" />
                                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Немає членів журі для цього турніру</p>
                                </div>
                            )}
                            {submissions.length === 0 && jury.length > 0 && (
                                <div className="bg-(--card) border border-(--brd) rounded-2xl p-10 text-center">
                                    <FileText size={28} className="mx-auto text-(--t2) opacity-30 mb-3" />
                                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Немає поданих робіт для розподілу</p>
                                </div>
                            )}

                            {/* Matrix */}
                            {jury.length > 0 && submissions.length > 0 && (
                                <div className="bg-(--card) border border-(--brd) rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    {/* Top-left corner */}
                                                    <th className="sticky left-0 z-20 bg-(--card) border-b border-r border-(--brd) px-4 py-3 text-left min-w-[180px]">
                                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-(--t2)">
                                                            <Users size={11} />Журі \ Роботи
                                                        </div>
                                                    </th>
                                                    {submissions.map(sub => (
                                                        <th key={sub.id} className="border-b border-r border-(--brd) px-3 py-3 text-center min-w-[90px]">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-[10px] font-black text-(--t1) leading-tight truncate max-w-[80px]" title={sub.team_name}>
                                                                    {sub.team_name}
                                                                </span>
                                                                {sub.team_org && (
                                                                    <span className="text-[8px] font-bold text-(--t2) truncate max-w-[80px]" title={sub.team_org}>
                                                                        {sub.team_org}
                                                                    </span>
                                                                )}
                                                                {/* Per-submission count badge */}
                                                                <span className={`mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                                                                    subAssignCounts[sub.id] === 0
                                                                        ? "bg-red-500/15 text-red-500"
                                                                        : "bg-blue-500/15 text-blue-600"
                                                                }`}>
                                                                    {subAssignCounts[sub.id]} журі
                                                                </span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {jury.map((juryMember, jIdx) => {
                                                    const assignedForJury = submissions.filter(s => assignments.has(`${juryMember.id}|${s.id}`)).length;
                                                    return (
                                                        <tr key={juryMember.id} className={jIdx % 2 === 0 ? "" : "bg-(--bg)/40"}>
                                                            {/* Jury name cell - sticky */}
                                                            <td className="sticky left-0 z-10 bg-(--card) border-r border-b border-(--brd) px-4 py-3">
                                                                <div className="flex items-center gap-2.5">
                                                                    {juryMember.avatar_url ? (
                                                                        <img src={juryMember.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                                                    ) : (
                                                                        <div className="w-7 h-7 rounded-full bg-blue-600/15 border border-blue-600/25 flex items-center justify-center flex-shrink-0">
                                                                            <span className="text-[10px] font-black text-blue-600">
                                                                                {(juryMember.username ?? juryMember.login ?? "?")[0].toUpperCase()}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-black text-(--t1) truncate max-w-[120px]">
                                                                            {juryMember.username ?? juryMember.login}
                                                                        </div>
                                                                        <div className="text-[9px] font-bold text-(--t2)">
                                                                            {assignedForJury} / {submissions.length} призначено
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {/* Cells */}
                                                            {submissions.map(sub => {
                                                                const key = `${juryMember.id}|${sub.id}`;
                                                                return (
                                                                    <td key={sub.id} className="border-r border-b border-(--brd) px-3 py-3 text-center">
                                                                        <AssignCell
                                                                            assigned={assignments.has(key)}
                                                                            pending={pending.has(key)}
                                                                            onToggle={() => toggleAssignment(juryMember.id, sub.id)}
                                                                        />
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Footer hint */}
                                    <div className="px-4 py-3 border-t border-(--brd) bg-(--bg)/40 flex items-center justify-between flex-wrap gap-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">
                                            Натисніть клітинку для призначення / зняття призначення
                                        </p>
                                        <p className="text-[9px] font-bold text-(--t2)">
                                            {assignedCount} з {totalPossible} можливих призначень
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
