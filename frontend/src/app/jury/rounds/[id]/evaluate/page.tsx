//src/app/jury/rounds/[id]/evaluate/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Trophy, ChevronRight, ChevronLeft, ArrowLeft, Loader, Save,
    CheckCircle2, AlertCircle, Github, Video,
    RefreshCw, Star, BarChart2, Shuffle, Users,
    Lock, Unlock, ChevronDown, ChevronUp, Eye,
    Clock, Shield, Zap, Award,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CriterionScore {
    key: string;
    label: string;
    weight: number; // 0–100, sum of all = 100
    score: number | ""; // 0–100
    comment: string;
}

interface SubmissionWork {
    id: string;
    team_id: string;
    team_name: string;
    team_org?: string;
    round_id: string;
    submitted_at: string;
    github_url?: string;
    video_url?: string;
    status: "not_evaluated" | "in_progress" | "evaluated";
    // filled after evaluation load
    criteria: CriterionScore[];
    general_comment: string;
    total_score?: number;
}

interface RoundInfo {
    id: string;
    number: number;
    name: string;
    tournament_id: string;
    tournament_name?: string;
    end_at?: string;
    status?: string;
}

interface DistributionStats {
    total: number;
    distributed: number;
    evaluated: number;
}

// ── Default criteria ─────────────────────────────────────────────────────────

const DEFAULT_CRITERIA: Omit<CriterionScore, "score" | "comment">[] = [
    { key: "backend_quality",    label: "Backend якість коду",       weight: 20 },
{ key: "database_structure", label: "Database структура",        weight: 20 },
{ key: "frontend_quality",   label: "Frontend якість/UX",        weight: 20 },
{ key: "must_have",          label: 'Виконання "must have"',      weight: 20 },
{ key: "no_bugs",            label: "Робото­здатність, без багів", weight: 20 },
];

function buildDefaultCriteria(): CriterionScore[] {
    return DEFAULT_CRITERIA.map(c => ({ ...c, score: "", comment: "" }));
}

function computeTotal(criteria: CriterionScore[]): number {
    let total = 0;
    for (const c of criteria) {
        if (c.score === "" || isNaN(Number(c.score))) continue;
        total += (Number(c.score) * c.weight) / 100;
    }
    return Math.round(total * 10) / 10;
}

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// ── Score slider / input ─────────────────────────────────────────────────────

