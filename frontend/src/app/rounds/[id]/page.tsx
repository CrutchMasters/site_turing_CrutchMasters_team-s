"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Clock, Calendar, ChevronLeft, Download, Upload,
    Link2, FileText, AlertCircle, CheckCircle2, Cpu, Loader2,
    X, ZoomIn, ZoomOut, RotateCw, ExternalLink, File, Film,
    Image as ImageIcon, Archive, FileCode, Paperclip, Flag,
} from "lucide-react";

function getFileType(name: string): "image" | "video" | "pdf" | "archive" | "code" | "other" {
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    if (["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext)) return "image";
    if (["mp4","webm","mov","avi","mkv"].includes(ext))                     return "video";
    if (ext === "pdf")                                                       return "pdf";
    if (["zip","rar","7z","tar","gz","bz2"].includes(ext))                  return "archive";
    if (["js","ts","jsx","tsx","py","go","rs","java","c","cpp","cs",
        "html","css","json","yaml","yml","md","sh"].includes(ext))          return "code";
    return "other";
}

function FileTypeIcon({ type, size = 15 }: { type: ReturnType<typeof getFileType>; size?: number }) {
    const cls = "flex-shrink-0";
    if (type === "image")   return <ImageIcon  size={size} className={cls} />;
    if (type === "video")   return <Film       size={size} className={cls} />;
    if (type === "pdf")     return <FileText   size={size} className={cls} />;
    if (type === "archive") return <Archive    size={size} className={cls} />;
    if (type === "code")    return <FileCode   size={size} className={cls} />;
    return <File size={size} className={cls} />;
}

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("uk-UA", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

interface FilePreviewModalProps {
    file: { id: string; name: string; url: string; type: "link" | "file" } | null;
    signedUrl: string | null;
    onClose: () => void;
    dark: boolean;
}

function FilePreviewModal({ file, signedUrl, onClose, dark }: FilePreviewModalProps) {
    const [zoom, setZoom]         = useState(1);
    const [rotation, setRotation] = useState(0);
    const [imgError, setImgError] = useState(false);

    useEffect(() => { setZoom(1); setRotation(0); setImgError(false); }, [file]);
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    if (!file || !signedUrl) return null;

    const fileType = getFileType(file.name);
    const ext = (file.name.split(".").pop() ?? "").toUpperCase();

    return (
        <div
        style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",
            backdropFilter:"blur(12px)",display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",padding:16 }}
            onClick={onClose}
            >
            <style>{`
                @keyframes slideUpModal {
                    from { opacity:0; transform:translateY(24px) scale(0.97) }
                    to   { opacity:1; transform:none }
                }
                .modal-inner { animation: slideUpModal 0.22s cubic-bezier(.22,1,.36,1) both; }
                .modal-icon-btn:hover { opacity: 0.65 !important; }
                `}</style>
                <div className="modal-inner"
                style={{ position:"relative",width:"100%",maxWidth:920,
                    maxHeight:"calc(100vh - 80px)",borderRadius:18,overflow:"hidden",
            display:"flex",flexDirection:"column",
            background:dark?"#111114":"#fff",
            border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`,
            boxShadow:"0 32px 80px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
            >
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 16px",
                borderBottom:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"}`,
            background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",flexShrink:0 }}>
            <span style={{ padding:"2px 8px",borderRadius:6,fontSize:"0.65rem",fontWeight:700,
                letterSpacing:"0.06em",
                background:dark?"rgba(37,99,235,0.2)":"rgba(37,99,235,0.12)",
            color:dark?"#93c5fd":"#1d4ed8",flexShrink:0 }}>{ext}</span>
            <span style={{ flex:1,fontSize:"0.85rem",fontWeight:600,color:dark?"#e2e8f0":"#1e293b",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{file.name}</span>
                {fileType === "image" && !imgError && (
                    <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                    {[
                        { icon:<ZoomOut size={15}/>, fn:() => setZoom(z => Math.max(0.25,z-0.25)) },
                                                       { icon:<ZoomIn  size={15}/>, fn:() => setZoom(z => Math.min(4,z+0.25)) },
                                                       { icon:<RotateCw size={15}/>, fn:() => setRotation(r => (r+90)%360) },
                    ].map((b,i) => (
                        <button key={i} className="modal-icon-btn" onClick={b.fn}
                        style={{ display:"flex",alignItems:"center",justifyContent:"center",
                            width:34,height:34,borderRadius:8,
                            border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`,
                                    background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",
                                    color:dark?"#94a3b8":"#64748b",cursor:"pointer" }}>
                                    {b.icon}
                                    </button>
                    ))}
                    <span style={{ fontSize:"0.72rem",fontWeight:700,color:dark?"#94a3b8":"#64748b",minWidth:38,textAlign:"center" }}>
                    {Math.round(zoom*100)}%
                    </span>
                    </div>
                )}
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="modal-icon-btn"
                style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,
                    borderRadius:8,border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`,
            background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",
            color:dark?"#94a3b8":"#64748b",textDecoration:"none" }}>
            <ExternalLink size={15}/>
            </a>
            <a href={signedUrl} download={file.name} className="modal-icon-btn"
            style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,
                borderRadius:8,border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`,
            background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",
            color:dark?"#94a3b8":"#64748b",textDecoration:"none" }}>
            <Download size={15}/>
            </a>
            <button className="modal-icon-btn" onClick={onClose}
            style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,
                borderRadius:8,border:"1px solid rgba(239,68,68,0.25)",
            background:dark?"rgba(239,68,68,0.1)":"rgba(239,68,68,0.06)",
            color:"#ef4444",cursor:"pointer" }}>
            <X size={16}/>
            </button>
            </div>
            <div style={{ flex:1,overflow:"auto",display:"flex",alignItems:"center",
                justifyContent:"center",minHeight:0,
            background:dark?"#0c0c0f":"#f5f5f7",position:"relative" }}>
            {fileType === "image" && !imgError ? (
                <div style={{ overflow:"auto",width:"100%",height:"100%",display:"flex",
                    alignItems:"center",justifyContent:"center",padding:24 }}>
                    <img src={signedUrl} alt={file.name} onError={() => setImgError(true)}
                    style={{ transform:`scale(${zoom}) rotate(${rotation}deg)`,
                                                  transformOrigin:"center",transition:"transform 0.2s ease",
                                                  maxWidth:"100%",maxHeight:"62vh",objectFit:"contain",
                                                  borderRadius:6,display:"block" }} />
                                                  </div>
            ) : fileType === "video" ? (
                <video src={signedUrl} controls style={{ maxWidth:"100%",maxHeight:"65vh",borderRadius:6 }} />
            ) : fileType === "pdf" ? (
                <iframe src={signedUrl} style={{ width:"100%",height:"65vh",border:"none",display:"block" }} title={file.name} />
            ) : (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:48 }}>
                <div style={{ width:72,height:72,borderRadius:20,
                    background:dark?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.1)",
                 border:"1px solid rgba(37,99,235,0.25)",
                 display:"flex",alignItems:"center",justifyContent:"center",
                 color:dark?"#93c5fd":"#2563eb" }}>
                 <FileTypeIcon type={fileType} size={32}/>
                 </div>
                 <p style={{ fontSize:"0.9rem",fontWeight:600,color:dark?"#e2e8f0":"#1e293b",textAlign:"center" }}>
                 Попередній перегляд недоступний
                 </p>
                 <a href={signedUrl} download={file.name}
                 style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 20px",
                     borderRadius:10,background:"linear-gradient(135deg,#2563eb,#1d4ed8)",
                 color:"#fff",fontWeight:700,fontSize:"0.85rem",textDecoration:"none" }}>
                 <Download size={15}/> Завантажити файл
                 </a>
                 </div>
            )}
            </div>
            </div>
            </div>
    );
}

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface RoundAttachment { id: string; name: string; url: string; type: "link" | "file"; }
interface Round {
    id: string; tournament_id: string; name: string;
    description?: string; criteria?: string; technologies?: string[];
    start_at?: string; end_at?: string; template_url?: string;
    attachments?: RoundAttachment[]; links?: RoundAttachment[];
    status?: string;
}
interface Submission { id: string; round_id: string; team_id: string; submitted_at: string; status: string; }

function useCountdown(endAt?: string) {
    const [time, setTime] = useState({ days:0, hours:0, minutes:0, seconds:0 });
    useEffect(() => {
        if (!endAt) return;
        const tick = () => {
            const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
            setTime({
                days:    Math.floor(diff / 86400000),
                    hours:   Math.floor((diff % 86400000) / 3600000),
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
        <div className={`w-full py-4 rounded-2xl border flex items-center justify-center ${
            urgent ? "bg-red-500/10 border-red-500/25" : "bg-(--bg) border-(--brd)"
        }`}>
        <span className={`text-3xl font-black tabular-nums ${urgent ? "text-red-500" : "text-(--t1)"}`}
        style={{ fontVariantNumeric:"tabular-nums" }}>
        {String(value).padStart(2,"0")}
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

export default function RoundPage() {
    const params = useParams();
    const router = useRouter();
    const { user }  = useAuth();
    const { dark }  = useTheme();
    const id = params?.id as string;

    const [round,       setRound]       = useState<Round | null>(null);
    const [submission,  setSubmission]  = useState<Submission | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [submitting,  setSubmitting]  = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [userTeamId,  setUserTeamId]  = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<RoundAttachment | null>(null);
    const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

    const countdown = useCountdown(round?.end_at);

    useEffect(() => { if (id) fetchRound(); }, [id]);
    useEffect(() => { if (user) fetchUserTeam(); }, [user]);

    const fetchRound = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from("rounds").select("*").eq("id", id).single();
            if (error) throw error;
            setRound(data);
            if (userTeamId) fetchSubmission(data.id, userTeamId);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchUserTeam = async () => {
        if (!user) return;
        const { data } = await supabase.from("teams").select("id").eq("captain_id", user.id).single();
        if (data) { setUserTeamId(data.id); if (round) fetchSubmission(round.id, data.id); }
    };

    const fetchSubmission = async (roundId: string, teamId: string) => {
        const { data } = await supabase.from("submissions").select("*")
        .eq("round_id", roundId).eq("team_id", teamId).maybeSingle();
        setSubmission(data ?? null);
    };

    const handleOpenFile = (file: RoundAttachment) => {
        setPreviewFile(file);
        setPreviewUrl(file.url);
    };

    const handleDownloadTemplate = async () => {
        if (!round?.template_url) return;
        const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
        const res = await fetch(`${API_URL}/api/rounds/${round.id}/template`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href = url; a.download = `${round.name}_template.docx`; a.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleSubmit = async () => {
        if (!user || !round || !userTeamId) return;
        setSubmitting(true); setSubmitError(null);
        try {
            const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
            const res = await fetch(`${API_URL}/api/rounds/${round.id}/submit`, {
                method: "POST",
                headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
                body: JSON.stringify({ team_id: userTeamId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Помилка при здачі завдання");
            }
            await fetchSubmission(round.id, userTeamId);
        } catch (e: any) { setSubmitError(e.message); }
        finally { setSubmitting(false); }
    };

    const allAttachments: RoundAttachment[] = React.useMemo(() => {
        const merged = [...(round?.attachments ?? []), ...(round?.links ?? [])];
        const seen = new Set<string>();
        return merged.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
    }, [round]);

    const links        = allAttachments.filter(a => a.type === "link");
    const files        = allAttachments.filter(a => a.type === "file");
    const technologies = round?.technologies ?? [];

    const startTs = round?.start_at ? new Date(round.start_at).getTime() : 0;
    const endTs   = round?.end_at   ? new Date(round.end_at).getTime()   : 0;
    const progressPct = (startTs && endTs && endTs > startTs)
    ? Math.min(100, Math.max(0, ((Date.now() - startTs) / (endTs - startTs)) * 100))
    : 0;
    const isUrgent = progressPct > 80;

    const statusConfig = {
        active:   { label: "Активний",   bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-500",  dot: "bg-green-500",  pulse: true  },
        finished: { label: "Завершено",  bg: "bg-(--bg)",       border: "border-(--brd)",       text: "text-(--t2)",    dot: "bg-gray-400",   pulse: false },
        pending:  { label: "Очікується", bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-500", dot: "bg-amber-400",  pulse: false },
    };
    const st = statusConfig[(round?.status as keyof typeof statusConfig) ?? "pending"] ?? statusConfig.pending;

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
        <div className="w-16 h-16 rounded-2xl bg-(--card) border border-(--brd) flex items-center justify-center">
        <AlertCircle size={28} className="text-(--t2)" />
        </div>
        <p className="text-(--t2) font-bold">Раунд не знайдено</p>
        <button onClick={() => router.back()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm bg-(--card) border border-(--brd) text-(--t1) hover:border-blue-600/40 hover:text-blue-600 transition-all font-bold">
        <ChevronLeft size={16}/> Назад
        </button>
        </main>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
        {/* Background logo — same as tournaments page */}
        <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
        <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
        </div>

        <Sidebar />

        <FilePreviewModal
        file={previewFile} signedUrl={previewUrl}
        onClose={() => { setPreviewFile(null); setPreviewUrl(null); }}
        dark={dark}
        />

        {isMobileSidebarOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)} />
        )}

        <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
        <MobileHeader
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        title={round.name}
        icon={<Flag size={18} className="text-blue-600" />}
        />

        <div className="p-6 max-w-5xl w-full mx-auto">
        {/* Back */}
        <button onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-(--t2) hover:text-blue-600 transition-colors group">
        <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform"/>
        Назад до турніру
        </button>

        {/* Status badges */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-600/20">
        Раунд
        </span>
        {round.status && (
            <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${st.bg} ${st.border} ${st.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${st.pulse ? "animate-pulse" : ""}`} />
            {st.label}
            </span>
        )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-(--t1) leading-tight mb-8">
        {round.name}
        </h1>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── LEFT ── */}
        <div className="flex flex-col gap-4">

        {/* Description */}
        <Card>
        <SectionLabel icon={<FileText size={13}/>}>Опис завдання</SectionLabel>
        {round.description ? (
            <p className="text-sm text-(--t2) leading-relaxed whitespace-pre-wrap">
            {round.description}
            </p>
        ) : (
            <p className="text-sm text-(--t2) italic">Опис відсутній</p>
        )}
        </Card>

        {/* Criteria */}
        <Card>
        <SectionLabel icon={<CheckCircle2 size={13}/>}>Критерії оцінювання</SectionLabel>
        {round.criteria ? (
            <div className="flex flex-col gap-3">
            {round.criteria.split("\n").filter(Boolean).map((line, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-(--t1)">
                <span className="w-6 h-6 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-600/20 flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5">
                {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{line}</span>
                </div>
            ))}
            </div>
        ) : (
            <p className="text-sm text-(--t2) italic">Критерії не вказані</p>
        )}
        </Card>

        {/* Status + template row */}
        <div className="flex items-stretch gap-3">
        <div className={`flex-1 flex items-center gap-3 px-5 py-4 rounded-2xl border font-bold text-sm ${
            submission
            ? "bg-green-500/10 border-green-500/25 text-green-500"
            : "bg-(--card) border-(--brd) text-(--t2)"
        }`}>
        {submission
            ? <><CheckCircle2 size={18}/> Статус: Здано</>
            : <><AlertCircle  size={18}/> Статус: Не здано</>
        }
        </div>
        <button
        onClick={handleDownloadTemplate}
        disabled={!round.template_url}
        className="flex items-center gap-2 px-5 py-4 rounded-2xl bg-(--card) border border-(--brd) text-(--t1) text-sm font-bold hover:border-blue-600/40 hover:text-blue-600 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
        <Download size={16}/> Шаблон
        </button>
        </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="flex flex-col gap-4">

        {/* Countdown */}
        <Card>
        <SectionLabel icon={<Clock size={13}/>}>До завершення</SectionLabel>
        <div className="flex items-end gap-2 mb-5">
        <TimeBlock value={countdown.days}    label="днів"  urgent={isUrgent} />
        <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
        <TimeBlock value={countdown.hours}   label="год"   urgent={isUrgent} />
        <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
        <TimeBlock value={countdown.minutes} label="хв"    urgent={isUrgent} />
        <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
        <TimeBlock value={countdown.seconds} label="сек"   urgent={isUrgent} />
        </div>
        <div className="relative h-2 rounded-full bg-(--brd) overflow-hidden mb-4">
        <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
        style={{
            width: `${progressPct}%`,
            background: isUrgent
            ? "linear-gradient(90deg,#f97316,#ef4444)"
            : "linear-gradient(90deg,#2563eb,#1d4ed8)",
        }}
        />
        <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-(--card) transition-all duration-1000"
        style={{
            left: `calc(${progressPct}% - 8px)`,
            background: isUrgent ? "#ef4444" : "#2563eb",
            boxShadow: `0 0 0 3px ${isUrgent ? "rgba(239,68,68,0.25)" : "rgba(37,99,235,0.25)"}`,
        }}
        />
        </div>
        <div className="flex items-center justify-between">
        <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
        <Calendar size={12}/> {fmtDate(round.start_at)}
        </span>
        <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
        {fmtDate(round.end_at)} <Calendar size={12}/>
        </span>
        </div>
        </Card>

        {/* Technologies */}
        {technologies.length > 0 && (
            <Card>
            <SectionLabel icon={<Cpu size={13}/>}>Технології</SectionLabel>
            <div className="flex flex-wrap gap-2">
            {technologies.map((tech, i) => (
                <span key={i}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-blue-600/10 text-blue-600 border-blue-600/20">
                {tech}
                </span>
            ))}
            </div>
            </Card>
        )}

        {/* Attachments */}
        {allAttachments.length > 0 && (
            <Card>
            <SectionLabel icon={<Paperclip size={13}/>}>Посилання / Файли</SectionLabel>
            {links.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                {links.length > 0 && files.length > 0 && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Посилання</p>
                )}
                {links.map(link => {
                    let host = link.url;
                    try { host = new URL(link.url).hostname.replace("www.",""); } catch {}
                    return (
                        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all group">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <Link2 size={14} className="text-blue-600"/>
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-blue-600 group-hover:underline truncate">{host}</p>
                        <p className="text-[11px] text-(--t2) truncate">{link.url}</p>
                        </div>
                        <ExternalLink size={14} className="text-(--t2) flex-shrink-0"/>
                        </a>
                    );
                })}
                </div>
            )}
            {files.length > 0 && (
                <div className="flex flex-col gap-2">
                {links.length > 0 && files.length > 0 && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Файли</p>
                )}
                {files.map(file => {
                    const ftype = getFileType(file.name);
                    return (
                        <button key={file.id} onClick={() => handleOpenFile(file)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-blue-600/40 hover:bg-blue-600/5 transition-all text-left w-full group">
                        <div className="w-8 h-8 rounded-xl bg-(--brd) flex items-center justify-center flex-shrink-0 text-(--t2)">
                        <FileTypeIcon type={ftype} size={15}/>
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-(--t1) truncate group-hover:text-blue-600 transition-colors">{file.name}</p>
                        <p className="text-[11px] text-(--t2)">{ftype.toUpperCase()}</p>
                        </div>
                        <Download size={14} className="text-(--t2) flex-shrink-0"/>
                        </button>
                    );
                })}
                </div>
            )}
            </Card>
        )}

        {/* Submit error */}
        {submitError && (
            <div className="px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-500 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0"/>
            {submitError}
            </div>
        )}

        {/* Submit button */}
        <button
        onClick={handleSubmit}
        disabled={submitting || !!submission}
        className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] ${
            submission
            ? "bg-green-500/10 border border-green-500/25 text-green-500 cursor-default"
            : submitting
            ? "bg-blue-600/60 text-white cursor-wait"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
        } disabled:opacity-70`}
        >
        {submitting ? (
            <><Loader2 size={18} className="animate-spin"/> Надсилається...</>
        ) : submission ? (
            <><CheckCircle2 size={18}/> Завдання здано</>
        ) : (
            <><Upload size={18}/> Здати завдання</>
        )}
        </button>
        </div>
        </div>
        </div>
        </main>
        </div>
    );
}
