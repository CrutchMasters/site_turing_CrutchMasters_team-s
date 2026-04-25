"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Clock, Calendar, ChevronLeft, Download, Upload,
    Link2, FileText, AlertCircle, CheckCircle2, Cpu, Loader2
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface RoundAttachment {
    id: string;
    name: string;
    url: string;
    type: "link" | "file";
}

interface Round {
    id: string;
    tournament_id: string;
    name: string;
    description?: string;
    criteria?: string;
    technologies?: string[];
    start_at?: string;
    end_at?: string;
    template_url?: string;
    attachments?: RoundAttachment[];
    status?: string;
}

interface Submission {
    id: string;
    round_id: string;
    team_id: string;
    submitted_at: string;
    status: string;
}

function useCountdown(endAt?: string) {
    const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, pct: 0 });

    useEffect(() => {
        if (!endAt) return;
        const tick = () => {
            const now = Date.now();
            const end = new Date(endAt).getTime();
            const diff = Math.max(0, end - now);
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTime({ days, hours, minutes, seconds, pct: diff > 0 ? 1 - diff / (end - Date.now() + diff) : 1 });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endAt]);

    return time;
}

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function TimeBlock({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5">
        <span
        style={{
            fontFamily: "'Barlow Condensed', var(--font-barlow), sans-serif",
            fontWeight: 700,
            fontSize: "1.6rem",
            lineHeight: 1,
            color: "var(--t1)",
        }}
        >
        {String(value).padStart(2, "0")}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
        </span>
        </div>
    );
}