function ScoreInput({
    value, onChange, disabled,
}: {
    value: number | ""; onChange: (v: number | "") => void; disabled?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const num = value === "" ? 0 : Number(value);

    const color =
    value === "" ? "var(--brd)"
    : num >= 80 ? "#22c55e"
    : num >= 50 ? "#3b82f6"
    : num >= 30 ? "#f59e0b"
    : "#ef4444";

    return (
        <div className="flex items-center gap-3">
        {/* Track */}
        <div className="relative flex-1 h-2 rounded-full bg-(--brd) overflow-hidden">
        <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
        style={{ width: `${num}%`, background: color }}
        />
        <input
        type="range"
        min={0} max={100} step={1}
        value={num}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        style={{ height: "100%" }}
        />
        </div>
        {/* Number input */}
        <div
        className="relative flex-shrink-0"
        style={{ width: 56 }}
        >
        <input
        type="number"
        min={0} max={100}
        value={value}
        onChange={e => {
            const v = e.target.value;
            if (v === "") { onChange(""); return; }
            const n = Math.min(100, Math.max(0, Number(v)));
            onChange(n);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder="—"
        className={`w-full text-center py-1.5 rounded-xl border text-sm font-black outline-none transition-all
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
            disabled:opacity-40 disabled:cursor-not-allowed`}
            style={{
                background: "var(--bg)",
            borderColor: focused ? color : "var(--brd)",
            color: value !== "" ? color : "var(--t2)",
            boxShadow: focused ? `0 0 0 2px ${color}30` : "none",
            }}
            />
            </div>
            </div>
    );
}

// ── Submission card ───────────────────────────────────────────────────────────

function SubmissionCard({
    work,
    isActive,
    onSelect,
    juryId,
}: {
    work: SubmissionWork;
    isActive: boolean;
    onSelect: () => void;
    juryId: string;
}) {
    const total = work.total_score ?? (work.criteria.some(c => c.score !== "") ? computeTotal(work.criteria) : undefined);

    const statusIcon =
    work.status === "evaluated"   ? <CheckCircle2 size={14} className="text-green-500" /> :
    work.status === "in_progress" ? <Clock        size={14} className="text-amber-500" /> :
    <AlertCircle size={14} className="text-(--t2) opacity-40" />;

    const statusLabel =
    work.status === "evaluated"   ? "Оцінено" :
    work.status === "in_progress" ? "В процесі" :
    "Не оцінено";

        return (
            <button
            onClick={onSelect}
            className={`w-full text-left p-4 rounded-2xl border transition-all group ${
                isActive
                ? "border-blue-600 bg-blue-600/8 shadow-md shadow-blue-600/10"
                : "border-(--brd) bg-(--card) hover:border-blue-600/40 hover:bg-(--bg)"
            }`}
            >
            <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
            <p className={`font-black text-sm truncate ${isActive ? "text-blue-600" : "text-(--t1) group-hover:text-blue-600 transition-colors"}`}>
            {work.team_name}
            </p>
            {work.team_org && (
                <p className="text-[10px] font-bold text-(--t2) truncate mt-0.5">{work.team_org}</p>
            )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
            {statusIcon}
            {total !== undefined && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                    total >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
                    total >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
                    "text-amber-500 bg-amber-500/10 border-amber-500/20"
                }`}>
                {total}
                </span>
            )}
            </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-widest ${
                work.status === "evaluated"   ? "text-green-500" :
                work.status === "in_progress" ? "text-amber-500" :
                "text-(--t2) opacity-60"
            }`}>
            {statusLabel}
            </span>
            <span className="text-[9px] text-(--t2) opacity-40">·</span>
            <span className="text-[9px] font-bold text-(--t2) opacity-60">
            {fmtDate(work.submitted_at)}
            </span>
            </div>
            </button>
        );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JuryEvaluationPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const params = useParams();
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const roundId = params?.id as string;

    // -- Data --
    const [round, setRound] = useState<RoundInfo | null>(null);
    const [works, setWorks] = useState<SubmissionWork[]>([]);
    const [stats, setStats] = useState<DistributionStats>({ total: 0, distributed: 0, evaluated: 0 });
    const [pageLoading, setPageLoading] = useState(true);

    // -- UI --
    const [activeIdx, setActiveIdx] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [redistributing, setRedistributing] = useState(false);
    const [showAllInfo, setShowAllInfo] = useState(false);
    const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isJury     = user?.role === "jury";
    const isAdmin    = user?.role === "admin" || user?.role === "superadmin";
    const canAccess  = isJury || isAdmin;

    // ── Access guard ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !user) { router.push("/login"); return; }
        if (!authLoading && user && !canAccess) { router.push("/dashboard"); }
    }, [authLoading, user, canAccess, router]);

    // ── Fetch round + submissions ─────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!roundId || !user) return;
        setPageLoading(true);

        const API_URL = window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : "https://turing-backend.onrender.com";

        try {
            // 1. Round info (через Supabase — публічні дані)
            const { data: roundData } = await supabase
            .from("rounds")
            .select("id, number, name, tournament_id, end_at, status")
            .eq("id", roundId)
            .single();
            if (!roundData) throw new Error("Раунд не знайдено");

            // Tournament name
            let tournamentName = "";
            if (roundData.tournament_id) {
                const { data: tData } = await supabase
                .from("tournaments")
                .select("name")
                .eq("id", roundData.tournament_id)
                .single();
                tournamentName = tData?.name ?? "";
            }
            setRound({ ...roundData, tournament_name: tournamentName });

            // 2. Submissions — через бекенд (перевіряє JWT і права журі)
            const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
            const subsRes = await fetch(`${API_URL}/api/rounds/${roundId}/submissions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!subsRes.ok) {
                const err = await subsRes.json().catch(() => ({}));
                throw new Error(err.detail ?? `Помилка ${subsRes.status}`);
            }
            const subsJson = await subsRes.json();
            const assignedSubmissions: any[] = subsJson.submissions ?? [];

            // Загальна кількість submissions раунду (для статистики адміна)
            const { count: totalCount } = await supabase
            .from("submissions")
            .select("id", { count: "exact", head: true })
            .eq("round_id", roundId)
            .neq("status", "draft");

            if (assignedSubmissions.length === 0) {
                setWorks([]);
                setStats({ total: totalCount ?? 0, distributed: 0, evaluated: 0 });
                setPageLoading(false);
                return;
            }

            // 3. Load existing evaluations
            const submissionIds = assignedSubmissions.map((s: any) => s.id);
            const { data: evalsData } = await supabase
            .from("jury_evaluations")
            .select("submission_id, criteria_scores, general_comment, total_score")
            .eq("jury_id", user.id)
            .in("submission_id", submissionIds);
            const evalMap: Record<string, any> = {};
            (evalsData ?? []).forEach((e: any) => { evalMap[e.submission_id] = e; });

            // 4. Build work list (team_name/team_org вже є в відповіді бекенду)
            const workList: SubmissionWork[] = assignedSubmissions.map((s: any) => {
                const existingEval = evalMap[s.id];
                let criteria = buildDefaultCriteria();
                let general_comment = "";
                let total_score: number | undefined;
                let status: SubmissionWork["status"] = "not_evaluated";

                if (existingEval) {
                    const saved: Record<string, { score: number; comment: string }> = existingEval.criteria_scores ?? {};
                    criteria = criteria.map(c => ({
                        ...c,
                        score: saved[c.key]?.score ?? "",
                        comment: saved[c.key]?.comment ?? "",
                    }));
                    general_comment = existingEval.general_comment ?? "";
                    total_score = existingEval.total_score;
                    const allFilled = criteria.every(c => c.score !== "");
                    status = allFilled ? "evaluated" : "in_progress";
                }

                return {
                    id: s.id,
                    team_id: s.team_id,
                    team_name: s.team_name ?? "Команда",
                    team_org: s.team_org,
                    round_id: s.round_id,
                    submitted_at: s.submitted_at,
                    github_url: s.github_url,
                    video_url: s.video_url,
                    status,
                    criteria,
                    general_comment,
                    total_score,
                };
            });

            setWorks(workList);
            setStats({
                total: totalCount ?? assignedSubmissions.length,
                distributed: assignedSubmissions.length,
                evaluated: workList.filter(w => w.status === "evaluated").length,
            });

            if (workList.length > 0 && activeIdx === null) setActiveIdx(0);
        } catch (e) {
            console.error(e);
        } finally {
            setPageLoading(false);
        }
        // FIX (середній): activeIdx прибрано з deps — перезавантаження даних при
        // зміні активної картки спричиняло зайві fetch-запити і скидало стан форми.
    }, [roundId, user, isJury]);

    useEffect(() => {
        if (!authLoading && user && canAccess) fetchData();
    }, [authLoading, user, canAccess]);

        // ── Active work mutations ─────────────────────────────────────────────────
        const updateCriterionScore = (criterionKey: string, score: number | "") => {
            if (activeIdx === null) return;
            setWorks(prev => prev.map((w, i) => {
                if (i !== activeIdx) return w;
                const criteria = w.criteria.map(c =>
                c.key === criterionKey ? { ...c, score } : c
                );
                const allFilled = criteria.every(c => c.score !== "");
                return { ...w, criteria, status: allFilled ? "evaluated" : "in_progress" };
            }));
        };

        const updateCriterionComment = (criterionKey: string, comment: string) => {
            if (activeIdx === null) return;
            setWorks(prev => prev.map((w, i) => {
                if (i !== activeIdx) return w;
                const criteria = w.criteria.map(c =>
                c.key === criterionKey ? { ...c, comment } : c
                );
                return { ...w, criteria };
            }));
        };

        const updateGeneralComment = (comment: string) => {
            if (activeIdx === null) return;
            setWorks(prev => prev.map((w, i) =>
            i === activeIdx ? { ...w, general_comment: comment } : w
            ));
        };

        // ── Save evaluation ───────────────────────────────────────────────────────
        const handleSave = async () => {
            if (activeIdx === null || !user) return;
            const work = works[activeIdx];
            setSaving(true);
            setSaveMsg(null);
            try {
                const criteriaScores: Record<string, { score: number | ""; comment: string }> = {};
                work.criteria.forEach(c => { criteriaScores[c.key] = { score: c.score, comment: c.comment }; });
                const total = computeTotal(work.criteria);

                // FIX (середній): замість прямого запису в supabase з клієнта —
                // відправляємо на бекенд-ендпоінт з JWT-авторизацією.
                // Це запобігає маніпуляціям через DevTools (обхід перевірки журі).
                const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
                const API_URL = window.location.hostname === "localhost"
                ? "http://localhost:8000"
                : "https://site-turing-crutchmasters-team-s.onrender.com";

                const res = await fetch(`${API_URL}/api/rounds/${work.round_id}/evaluate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        submission_id:   work.id,
                        criteria_scores: criteriaScores,
                        general_comment: work.general_comment,
                        total_score:     total,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.detail ?? `HTTP ${res.status}`);
                }

                // Update local total + status
                setWorks(prev => prev.map((w, i) => {
                    if (i !== activeIdx) return w;
                    const allFilled = w.criteria.every(c => c.score !== "");
                    return { ...w, total_score: total, status: allFilled ? "evaluated" : "in_progress" };
                }));
                setStats(prev => ({
                    ...prev,
                    evaluated: works.filter((w, i) => {
                        if (i === activeIdx) return work.criteria.every(c => c.score !== "");
                        return w.status === "evaluated";
                    }).length,
                }));

                if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current);
                setSaveMsg({ type: "ok", text: "Оцінку збережено ✓" });
                saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 3000);
            } catch (e: any) {
                setSaveMsg({ type: "err", text: e?.message ?? "Помилка збереження" });
            } finally {
                setSaving(false);
            }
        };

        // ── Redistribute (admin only) ─────────────────────────────────────────────
        const handleRedistribute = async () => {
            if (!isAdmin || !roundId) return;
            setRedistributing(true);
            try {
                // FIX (середній): ендпоінт /api/rounds/{id}/redistribute не існує в бекенді.
                // Поки не реалізовано — показуємо повідомлення замість 404-помилки.
                // TODO: реалізувати POST /api/rounds/{round_id}/redistribute в main.py
                console.warn("[handleRedistribute] ендпоінт ще не реалізований на бекенді");
                setSaveMsg({ type: "err", text: "Функція перерозподілу ще не реалізована на сервері" });
                await fetchData();
            } catch (e) {
                console.error(e);
            } finally {
                setRedistributing(false);
            }
        };

        // ── Render guards ─────────────────────────────────────────────────────────
        if (authLoading || (!user && !authLoading)) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        const activeWork = activeIdx !== null ? works[activeIdx] : null;
        const activeTotal = activeWork ? computeTotal(activeWork.criteria) : 0;
        const allCriteriaFilled = activeWork?.criteria.every(c => c.score !== "") ?? false;

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
                @keyframes cardDrop { from{opacity:0;transform:translateY(-12px) scale(.98)} to{opacity:1;transform:none} }
                @keyframes scoreGlow { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0)} 50%{box-shadow:0 0 12px 2px rgba(59,130,246,0.18)} }
                .fuIn { animation: fadeUp   300ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: cardDrop 380ms cubic-bezier(.22,1,.36,1) both }
                .score-glow { animation: scoreGlow 2s ease-in-out infinite }
                input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--t1); border: 2px solid var(--card); cursor: pointer; }
                `}} />

                {/* Watermark */}
                <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
                </div>

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
                title="Оцінювання"
                icon={<Star size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-5 uppercase tracking-widest text-(--t2) flex-wrap">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
                <ChevronRight size={10} />
                <button onClick={() => round && router.push(`/tournaments/${round.tournament_id}`)} className="hover:text-blue-600 transition-colors truncate max-w-[100px]">
                {round?.tournament_name ?? "Турнір"}
                </button>
                <ChevronRight size={10} />
                <span className="text-(--t1) truncate max-w-[120px]">{round ? `Раунд ${round.number}` : "..."} — Оцінювання</span>
                </nav>

                <div className="flex items-center gap-3 mb-6">
                <button
                onClick={() => round && router.push(`/rounds/${round.id}`)}
                className="flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors group"
                >
                <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Назад до раунду
                </button>
                <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-(--t1) uppercase tracking-tight truncate">
                ⚖️ Оцінювання робіт
                </h1>
                {round && (
                    <p className="text-[11px] font-bold text-(--t2) uppercase tracking-widest mt-0.5">
                    {round.tournament_name} · Раунд {round.number}: {round.name}
                    </p>
                )}
                </div>
                </div>

                {pageLoading ? (
                    <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Завантаження...</p>
                    </div>
                    </div>
                ) : (
                    <div className="flex flex-col xl:flex-row gap-5 items-start w-full">

                    {/* ══ LEFT — Submission list + Stats ═══════════════════════════ */}
                    <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col gap-4">

                    {/* Stats card */}
                    <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-(--brd) bg-(--bg)/40">
                    <BarChart2 size={14} className="text-blue-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-(--t1)">
                    {isAdmin ? "Загальний стан розподілу" : "Мої роботи до оцінки"}
                    </span>
                    </div>
                    <div className="p-4 grid grid-cols-3 gap-3">
                    {[
                        { label: "Всього робіт",  value: stats.total,       color: "text-(--t1)" },
                     { label: "Розподілено",   value: stats.distributed, color: "text-blue-600" },
                     { label: "Оцінено",       value: stats.evaluated,   color: "text-green-500" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-(--bg) border border-(--brd)">
                        <span className={`text-xl font-black ${color}`}>{value}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-(--t2) text-center leading-tight">{label}</span>
                        </div>
                    ))}
                    </div>
                    {/* Progress bar */}
                    <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Прогрес оцінення</span>
                    <span className="text-[9px] font-black text-blue-600">
                    {stats.distributed > 0 ? Math.round((stats.evaluated / stats.distributed) * 100) : 0}%
                    </span>
                    </div>
                    <div className="h-2 rounded-full bg-(--brd) overflow-hidden">
                    <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-700"
                    style={{ width: `${stats.distributed > 0 ? (stats.evaluated / stats.distributed) * 100 : 0}%` }}
                    />
                    </div>
                    </div>
                    {/* Admin redistribute */}
                    {isAdmin && (
                        <div className="px-4 pb-4">
                        <button
                        onClick={handleRedistribute}
                        disabled={redistributing}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-50"
                        >
                        {redistributing
                            ? <><Loader size={12} className="animate-spin" /> Розподіл...</>
                            : <><Shuffle size={12} /> Перерозподілити роботи вручну</>
                        }
                        </button>
                        </div>
                    )}
                    </div>

                    {/* Submission list */}
                    <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-(--brd) bg-(--bg)/40">
                    <Users size={14} className="text-blue-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-(--t1)">
                    Роботи ({works.length})
                    </span>
                    </div>
                    <div className="p-3 max-h-[420px] xl:max-h-[calc(100vh-380px)] overflow-y-auto space-y-2">
                    {works.length === 0 ? (
                        <div className="flex flex-col items-center py-10 gap-3">
                        <Shield size={28} className="text-(--t2) opacity-30" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-(--t2) text-center">
                        {isJury ? "Вам ще не призначено робіт для оцінювання" : "Немає поданих робіт"}
                        </p>
                        </div>
                    ) : (
                        works.map((work, idx) => (
                            <SubmissionCard
                            key={work.id}
                            work={work}
                            isActive={activeIdx === idx}
                            onSelect={() => setActiveIdx(idx)}
                            juryId={user?.id ?? ""}
                            />
                        ))
                    )}
                    </div>
                    </div>

                    </div>

                    {/* ══ RIGHT — Evaluation form ═══════════════════════════════════ */}
                    <div className="flex-1 min-w-0 flex flex-col gap-4">

                    {activeWork ? (
                        <>
                        {/* Work header */}
                        <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-xl flex-shrink-0">
                        {activeWork.team_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                        <h2 className="font-black text-(--t1) text-base sm:text-lg uppercase tracking-tight">
                        {activeWork.team_name}
                        </h2>
                        {activeWork.team_org && (
                            <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider mt-0.5">
                            {activeWork.team_org}
                            </p>
                        )}
                        </div>
                        {/* Total score display */}
                        <div className="flex flex-col items-end gap-1">
                        <div className={`score-glow text-3xl font-black px-4 py-1 rounded-2xl border ${
                            activeTotal >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
                            activeTotal >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
                            activeTotal >  0  ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
                            "text-(--t2) bg-(--bg) border-(--brd)"
                        }`}>
                        {activeWork.criteria.every(c => c.score !== "") || activeTotal > 0 ? activeTotal : "—"}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Підсумкова оцінка (авто)</span>
                        </div>
                        </div>

                        {/* Submission links */}
                        <div className="flex flex-wrap gap-2 mt-3">
                        {activeWork.github_url && (
                            <a
                            href={activeWork.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95"
                            >
                            <Github size={12} /> GitHub
                            </a>
                        )}
                        {activeWork.video_url && (
                            <a
                            href={activeWork.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95"
                            >
                            <Video size={12} /> Відео
                            </a>
                        )}
                        {!activeWork.github_url && !activeWork.video_url && (
                            <span className="text-[10px] font-bold text-(--t2) opacity-50 italic">Посилання не додані</span>
                        )}
                        <span className="ml-auto text-[9px] font-bold text-(--t2) opacity-50 self-center">
                        Здано: {fmtDate(activeWork.submitted_at)}
                        </span>
                        </div>
                        </div>
                        </div>
                        </div>

                        {/* Criteria scores */}
                        <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm overflow-hidden" style={{ animationDelay: "50ms" }}>
                        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-(--brd) bg-(--bg)/40">
                        <Award size={14} className="text-blue-600" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-(--t1)">
                        Форма оцінки (по категоріях)
                        </h3>
                        </div>

                        {/* Criteria table header */}
                        <div className="hidden sm:grid grid-cols-[1fr_40px_1fr_96px] gap-3 px-5 sm:px-6 py-3 border-b border-(--brd) bg-(--bg)/20">
                        {["Категорія", "Вага", "Оцінка (0–100)", "Коментар"].map(h => (
                            <span key={h} className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{h}</span>
                        ))}
                        </div>

                        <div className="divide-y divide-(--brd)">
                        {activeWork.criteria.map((crit, ci) => (
                            <div key={crit.key} className="fuIn px-5 sm:px-6 py-4" style={{ animationDelay: `${ci * 40}ms` }}>
                            {/* Mobile: stacked layout */}
                            <div className="sm:hidden mb-3 flex items-center justify-between">
                            <span className="text-sm font-black text-(--t1)">{crit.label}</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-600/20">
                            {crit.weight}%
                            </span>
                            </div>
                            {/* Desktop: grid */}
                            <div className="hidden sm:grid grid-cols-[1fr_40px_1fr_96px] gap-3 items-center">
                            <span className="text-sm font-bold text-(--t1)">{crit.label}</span>
                            <span className="text-[10px] font-black text-center text-blue-600 bg-blue-600/8 rounded-lg py-1">{crit.weight}%</span>
                            <ScoreInput
                            value={crit.score}
                            onChange={v => updateCriterionScore(crit.key, v)}
                            />
                            <input
                            type="text"
                            placeholder="Коментар..."
                            value={crit.comment}
                            onChange={e => updateCriterionComment(crit.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-(--t2)/40"
                            />
                            </div>
                            {/* Mobile score + comment */}
                            <div className="sm:hidden space-y-2">
                            <ScoreInput
                            value={crit.score}
                            onChange={v => updateCriterionScore(crit.key, v)}
                            />
                            <input
                            type="text"
                            placeholder="Коментар..."
                            value={crit.comment}
                            onChange={e => updateCriterionComment(crit.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                            />
                            </div>
                            </div>
                        ))}
                        </div>

                        {/* Total row */}
                        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t-2 border-(--brd) bg-(--bg)/30">
                        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
                        Підсумкова оцінка (авто)
                        </span>
                        <div className="flex items-center gap-3">
                        {/* Visual bar */}
                        <div className="hidden sm:flex items-center gap-2">
                        <div className="relative w-32 h-2 rounded-full bg-(--brd) overflow-hidden">
                        <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                            width: `${activeTotal}%`,
                            background: activeTotal >= 80 ? "#22c55e" : activeTotal >= 50 ? "#3b82f6" : "#f59e0b",
                        }}
                        />
                        </div>
                        </div>
                        <span className={`text-2xl font-black ${
                            !allCriteriaFilled      ? "text-(--t2)" :
                            activeTotal >= 80       ? "text-green-500" :
                            activeTotal >= 50       ? "text-blue-500" :
                            "text-amber-500"
                        }`}>
                        {allCriteriaFilled ? activeTotal : "—"}
                        </span>
                        <span className="text-[9px] font-bold text-(--t2) uppercase">/ 100</span>
                        </div>
                        </div>
                        </div>

                        {/* General comment */}
                        <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm p-5 sm:p-6" style={{ animationDelay: "100ms" }}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3">
                        Опціональний загальний коментар
                        </label>
                        <textarea
                        rows={3}
                        placeholder="Загальні враження від роботи, рекомендації..."
                        value={activeWork.general_comment}
                        onChange={e => updateGeneralComment(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all resize-none placeholder:text-(--t2)/40"
                        />
                        </div>

                        {/* Action bar */}
                        <div className="cdIn flex flex-col sm:flex-row items-start sm:items-center gap-3" style={{ animationDelay: "130ms" }}>
                        {/* Save button */}
                        <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                            saving
                            ? "bg-(--brd) text-(--t2) cursor-not-allowed shadow-none"
                            : allCriteriaFilled
                            ? "bg-green-600 text-white hover:bg-green-700 shadow-green-600/25"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/25"
                        }`}
                        >
                        {saving
                            ? <><Loader size={14} className="animate-spin" /> Збереження...</>
                            : allCriteriaFilled
                            ? <><CheckCircle2 size={14} /> Зберегти оцінку</>
                            : <><Save size={14} /> Зберегти оцінку</>
                        }
                        </button>

                        {/* Cancel (reset to saved) */}
                        <button
                        onClick={() => { fetchData(); setSaveMsg(null); }}
                        className="flex items-center gap-2 px-5 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) hover:text-(--t1) active:scale-95 transition-all"
                        >
                        <RefreshCw size={14} /> Відмінити
                        </button>

                        {/* Status message */}
                        {saveMsg && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest ${
                                saveMsg.type === "ok"
                                ? "bg-green-500/10 border border-green-500/20 text-green-500"
                                : "bg-red-500/10 border border-red-500/20 text-red-500"
                            }`}>
                            {saveMsg.type === "ok"
                                ? <CheckCircle2 size={13} />
                                : <AlertCircle size={13} />
                            }
                            {saveMsg.text}
                            </div>
                        )}

                        {/* Navigate prev/next */}
                        <div className="flex items-center gap-2 ml-auto">
                        <button
                        onClick={() => setActiveIdx(i => (i !== null && i > 0) ? i - 1 : i)}
                        disabled={activeIdx === 0 || activeIdx === null}
                        className="px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-30"
                        >
                        ← Попередня
                        </button>
                        <button
                        onClick={() => setActiveIdx(i => (i !== null && i < works.length - 1) ? i + 1 : i)}
                        disabled={activeIdx === works.length - 1 || activeIdx === null}
                        className="px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-30"
                        >
                        Наступна →
                        </button>
                        </div>
                        </div>
                        </>
                    ) : (
                        /* Empty state */
                        <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm flex flex-col items-center justify-center py-24 text-center gap-4 px-8">
                        <div className="w-16 h-16 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center">
                        <Star size={28} className="text-(--t2) opacity-30" />
                        </div>
                        <p className="font-black text-(--t1) text-base uppercase">
                        {works.length === 0
                            ? "Немає робіт для оцінювання"
                            : "Оберіть роботу зі списку"
                        }
                        </p>
                        <p className="text-sm text-(--t2) max-w-xs">
                        {works.length === 0 && isJury
                            ? "Адміністратор ще не розподілив роботи між журі. Очікуйте повідомлення."
                            : "Натисніть на картку команди зліва, щоб розпочати оцінювання"
                        }
                        </p>
                        </div>
                    )}
                    </div>
                    </div>
                )}
                </div>
                </main>
                </div>
        );
}
