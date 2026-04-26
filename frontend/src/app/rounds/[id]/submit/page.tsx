"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Github, Youtube, Globe, Upload, FileText, Clock, ChevronRight,
    ArrowLeft, Zap, Send, CheckCircle2, AlertCircle, X, Loader2,
    Link2, Paperclip, Trash2, ExternalLink,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

const inp =
"w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all placeholder:text-(--t2)/50";

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(endAt?: string | null) {
    const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });
    useEffect(() => {
        if (!endAt) return;
        const tick = () => {
            const diff = new Date(endAt).getTime() - Date.now();
            if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTime({ days: d, hours: h, minutes: m, seconds: s, expired: false });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endAt]);
    return time;
}

// ── Deadline countdown widget ──────────────────────────────────────────────
function DeadlineCountdown({ endAt }: { endAt: string | null }) {
    const t = useCountdown(endAt);
    if (!endAt) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white flex-shrink-0">
        <Clock size={16} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">До дедлайну</span>
        </div>
        <div className="p-6">
        {t.expired ? (
            <div className="flex items-center gap-2 text-red-500 font-black text-sm">
            <AlertCircle size={16} /> Дедлайн минув
            </div>
        ) : (
            <>
            <div className="grid grid-cols-4 gap-2 mb-3">
            {[{ val: t.days, label: "дн" }, { val: t.hours, label: "год" }, { val: t.minutes, label: "хв" }, { val: t.seconds, label: "сек" }].map(({ val, label }) => (
                <div key={label} className="flex flex-col items-center bg-(--bg) rounded-2xl py-3 px-1 border border-(--brd)">
                <span className="text-2xl font-black tabular-nums text-(--t1)">{pad(val)}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-(--t2) mt-0.5">{label}</span>
                </div>
            ))}
            </div>
            <p className="text-[10px] font-bold text-(--t2) text-center">
            Здати до: <span className="text-(--t1)">{new Date(endAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </p>
            </>
        )}
        </div>
        </div>
    );
}

// ── File upload area ───────────────────────────────────────────────────────
function FileDropZone({ files, onAdd, onRemove, uploading }: { files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void; uploading: boolean; }) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setDragging(false);
        const added = Array.from(e.dataTransfer.files);
        if (added.length) onAdd(added);
    }, [onAdd]);
        const fmt = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
        return (
            <div className="space-y-3">
            <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${dragging ? "border-blue-500 bg-blue-500/5 scale-[1.01]" : "border-(--brd) hover:border-blue-500/50"} ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
            <input ref={inputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) onAdd(Array.from(e.target.files)); }} />
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
            <Upload size={22} className="text-blue-500" />
            </div>
            <div className="text-center">
            <p className="text-sm font-black text-(--t1)">{dragging ? "Відпустіть файли" : "Перетягніть файли або натисніть"}</p>
            <p className="text-[11px] text-(--t2) mt-1">Будь-який формат · до 50 MB</p>
            </div>
            </div>
            {files.length > 0 && (
                <div className="space-y-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 bg-(--bg) rounded-2xl border border-(--brd) group">
                    <Paperclip size={14} className="text-blue-500 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-(--t1) truncate">{f.name}</span>
                    <span className="text-[11px] font-bold text-(--t2) flex-shrink-0">{fmt(f.size)}</span>
                    <button type="button" onClick={() => onRemove(i)} className="w-6 h-6 rounded-lg flex items-center justify-center text-(--t2) hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} />
                    </button>
                    </div>
                ))}
                </div>
            )}
            </div>
        );
}

