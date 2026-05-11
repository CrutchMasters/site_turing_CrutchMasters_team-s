//site_turing_CrutchMasters_team-s/frontend/src/app/teams/[id]/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Users, Crown, ChevronRight, ArrowLeft, Loader,
    Shield, Star, Send, MessageSquare, Calendar,
    ExternalLink, Copy, Check, Camera, X, Trophy,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface TeamMember {
    id: string;
    username: string;
    login: string;
    email: string;
    role: string;
    avatar_url?: string;
    status?: string;
}

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
    members_ids?: string[];
    telegram_url?: string;
    discord_url?: string;
    created_at?: string;
    tournament_id?: string;
    avatar_url?: string;
}

interface Tournament {
    id: string;
    name: string;
    status?: string;
    start_at?: string;
    registration_from?: string;
    registration_to?: string;
}

const gradients = [
    "from-blue-500 to-blue-700",
"from-violet-500 to-violet-700",
"from-emerald-500 to-emerald-700",
"from-orange-500 to-orange-700",
"from-pink-500 to-pink-700",
"from-cyan-500 to-cyan-700",
];

const roleBadge = (role: string) => {
    if (role === "superadmin") return "bg-red-500/10 text-red-500 border-red-500/20";
    if (role === "admin")      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    if (role === "jury")       return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <button onClick={handle} title="Copy ID"
        className="p-1.5 rounded-lg text-(--t2) hover:text-blue-600 hover:bg-blue-600/10 transition-all active:scale-90">
        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
    );
}

