// src/app/rounds/[id]/submit/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Clock, Calendar, ChevronLeft, Upload,
    Github, Youtube, Globe, Link2,
    FileText, AlertCircle, CheckCircle2, Loader2,
    X, Paperclip, Flag, File, Film,
    Image as ImageIcon, Archive, FileCode, Send, BookOpen,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────── */

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function useCountdown(endAt?: string) {
    const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    useEffect(() => {
        if (!endAt) return;
        const tick = () => {
            const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
            setTime({
                days: Math.floor(diff / 86400000),
                    hours: Math.floor((diff % 86400000) / 3600000),
                    minutes: Math.floor((diff % 3600000) / 60000),
                    seconds: Math.floor((diff % 60000) / 1000),
            });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endAt]);
    return time;
}

function getFileType(name: string): "image" | "video" | "pdf" | "archive" | "code" | "other" {
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["mp4", "webm", "mov", "avi"].includes(ext)) return "video";
    if (ext === "pdf") return "pdf";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
    if (["js", "ts", "jsx", "tsx", "py", "go", "rs", "java", "c", "cpp",
        "html", "css", "json", "yaml", "md", "sh"].includes(ext)) return "code";
    return "other";
}

function FileTypeIcon({ type, size = 15 }: { type: ReturnType<typeof getFileType>; size?: number }) {
    const cls = "flex-shrink-0";
    if (type === "image") return <ImageIcon size={size} className={cls} />;
    if (type === "video") return <Film size={size} className={cls} />;
    if (type === "pdf") return <FileText size={size} className={cls} />;
    if (type === "archive") return <Archive size={size} className={cls} />;
    if (type === "code") return <FileCode size={size} className={cls} />;
    return <File size={size} className={cls} />;
}

/* ─── sub-components ──────────────────────────────────── */

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 flex-shrink-0">
        {icon}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-(--t2)">{children}</span>
        </div>
    );
}

function TimeBlock({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-1.5 flex-1">
        <div className={`w-full py-4 rounded-2xl border flex items-center justify-center ${urgent ? "bg-red-500/10 border-red-500/25" : "bg-(--bg) border-(--brd)"}`}>
        <span className={`text-3xl font-black tabular-nums ${urgent ? "text-red-500" : "text-(--t1)"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}>
        {String(value).padStart(2, "0")}
        </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
        </div>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-(--card) border border-(--brd) rounded-2xl p-6 ${className}`}>
        {children}
        </div>
    );
}

/* ─── interfaces ──────────────────────────────────────── */

interface Round {
    id: string;
    tournament_id: string;
    name: string;
    description?: string;
    start_at?: string;
    end_at?: string;
    status?: string;
}

interface AttachedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    type: ReturnType<typeof getFileType>;
}

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

/* ─── main page ───────────────────────────────────────── */