// ── URL input row ──────────────────────────────────────────────────────────
function UrlInput({ icon, label, placeholder, value, onChange, required, error }: { icon: React.ReactNode; label: string; placeholder: string; value: string; onChange: (v: string) => void; required?: boolean; error?: string | null; }) {
    return (
        <div>
        <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex items-center gap-1.5">{icon}{label}</label>
        {required && <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1"><Zap className="w-2.5 h-2.5 fill-red-500" /> Обов&apos;язково</span>}
        </div>
        <input type="url" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inp + (error ? " border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : "")} />
        {error && <p className="mt-1.5 text-[11px] font-bold text-red-500 flex items-center gap-1"><AlertCircle size={11} /> {error}</p>}
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────
interface Round { id: string; number: number; name: string | null; end_at: string | null; tournament_id: string; }
interface ExistingSubmission { id: string; github_url: string | null; video_url: string | null; live_demo_url: string | null; description: string | null; submitted_at: string; status: string; }

export default function SubmitPage() {
    const { dark } = useTheme();
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const roundId = searchParams.get("round_id");

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [round, setRound] = useState<Round | null>(null);
    const [userTeamId, setUserTeamId] = useState<string | null>(null);
    const [existing, setExisting] = useState<ExistingSubmission | null>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    const [githubUrl,    setGithubUrl]    = useState("");
    const [videoUrl,     setVideoUrl]     = useState("");
    const [demoUrl,      setDemoUrl]      = useState("");
    const [description,  setDescription]  = useState("");
    const [files,        setFiles]        = useState<File[]>([]);
    const [githubError,  setGithubError]  = useState<string | null>(null);
    const [videoError,   setVideoError]   = useState<string | null>(null);
    const [submitting,   setSubmitting]   = useState(false);
    const [submitError,  setSubmitError]  = useState<string | null>(null);
    const [submitted,    setSubmitted]    = useState(false);

    useEffect(() => {
        if (isLoading) return;
        if (!user) { router.push("/login"); return; }
        if (!roundId) { setPageError("Не вказано раунд (параметр round_id відсутній)"); setPageLoading(false); return; }
        (async () => {
            try {
                const { data: roundData, error: roundErr } = await supabase.from("rounds").select("id, number, name, end_at, tournament_id").eq("id", roundId).single();
                if (roundErr || !roundData) throw new Error("Раунд не знайдено");
                setRound(roundData);

                // Шукаємо команду: спочатку де капітан, потім де учасник
                let teamId: string | null = null;
                const token = localStorage.getItem("access_token") || "";

                const { data: captainTeam } = await supabase
                .from("teams")
                .select("id")
                .eq("captain_id", user.id)
                .maybeSingle();

                if (captainTeam?.id) {
                    teamId = captainTeam.id;
                } else {
                    // Fallback: шукаємо команди де user є учасником
                    const { data: memberTeams } = await supabase
                    .from("teams")
                    .select("id")
                    .contains("members_ids", [user.id])
                    .limit(1);
                    teamId = memberTeams?.[0]?.id ?? null;
                }

                setUserTeamId(teamId);
                if (!teamId) { setPageLoading(false); return; }
                const { data: subData } = await supabase.from("submissions").select("id, github_url, video_url, demo_url, description, submitted_at, status").eq("round_id", roundId).eq("team_id", teamId).maybeSingle();
                if (subData) {
                    setExisting(subData);
                    setGithubUrl(subData.github_url ?? "");
                    setVideoUrl(subData.video_url ?? "");
                    setDemoUrl(subData.live_demo_url ?? "");
                    setDescription(subData.description ?? "");
                }
            } catch (e: any) {
                setPageError(e.message ?? "Помилка завантаження");
            } finally {
                setPageLoading(false);
            }
        })();
    }, [isLoading, user, roundId, router]);

    const validateUrl = (url: string, label: string): string | null => {
        if (!url.trim()) return null;
        try { new URL(url); return null; } catch { return `Невалідне посилання для ${label}`; }
    };

    // Завантажує файли через бекенд (service_role обходить RLS bucket)
    // Повертає [{name, path}] — path в bucket, не URL
    const uploadFiles = async (): Promise<{ name: string; path: string }[]> => {
        if (files.length === 0) return [];
        const result: { name: string; path: string }[] = [];
        const token = localStorage.getItem("access_token") || "";
        for (const file of files) {
            const form = new FormData();
            form.append("round_id", roundId!);
            form.append("team_id",  userTeamId!);
            form.append("file",     file);
            const res = await fetch(`${API_URL}/api/upload/submission-file`, {
                method:  "POST",
                headers: { Authorization: `Bearer ${token}` },
                body:    form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`Помилка завантаження "${file.name}": ${err.detail ?? res.statusText}`);
            }
            const data = await res.json();
            result.push({ name: data.name, path: data.path });
        }
        return result;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        const gErr = !githubUrl.trim() ? "GitHub посилання є обов'язковим" : validateUrl(githubUrl, "GitHub");
        const vErr = !videoUrl.trim() ? "Відео-демо є обов'язковим" : validateUrl(videoUrl, "YouTube/Drive");
        const dErr = demoUrl.trim() ? validateUrl(demoUrl, "Live Demo") : null;
        setGithubError(gErr); setVideoError(vErr);
        if (gErr || vErr || dErr) return;
        if (!userTeamId) { setSubmitError("Ви не є капітаном жодної команди"); return; }
        if (!round) return;
        setSubmitting(true);
        try {
            const uploadedFiles = await uploadFiles();
            const token = localStorage.getItem("access_token") || "";
            const res = await fetch(`${API_URL}/api/rounds/${roundId}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    team_id:     userTeamId,
                    github_url:  githubUrl.trim() || null,
                                     video_url:   videoUrl.trim() || null,
                                     live_demo_url: demoUrl.trim() || null,
                                     description: description.trim() || null,
                                     files:       uploadedFiles,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? "Помилка при здачі роботи");
            }
            setSubmitted(true);
        } catch (e: any) {
            setSubmitError(e.message ?? "Невідома помилка");
        } finally {
            setSubmitting(false);
        }
    };

    const SidebarWrapper = () => (
        <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar />
        </div>
    );

    if (isLoading || pageLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-(--bg)">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (pageError) return (
        <div className="min-h-screen flex items-center justify-center bg-(--bg) text-(--t1)">
        <div className="max-w-sm text-center">
        <AlertCircle size={40} className="mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-black mb-2">Помилка</h2>
        <p className="text-(--t2) text-sm mb-6">{pageError}</p>
        <button onClick={() => router.back()} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all">Назад</button>
        </div>
        </div>
    );

    if (!userTeamId) return (
        <div className="min-h-screen flex bg-(--bg) text-(--t1)">
        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
        <SidebarWrapper />
        <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-sm text-center">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4"><AlertCircle size={28} className="text-orange-500" /></div>
        <h2 className="text-xl font-black mb-2">Немає команди</h2>
        <p className="text-(--t2) text-sm mb-6">Щоб здати роботу, ви маєте бути капітаном або учасником команди.</p>
        <button onClick={() => router.push("/teams")} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all">До команд</button>
        </div>
        </main>
        </div>
    );

    if (submitted) return (
        <div className="min-h-screen flex bg-(--bg) text-(--t1)">
        <style>{`@keyframes successPop{0%{opacity:0;transform:scale(0.85) translateY(20px)}100%{opacity:1;transform:none}}.success-card{animation:successPop 0.4s cubic-bezier(.22,1,.36,1) both}`}</style>
        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
        <SidebarWrapper />
        <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="success-card max-w-sm w-full text-center bg-(--card) rounded-[2.5rem] shadow-xl border border-(--brd) p-10">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25"><CheckCircle2 size={36} className="text-white" /></div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Здано! 🎉</h2>
        <p className="text-(--t2) text-sm mb-8">Роботу вашої команди успішно подано на раунд.</p>
        <div className="flex flex-col gap-3">
        <button onClick={() => router.push(`/rounds/${roundId}`)} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all">Переглянути раунд</button>
        <button onClick={() => router.push("/dashboard")} className="w-full py-3 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) transition-all">Дашборд</button>
        </div>
        </div>
        </main>
        </div>
    );

    return (
        <div className="min-h-screen flex bg-(--bg) text-(--t1)">
        <style>{`@keyframes cdIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cdIn{animation:cdIn 0.35s cubic-bezier(.22,1,.36,1) both}`}</style>

        <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
        </div>

        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
        <SidebarWrapper />

        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} title="Здати роботу" icon={<Send size={18} className="text-blue-600" />} />

        <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
        <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
        <ChevronRight size={10} />
        <button onClick={() => router.push("/dashboard")} className="hover:text-blue-600 transition-colors">Дашборд</button>
        <ChevronRight size={10} />
        {round && (<><button onClick={() => router.push(`/rounds/${round.id}`)} className="hover:text-blue-600 transition-colors">Раунд {round.number}</button><ChevronRight size={10} /></>)}
        <span className="text-(--t1)">Здати роботу</span>
        </nav>

        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
        <ArrowLeft size={14} /> Назад
        </button>

        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-(--t1) mb-1">Здати роботу</h1>
        {round && <p className="text-(--t2) text-sm font-medium mb-8">Раунд {round.number}{round.name ? ` · ${round.name}` : ""}</p>}

        {existing && (
            <div className="cdIn mb-6 flex items-start gap-3 px-5 py-4 rounded-2xl bg-blue-500/10 border border-blue-500/25">
            <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
            <p className="text-sm font-black text-blue-500">Роботу вже подано</p>
            <p className="text-[11px] text-(--t2) mt-0.5">Подано {new Date(existing.submitted_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · Збережіть нову версію, щоб оновити</p>
            </div>
            </div>
        )}

        <form className="flex flex-col xl:flex-row gap-6 items-start w-full" onSubmit={handleSubmit}>

        {/* ── LEFT ── */}
        <div className="flex flex-col gap-5 w-full xl:flex-1 xl:min-w-0">

        {/* Block 1: Links */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0"><Link2 size={16} /></div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2)">1. Посилання</span>
        </div>
        <div className="p-6 sm:p-8 space-y-5">
        <UrlInput icon={<Github size={12} />} label="GitHub репозиторій" placeholder="https://github.com/your-team/project" value={githubUrl} onChange={v => { setGithubUrl(v); setGithubError(null); }} required error={githubError} />
        <div className="border-t border-(--brd)" />
        <UrlInput icon={<Youtube size={12} />} label="Відео-демо (YouTube / Drive)" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={v => { setVideoUrl(v); setVideoError(null); }} required error={videoError} />
        <div className="border-t border-(--brd)" />
        <UrlInput icon={<Globe size={12} />} label="Live Demo" placeholder="https://your-project.vercel.app" value={demoUrl} onChange={setDemoUrl} />
        <p className="text-[10px] font-bold text-(--t2) flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full border border-(--brd) flex items-center justify-center text-[8px] font-black flex-shrink-0">i</span>
        Live demo є опціональним. Вкажіть, якщо ваш проєкт задеплоєно
        </p>
        </div>
        </section>

        {/* Block 2: Description */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0"><FileText size={16} /></div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2) flex-1">2. Опис проєкту</span>
        <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full">Опціонально</span>
        </div>
        <div className="p-6 sm:p-8 space-y-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) block">Що зроблено та як запустити (1–2 абзаци)</label>
        <textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} placeholder="Короткий опис: що вирішує проєкт, які технології використано, як запустити локально..." className="w-full px-5 py-4 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all resize-y placeholder:text-(--t2)/50" />
        </div>
        </section>

        {/* Block 3: Files */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0"><Upload size={16} /></div>
        <span className="text-xs font-black uppercase tracking-widest text-(--t2) flex-1">3. Завантажити файли</span>
        <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full">Опціонально</span>
        </div>
        <div className="p-6 sm:p-8">
        <FileDropZone files={files} onAdd={added => setFiles(prev => [...prev, ...added])} onRemove={i => setFiles(prev => prev.filter((_, idx) => idx !== i))} uploading={submitting} />
        </div>
        </section>

        {submitError && (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/25">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-500">{submitError}</p>
            </div>
        )}

        <div className="cdIn flex flex-col sm:flex-row gap-3" style={{ animationDelay: "180ms" }}>
        <button type="submit" disabled={submitting} className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {submitting ? <><Loader2 size={16} className="animate-spin" /> Завантаження...</> : <><Send size={14} /> {existing ? "Оновити роботу" : "Здати роботу"}</>}
        </button>
        <button type="button" onClick={() => router.back()} disabled={submitting} className="flex-1 px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all disabled:opacity-60">
        Скасувати
        </button>
        </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="w-full xl:w-72 xl:flex-shrink-0 xl:sticky xl:top-6 flex flex-col gap-5">

        {round?.end_at && (
            <div className="cdIn" style={{ animationDelay: "80ms" }}>
            <DeadlineCountdown endAt={round.end_at} />
            </div>
        )}

        {/* Checklist */}
        <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0"><CheckCircle2 size={14} /></div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Що потрібно здати</span>
        </div>
        <div className="p-5 space-y-3">
        {[
            { icon: <Github size={14} />, label: "GitHub репозиторій", required: true, done: !!githubUrl.trim() },
            { icon: <Youtube size={14} />, label: "Відео-демо", required: true, done: !!videoUrl.trim() },
            { icon: <Globe size={14} />, label: "Live demo", required: false, done: !!demoUrl.trim() },
            { icon: <FileText size={14} />, label: "Опис проєкту", required: false, done: !!description.trim() },
            { icon: <Upload size={14} />, label: "Файли / архів", required: false, done: files.length > 0 },
        ].map(({ icon, label, required, done }) => (
            <div key={label} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${done ? "bg-green-500 border-green-500 text-white" : required ? "border-red-500/50 text-red-500/50" : "border-(--brd) text-(--t2)/40"}`}>
            {done ? <CheckCircle2 size={11} /> : required ? <Zap size={9} className="fill-current" /> : null}
            </div>
            <span className={`text-xs font-bold flex-1 ${done ? "text-(--t1)" : "text-(--t2)"}`}>{label}</span>
            {required && !done && <span className="text-[9px] font-black uppercase text-red-500 flex-shrink-0">Required</span>}
            </div>
        ))}
        </div>
        </div>

        {/* Tips */}
        <div className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: "180ms" }}>
        <div className="p-5 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Поради</p>
        {["Переконайтесь, що репозиторій публічний", "Відео має демонструвати основний функціонал", "Додайте README з інструкцією запуску"].map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5">
            <span className="w-4 h-4 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[8px] font-black text-blue-500 flex-shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-xs text-(--t2) font-medium leading-relaxed">{tip}</p>
            </div>
        ))}
        </div>
        </div>

        </div>
        </form>
        </div>
        </main>
        </div>
    );
}