// ── Team Avatar Editor Modal ─────────────────────────────────────────────────
function TeamAvatarModal({
    teamId,
    onSave,
    onClose,
}: {
    teamId: string;
    onSave: (url: string) => void;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(100);
    const [rotate, setRotate] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [uploading, setUploading] = useState(false);
    const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const SIZE = 260;

    const draw = React.useCallback((
        image?: HTMLImageElement | null,
        sc?: number,
        rot?: number,
        off?: { x: number; y: number }
    ) => {
        const canvas = canvasRef.current;
        const i = image ?? img;
        const s = sc ?? scale;
        const r = rot ?? rotate;
        const o = off ?? offset;
        if (!canvas || !i) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.translate(SIZE / 2 + o.x, SIZE / 2 + o.y);
        ctx.rotate((r * Math.PI) / 180);
        ctx.scale(s / 100, s / 100);
        ctx.drawImage(i, -i.width / 2, -i.height / 2);
        ctx.restore();
    }, [img, scale, rotate, offset]);

    useEffect(() => { draw(); }, [draw]);

    const loadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const image = new Image();
            image.onload = () => {
                const fitScale = Math.min(100, (SIZE / Math.max(image.width, image.height)) * 100);
                setImg(image);
                setScale(Math.round(fitScale));
                setRotate(0);
                setOffset({ x: 0, y: 0 });
                draw(image, Math.round(fitScale), 0, { x: 0, y: 0 });
            };
            image.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setUploading(true);
        try {
            const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), "image/webp", 0.85));
            const timestamp = Date.now();
            const path = `teams/${teamId}/avatar_${timestamp}.webp`;

            const { error } = await supabase.storage
            .from("avatars")
            .upload(path, blob, { contentType: "image/webp" });

            if (error) throw error;

            const { data } = supabase.storage.from("avatars").getPublicUrl(path);
            const finalUrl = `${data.publicUrl}?v=${timestamp}`;

            // Delete old avatar if present
            const { data: teamData } = await supabase
            .from("teams")
            .select("avatar_url")
            .eq("id", teamId)
            .single();

            await supabase.from("teams").update({ avatar_url: finalUrl }).eq("id", teamId);

            if (teamData?.avatar_url) {
                try {
                    const url = new URL(teamData.avatar_url);
                    const pathParts = url.pathname.split("/object/public/avatars/");
                    if (pathParts[1]) {
                        const oldPath = pathParts[1].split("?")[0];
                        await supabase.storage.from("avatars").remove([oldPath]);
                    }
                } catch { /* ignore */ }
            }

            onSave(finalUrl);
            onClose();
        } catch (err: any) {
            console.error("Team avatar upload error:", err);
            alert(err?.message ?? "Failed to load team profile");
        } finally {
            setUploading(false);
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragRef.current) return;
        const newOff = {
            x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
            y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
        };
        setOffset(newOff);
        draw(undefined, undefined, undefined, newOff);
    };
    const onMouseUp = () => { dragRef.current = null; };

    const touchRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        touchRef.current = { sx: t.clientX, sy: t.clientY, ox: offset.x, oy: offset.y };
    };
    const onTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        if (!touchRef.current) return;
        const t = e.touches[0];
        const newOff = {
            x: touchRef.current.ox + (t.clientX - touchRef.current.sx),
            y: touchRef.current.oy + (t.clientY - touchRef.current.sy),
        };
        setOffset(newOff);
        draw(undefined, undefined, undefined, newOff);
    };
    const onTouchEnd = () => { touchRef.current = null; };

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newScale = Math.min(300, Math.max(20, scale - e.deltaY / 8));
        setScale(Math.round(newScale));
        draw(undefined, Math.round(newScale));
    };

    const rotateCW  = () => { const v = rotate + 90; setRotate(v); draw(undefined, undefined, v); };
    const rotateCCW = () => { const v = rotate - 90; setRotate(v); draw(undefined, undefined, v); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-(--card) border border-(--brd) rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--brd)">
        <p className="text-sm font-black uppercase tracking-widest text-(--t1)">Change Avatar</p>
        <button onClick={onClose}
        className="w-7 h-7 rounded-full border border-(--brd) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-500/40 transition-all">
        <X size={13} />
        </button>
        </div>

        {!img ? (
            <label className="flex flex-col items-center justify-center gap-3 m-5 p-10 border-2 border-dashed border-(--brd) rounded-2xl cursor-pointer hover:border-blue-600/40 hover:bg-blue-600/5 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-3xl">🖼️</div>
            <div className="text-center">
            <p className="text-sm font-black text-(--t1)">Choose Image</p>
            <p className="text-[11px] text-(--t2) mt-1 font-medium">Click or drag to select</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={loadImage} />
            </label>
        ) : (
            <>
            <div className="flex flex-col items-center pt-5 pb-2 gap-2">
            <div
            className="rounded-2xl overflow-hidden border-2 border-blue-600 cursor-grab active:cursor-grabbing select-none"
            style={{ width: SIZE, height: SIZE }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE, display: "block" }} />
            </div>
            <p className="text-[10px] text-(--t2) font-bold">Drag to adjust position</p>
            </div>

            <div className="px-5 space-y-3 pb-2">
            <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) w-16 flex-shrink-0">Scale</span>
            <input type="range" min="20" max="300" step="1" value={scale} className="flex-1"
            onChange={e => { const v = +e.target.value; setScale(v); draw(undefined, v); }} />
            <span className="text-[10px] font-bold text-(--t2) w-10 text-right">{scale}%</span>
            </div>
            <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) w-16 flex-shrink-0">Rotate</span>
            <input type="range" min="-180" max="180" step="1" value={rotate} className="flex-1"
            onChange={e => { const v = +e.target.value; setRotate(v); draw(undefined, undefined, v); }} />
            <span className="text-[10px] font-bold text-(--t2) w-10 text-right">{rotate}°</span>
            </div>
            </div>

            <div className="flex gap-2 p-5 pt-3">
            <button onClick={rotateCCW} className="flex-1 h-9 rounded-xl border border-(--brd) text-(--t2) text-xs font-black hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95">↺ −90°</button>
            <button onClick={rotateCW} className="flex-1 h-9 rounded-xl border border-(--brd) text-(--t2) text-xs font-black hover:border-blue-600/40 hover:text-blue-600 transition-all active:scale-95">↻ +90°</button>
            <button onClick={handleSave} disabled={uploading}
            className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20">
            {uploading ? <Loader size={13} className="animate-spin" /> : null}
            {uploading ? "..." : "Save"}
            </button>
            </div>

            <div className="text-center pb-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 cursor-pointer transition-colors">
            Change Image
            <input type="file" accept="image/*" className="hidden" onChange={loadImage} />
            </label>
            </div>
            </>
        )}
        </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TeamProfilePage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const params = useParams();
    const { dark } = useTheme();
    const { user, isLoading: authLoading } = useAuth();

    const { locale, t } = useLanguage();
    const [team, setTeam]           = useState<Team | null>(null);
    const [captain, setCaptain]     = useState<TeamMember | null>(null);
    const [members, setMembers]     = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);

    const teamId = params.id as string;

    // Auth guard
    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

        // Fetch team data
        useEffect(() => {
            if (!user || !teamId) return;

            const fetchTeam = async () => {
                setIsLoading(true);
                try {
                    const { data: teamData, error: teamErr } = await supabase
                    .from("teams")
                    .select("id, name, city_school_org, captain_id, members_ids, telegram_url, discord_url, created_at, tournament_id, avatar_url")
                    .eq("id", teamId)
                    .single();

                    if (teamErr || !teamData) throw new Error("Team not found");
                    setTeam(teamData);

                    if (teamData.tournament_id) {
                        const { data: tourData } = await supabase
                        .from("tournaments")
                        .select("id, name, status, start_at, registration_from, registration_to")
                        .eq("id", teamData.tournament_id)
                        .single();
                        if (tourData) setTournament(tourData);
                    }

                    const allIds: string[] = [];
                    if (teamData.captain_id) allIds.push(teamData.captain_id);
                    if (teamData.members_ids?.length) allIds.push(...teamData.members_ids);
                    const uniqueIds = [...new Set(allIds)];

                    if (uniqueIds.length > 0) {
                        const { data: accounts } = await supabase
                        .from("account")
                        .select("id, username, login, email, role, avatar_url, status")
                        .in("id", uniqueIds);

                        const accountMap: Record<string, TeamMember> = {};
                        (accounts ?? []).forEach(a => { accountMap[a.id] = a; });

                        if (teamData.captain_id && accountMap[teamData.captain_id]) {
                            setCaptain(accountMap[teamData.captain_id]);
                        }

                        const memberList = (teamData.members_ids ?? [])
                        .map((id: string) => accountMap[id])
                        .filter(Boolean);
                        setMembers(memberList);
                    }
                } catch (e: any) {
                    setError(e.message ?? "Failed to load team");
                } finally {
                    setIsLoading(false);
                }
            };

            fetchTeam();
        }, [user, teamId]);

        const isMyTeam  = team?.captain_id === user?.id;
        const gradient  = gradients[teamId ? teamId.charCodeAt(0) % gradients.length : 0];
        const initial   = team?.name?.charAt(0).toUpperCase() ?? "?";
        const allMembers = captain ? [captain, ...members.filter(m => m.id !== captain.id)] : members;

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
                @keyframes cardDrop { from{opacity:0;transform:translateY(-16px) scale(.97)} to{opacity:1;transform:none} }
                @keyframes shimmer  { from{background-position:-200% 0} to{background-position:200% 0} }
                .fuIn { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn { animation: cardDrop 420ms cubic-bezier(.22,1,.36,1) both }
                .spr  { transition: transform 170ms cubic-bezier(.22,1,.36,1), box-shadow 170ms ease }
                .spr:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 8px 24px rgba(37,99,235,0.12); }
                .skeleton {
                    background: linear-gradient(90deg, var(--brd) 25%, var(--bg) 50%, var(--brd) 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 0.75rem;
                }
                `}</style>

                {/* Team avatar modal */}
                {avatarModalOpen && team && (
                    <TeamAvatarModal
                    teamId={team.id}
                    onSave={(url) => setTeam(prev => prev ? { ...prev, avatar_url: url } : prev)}
                    onClose={() => setAvatarModalOpen(false)}
                    />
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
                title={team?.name ?? t.teamProfile.teamFallback}
                icon={<Users size={18} className="text-blue-600" />}
                />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">{t.teamProfile.breadcrumbHome}</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push("/teams")} className="hover:text-blue-600 transition-colors">{t.teamProfile.breadcrumbTeams}</button>
                <ChevronRight size={10} />
                <span className="text-(--t1) truncate max-w-[120px]">{isLoading ? t.teamProfile.breadcrumbLoading : team?.name ?? t.teamProfile.breadcrumbFallback}</span>
                </nav>

                <button
                onClick={() => router.push("/teams")}
                className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors"
                >
                <ArrowLeft size={14} /> {t.teamProfile.back}
                </button>

                {/* Error state */}
                {error && (
                    <div className="max-w-2xl bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) p-12 text-center">
                    <Users className="w-16 h-16 text-(--t2) mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-black text-(--t1) mb-2">{t.teamProfile.notFound}</p>
                    <p className="text-(--t2) text-sm">{error}</p>
                    <button
                    onClick={() => router.push("/teams")}
                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 py-3 hover:bg-blue-700 transition-all active:scale-95"
                    >
                    ← До списку команд
                    </button>
                    </div>
                )}

                {/* Loading skeleton */}
                {isLoading && !error && (
                    <div className="max-w-3xl space-y-5">
                    <div className="skeleton h-48 w-full" />
                    <div className="skeleton h-32 w-full" />
                    <div className="skeleton h-64 w-full" />
                    </div>
                )}

                {/* Team profile */}
                {!isLoading && !error && team && (
                    <div className="max-w-3xl space-y-5">

                    {/* Hero card */}
                    <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-xl overflow-hidden">
                    {/* Gradient top bar */}
                    <div className={`h-2 w-full bg-gradient-to-r ${gradient}`} />

                    <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">

                    {/* Avatar with optional change button */}
                    <div className="relative flex-shrink-0 group/avatar">
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center shadow-lg ${team.avatar_url ? "" : `bg-gradient-to-br ${gradient}`}`}>
                    {team.avatar_url
                        ? <img src={team.avatar_url} alt={team.name} className="w-full h-full object-cover" />
                        : <span className="text-white font-black text-3xl sm:text-4xl">{initial}</span>
                    }
                    </div>
                    {/* Camera overlay — only for captain */}
                    {isMyTeam && (
                        <button
                        onClick={() => setAvatarModalOpen(true)}
                        className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                        title={t.teamProfile.avatarChangeTip}
                        >
                        <Camera size={20} className="text-white" />
                        </button>
                    )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-black text-(--t1) uppercase tracking-tight">
                    {team.name}
                    </h1>
                    {isMyTeam && (
                        <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Star size={9} className="fill-amber-500" /> Моя команда
                        </span>
                    )}
                    </div>

                    {team.city_school_org && (
                        <p className="text-sm font-bold text-(--t2) uppercase tracking-wider mb-3">{team.city_school_org}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-(--t2)">
                    <Users size={14} />
                    <span className="text-[11px] font-black uppercase tracking-wider">
                    {allMembers.length}{allMembers.length === 1 ? t.teamProfile.memberCount_one : t.teamProfile.memberCount_many}
                    </span>
                    </div>
                    {team.created_at && (
                        <div className="flex items-center gap-1.5 text-(--t2)">
                        <Calendar size={14} />
                        <span className="text-[11px] font-black uppercase tracking-wider">
                        {new Date(team.created_at).toLocaleDateString(locale === "ua" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                        </div>
                    )}
                    </div>

                    {/* Change avatar button (text, for captain) */}
                    {isMyTeam && (
                        <button
                        onClick={() => setAvatarModalOpen(true)}
                        className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors"
                        >
                        <Camera size={11} /> Змінити аватар
                        </button>
                    )}
                    </div>
                    </div>

                    {/* ID row */}
                    <div className="mt-5 pt-4 border-t border-(--brd) flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">ID:</span>
                    <span className="text-[10px] font-bold text-(--t2) font-mono">{team.id}</span>
                    <CopyButton text={team.id} />
                    </div>
                    </div>
                    </section>

                    {/* Social links */}
                    {(team.telegram_url || team.discord_url) && (
                        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm p-6 sm:p-8" style={{ animationDelay: "60ms" }}>
                        <h2 className="text-xs font-black uppercase tracking-widest text-(--t2) mb-4">{t.teamProfile.socialTitle}</h2>
                        <div className="flex flex-wrap gap-3">
                        {team.telegram_url && (
                            <a
                            href={team.telegram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="spr flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-500 font-black text-xs uppercase tracking-widest hover:bg-sky-500/20 transition-all active:scale-95"
                            >
                            <Send size={14} /> Telegram
                            <ExternalLink size={11} className="opacity-60" />
                            </a>
                        )}
                        {team.discord_url && (
                            <a
                            href={team.discord_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="spr flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 font-black text-xs uppercase tracking-widest hover:bg-indigo-500/20 transition-all active:scale-95"
                            >
                            <MessageSquare size={14} /> Discord
                            <ExternalLink size={11} className="opacity-60" />
                            </a>
                        )}
                        </div>
                        </section>
                    )}

                    {/* Tournament badge */}
                    {tournament && (
                        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm overflow-hidden" style={{ animationDelay: "75ms" }}>
                        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-blue-500/5">
                        <Trophy size={14} className="text-blue-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-blue-500">{t.teamProfile.tournamentTitle}</h2>
                        </div>
                        <div className="p-6 sm:p-8">
                        <button
                        onClick={() => router.push(`/tournaments/${tournament.id}`)}
                        className="w-full flex items-center gap-4 group text-left"
                        >
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
                        <Trophy size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-(--t1) text-sm truncate group-hover:text-blue-500 transition-colors">
                        {tournament.name}
                        </span>
                        {tournament.status && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border flex-shrink-0 text-(--t2) bg-(--bg) border-(--brd)">
                            {tournament.status === "active" || tournament.status === "ongoing" ? t.teamProfile.tournamentStatusActive
                                : tournament.status === "registration" ? t.teamProfile.tournamentStatusRegistration
                                : tournament.status === "upcoming" ? t.teamProfile.tournamentStatusUpcoming
                                : tournament.status === "finished" ? t.teamProfile.tournamentStatusFinished
                                : tournament.status}
                                </span>
                        )}
                        </div>
                        {tournament.start_at && (
                            <p className="text-[10px] font-bold text-(--t2)">
                            Початок: {new Date(tournament.start_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" })}
                            </p>
                        )}
                        </div>
                        <ExternalLink size={14} className="text-(--t2) flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        </div>
                        </section>
                    )}

                    {/* Captain card */}
                    {captain && (
                        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-amber-500/20 shadow-sm overflow-hidden" style={{ animationDelay: "90ms" }}>
                        <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-amber-500/5">
                        <Crown size={14} className="text-amber-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-amber-500">{t.teamProfile.captainTitle}</h2>
                        </div>
                        <div className="p-6 sm:p-8">
                        <MemberRow member={captain} isCaptain onClick={() => router.push(captain.id === user?.id ? "/profile" : `/user/${captain.id}`)} />
                        </div>
                        </section>
                    )}

                    {/* Members */}
                    <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-sm overflow-hidden" style={{ animationDelay: "130ms" }}>
                    <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-(--brd)">
                    <div className="flex items-center gap-3">
                    <Users size={14} className="text-blue-600" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-(--t1)">{t.teamProfile.membersTitle}</h2>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-(--bg) border border-(--brd) text-(--t2)">
                    {members.length} / 10
                    </span>
                    </div>
                    <div className="divide-y divide-(--brd)">
                    {members.length === 0 ? (
                        <div className="px-6 sm:px-8 py-10 text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">{t.teamProfile.noMembers}</p>
                        </div>
                    ) : (
                        members.map((m, i) => (
                            <div key={m.id} className="px-6 sm:px-8 py-4 fuIn" style={{ animationDelay: `${150 + i * 50}ms` }}>
                            <MemberRow
                            member={m}
                            onClick={() => router.push(m.id === user?.id ? "/profile" : `/user/${m.id}`)}
                            />
                            </div>
                        ))
                    )}
                    </div>
                    </section>

                    {/* Edit button — only for captain */}
                    {isMyTeam && (
                        <div className="fuIn pt-2" style={{ animationDelay: "300ms" }}>
                        <button
                        onClick={() => router.push(`/teams/${teamId}/edit`)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-(--card) border border-(--brd) text-(--t2) font-black text-xs uppercase tracking-widest rounded-2xl px-8 py-4 hover:bg-(--bg) hover:text-(--t1) transition-all active:scale-95"
                        >
                        {t.teamProfile.editBtn}
                        </button>
                        </div>
                    )}
                    </div>
                )}
                </div>
                </main>
                </div>
        );
}

function MemberRow({ member, isCaptain, onClick }: { member: TeamMember; isCaptain?: boolean; onClick?: () => void }) {
    const letter = (member.username || member.login || "?").charAt(0).toUpperCase();
    const { t } = useLanguage();
    return (
        <div
        className="flex items-center gap-4 cursor-pointer group"
        onClick={onClick}
        >
        <div className="w-10 h-10 rounded-full bg-blue-600/10 border-2 border-(--brd) flex items-center justify-center font-black text-blue-600 flex-shrink-0 overflow-hidden group-hover:border-blue-600/40 transition-colors">
        {member.avatar_url
            ? <img src={member.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            : letter
        }
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
        <p className="font-black text-(--t1) text-sm truncate group-hover:text-blue-600 transition-colors">
        {member.username}
        </p>
        {isCaptain && (
            <Crown size={11} className="text-amber-500 flex-shrink-0" />
        )}
        </div>
        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-wider">@{member.login}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${roleBadge(member.role)}`}>
        {member.role}
        </span>
        {member.status === "active" && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title={t.teamProfile.statusActive} />
        )}
        <ChevronRight size={14} className="text-(--t2) group-hover:text-blue-600 transition-colors" />
        </div>
        </div>
    );
}