export default function RoundPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [round, setRound] = useState<Round | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [userTeamId, setUserTeamId] = useState<string | null>(null);

    const countdown = useCountdown(round?.end_at);

    useEffect(() => { if (id) fetchRound(); }, [id]);
    useEffect(() => { if (user) fetchUserTeam(); }, [user]);

    const fetchRound = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
            .from("rounds")
            .select("*")
            .eq("id", id)
            .single();
            if (error) throw error;
            setRound(data);

            // fetch submission if team known
            if (userTeamId) fetchSubmission(data.id, userTeamId);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserTeam = async () => {
        if (!user) return;
        const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("captain_id", user.id)
        .single();
        if (data) {
            setUserTeamId(data.id);
            if (round) fetchSubmission(round.id, data.id);
        }
    };

    const fetchSubmission = async (roundId: string, teamId: string) => {
        const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("round_id", roundId)
        .eq("team_id", teamId)
        .maybeSingle();
        setSubmission(data ?? null);
    };

    const handleDownloadTemplate = async () => {
        if (!round?.template_url) return;
        const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
        const res = await fetch(`${API_URL}/api/rounds/${round.id}/template`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${round.name}_template.docx`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleSubmit = async () => {
        if (!user || !round || !userTeamId) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
            const res = await fetch(`${API_URL}/api/rounds/${round.id}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ team_id: userTeamId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Помилка при здачі завдання");
            }
            await fetchSubmission(round.id, userTeamId);
        } catch (e: any) {
            setSubmitError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const attachments: RoundAttachment[] = round?.attachments ?? [];
    const links = attachments.filter(a => a.type === "link");
    const files = attachments.filter(a => a.type === "file");
    const technologies: string[] = round?.technologies ?? [];

    // Timeline progress
    const startTs = round?.start_at ? new Date(round.start_at).getTime() : 0;
    const endTs = round?.end_at ? new Date(round.end_at).getTime() : 0;
    const nowTs = Date.now();
    const progressPct = (startTs && endTs && endTs > startTs)
    ? Math.min(100, Math.max(0, ((nowTs - startTs) / (endTs - startTs)) * 100))
    : 0;

    const cardStyle = {
        background: "var(--card)",
        border: "1px solid var(--brd)",
        borderRadius: "14px",
        padding: "20px",
    };

    if (loading) {
        return (
            <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
            <Sidebar />
            <main className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--t2)" }} />
            </main>
            </div>
        );
    }

    if (!round) {
        return (
            <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
            <Sidebar />
            <main className="flex-1 flex flex-col items-center justify-center gap-3">
            <AlertCircle size={36} style={{ color: "var(--t2)" }} />
            <p style={{ color: "var(--t2)" }}>Раунд не знайдено</p>
            <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ background: "var(--card)", color: "var(--t1)", border: "1px solid var(--brd)" }}
            >
            <ChevronLeft size={16} /> Назад
            </button>
            </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar />

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30">
        <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} />
        </div>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 pt-16 md:pt-8">
        {/* Back button */}
        <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 mb-5 text-sm transition-opacity hover:opacity-70"
        style={{ color: "var(--t2)" }}
        >
        <ChevronLeft size={16} />
        Назад до турніру
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ maxWidth: 1100 }}>

        {/* ═══════════ LEFT COLUMN ═══════════ */}
        <div className="flex flex-col gap-4">

        {/* ── Task card (name + description) ── */}
        <div style={{ ...cardStyle, minHeight: 180, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t2)", marginBottom: 6 }}>
        Завдання
        </p>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--t1)", lineHeight: 1.25 }}>
        {round.name}
        </h1>
        </div>

        {round.description ? (
            <div
            style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: 200,
                color: "var(--t2)",
                              fontSize: "0.875rem",
                              lineHeight: 1.65,
                              paddingRight: 4,
            }}
            >
            {round.description}
            </div>
        ) : (
            <p style={{ color: "var(--t2)", fontSize: "0.85rem", fontStyle: "italic" }}>Опис відсутній</p>
        )}
        </div>

        {/* ── Criteria card ── */}
        <div style={cardStyle}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t2)", marginBottom: 10 }}>
        Критерії оцінювання
        </p>
        {round.criteria ? (
            <div
            style={{
                overflowY: "auto",
                maxHeight: 160,
                color: "var(--t1)",
                           fontSize: "0.875rem",
                           lineHeight: 1.7,
                           paddingRight: 4,
                           whiteSpace: "pre-wrap",
            }}
            >
            {round.criteria}
            </div>
        ) : (
            <p style={{ color: "var(--t2)", fontSize: "0.85rem", fontStyle: "italic" }}>Критерії не вказані</p>
        )}
        </div>

        {/* ── Bottom action row ── */}
        <div className="flex items-center gap-3 flex-wrap">
        {/* Status badge */}
        <div
        style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            borderRadius: 10,
            background: submission
            ? (dark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)")
            : (dark ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.08)"),
            border: `1px solid ${submission ? "rgba(34,197,94,0.3)" : "var(--brd)"}`,
            fontSize: "0.8rem",
            fontWeight: 600,
            color: submission ? "#22c55e" : "var(--t2)",
            whiteSpace: "nowrap",
        }}
        >
        {submission ? (
            <><CheckCircle2 size={15} /> Здано</>
        ) : (
            <><AlertCircle size={15} /> Не здано</>
        )}
        </div>

        {/* Download template */}
        <button
        onClick={handleDownloadTemplate}
        disabled={!round.template_url}
        style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            borderRadius: 10,
            background: "var(--card)",
            border: "1px solid var(--brd)",
            color: "var(--t1)",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: round.template_url ? "pointer" : "not-allowed",
            opacity: round.template_url ? 1 : 0.45,
            whiteSpace: "nowrap",
            transition: "opacity 0.15s",
        }}
        className="hover:opacity-70"
        >
        <Download size={15} />
        Скачати шаблон
        </button>
        </div>
        </div>

        {/* ═══════════ RIGHT COLUMN ═══════════ */}
        <div className="flex flex-col gap-4">

        {/* ── Timer card ── */}
        <div style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t2)" }}>
        До завершення
        </p>
        <Clock size={15} style={{ color: "var(--t2)" }} />
        </div>

        {/* Countdown digits */}
        <div className="flex items-center gap-4 mb-4">
        <TimeBlock value={countdown.days} label="днів" />
        <span style={{ color: "var(--t2)", fontWeight: 700, fontSize: "1.4rem", marginTop: -6 }}>:</span>
        <TimeBlock value={countdown.hours} label="год" />
        <span style={{ color: "var(--t2)", fontWeight: 700, fontSize: "1.4rem", marginTop: -6 }}>:</span>
        <TimeBlock value={countdown.minutes} label="хв" />
        <span style={{ color: "var(--t2)", fontWeight: 700, fontSize: "1.4rem", marginTop: -6 }}>:</span>
        <TimeBlock value={countdown.seconds} label="сек" />
        </div>

        {/* Progress bar */}
        <div style={{ position: "relative", height: 6, borderRadius: 99, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 10 }}>
        <div
        style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${progressPct}%`,
            borderRadius: 99,
            background: progressPct > 80
            ? "linear-gradient(90deg,#f97316,#ef4444)"
            : "linear-gradient(90deg,#3b82f6,#6366f1)",
            transition: "width 1s linear",
        }}
        />
        {/* Dot */}
        <div
        style={{
            position: "absolute",
            top: "50%",
            left: `calc(${progressPct}% - 6px)`,
            transform: "translateY(-50%)",
            width: 12, height: 12,
            borderRadius: "50%",
            background: progressPct > 80 ? "#ef4444" : "#6366f1",
            border: "2px solid var(--card)",
            boxShadow: "0 0 0 2px rgba(99,102,241,0.3)",
            transition: "left 1s linear",
        }}
        />
        </div>

        {/* Start / End dates */}
        <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.72rem", color: "var(--t2)" }}>
        <Calendar size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
        {fmtDate(round.start_at)}
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--t2)" }}>
        {fmtDate(round.end_at)}
        <Calendar size={11} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }} />
        </span>
        </div>
        </div>

        {/* ── Technologies card ── */}
        <div style={cardStyle}>
        <div className="flex items-center gap-2 mb-3">
        <Cpu size={15} style={{ color: "var(--t2)" }} />
        <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t2)" }}>
        Технології
        </p>
        </div>
        {technologies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
            {technologies.map((tech, i) => (
                <span
                key={i}
                style={{
                    padding: "4px 12px",
                    borderRadius: 99,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    background: dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
                                            color: dark ? "#a5b4fc" : "#4f46e5",
                                            border: "1px solid rgba(99,102,241,0.2)",
                }}
                >
                {tech}
                </span>
            ))}
            </div>
        ) : (
            <p style={{ color: "var(--t2)", fontSize: "0.85rem", fontStyle: "italic" }}>Технології не вказані</p>
        )}
        </div>

        {/* ── Attachments card ── */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex items-center gap-2">
        <Link2 size={15} style={{ color: "var(--t2)" }} />
        <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--t2)" }}>
        Посилання та файли
        </p>
        </div>

        {/* Links */}
        {links.length > 0 && (
            <div className="flex flex-col gap-1.5">
            {links.map(link => (
                <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.82rem",
                    color: dark ? "#818cf8" : "#4f46e5",
                    textDecoration: "none",
                    padding: "5px 0",
                    borderBottom: "1px solid var(--brd)",
                                transition: "opacity 0.15s",
                }}
                className="hover:opacity-70"
                >
                <Link2 size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {link.name || link.url}
                </span>
                </a>
            ))}
            </div>
        )}

        {/* Files list — scrollable */}
        {files.length > 0 ? (
            <div
            style={{
                overflowY: "auto",
                maxHeight: 160,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                paddingRight: 4,
            }}
            >
            {files.map(file => (
                <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                                border: "1px solid var(--brd)",
                                fontSize: "0.82rem",
                                color: "var(--t1)",
                                textDecoration: "none",
                                transition: "opacity 0.15s",
                }}
                className="hover:opacity-70"
                >
                <FileText size={14} style={{ flexShrink: 0, color: "var(--t2)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {file.name}
                </span>
                <Download size={13} style={{ flexShrink: 0, color: "var(--t2)" }} />
                </a>
            ))}
            </div>
        ) : links.length === 0 ? (
            <p style={{ color: "var(--t2)", fontSize: "0.85rem", fontStyle: "italic" }}>Вкладень немає</p>
        ) : null}
        </div>

        {/* ── Submit button ── */}
        {submitError && (
            <div
            style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
                         border: "1px solid rgba(239,68,68,0.25)",
                         color: "#ef4444",
                         fontSize: "0.8rem",
            }}
            >
            {submitError}
            </div>
        )}

        <button
        onClick={handleSubmit}
        disabled={submitting || !!submission}
        style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            padding: "13px 20px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: (submitting || !!submission) ? "not-allowed" : "pointer",
            opacity: (submitting || !!submission) ? 0.6 : 1,
            background: submission
            ? (dark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)")
            : "linear-gradient(135deg,#6366f1,#4f46e5)",
            color: submission ? "#22c55e" : "#fff",
            border: submission ? "1px solid rgba(34,197,94,0.3)" : "none",
            boxShadow: submission ? "none" : "0 4px 14px rgba(99,102,241,0.35)",
            transition: "opacity 0.15s, box-shadow 0.15s",
        }}
        >
        {submitting ? (
            <><Loader2 size={17} className="animate-spin" /> Надсилається...</>
        ) : submission ? (
            <><CheckCircle2 size={17} /> Завдання здано</>
        ) : (
            <><Upload size={17} /> Здати завдання</>
        )}
        </button>

        </div>
        </div>
        </main>
        </div>
    );
}