export default function SubmitPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [round, setRound] = useState<Round | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [userTeamId, setUserTeamId] = useState<string | null>(null);

    // form state
    const [githubUrl, setGithubUrl] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [liveUrl, setLiveUrl] = useState("");
    const [description, setDescription] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const countdown = useCountdown(round?.end_at);

    useEffect(() => { if (id) fetchRound(); }, [id]);
    useEffect(() => { if (user && round) fetchUserTeam(); }, [user, round?.tournament_id]);

    const fetchRound = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from("rounds").select("*").eq("id", id).single();
            if (error) throw error;
            setRound(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchUserTeam = async () => {
        if (!user || !round?.tournament_id) return;
        const { data: captainTeam } = await supabase
        .from("teams").select("id").eq("captain_id", user.id).eq("tournament_id", round.tournament_id).maybeSingle();
        let teamId = captainTeam?.id ?? null;
        if (!teamId) {
            const { data: memberTeams } = await supabase
            .from("teams").select("id").contains("members_ids", [user.id]).eq("tournament_id", round.tournament_id).limit(1);
            teamId = memberTeams?.[0]?.id ?? null;
        }
        if (teamId) setUserTeamId(teamId);
    };

        /* ── file handling ── */

        const addFiles = useCallback((newFiles: FileList | File[]) => {
            const arr = Array.from(newFiles);
            setAttachedFiles(prev => [
                ...prev,
                ...arr.map(f => ({
                    id: `${f.name}-${Date.now()}-${Math.random()}`,
                                 file: f,
                                 name: f.name,
                                 size: f.size,
                                 type: getFileType(f.name),
                })),
            ]);
        }, []);

        const removeFile = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

        const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
        const handleDragLeave = () => setIsDragging(false);
        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        };

            const formatSize = (bytes: number) => {
                if (bytes < 1024) return `${bytes} B`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            };

            /* ── submit / draft ── */

            const buildPayload = (isDraft: boolean) => ({
                team_id: userTeamId,
                round_id: id,
                github_url: githubUrl.trim() || null,
                                                        youtube_url: youtubeUrl.trim() || null,
                                                        live_url: liveUrl.trim() || null,
                                                        description: description.trim() || null,
                                                        is_draft: isDraft,
            });

            const handleAction = async (isDraft: boolean) => {
                if (!user || !round || !userTeamId) {
                    setSubmitError("Помилка: не знайдено команду або користувача.");
                    return;
                }
                if (!isDraft && round.status !== "active") {
                    setSubmitError(`Здача недоступна: раунд має статус "${round.status}".`);
                    return;
                }

                setSubmitting(true);
                setSubmitError(null);

                try {
                    const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
                    const formData = new FormData();
                    formData.append("payload", JSON.stringify(buildPayload(isDraft)));
                    attachedFiles.forEach(f => formData.append("files", f.file, f.name));

                    const res = await fetch(`${API_URL}/api/rounds/${id}/submit`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.detail ?? "Сталася помилка при відправці.");
                    }

                    router.push(`/rounds/${id}?submitted=1`);
                } catch (e: unknown) {
                    setSubmitError(e instanceof Error ? e.message : "Невідома помилка.");
                } finally {
                    setSubmitting(false);
                }
            };

            /* ── deadline progress (same logic as rounds/[id]) ── */
            const now = Date.now();
            const endTs = round?.end_at ? new Date(round.end_at).getTime() : 0;
            let progressPct = 0;
            if (endTs > 0) {
                if (round?.start_at) {
                    const startTs = new Date(round.start_at).getTime();
                    if (endTs > startTs)
                        progressPct = Math.min(100, Math.max(0, ((now - startTs) / (endTs - startTs)) * 100));
                } else {
                    progressPct = now >= endTs ? 100 : 0;
                }
            }
            const isUrgent = progressPct > 80;

            /* ── render ── */

            if (loading) return (
                <div className="flex min-h-screen bg-(--bg)">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-(--t2)" />
                </main>
                </div>
            );

            if (!round) return (
                <div className="flex min-h-screen bg-(--bg)">
                <Sidebar />
                <main className="flex-1 flex flex-col items-center justify-center gap-4">
                <AlertCircle size={28} className="text-(--t2)" />
                <p className="text-(--t2) font-bold">Раунд не знайдено</p>
                <button onClick={() => router.back()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm bg-(--card) border border-(--brd) text-(--t1) hover:border-blue-600/40 hover:text-blue-600 transition-all font-bold">
                <ChevronLeft size={16} /> Назад
                </button>
                </main>
                </div>
            );

            return (
                <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
                {/* background logo */}
                <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
                <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
                </div>

                <Sidebar />

                {isMobileSidebarOpen && (
                    <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)} />
                )}

                <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
                <MobileHeader
                onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                title="Здати роботу"
                icon={<Flag size={18} className="text-blue-600" />}
                />

                <div className="p-6 max-w-5xl w-full mx-auto">
                {/* back */}
                <button onClick={() => router.back()}
                className="mb-6 flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors group">
                <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Назад до раунду
                </button>

                {/* badge + title */}
                <div className="flex items-center gap-3 flex-wrap mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-600/20">
                Здача
                </span>
                </div>
                <h1 className="text-2xl font-black text-(--t1) leading-tight mb-8">
                {round.name}
                </h1>

                {/* two-column grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* ── LEFT ── */}
                <div className="flex flex-col gap-4">

                {/* description */}
                <Card>
                <SectionLabel icon={<FileText size={13} />}>Опис проєкту</SectionLabel>
                <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Розкажіть про ваш проєкт: ідея, технології, особливості..."
                rows={6}
                className="w-full resize-none rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-sm px-4 py-3 outline-none focus:border-blue-600/60 focus:ring-2 focus:ring-blue-600/10 placeholder:text-(--t2) transition-all leading-relaxed font-medium"
                />
                </Card>

                {/* links */}
                <Card>
                <SectionLabel icon={<Link2 size={13} />}>Посилання</SectionLabel>
                <div className="flex flex-col gap-3">

                {/* GitHub */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) focus-within:border-blue-600/60 focus-within:ring-2 focus-within:ring-blue-600/10 transition-all">
                <Github size={16} className="text-(--t2) flex-shrink-0" />
                <input
                type="url"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/your/repo"
                className="flex-1 bg-transparent text-sm text-(--t1) outline-none placeholder:text-(--t2) font-medium"
                />
                </div>

                {/* YouTube */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) focus-within:border-blue-600/60 focus-within:ring-2 focus-within:ring-blue-600/10 transition-all">
                <Youtube size={16} className="text-(--t2) flex-shrink-0" />
                <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 bg-transparent text-sm text-(--t1) outline-none placeholder:text-(--t2) font-medium"
                />
                </div>

                {/* Live / Demo */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) focus-within:border-blue-600/60 focus-within:ring-2 focus-within:ring-blue-600/10 transition-all">
                <Globe size={16} className="text-(--t2) flex-shrink-0" />
                <input
                type="url"
                value={liveUrl}
                onChange={e => setLiveUrl(e.target.value)}
                placeholder="https://your-demo.vercel.app"
                className="flex-1 bg-transparent text-sm text-(--t1) outline-none placeholder:text-(--t2) font-medium"
                />
                </div>

                </div>
                </Card>
                </div>

                {/* ── RIGHT ── */}
                <div className="flex flex-col gap-4">

                {/* deadline countdown */}
                <Card>
                <SectionLabel icon={<Clock size={13} />}>Дедлайн до {fmtDate(round.end_at)}</SectionLabel>
                <div className="flex items-end gap-2 mb-5">
                <TimeBlock value={countdown.days} label="днів" urgent={isUrgent} />
                <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
                <TimeBlock value={countdown.hours} label="год" urgent={isUrgent} />
                <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
                <TimeBlock value={countdown.minutes} label="хв" urgent={isUrgent} />
                <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
                <TimeBlock value={countdown.seconds} label="сек" urgent={isUrgent} />
                </div>

                {endTs > 0 && (
                    <>
                    <div className="relative h-2 rounded-full bg-(--brd) overflow-hidden mb-1">
                    <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                    style={{
                        width: `${progressPct}%`,
                        background: isUrgent
                        ? "linear-gradient(90deg,#f97316,#ef4444)"
                        : "linear-gradient(90deg,#2563eb,#1d4ed8)",
                               minWidth: progressPct > 0 ? 8 : 0,
                    }}
                    />
                    {progressPct > 0 && progressPct < 100 && (
                        <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-(--card) transition-all duration-1000"
                        style={{
                            left: `calc(${progressPct}% - 8px)`,
                                                              background: isUrgent ? "#ef4444" : "#2563eb",
                                                              boxShadow: `0 0 0 3px ${isUrgent ? "rgba(239,68,68,0.25)" : "rgba(37,99,235,0.25)"}`,
                        }}
                        />
                    )}
                    </div>
                    <div className="flex items-center justify-between">
                    <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
                    <Calendar size={12} /> {round.start_at ? fmtDate(round.start_at) : "Старт не вказано"}
                    </span>
                    <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
                    {fmtDate(round.end_at)} <Calendar size={12} />
                    </span>
                    </div>
                    </>
                )}
                </Card>

                {/* file attachment */}
                <Card>
                <SectionLabel icon={<Paperclip size={13} />}>Прикріпити файли</SectionLabel>

                {/* drop zone */}
                <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all ${isDragging
                    ? "border-blue-600/60 bg-blue-600/5"
                    : "border-(--brd) hover:border-blue-600/40 hover:bg-blue-600/5"
                }`}
                >
                <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => e.target.files && addFiles(e.target.files)}
                />
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600">
                <Upload size={18} />
                </div>
                <p className="text-sm font-bold text-(--t1) text-center">
                Перетягніть файли або{" "}
                <span className="text-blue-600">оберіть вручну</span>
                </p>
                <p className="text-[11px] text-(--t2) font-medium">
                Будь-який формат • необмежений розмір
                </p>
                </div>

                {/* file list */}
                {attachedFiles.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                    {attachedFiles.map(f => (
                        <div key={f.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg)">
                        <div className="w-8 h-8 rounded-xl bg-(--brd) flex items-center justify-center text-(--t2) flex-shrink-0">
                        <FileTypeIcon type={f.type} size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-(--t1) truncate">{f.name}</p>
                        <p className="text-[11px] text-(--t2)">{formatSize(f.size)}</p>
                        </div>
                        <button
                        onClick={() => removeFile(f.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex-shrink-0">
                        <X size={13} />
                        </button>
                        </div>
                    ))}
                    </div>
                )}
                </Card>

                {/* error */}
                {submitError && (
                    <div className="px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-500 text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    {submitError}
                    </div>
                )}

                {/* action buttons */}
                <div className="flex items-stretch gap-3">
                {/* Draft */}
                <button
                onClick={() => handleAction(true)}
                disabled={submitting}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest border border-(--brd) bg-(--card) text-(--t2) hover:border-blue-600/40 hover:text-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                Чернетка
                </button>

                {/* Submit */}
                <button
                onClick={() => handleAction(false)}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Надсилається...</>
                    : <><Send size={16} /> Здати</>
                }
                </button>
                </div>

                </div>
                </div>
                </div>
                </main>
                </div>
            );
}
