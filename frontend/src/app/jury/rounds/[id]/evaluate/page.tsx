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
    Clock, Shield, Zap, Award, X, FileText,
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
    team_avatar_url?: string;
    round_id: string;
    submitted_at: string;
    github_url?: string;
    youtube_url?: string;
    live_url?: string;
    files?: { name: string; path: string; url: string | null }[];
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

// ── Readme Modal ──────────────────────────────────────────────────────────────

function ReadmeModal({ url, onClose }: { url: string; onClose: () => void }) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(url)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        })
        .then(text => { setContent(text); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    }, [url]);

    // Simple markdown → HTML renderer (no external dep)
    const renderMarkdown = (md: string): string => {
        return md
        // Escape HTML
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        // Code blocks
        .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="md-pre"><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
        // Headings
        .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>')
        // Images
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />')
        // Horizontal rule
        .replace(/^---$/gm, '<hr class="md-hr" />')
        // Unordered lists
        .replace(/^\s*[-*+] (.+)$/gm, '<li class="md-li">$1</li>')
        .replace(/(<li[\s\S]*?<\/li>)(\s*(?!<li))/g, '<ul class="md-ul">$1</ul>$2')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')
        .replace(/(<li class="md-oli"[\s\S]*?<\/li>)(\s*(?!<li))/g, '<ol class="md-ol">$1</ol>$2')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')
        // Paragraphs (lines not already wrapped)
        .replace(/^(?!<[hupoba]|<li|<pre|<blockquote|<hr)(.+)$/gm, '<p class="md-p">$1</p>')
        // Clean up empty lines
        .replace(/\n{2,}/g, '\n');
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
        <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-[2rem] border border-(--brd) shadow-2xl overflow-hidden"
        style={{ background: "var(--card)" }}
        >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd)" style={{ background: "var(--bg)" }}>
        <FileText size={16} className="text-blue-600 flex-shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-(--t1) flex-1">README</span>
        <button
        onClick={onClose}
        className="w-8 h-8 rounded-xl flex items-center justify-center border border-(--brd) text-(--t2) hover:text-(--t1) hover:border-blue-600/40 transition-all active:scale-95"
        >
        <X size={14} />
        </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && (
            <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )}
        {error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm font-bold text-(--t2)">Не вдалося завантажити файл</p>
            <p className="text-xs text-(--t2) opacity-60">{error}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-blue-600 hover:underline mt-1">Відкрити напряму ↗</a>
            </div>
        )}
        {!loading && !error && content !== null && (
            <div
            className="md-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
        )}
        </div>
        </div>
        <style>{`
            .md-body { color: var(--t1); font-size: 14px; line-height: 1.7; }
            .md-h1 { font-size: 1.6em; font-weight: 900; margin: 1.2em 0 0.5em; color: var(--t1); }
            .md-h2 { font-size: 1.3em; font-weight: 900; margin: 1em 0 0.4em; color: var(--t1); border-bottom: 1px solid var(--brd); padding-bottom: 0.3em; }
            .md-h3 { font-size: 1.1em; font-weight: 800; margin: 0.8em 0 0.3em; color: var(--t1); }
            .md-p { margin: 0.5em 0; color: var(--t2); }
            .md-pre { background: var(--bg); border: 1px solid var(--brd); border-radius: 12px; padding: 14px 16px; overflow-x: auto; margin: 0.8em 0; font-size: 12px; line-height: 1.5; }
            .md-pre code { background: none; padding: 0; border: none; font-family: monospace; }
            .md-code { background: var(--bg); border: 1px solid var(--brd); border-radius: 6px; padding: 1px 6px; font-size: 12px; font-family: monospace; color: #3b82f6; }
            .md-link { color: #3b82f6; text-decoration: underline; text-underline-offset: 2px; }
            .md-img { max-width: 100%; border-radius: 10px; margin: 0.5em 0; }
            .md-hr { border: none; border-top: 1px solid var(--brd); margin: 1.2em 0; }
            .md-ul, .md-ol { padding-left: 1.5em; margin: 0.4em 0; }
            .md-li, .md-oli { margin: 0.2em 0; color: var(--t2); }
            .md-blockquote { border-left: 3px solid #3b82f6; padding-left: 1em; margin: 0.6em 0; color: var(--t2); opacity: 0.8; font-style: italic; }
            `}</style>
            </div>
    );
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
        {/* Track wrapper */}
        <div className="relative flex-1 flex items-center" style={{ height: 24 }}>
        {/* Background track */}
        <div className="absolute inset-x-0 h-2 rounded-full" style={{ top: "50%", transform: "translateY(-50%)", background: "var(--brd)" }} />
        {/* Fill track — no transition, syncs with thumb instantly */}
        <div
        className="absolute left-0 h-2 rounded-full pointer-events-none"
        style={{ top: "50%", transform: "translateY(-50%)", width: `${num}%`, background: color }}
        />
        <input
        type="range"
        min={0} max={100} step={1}
        value={num}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="absolute inset-0 w-full cursor-pointer disabled:cursor-not-allowed"
        style={{ height: "100%", opacity: 1, background: "transparent", WebkitAppearance: "none", appearance: "none" }}
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
            fontVariantNumeric: "tabular-nums",
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
            <div className="flex items-start gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 mt-0.5">
            {work.team_avatar_url
                ? <img src={work.team_avatar_url} alt={work.team_name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-blue-600/10 text-blue-600 flex items-center justify-center text-xs font-black">{work.team_name.charAt(0).toUpperCase()}</div>
            }
            </div>
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
            <span className={`text-[10px] font-black rounded-lg border ${
                total === undefined ? "text-transparent border-transparent bg-transparent" :
                total >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
                total >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
                "text-amber-500 bg-amber-500/10 border-amber-500/20"
            }`} style={{ width: 40, textAlign: "center", padding: "2px 0", fontVariantNumeric: "tabular-nums", display: "inline-block" }}>
            {total !== undefined ? total : ""}
            </span>
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
    const [readmeModal, setReadmeModal] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<"list" | "form">("list");
    const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isJury     = user?.role === "jury";
    const isAdmin    = user?.role === "admin" || user?.role === "superadmin";
    const canAccess  = isJury || isAdmin;

    const API_URL = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

    // ── Access guard ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !user) { router.push("/login"); return; }
        if (!authLoading && user && !canAccess) { router.push("/dashboard"); }
    }, [authLoading, user, canAccess, router]);

    // ── Fetch round + submissions ─────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!roundId || !user) return;
        setPageLoading(true);


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
            // Токен беремо з localStorage (актуальніший ніж сесія Supabase)
            const freshToken = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null)
            ?? (await supabase.auth.getSession()).data.session?.access_token ?? "";
            const subsRes = await fetch(`${API_URL}/api/rounds/${roundId}/submissions`, {
                headers: { Authorization: `Bearer ${freshToken}` },
            });
            if (!subsRes.ok) {
                const err = await subsRes.json().catch(() => ({}));
                throw new Error(err.detail ?? `Помилка ${subsRes.status}`);
            }
            const subsJson = await subsRes.json();
            const assignedSubmissions: any[] = subsJson.submissions ?? [];

            // Загальна кількість submissions раунду (для статистики)
            const totalCount = assignedSubmissions.length;

            if (assignedSubmissions.length === 0) {
                setWorks([]);
                setStats({ total: 0, distributed: 0, evaluated: 0 });
                setPageLoading(false);
                return;
            }

            // 3. Build work list — бекенд вже повертає my_evaluation для журі,
            //    тому окремого запиту до jury_evaluations не потрібно.
            const workList: SubmissionWork[] = assignedSubmissions.map((s: any) => {
                // my_evaluation присутній якщо роль === "jury", інакше null
                const existingEval = s.my_evaluation ?? null;
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
                    team_avatar_url: s.team_avatar_url ?? undefined,
                    team_leader: s.team_leader ?? undefined,
                    round_id: s.round_id,
                    submitted_at: s.submitted_at,
                    github_url: s.github_url,
                    youtube_url: s.youtube_url,
                    live_url: s.live_url ?? undefined,
                    files: s.files ?? [],
                    status,
                    criteria,
                    general_comment,
                    total_score,
                };
            });

            // Fetch team avatars + captain from Supabase
            const teamIds = [...new Set(workList.map(w => w.team_id).filter(Boolean))];
            if (teamIds.length > 0) {
                const { data: teamsData } = await supabase
                .from("teams")
                .select("id, avatar_url, captain_id")
                .in("id", teamIds);
                if (teamsData) {
                    const avatarMap: Record<string, string> = {};
                    const captainIdMap: Record<string, string> = {};
                    teamsData.forEach((t: any) => {
                        if (t.avatar_url) avatarMap[t.id] = t.avatar_url;
                        if (t.captain_id) captainIdMap[t.id] = t.captain_id;
                    });
                        workList.forEach(w => {
                            if (avatarMap[w.team_id]) w.team_avatar_url = avatarMap[w.team_id];
                        });

                            // Fetch captain names from account table
                            const captainIds = [...new Set(Object.values(captainIdMap).filter(Boolean))];
                            if (captainIds.length > 0) {
                                const { data: accountsData } = await supabase
                                .from("account")
                                .select("id, username, login")
                                .in("id", captainIds);
                                if (accountsData) {
                                    const nameMap: Record<string, string> = {};
                                    accountsData.forEach((a: any) => { nameMap[a.id] = a.username || a.login || "—"; });
                                    workList.forEach(w => {
                                        const capId = captainIdMap[w.team_id];
                                        if (capId && nameMap[capId]) (w as any).team_leader = nameMap[capId];
                                    });
                                }
                            }
                }
            }

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
            setSaveMsg(null);
            try {
                const freshToken = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) ?? "";
                const res = await fetch(`${API_URL}/api/rounds/${roundId}/redistribute`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${freshToken}` },
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.detail ?? `HTTP ${res.status}`);
                setSaveMsg({ type: "ok", text: `Розподілено ${json.submissions} робіт між ${json.jury_count} журі` });
                if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current);
                saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 4000);
                await fetchData();
            } catch (e: any) {
                setSaveMsg({ type: "err", text: e?.message ?? "Помилка перерозподілу" });
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
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--t1); border: 3px solid var(--card); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.25); transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.2s ease; }
                input[type=range]:hover::-webkit-slider-thumb { transform: scale(1.25); box-shadow: 0 2px 10px rgba(59,130,246,0.45); }
                input[type=range]:active::-webkit-slider-thumb { transform: scale(0.92); transition: transform 0.12s cubic-bezier(0.34, 1.2, 0.64, 1), box-shadow 0.1s ease; }
                input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--t1); border: 3px solid var(--card); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.25); transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1); }
                html, body { max-width: 100vw; overflow-x: hidden; }
                @media (min-width: 480px) { .xs\\:inline { display: inline !important; } }
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

                <main className="flex-1 flex flex-col min-w-0 overflow-hidden max-w-full">
                <MobileHeader
                onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                title="Оцінювання"
                icon={<Star size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 relative z-10 w-full max-w-full">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-5 uppercase tracking-widest text-(--t2) flex-wrap overflow-hidden">
                <a href={"/"} onClick={(e) => { e.preventDefault(); router.push("/"); }} className="hover:text-blue-600 transition-colors flex-shrink-0">Головна</a>
                <ChevronRight size={10} className="flex-shrink-0" />
                <button onClick={() => round && router.push(`/tournaments/${round.tournament_id}`)} className="hover:text-blue-600 transition-colors truncate max-w-[80px]">
                {round?.tournament_name ?? "Турнір"}
                </button>
                <ChevronRight size={10} className="flex-shrink-0" />
                <span className="text-(--t1) truncate max-w-[100px]">{round ? `Раунд ${round.number}` : "..."} — Оцінювання</span>
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
                ) : round && round.status !== "finished" ? (
                    /* Round not finished — block evaluation */
                    <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2rem] border border-amber-500/30 shadow-sm flex flex-col items-center justify-center py-20 text-center gap-5 px-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Clock size={30} className="text-amber-500" />
                    </div>
                    <div>
                    <p className="font-black text-(--t1) text-lg uppercase tracking-tight mb-2">
                    Раунд ще не завершено
                    </p>
                    <p className="text-sm text-(--t2) max-w-sm leading-relaxed">
                    Оцінювання робіт відкриється після закінчення раунду.
                    {round.end_at && (
                        <span className="block mt-2 font-bold text-amber-500">
                        Кінець раунду: {fmtDate(round.end_at)}
                        </span>
                    )}
                    </p>
                    </div>
                    <div className="px-5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-500">
                    Статус раунду: {round.status === "active" ? "Активний" : round.status === "pending" ? "Очікується" : round.status}
                    </div>
                    </div>
                ) : (
                    <div className="flex flex-col xl:flex-row gap-4 w-full">

                    {/* ══ Mobile tab switcher ══════════════════════════════════════ */}
                    <div className="xl:hidden w-full flex rounded-2xl border border-(--brd) bg-(--card) p-1 gap-1">
                    <button
                    onClick={() => setMobileTab("list")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        mobileTab === "list" ? "bg-blue-600 text-white shadow-md" : "text-(--t2) hover:text-(--t1)"
                    }`}
                    >
                    <Users size={13} /> Роботи ({works.length})
                    </button>
                    <button
                    onClick={() => setMobileTab("form")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        mobileTab === "form" ? "bg-blue-600 text-white shadow-md" : "text-(--t2) hover:text-(--t1)"
                    }`}
                    >
                    <Star size={13} />
                    <span className="truncate max-w-[110px]">{activeWork ? activeWork.team_name : "Оцінка"}</span>
                    {activeWork && (
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            activeWork.status === "evaluated" ? "bg-green-500" :
                            activeWork.status === "in_progress" ? "bg-amber-500" : "bg-(--brd)"
                        }`} />
                    )}
                    </button>
                    </div>

                    {/* ══ LEFT — Submission list + Stats ═══════════════════════════ */}
                    <div className={`w-full xl:w-[320px] flex-shrink-0 flex-col gap-4 ${mobileTab === "list" ? "flex" : "hidden xl:flex"}`}>

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
                        <div className="px-4 pb-4 flex flex-col gap-2">
                        <a
                        href={`/jury/rounds/${roundId}/distribute`} onClick={(e) => { e.preventDefault(); router.push(`/jury/rounds/${roundId}/distribute`); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-600/30 bg-blue-600/10 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600/20 active:scale-95 transition-all"
                        >
                        <Shuffle size={12} /> Ручний розподіл робіт
                        </a>
                        <button
                        onClick={handleRedistribute}
                        disabled={redistributing}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-orange-500/40 hover:text-orange-500 active:scale-95 transition-all disabled:opacity-50"
                        >
                        {redistributing
                            ? <><Loader size={12} className="animate-spin" /> Розподіл...</>
                            : <><RefreshCw size={12} /> Авто-перерозподіл</>
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
                            onSelect={() => { setActiveIdx(idx); setMobileTab("form"); }}
                            juryId={user?.id ?? ""}
                            />
                        ))
                    )}
                    </div>
                    </div>

                    </div>

                    {/* ══ RIGHT — Evaluation form ═══════════════════════════════════ */}
                    <div className={`flex-1 min-w-0 flex-col gap-4 ${mobileTab === "form" ? "flex" : "hidden xl:flex"}`}>

                    {activeWork ? (
                        <>
                        {/* ── Work header: team card + score island ── */}
                        <div className="cdIn flex flex-col sm:flex-row gap-3 items-stretch">

                        {/* MAIN INFO CARD */}
                        <div className="flex-1 min-w-0 bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm overflow-hidden">

                        {/* ── Mobile layout ── */}
                        <div className="sm:hidden">
                        {/* Top: avatar + team name + score */}
                        <div className="flex items-center gap-3 p-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-(--brd)">
                        {activeWork.team_avatar_url
                            ? <img src={activeWork.team_avatar_url} alt={activeWork.team_name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-black text-xl">{activeWork.team_name.charAt(0).toUpperCase()}</div>
                        }
                        </div>
                        <div className="flex-1 min-w-0">
                        <h2 className="font-black text-(--t1) text-base uppercase tracking-tight truncate">{activeWork.team_name}</h2>
                        {activeWork.team_org && <p className="text-[10px] font-bold text-(--t2) truncate">{activeWork.team_org}</p>}
                        {(activeWork as any).team_leader && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-bold text-(--t2) truncate max-w-[120px]">{(activeWork as any).team_leader}</span>
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">капітан</span>
                            </div>
                        )}
                        </div>
                        {/* Inline score badge */}
                        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl border font-black text-2xl ${
                            activeTotal >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
                            activeTotal >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
                            activeTotal >  0  ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
                            "text-(--t2) bg-(--bg) border-(--brd)"
                        }`} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {activeWork.criteria.every(c => c.score !== "") || activeTotal > 0 ? activeTotal : "—"}
                        </div>
                        </div>
                        {/* Bottom: link buttons row — icon-only on mobile, icon+text on sm+ */}
                        <div className="flex items-center gap-2 px-4 pb-4 border-t border-(--brd) pt-3">
                        {activeWork.github_url ? (
                            <a href={activeWork.github_url} target="_blank" rel="noopener noreferrer" title="GitHub"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-blue-600 hover:border-blue-600/40 active:scale-95 transition-all min-w-0">
                            <Github size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">GitHub</span>
                            </a>
                        ) : (
                            <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
                            <Github size={13} />
                            </span>
                        )}
                        {activeWork.youtube_url ? (
                            <a href={activeWork.youtube_url} target="_blank" rel="noopener noreferrer" title="YouTube"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-red-500 hover:border-red-500/40 active:scale-95 transition-all min-w-0">
                            <Video size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">YouTube</span>
                            </a>
                        ) : (
                            <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
                            <Video size={13} />
                            </span>
                        )}
                        {activeWork.live_url ? (
                            <a href={activeWork.live_url} target="_blank" rel="noopener noreferrer" title="Live Demo"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-green-500 hover:border-green-500/40 active:scale-95 transition-all min-w-0">
                            <Zap size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">Live</span>
                            </a>
                        ) : (
                            <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
                            <Zap size={13} />
                            </span>
                        )}
                        {(() => {
                            const rf = (activeWork.files ?? []).find(f => f.name?.toLowerCase().includes("readme") && f.url);
                            return rf?.url ? (
                                <button onClick={() => setReadmeModal(rf.url!)} title="README"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:text-blue-600 hover:border-blue-600/40 active:scale-95 transition-all min-w-0">
                                <Eye size={13} className="flex-shrink-0" /><span className="hidden xs:inline truncate">README</span>
                                </button>
                            ) : (
                                <span className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-(--brd) text-(--t2) opacity-30 cursor-not-allowed min-w-0">
                                <Eye size={13} />
                                </span>
                            );
                        })()}
                        </div>
                        </div>

                        {/* ── Desktop layout ── */}
                        <div className="hidden sm:flex items-stretch">
                        {/* LEFT — avatar + team info */}
                        <div className="flex items-center gap-4 p-5 sm:p-6 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-(--brd) shadow-md">
                        {activeWork.team_avatar_url
                            ? <img src={activeWork.team_avatar_url} alt={activeWork.team_name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-3xl">{activeWork.team_name.charAt(0).toUpperCase()}</div>
                        }
                        </div>
                        </div>
                        <div className="flex flex-col justify-center gap-1 min-w-0">
                        <h2 className="font-black text-(--t1) text-xl uppercase tracking-tight truncate">{activeWork.team_name}</h2>
                        {activeWork.team_org && <p className="text-[11px] font-bold text-(--t2) uppercase tracking-wider truncate">{activeWork.team_org}</p>}
                        {(activeWork as any).team_leader && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                            <Shield size={11} className="text-(--t2) flex-shrink-0" />
                            <span className="text-[11px] font-bold text-(--t2) truncate">{(activeWork as any).team_leader}</span>
                            <span className="ml-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">капітан</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={11} className="text-(--t2) flex-shrink-0" />
                        <span className="text-[11px] font-bold text-(--t2)">Здано: {fmtDate(activeWork.submitted_at)}</span>
                        </div>
                        </div>
                        </div>
                        {/* RIGHT — video + buttons */}
                        <div className="flex items-stretch border-l border-(--brd)">
                        <div className="flex flex-col items-center justify-center p-3 bg-(--bg)/40 gap-2">
                        <div className="w-28 h-[72px] rounded-xl overflow-hidden border border-(--brd) shadow-sm relative flex-shrink-0">
                        {activeWork.youtube_url ? (
                            <a href={activeWork.youtube_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full group">
                            <img src={`https://img.youtube.com/vi/${activeWork.youtube_url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1]}/hqdefault.jpg`} alt="preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"><Video size={12} className="text-white ml-0.5" /></div>
                            </div>
                            </a>
                        ) : (
                            <div className="w-full h-full bg-(--bg) flex flex-col items-center justify-center gap-1">
                            <Video size={16} className="text-(--t2) opacity-25" />
                            <span className="text-[8px] font-black uppercase text-(--t2) opacity-30 text-center leading-tight px-1">Відео відсутнє</span>
                            </div>
                        )}
                        </div>
                        {activeWork.youtube_url ? (
                            <a href={activeWork.youtube_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-(--bg) border border-(--brd) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 transition-all active:scale-95"><Video size={10} /> YouTube</a>
                        ) : (
                            <span className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-(--brd) text-(--t2) opacity-30 font-black text-[9px] uppercase tracking-widest cursor-not-allowed"><Video size={10} /> YouTube</span>
                        )}
                        </div>
                        <div className="flex flex-col justify-center gap-2 px-4 py-4 min-w-[120px]">
                        {activeWork.github_url ? (
                            <a href={activeWork.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95"><Github size={11} /> GitHub</a>
                        ) : (
                            <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) text-(--t2) opacity-30 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"><Github size={11} /> GitHub</span>
                        )}
                        {activeWork.live_url ? (
                            <a href={activeWork.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-green-500/40 hover:text-green-500 transition-all active:scale-95"><Zap size={11} /> Live Demo</a>
                        ) : (
                            <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) text-(--t2) opacity-30 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"><Zap size={11} /> Live Demo</span>
                        )}
                        {(() => {
                            const rf = (activeWork.files ?? []).find(f => f.name?.toLowerCase().includes("readme") && f.url);
                            return rf?.url ? (
                                <button onClick={() => setReadmeModal(rf.url!)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95"><Eye size={11} /> README</button>
                            ) : (
                                <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--brd) text-(--t2) opacity-30 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"><Eye size={11} /> README</span>
                            );
                        })()}
                        </div>
                        </div>
                        </div>

                        </div>

                        {/* SCORE ISLAND — hidden on mobile (shown inline above), visible on sm+ */}
                        <div className="hidden sm:flex flex-shrink-0 bg-(--card) rounded-2xl sm:rounded-[2rem] border border-(--brd) shadow-sm flex-col items-center justify-center px-6 py-5 gap-2" style={{ width: 140, minWidth: 140 }}>
                        <div className={`text-4xl font-black rounded-2xl border flex items-center justify-center ${
                            activeTotal >= 80 ? "text-green-500 bg-green-500/10 border-green-500/20" :
                            activeTotal >= 50 ? "text-blue-500 bg-blue-500/10 border-blue-500/20" :
                            activeTotal >  0  ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
                            "text-(--t2) bg-(--bg) border-(--brd)"
                        }`} style={{ width: 104, height: 60, fontVariantNumeric: "tabular-nums" }}>
                        {activeWork.criteria.every(c => c.score !== "") || activeTotal > 0 ? activeTotal : "—"}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-(--t2) text-center leading-tight">
                        Підсумкова<br/>оцінка (авто)
                        </span>
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
                        <div className="flex items-center gap-2">
                        <div style={{ width: 64, textAlign: "right" }}>
                        <span className={`text-2xl font-black ${
                            !allCriteriaFilled      ? "text-(--t2)" :
                            activeTotal >= 80       ? "text-green-500" :
                            activeTotal >= 50       ? "text-blue-500" :
                            "text-amber-500"
                        }`} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {allCriteriaFilled ? activeTotal : "—"}
                        </span>
                        </div>
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
                        <div className="cdIn flex flex-col gap-3" style={{ animationDelay: "130ms" }}>
                        {/* Save + Cancel */}
                        <div className="flex items-center gap-3">
                        <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
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
                        <button
                        onClick={() => { fetchData(); setSaveMsg(null); }}
                        className="flex items-center gap-2 px-4 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) hover:text-(--t1) active:scale-95 transition-all"
                        >
                        <RefreshCw size={14} /><span className="hidden sm:inline"> Відмінити</span>
                        </button>
                        {saveMsg && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest ${
                                saveMsg.type === "ok"
                                ? "bg-green-500/10 border border-green-500/20 text-green-500"
                                : "bg-red-500/10 border border-red-500/20 text-red-500"
                            }`}>
                            {saveMsg.type === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                            <span className="hidden sm:inline">{saveMsg.text}</span>
                            </div>
                        )}
                        </div>
                        {/* Prev / Next — full width on mobile */}
                        <div className="flex items-center gap-2">
                        <button
                        onClick={() => setActiveIdx(i => (i !== null && i > 0) ? i - 1 : i)}
                        disabled={activeIdx === 0 || activeIdx === null}
                        className="flex-1 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-30 text-center"
                        >
                        ← Попередня
                        </button>
                        <button
                        onClick={() => setActiveIdx(i => (i !== null && i < works.length - 1) ? i + 1 : i)}
                        disabled={activeIdx === works.length - 1 || activeIdx === null}
                        className="flex-1 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t2) font-black text-[10px] uppercase tracking-widest hover:border-blue-600/40 hover:text-blue-600 active:scale-95 transition-all disabled:opacity-30 text-center"
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
                {/* README Modal */}
                {readmeModal && (
                    <ReadmeModal url={readmeModal} onClose={() => setReadmeModal(null)} />
                )}
                </div>
        );
}

