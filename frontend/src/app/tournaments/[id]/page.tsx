// src/app/tournaments/[id]/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
    Trophy, Users, ArrowLeft, Loader, Edit, ChevronRight, Clock,
    Flag, Lock, LayoutList, Star, Download, Award, X, Upload,
    Eye, Crown, Medal, Hash, TrendingUp, AlertCircle, Loader2, FileText,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Deadline } from "@/components/Deadline";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Round {
    id: string;
    tournament_id: string;
    number: number;
    name: string;
    description?: string;
    start_at?: string;
    end_at?: string;
    status?: string;
}

interface Team {
    id: string;
    name: string;
    city_school_org?: string;
    captain_id?: string;
    members_ids?: string[];
    avatar_url?: string;
}

interface JuryMember {
    jury_id: string;
    username: string;
    avatar_url?: string;
}

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    max_teams?: number;
    rounds?: number;
    status: string;
    start_at?: string;
    end_at?: string;
    registration_from?: string;
    registration_to?: string;
    banner_url?: string;
    teams: Team[];
}

interface LeaderboardRound {
    id: string;
    name: string;
    number: number;
    status: string;
}

interface LeaderboardEntry {
    place: number;
    team_id: string;
    team_name: string;
    city_school_org?: string;
    captain_username?: string;
    round_scores: Record<string, number | null>;
    total_score: number;
    evaluated_rounds: number;
}

type Tab = "info" | "leaderboard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("uk-UA", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

const placeColors: Record<number, string> = {
    1: "text-yellow-500",
    2: "text-slate-400",
    3: "text-amber-600",
};

const placeBg: Record<number, string> = {
    1: "bg-yellow-500/10 border-yellow-500/30",
    2: "bg-slate-400/10 border-slate-400/30",
    3: "bg-amber-600/10 border-amber-600/30",
};

const PlaceIcon = ({ place }: { place: number }) => {
    if (place === 1) return <Crown size={16} className="text-yellow-500" />;
    if (place === 2) return <Medal size={16} className="text-slate-400" />;
    if (place === 3) return <Medal size={16} className="text-amber-600" />;
    return <span className="text-xs font-black text-(--t2)">#{place}</span>;
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(
    leaderboard: LeaderboardEntry[],
    rounds: LeaderboardRound[],
    tournamentName: string
) {
    const sorted = [...leaderboard].sort((a, b) => b.total_score - a.total_score);

    const esc = (v: string | number | undefined | null) => {
        const s = v === null || v === undefined ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
    };

    const roundHeaders = rounds.map(r => esc(r.name || `Раунд ${r.number}`));
    const headers = [
        esc("Місце"), esc("Команда"), esc("Місто / Школа / Організація"),
        esc("Капітан"), ...roundHeaders, esc("Загальна сума"),
    ];

    const rows = sorted.map(entry => {
        const roundCols = rounds.map(r => {
            const score = entry.round_scores[r.id];
            return score !== null && score !== undefined ? score.toFixed(1) : "";
        });
        return [entry.place, esc(entry.team_name), esc(entry.city_school_org || ""),
                            esc(entry.captain_username || ""), ...roundCols, entry.total_score.toFixed(1)].join(",");
    });

    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Лідерборд_${tournamentName.replace(/[^\wа-яА-ЯіІїЇєЄ ]/g, "_").trim()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Certificate Modal ────────────────────────────────────────────────────────

type CertTarget = "all" | "winners";

interface CertModalProps {
    leaderboard: LeaderboardEntry[];
    tournamentName: string;
    onClose: () => void;
}

// Text field definition for the editor
interface TextField {
    id: string;
    label: string;        // UI label
    value: string;        // placeholder value shown in editor
    isDynamic: boolean;   // dynamic = replaced per-entry
    x: number;            // 0–100 % of canvas width
    y: number;            // 0–100 % of canvas height
    fontSize: number;     // px on canvas (scaled to mm on export)
    color: string;        // hex
    bold: boolean;
    align: "left" | "center" | "right";
}

// Draw text on a canvas 2d context with proper cyrillic support
function drawTextOnCanvas(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    fontSize: number,
    color: string,
    bold: boolean,
    align: "left" | "center" | "right"
) {
    ctx.font = `${bold ? "bold" : "normal"} ${fontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
}

function CertificateModal({ leaderboard, tournamentName, onClose }: CertModalProps) {
    const [template, setTemplate] = useState<string | null>(null);
    const [templateName, setTemplateName] = useState("");
    const [target, setTarget] = useState<CertTarget>("winners");
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1=upload, 2=editor, 3=generate
    const [selectedField, setSelectedField] = useState<string | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const fileRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const templateImgRef = useRef<HTMLImageElement | null>(null);

    // Default text fields
    const [fields, setFields] = useState<TextField[]>([
        { id: "tournament", label: "Назва турніру",  value: tournamentName,        isDynamic: false, x: 50, y: 38, fontSize: 22, color: "#3c3c3c", bold: true,  align: "center" },
        { id: "team",       label: "Назва команди",  value: "{{team_name}}",       isDynamic: true,  x: 50, y: 52, fontSize: 36, color: "#141414", bold: true,  align: "center" },
        { id: "place",      label: "Місце",           value: "{{place}}",           isDynamic: true,  x: 50, y: 63, fontSize: 24, color: "#6b4a00", bold: true,  align: "center" },
        { id: "score",      label: "Сума балів",      value: "{{score}} балів",     isDynamic: true,  x: 50, y: 72, fontSize: 16, color: "#505050", bold: false, align: "center" },
        { id: "org",        label: "Школа/Організація", value: "{{city_school_org}}", isDynamic: true, x: 50, y: 79, fontSize: 13, color: "#787878", bold: false, align: "center" },
        { id: "date",       label: "Дата",            value: new Date().toLocaleDateString("uk-UA"), isDynamic: false, x: 50, y: 87, fontSize: 11, color: "#969696", bold: false, align: "center" },
    ]);

    const participants = target === "winners"
    ? leaderboard.filter(e => e.place <= 3)
    : leaderboard;

    // Load template image into ref
    useEffect(() => {
        if (!template) return;
        const img = new Image();
        img.onload = () => { templateImgRef.current = img; renderPreview(); };
        img.src = template;
    }, [template]);

    // Re-render preview when fields or selection change
    useEffect(() => { if (template) renderPreview(); }, [fields, selectedField, template]);

    function renderPreview(sampleEntry?: LeaderboardEntry) {
        const canvas = previewCanvasRef.current;
        if (!canvas || !templateImgRef.current) return;
        const img = templateImgRef.current;
        const W = canvas.width, H = canvas.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);

        // For the preview, resolve dynamic fields with a sample or placeholder
        const entry = sampleEntry ?? leaderboard[0];
        fields.forEach(f => {
            let text = f.value;
            if (f.isDynamic && entry) {
                const placeText = entry.place === 1 ? "🥇 1 місце" : entry.place === 2 ? "🥈 2 місце" : entry.place === 3 ? "🥉 3 місце" : `${entry.place} місце`;
                text = text
                .replace("{{team_name}}", entry.team_name)
                .replace("{{place}}", placeText)
                .replace("{{score}}", entry.total_score.toFixed(1))
                .replace("{{city_school_org}}", entry.city_school_org || "");
            }
            if (!text) return;
            const px = (f.x / 100) * W;
            const py = (f.y / 100) * H;
            drawTextOnCanvas(ctx, text, px, py, f.fontSize, f.color, f.bold, f.align);

            // Draw selection highlight
            if (selectedField === f.id) {
                const measured = ctx.measureText(text);
                const tw = measured.width;
                const th = f.fontSize;
                const lx = f.align === "center" ? px - tw / 2 : f.align === "right" ? px - tw : px;
                ctx.strokeStyle = "#2563eb";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(lx - 6, py - th / 2 - 4, tw + 12, th + 8);
                ctx.setLineDash([]);
            }
        });
    }

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setTemplateName(file.name);
        const reader = new FileReader();
        reader.onload = ev => {
            setTemplate(ev.target?.result as string);
            setStep(2);
        };
        reader.readAsDataURL(file);
    }

    // Mouse events for drag
    function getCanvasPos(e: React.MouseEvent) {
        const canvas = previewCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        };
    }

    function onCanvasMouseDown(e: React.MouseEvent) {
        const pos = getCanvasPos(e);
        const canvas = previewCanvasRef.current;
        if (!canvas || !templateImgRef.current) return;
        const W = canvas.width, H = canvas.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Find clicked field (last = topmost)
        let hit: TextField | null = null;
        for (let i = fields.length - 1; i >= 0; i--) {
            const f = fields[i];
            let text = f.value;
            if (f.isDynamic && leaderboard[0]) {
                const entry = leaderboard[0];
                const placeText = entry.place === 1 ? "🥇 1 місце" : entry.place === 2 ? "🥈 2 місце" : entry.place === 3 ? "🥉 3 місце" : `${entry.place} місце`;
                text = text.replace("{{team_name}}", entry.team_name).replace("{{place}}", placeText).replace("{{score}}", entry.total_score.toFixed(1)).replace("{{city_school_org}}", entry.city_school_org || "");
            }
            ctx.font = `${f.bold ? "bold" : "normal"} ${f.fontSize}px Arial`;
            const tw = ctx.measureText(text).width;
            const th = f.fontSize;
            const px = (f.x / 100) * W; const py = (f.y / 100) * H;
            const lx = f.align === "center" ? px - tw / 2 : f.align === "right" ? px - tw : px;
            const hitX = (lx / W) * 100 - 1; const hitY = ((py - th / 2) / H) * 100 - 1;
            const hitW = (tw / W) * 100 + 2; const hitH = (th / H) * 100 + 2;
            if (pos.x >= hitX && pos.x <= hitX + hitW && pos.y >= hitY && pos.y <= hitY + hitH) {
                hit = f; break;
            }
        }
        if (hit) {
            setSelectedField(hit.id);
            setDragging(hit.id);
            setDragOffset({ x: pos.x - hit.x, y: pos.y - hit.y });
        } else {
            setSelectedField(null);
        }
    }

    function onCanvasMouseMove(e: React.MouseEvent) {
        if (!dragging) return;
        const pos = getCanvasPos(e);
        setFields(prev => prev.map(f => f.id === dragging
        ? { ...f, x: Math.max(0, Math.min(100, pos.x - dragOffset.x)), y: Math.max(0, Math.min(100, pos.y - dragOffset.y)) }
        : f
        ));
    }

    function onCanvasMouseUp() { setDragging(null); }

    function updateField(id: string, patch: Partial<TextField>) {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    }

    // Generate PDFs using canvas (supports cyrillic!)
    async function generate() {
        if (!template || !templateImgRef.current) return;
        setGenerating(true);
        setProgress(0);

        // A4 landscape: 297×210mm @ 3.78px/mm ≈ 1123×794px
        const EXPORT_W = 1123, EXPORT_H = 794;

        for (let i = 0; i < participants.length; i++) {
            const entry = participants[i];
            setProgress(Math.round(((i + 1) / participants.length) * 100));

            const placeText = entry.place === 1 ? "1 місце" : entry.place === 2 ? "2 місце" : entry.place === 3 ? "3 місце" : `${entry.place} місце`;

            // Draw everything on an offscreen canvas
            const cvs = document.createElement("canvas");
            cvs.width = EXPORT_W; cvs.height = EXPORT_H;
            const ctx = cvs.getContext("2d")!;
            ctx.drawImage(templateImgRef.current, 0, 0, EXPORT_W, EXPORT_H);

            fields.forEach(f => {
                let text = f.value;
                if (f.isDynamic) {
                    text = text
                    .replace("{{team_name}}", entry.team_name)
                    .replace("{{place}}", placeText)
                    .replace("{{score}}", entry.total_score.toFixed(1))
                    .replace("{{city_school_org}}", entry.city_school_org || "");
                }
                if (!text) return;
                // Scale fontSize proportionally from editor canvas (800px wide) to export canvas
                const scaledFontSize = f.fontSize * (EXPORT_W / 800);
                drawTextOnCanvas(ctx, text, (f.x / 100) * EXPORT_W, (f.y / 100) * EXPORT_H, scaledFontSize, f.color, f.bold, f.align);
            });

            // Canvas → dataURL → jsPDF (as image, so cyrillic is handled by canvas!)
            const imgData = cvs.toDataURL("image/jpeg", 0.95);
            const { jsPDF } = await import("jspdf");
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            doc.addImage(imgData, "JPEG", 0, 0, 297, 210);
            doc.save(`Сертифікат_${entry.team_name.replace(/[^\wа-яА-ЯіІїЇєЄ ]/g, "_")}_${entry.place}місце.pdf`);
            await new Promise(r => setTimeout(r, 300));
        }

        setGenerating(false);
        setProgress(100);
    }

    const selectedFieldObj = fields.find(f => f.id === selectedField) ?? null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
        <div className="bg-(--bg) border border-(--brd) rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: step === 2 ? "960px" : "520px", maxHeight: "96vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--brd) flex-shrink-0">
        <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
        <Award size={16} className="text-blue-600" />
        </div>
        <div>
        <h2 className="font-black text-(--t1) text-base leading-none">Генерація сертифікатів</h2>
        <p className="text-[10px] font-bold text-(--t2) mt-0.5">
        {step === 1 ? "Крок 1 — завантажте шаблон" : step === 2 ? "Крок 2 — розставте текст" : "Крок 3 — генерація"}
        </p>
        </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-(--card) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-red-500 hover:border-red-400/40 transition-all">
        <X size={14} />
        </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
            <div className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Макет сертифіката (JPG / PNG)</label>
            <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border-2 border-dashed border-(--brd) bg-(--card) hover:border-blue-600/40 cursor-pointer transition-all"
            >
            <Upload size={24} className="text-(--t2)" />
            <span className="text-sm font-bold text-(--t2)">Натисніть, щоб завантажити макет</span>
            <span className="text-[11px] text-(--t2)">JPG, PNG — рекомендовано A4 landscape (297×210 мм)</span>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
            </div>
            </div>
        )}

        {/* ── STEP 2: Editor ── */}
        {step === 2 && template && (
            <div className="flex flex-col lg:flex-row gap-0">

            {/* Canvas editor */}
            <div className="flex-1 p-4 flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Редактор — перетягніть текст на потрібне місце</p>
            <div ref={editorRef} className="relative rounded-xl overflow-hidden border border-(--brd) select-none"
            style={{ cursor: dragging ? "grabbing" : "default" }}>
            <canvas
            ref={previewCanvasRef}
            width={800} height={566}
            className="w-full h-auto block"
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            />
            </div>
            <p className="text-[10px] text-(--t2) font-bold text-center">Клікніть на текст щоб вибрати → потягніть щоб перемістити</p>
            </div>

            {/* Field controls */}
            <div className="lg:w-64 border-t lg:border-t-0 lg:border-l border-(--brd) flex flex-col">
            <div className="p-3 border-b border-(--brd)">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Текстові поля</p>
            </div>
            <div className="overflow-y-auto flex-1">
            {fields.map(f => (
                <div key={f.id}
                onClick={() => setSelectedField(f.id)}
                className={`px-3 py-2.5 border-b border-(--brd) cursor-pointer transition-colors text-xs font-bold flex items-center gap-2 ${selectedField === f.id ? "bg-blue-600/10 text-blue-600" : "text-(--t1) hover:bg-(--card)"}`}
                >
                <span className="flex-1 truncate">{f.label}</span>
                {f.isDynamic && <span className="text-[9px] font-black uppercase tracking-wider text-(--t2) bg-(--card) border border-(--brd) px-1.5 py-0.5 rounded-md">авто</span>}
                </div>
            ))}
            </div>

            {/* Selected field controls */}
            {selectedFieldObj && (
                <div className="p-3 border-t border-(--brd) flex flex-col gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{selectedFieldObj.label}</p>

                {/* Font size */}
                <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-(--t2)">Розмір: {selectedFieldObj.fontSize}px</label>
                <input type="range" min={8} max={80} value={selectedFieldObj.fontSize}
                onChange={e => updateField(selectedFieldObj.id, { fontSize: +e.target.value })}
                className="w-full accent-blue-600" />
                </div>

                {/* Color */}
                <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-(--t2) flex-1">Колір</label>
                <input type="color" value={selectedFieldObj.color}
                onChange={e => updateField(selectedFieldObj.id, { color: e.target.value })}
                className="w-8 h-7 rounded cursor-pointer border border-(--brd)" />
                </div>

                {/* Bold */}
                <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => updateField(selectedFieldObj.id, { bold: !selectedFieldObj.bold })}
                className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${selectedFieldObj.bold ? "bg-blue-600" : "bg-(--brd)"}`}>
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${selectedFieldObj.bold ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-[10px] font-bold text-(--t2)">Жирний</span>
                </label>

                {/* Align */}
                <div className="flex gap-1">
                {(["left", "center", "right"] as const).map(a => (
                    <button key={a} onClick={() => updateField(selectedFieldObj.id, { align: a })}
                    className={`flex-1 py-1 rounded-lg border text-[10px] font-black transition-all ${selectedFieldObj.align === a ? "bg-blue-600 text-white border-blue-600" : "border-(--brd) text-(--t2) hover:border-blue-600/30"}`}>
                    {a === "left" ? "←" : a === "center" ? "↔" : "→"}
                    </button>
                ))}
                </div>

                {/* Position */}
                <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-(--t2)">X: {selectedFieldObj.x.toFixed(1)}%</label>
                <input type="range" min={0} max={100} step={0.5} value={selectedFieldObj.x}
                onChange={e => updateField(selectedFieldObj.id, { x: +e.target.value })}
                className="w-full accent-blue-600" />
                </div>
                <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-(--t2)">Y: {selectedFieldObj.y.toFixed(1)}%</label>
                <input type="range" min={0} max={100} step={0.5} value={selectedFieldObj.y}
                onChange={e => updateField(selectedFieldObj.id, { y: +e.target.value })}
                className="w-full accent-blue-600" />
                </div>
                </div>

                {/* Custom text for non-dynamic */}
                {!selectedFieldObj.isDynamic && (
                    <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-(--t2)">Текст</label>
                    <input type="text" value={selectedFieldObj.value}
                    onChange={e => updateField(selectedFieldObj.id, { value: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-(--card) border border-(--brd) text-xs font-bold text-(--t1) focus:outline-none focus:border-blue-600/60" />
                    </div>
                )}
                </div>
            )}
            </div>
            </div>
        )}

        {/* ── STEP 3: Generate ── */}
        {step === 3 && (
            <div className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-(--t2)">Кому генерувати</label>
            <div className="grid grid-cols-2 gap-2">
            {(["winners", "all"] as CertTarget[]).map(t => (
                <button key={t} onClick={() => setTarget(t)}
                className={`py-3 px-4 rounded-xl border text-sm font-black transition-all
                    ${target === t ? "bg-blue-600 border-blue-600 text-white" : "bg-(--card) border-(--brd) text-(--t2) hover:border-blue-600/30"}`}>
                    {t === "winners" ? `🏆 Переможці (топ-3)` : `👥 Всі (${leaderboard.length})`}
                    </button>
            ))}
            </div>
            <p className="text-[11px] text-(--t2) font-bold">
            Буде згенеровано: <span className="text-blue-600">{participants.length} PDF</span>
            </p>
            </div>

            {generating && (
                <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[11px] font-black text-(--t2)">
                <span>Генерація...</span><span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-(--card) rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                </div>
            )}

            <button onClick={generate} disabled={generating}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {generating ? `Генерація... ${progress}%` : `Завантажити ${participants.length} сертифікат${participants.length === 1 ? "" : "и"}`}
            </button>

            <p className="text-[11px] text-(--t2) text-center font-bold">
            PDF файли завантажаться по одному. Переконайтесь, що браузер дозволяє множинне завантаження.
            </p>
            </div>
        )}

        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-(--brd) flex-shrink-0 gap-3">
        <button onClick={() => { if (step > 1) setStep((step - 1) as 1|2|3); else onClose(); }}
        className="px-5 py-2.5 rounded-xl border border-(--brd) text-xs font-black text-(--t2) hover:bg-(--card) transition-colors">
        {step === 1 ? "Скасувати" : "← Назад"}
        </button>
        {step < 3 && (
            <button
            onClick={() => setStep((step + 1) as 2|3)}
            disabled={step === 1 && !template}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {step === 1 ? "Далі — редактор →" : "Далі — генерація →"}
            </button>
        )}
        </div>
        </div>
        </div>
    );
}

// ─── Inline Leaderboard ───────────────────────────────────────────────────────

interface InlineLeaderboardProps {
    tournamentId: string;
    tournamentName: string;
    isAdmin: boolean;
}

function InlineLeaderboard({ tournamentId, tournamentName, isAdmin }: InlineLeaderboardProps) {
    const router = useRouter();
    const [lbRounds, setLbRounds] = useState<LeaderboardRound[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [certOpen, setCertOpen] = useState(false);

    useEffect(() => { fetchLeaderboard(); }, [tournamentId]);

    async function fetchLeaderboard() {
        setLoading(true);
        setError(null);
        try {
            const token = (typeof window !== "undefined" ? localStorage.getItem("access_token") : null) || "";
            const headers: Record<string, string> = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${API_URL}/api/tournaments/${tournamentId}/leaderboard`, { headers });
            if (!res.ok) throw new Error("Не вдалося завантажити таблицю лідерів");
            const data = await res.json();
            setLbRounds(data.rounds || []);
            setLeaderboard(data.leaderboard || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Помилка завантаження");
        } finally {
            setLoading(false);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-(--t2)" />
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-sm font-bold text-(--t2)">{error}</p>
        </div>
    );

    const isEmpty = leaderboard.length === 0;

    return (
        <>
        {/* Actions */}
        {!isEmpty && (
            <div className="flex items-center gap-2 flex-wrap mb-6">
            <button
            onClick={() => exportToCSV(leaderboard, lbRounds, tournamentName)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black bg-(--bg) border border-(--brd) text-(--t1) hover:border-green-500/40 hover:text-green-600 hover:bg-green-500/5 transition-all"
            >
            <Download size={14} /> Завантажити CSV
            </button>
            {isAdmin && (
                <button
                onClick={() => setCertOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black bg-blue-600/10 border border-blue-600/20 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                >
                <Award size={14} /> Сертифікати
                </button>
            )}
            </div>
        )}

        {/* Stats row */}
        {!isEmpty && (
            <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4 flex flex-col gap-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Команд</div>
            <div className="text-xl font-black text-(--t1) flex items-center gap-2">
            <Users size={14} className="text-blue-600" />{leaderboard.length}
            </div>
            </div>
            <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4 flex flex-col gap-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Раундів</div>
            <div className="text-xl font-black text-(--t1) flex items-center gap-2">
            <Hash size={14} className="text-blue-600" />{lbRounds.length}
            </div>
            </div>
            <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4 flex flex-col gap-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Лідер</div>
            <div className="text-sm font-black text-yellow-500 truncate">{leaderboard[0]?.team_name || "—"}</div>
            </div>
            </div>
        )}

        {/* Podium top-3 */}
        {leaderboard.filter(e => e.total_score > 0).length >= 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {[1, 0, 2].map((idx) => {
                const entry = leaderboard[idx];
                if (!entry) return <div key={idx} />;
                const place = entry.place;
                return (
                    <div key={entry.team_id}
                    className={`relative rounded-2xl border p-5 flex flex-col items-center gap-2 text-center transition-all ${placeBg[place] || "bg-(--bg) border-(--brd)"} ${place === 1 ? "sm:-mt-4 sm:shadow-lg" : ""}`}
                    >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${place === 1 ? "bg-yellow-500/20" : place === 2 ? "bg-slate-400/20" : "bg-amber-600/20"}`}>
                    <PlaceIcon place={place} />
                    </div>
                    <div className="font-black text-sm text-(--t1) leading-tight">{entry.team_name}</div>
                    {entry.city_school_org && <div className="text-[11px] text-(--t2) font-bold">{entry.city_school_org}</div>}
                    <div className={`text-2xl font-black mt-1 ${placeColors[place] || "text-(--t1)"}`}>{entry.total_score.toFixed(1)}</div>
                    <div className="text-[10px] text-(--t2) font-black uppercase tracking-wider">балів</div>
                    </div>
                );
            })}
            </div>
        )}

        {/* Table */}
        {isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-(--bg) border border-(--brd) flex items-center justify-center">
            <TrendingUp size={22} className="text-(--t2) opacity-50" />
            </div>
            <p className="font-black text-(--t1)">Результатів ще немає</p>
            <p className="text-sm text-(--t2) font-bold max-w-xs">
            Таблиця лідерів з&apos;явиться після того, як журі оцінять роботи команд
            </p>
            </div>
        ) : (
            <div className="bg-(--bg) border border-(--brd) rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
            <tr className="border-b border-(--brd) bg-(--card)">
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) w-12">#</th>
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2)">Команда</th>
            {lbRounds.map(r => (
                <th key={r.id} className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) whitespace-nowrap">
                {r.name || `Р.${r.number}`}
                </th>
            ))}
            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-(--t2) whitespace-nowrap">Сума ↓</th>
            </tr>
            </thead>
            <tbody>
            {leaderboard.map((entry) => {
                const isTop3 = entry.place <= 3;
                const isFirst = entry.place === 1;
                return (
                    <tr key={entry.team_id}
                    onClick={() => router.push(`/teams/${entry.team_id}`)}
                    className={`border-b border-(--brd) last:border-0 cursor-pointer transition-colors group ${isFirst ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-(--card)"}`}
                    >
                    <td className="px-4 py-3.5 w-12">
                    <div className="flex items-center justify-center w-8 h-8"><PlaceIcon place={entry.place} /></div>
                    </td>
                    <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-0.5">
                    <span className={`font-black text-sm group-hover:text-blue-600 transition-colors ${isTop3 ? placeColors[entry.place] || "text-(--t1)" : "text-(--t1)"}`}>
                    {entry.team_name}
                    </span>
                    {entry.captain_username && (
                        <span className="text-[11px] text-(--t2) font-bold flex items-center gap-1">
                        <Star size={9} />{entry.captain_username}
                        </span>
                    )}
                    {entry.city_school_org && (
                        <span className="text-[11px] text-(--t2) font-medium">{entry.city_school_org}</span>
                    )}
                    </div>
                    </td>
                    {lbRounds.map(r => {
                        const score = entry.round_scores[r.id];
                        return (
                            <td key={r.id} className="px-3 py-3.5 text-center">
                            {score !== null && score !== undefined
                                ? <span className="font-black text-sm text-(--t1)">{score.toFixed(1)}</span>
                                : <span className="text-(--t2) text-xs font-bold">—</span>
                            }
                            </td>
                        );
                    })}
                    <td className="px-4 py-3.5 text-right">
                    <span className={`font-black text-base ${isFirst ? "text-yellow-500" : isTop3 ? placeColors[entry.place] : "text-(--t1)"}`}>
                    {entry.total_score.toFixed(1)}
                    </span>
                    </td>
                    </tr>
                );
            })}
            </tbody>
            </table>
            </div>
            </div>
        )}

        <p className="mt-4 text-[11px] text-(--t2) font-bold text-center">
        Бали — середнє значення оцінок журі по кожному раунду. Відсортовано за спаданням.
        </p>

        {certOpen && (
            <CertificateModal
            leaderboard={leaderboard}
            tournamentName={tournamentName}
            onClose={() => setCertOpen(false)}
            />
        )}
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentPage() {
    const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar } = useSidebar();
    const router = useRouter();
    const params = useParams();
    const { user, isLoading: authLoading } = useAuth();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [rounds, setRounds] = useState<Round[]>([]);
    const [jury, setJury] = useState<JuryMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [unregistering, setUnregistering] = useState(false);
    const [registerError, setRegisterError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("info");
    const [leaderboardTouched, setLeaderboardTouched] = useState(false);

    useEffect(() => { if (id && !authLoading) fetchTournament(); }, [id, authLoading]);

    const fetchTournament = async () => {
        setLoading(true);
        try {
            const { data: tourData, error: tourErr } = await supabase
            .from("tournaments")
            .select("id, name, rules, max_teams, rounds, status, start_at, end_at, registration_from, registration_to, banner_url")
            .eq("id", id)
            .single();
            if (tourErr) throw tourErr;

            const { data: teamsData, error: teamsErr } = await supabase
            .from("teams")
            .select("id, name, city_school_org, captain_id, members_ids, avatar_url")
            .eq("tournament_id", id);
            if (teamsErr) throw teamsErr;

            setTournament({ ...tourData, teams: teamsData ?? [] });

            const { data: roundsData } = await supabase
            .from("rounds")
            .select("id, tournament_id, number, name, description, start_at, end_at, status")
            .eq("tournament_id", id)
            .order("number", { ascending: true });
            setRounds(roundsData ?? []);

            const { data: juryInvites } = await supabase
            .from("jury_tournament_invitations")
            .select("jury_id")
            .eq("tournament_id", id)
            .eq("status", "accepted");

            if (juryInvites && juryInvites.length > 0) {
                const juryIds = [...new Set(juryInvites.map((j: any) => j.jury_id))];
                const { data: juryAccounts } = await supabase
                .from("account")
                .select("id, username, avatar_url")
                .in("id", juryIds);
                const accountMap: Record<string, any> = {};
                (juryAccounts ?? []).forEach((a: any) => { accountMap[a.id] = a; });
                setJury(juryIds.map(jid => ({
                    jury_id: jid,
                    username: accountMap[jid]?.username ?? "—",
                    avatar_url: accountMap[jid]?.avatar_url ?? null,
                })));
            } else {
                setJury([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [teamPickerOpen, setTeamPickerOpen] = useState(false);
    const [eligibleTeams, setEligibleTeams] = useState<{ id: string; name: string }[]>([]);

    const handleRegister = async () => {
        if (!user || !tournament) return;
        setRegisterError(null);

        const { data: captainTeams, error: teamErr } = await supabase
        .from("teams")
        .select("id, name, tournament_id")
        .eq("captain_id", user.id);

        if (teamErr || !captainTeams || captainTeams.length === 0) {
            setRegisterError("У вас немає команди або ви не є капітаном жодної команди");
            return;
        }

        const eligible = captainTeams.filter(t => !t.tournament_id);
        if (eligible.length === 0) {
            setRegisterError("Всі ваші команди вже зареєстровані в турнірах");
            return;
        }

        if (eligible.length === 1) {
            await doRegister(eligible[0].id);
        } else {
            setEligibleTeams(eligible);
            setTeamPickerOpen(true);
        }
    };

    const doRegister = async (teamId: string) => {
        setTeamPickerOpen(false);
        setRegistering(true);
        try {
            const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
            const res = await fetch(`${API_URL}/api/tournaments/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ team_id: teamId, tournament_id: id }),
            });
            const data = await res.json();
            if (!res.ok) { setRegisterError(data.detail ?? "Помилка реєстрації"); return; }
            await fetchTournament();
        } catch (e: any) {
            setRegisterError("Помилка з'єднання з сервером: " + e.message);
        } finally {
            setRegistering(false);
        }
    };

    const handleUnregister = async () => {
        if (!user || !tournament || !myTeamInTournament) return;
        setRegisterError(null);
        setUnregistering(true);
        try {
            const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
            const res = await fetch(`${API_URL}/api/tournaments/unregister`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ team_id: myTeamInTournament.id, tournament_id: id }),
            });
            const data = await res.json();
            if (!res.ok) { setRegisterError(data.detail ?? "Помилка скасування реєстрації"); return; }
            await fetchTournament();
        } catch (e: any) {
            setRegisterError("Помилка з'єднання з сервером: " + e.message);
        } finally {
            setUnregistering(false);
        }
    };

    if (authLoading || loading || !tournament) {
        return (
            <div className="min-h-screen bg-(--bg) flex items-center justify-center">
            <Loader className="animate-spin text-blue-600" />
            </div>
        );
    }

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "info", label: "Огляд", icon: <LayoutList size={14} /> },
        { key: "leaderboard", label: "Лідербоард", icon: <Trophy size={14} /> },
    ];

    const handleTabClick = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === "leaderboard") setLeaderboardTouched(true);
    };

        const teamCount = tournament.teams.length;
        const isFull = !!(tournament.max_teams && teamCount >= tournament.max_teams);
        const now = Date.now();
        const regStart = tournament.registration_from ? new Date(tournament.registration_from).getTime() : 0;
        const regEnd = tournament.registration_to ? new Date(tournament.registration_to).getTime() : 0;
        const isRegistrationOpen = regEnd > 0 ? now >= regStart && now <= regEnd : false;
        const isAdmin = user?.role === "admin" || user?.role === "superadmin";
        const myTeamInTournament = user
        ? tournament.teams.find(t => t.captain_id === user.id || (t.members_ids ?? []).includes(user.id))
        : null;

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1)">
            <div className={`fixed inset-y-0 left-[152px] right-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
            <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] blur-sm ${dark ? "invert" : ""}`} />
            </div>

            {isMobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => closeMobileSidebar()} />
            )}
            <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
            <Sidebar />
            </div>

            <main className="flex-1 flex flex-col overflow-y-auto">
            <MobileHeader
            onOpenSidebar={openMobile}
            title={tournament.name}
            icon={<Trophy size={18} className="text-blue-600" />}
            />

            <div className="p-4 sm:p-6 md:p-8 max-w-3xl w-full mx-auto flex flex-col gap-5 relative z-10">
            <button
            onClick={() => router.push("/tournaments")}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors w-fit"
            >
            <ArrowLeft size={14} /> Назад до турнірів
            </button>

            {tournament.banner_url && (
                <div className="rounded-2xl sm:rounded-[2rem] overflow-hidden border border-(--brd) shadow-xl">
                <img src={tournament.banner_url} alt={tournament.name} className="w-full max-h-72 object-cover" />
                </div>
            )}

            {/* Hero header card */}
            <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
            <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--brd)">
            <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center flex-shrink-0">
            <Trophy size={16} className="text-(--t2)" />
            </div>
            <h1 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">{tournament.name}</h1>
            </div>
            {isAdmin && (
                <button
                onClick={() => router.push(`/tournaments/${id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-600/30 text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 hover:border-blue-600/50 text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                >
                <Edit size={13} /> Редагувати
                </button>
            )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 m-4 sm:m-6 mt-4 sm:mt-4 bg-(--bg) border border-(--brd) rounded-xl overflow-hidden">
            {tabs.map((tab) => (
                <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab.key
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-(--t2) hover:text-(--t1) hover:bg-(--card)"
                }`}
                >
                {tab.icon}{tab.label}
                </button>
            ))}
            </div>
            </div>

            {/* ── Tab: Огляд ── */}
            {activeTab === "info" && (
                <>
                {/* Stats */}
                <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
                <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-3 border-b border-(--brd)">
                <div className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-(--t2)" />
                </div>
                <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">Інформація</h2>
                </div>
                <div className="p-4 sm:p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Команди</div>
                <div className="text-xl font-black text-(--t1) flex items-end gap-1">
                {teamCount}
                {tournament.max_teams && <span className="text-sm font-bold text-(--t2)">/ {tournament.max_teams}</span>}
                </div>
                </div>
                {tournament.rounds && (
                    <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Раунди</div>
                    <div className="text-xl font-black text-(--t1)">{tournament.rounds}</div>
                    </div>
                )}
                {tournament.start_at && (
                    <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4 col-span-2 sm:col-span-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Старт</div>
                    <div className="text-sm font-black text-(--t1)">{fmtDate(tournament.start_at)}</div>
                    </div>
                )}
                {tournament.end_at && (
                    <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4 col-span-2 sm:col-span-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">Кінець</div>
                    <div className="text-sm font-black text-(--t1)">{fmtDate(tournament.end_at)}</div>
                    </div>
                )}
                {tournament.registration_from && (
                    <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-0.5">Реєстрація від</div>
                    <div className="text-sm font-bold text-(--t1)">{fmtDate(tournament.registration_from)}</div>
                    </div>
                )}
                {tournament.registration_to && (
                    <div className="bg-(--bg) border border-(--brd) rounded-2xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-0.5">Реєстрація до</div>
                    <div className="text-sm font-bold text-(--t1)">{fmtDate(tournament.registration_to)}</div>
                    </div>
                )}
                </div>
                </div>

                {tournament.registration_to && (
                    <Deadline
                    endAt={tournament.registration_to}
                    startAt={tournament.registration_from}
                    activeLabel="До завершення реєстрації команд"
                    endedLabel="Реєстрація завершена"
                    />
                )}

                {tournament.rules && (
                    <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
                    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-3 border-b border-(--brd)">
                    <div className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center flex-shrink-0">
                    <LayoutList size={16} className="text-(--t2)" />
                    </div>
                    <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">Правила</h2>
                    </div>
                    <div className="p-4 sm:p-6 md:p-8">
                    <MarkdownRenderer content={tournament.rules} />
                    </div>
                    </div>
                )}

                {/* Team picker modal */}
                {teamPickerOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-(--card) border border-(--brd) rounded-[2rem] shadow-2xl p-6 w-full max-w-sm">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-(--t1) mb-1">Оберіть команду</h3>
                    <p className="text-xs text-(--t2) mb-4">У вас кілька команд без турніру. Оберіть, яку зареєструвати:</p>
                    <div className="flex flex-col gap-2 mb-4">
                    {eligibleTeams.map(t => (
                        <button key={t.id} onClick={() => doRegister(t.id)}
                        className="w-full text-left px-4 py-3 rounded-xl border border-(--brd) bg-(--bg) hover:border-blue-600/50 hover:bg-blue-600/5 text-sm font-bold text-(--t1) transition-all"
                        >
                        {t.name}
                        </button>
                    ))}
                    </div>
                    <button onClick={() => setTeamPickerOpen(false)}
                    className="w-full px-4 py-2 rounded-xl border border-(--brd) text-[10px] font-black uppercase tracking-widest text-(--t2) hover:bg-(--bg) transition-all"
                    >
                    Скасувати
                    </button>
                    </div>
                    </div>
                )}

                {/* Rounds */}
                {rounds.length > 0 && (
                    <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
                    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-3 border-b border-(--brd)">
                    <div className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center flex-shrink-0">
                    <Flag size={16} className="text-(--t2)" />
                    </div>
                    <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">Раунди</h2>
                    </div>
                    <div className="p-4 sm:p-6 flex flex-col gap-2">
                    {rounds.map((round) => {
                        const now = Date.now();
                        const start = round.start_at ? new Date(round.start_at).getTime() : null;
                        const end = round.end_at ? new Date(round.end_at).getTime() : null;
                        const dbStatus = round.status;
                        const isFinished = dbStatus === "finished" || (!dbStatus && end && now > end);
                        const isActive = dbStatus === "active" || (!dbStatus && start && end && now >= start && now <= end);
                        const isPending = dbStatus === "pending" || (!dbStatus && start && now < start);

                        let statusLabel = "Очікується";
                        let statusColor = "text-(--t2)";
                        let statusBadgeBg = "bg-(--bg)";
                        let statusBadgeBorder = "border-(--brd)";
                        let dotColor = "bg-gray-400";

                        if (isFinished) {
                            statusLabel = "Завершено";
                        } else if (isActive) {
                            statusLabel = "Активний";
                            statusColor = "text-green-600";
                            dotColor = "bg-green-600";
                        }

                        const isLocked = isFinished;

                        return (
                            <div
                            key={round.id}
                            onClick={() => router.push(`/rounds/${round.id}`)}
                            className="flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all group bg-(--bg) hover:bg-(--bg) border-(--brd) hover:border-blue-600/40"
                            >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${
                                isLocked
                                ? "bg-(--card) border border-(--brd) text-(--t2)"
                                : "bg-(--card) border border-(--brd) text-(--t1) group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600"
                            }`}>
                            {isLocked ? <Lock size={14} /> : round.number}
                            </div>
                            <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-(--t1) group-hover:text-blue-600 transition-colors truncate">
                            {round.name || `Раунд ${round.number}`}
                            </p>
                            {(round.start_at || round.end_at) && (
                                <p className="text-[11px] text-(--t2) font-medium mt-0.5 flex items-center gap-1">
                                <Clock size={10} />
                                {round.start_at && fmtDate(round.start_at)}
                                {round.start_at && round.end_at && " — "}
                                {round.end_at && fmtDate(round.end_at)}
                                </p>
                            )}
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${statusBadgeBg} ${statusBadgeBorder} ${statusColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isActive ? "animate-pulse" : ""}`} />
                            {statusLabel}
                            </div>
                            <ChevronRight size={16} className="text-(--t2) group-hover:text-blue-600 transition-colors flex-shrink-0" />
                            </div>
                        );
                    })}
                    </div>
                    </div>
                )}

                {/* Error */}
                {registerError && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-sm font-bold">
                    ⚠️ {registerError}
                    </div>
                )}

                {/* Register button */}
                {isRegistrationOpen && !myTeamInTournament && (
                    user ? (
                        <button
                        onClick={handleRegister}
                        disabled={registering || isFull}
                        className="w-full px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
                        >
                        {isFull ? "Турнір заповнений" : registering ? "Реєстрація..." : "Зареєструвати мою команду"}
                        </button>
                    ) : (
                        <div className="w-full px-5 py-4 bg-(--card) border border-(--brd) rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <Lock size={18} className="text-(--t2) flex-shrink-0 mt-0.5 sm:mt-0" />
                        <p className="text-sm text-(--t2) flex-1">
                        Щоб взяти участь у турнірі, необхідно{" "}
                        <button onClick={() => router.push("/login")} className="text-blue-600 font-black hover:underline">увійти до акаунту</button>
                        {" "}або{" "}
                        <button onClick={() => router.push("/register")} className="text-blue-600 font-black hover:underline">зареєструватися</button>
                        </p>
                        </div>
                    )
                )}

                {myTeamInTournament && (
                    <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
                    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-(--card) border border-(--brd) flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) mb-0.5">Статус реєстрації</p>
                    <p className="font-black text-sm text-green-600">Ваша команда «{myTeamInTournament.name}» зареєстрована</p>
                    </div>
                    </div>
                    {isRegistrationOpen && (
                        <button
                        onClick={handleUnregister}
                        disabled={unregistering}
                        className="flex-shrink-0 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-500 bg-(--bg) hover:bg-red-500/10 hover:border-red-500/50 font-black text-[10px] uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition-all"
                        >
                        {unregistering ? "Скасування..." : "Розреєструвати команду"}
                        </button>
                    )}
                    </div>
                    </div>
                )}

                {/* Teams list */}
                <div className="mt-2">
                <h2 className="font-black text-lg mb-3 text-(--t1)">Команди-учасники</h2>
                {teamCount === 0 ? (
                    <div className="text-center py-10 text-(--t2)">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-bold">Поки немає зареєстрованих команд</p>
                    </div>
                ) : (
                    <div className="grid gap-2">
                    {tournament.teams.map((team, idx) => (
                        <div key={team.id} onClick={() => router.push(`/teams/${team.id}`)}
                        className="flex items-center gap-3 p-4 border border-(--brd) rounded-2xl bg-(--bg) hover:border-blue-600/40 cursor-pointer transition-all group"
                        >
                        <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
                        {team.avatar_url
                            ? <img src={team.avatar_url} alt={team.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-(--bg) border border-(--brd) text-(--t2) flex items-center justify-center text-xs font-black">{idx + 1}</div>
                        }
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-(--t1) group-hover:text-blue-600 transition-colors truncate">{team.name}</p>
                        {team.city_school_org && <p className="text-[11px] text-(--t2) font-bold truncate">{team.city_school_org}</p>}
                        </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>

                {/* Jury list */}
                {jury.length > 0 && (
                    <div className="mt-4">
                    <h2 className="font-black text-lg mb-3 text-(--t1) flex items-center gap-2">
                    <Star size={18} className="text-(--t2)" /> Журі
                    </h2>
                    <div className="grid gap-2">
                    {jury.map((member) => (
                        <div key={member.jury_id} onClick={() => router.push(`/user/${member.jury_id}`)}
                        className="flex items-center gap-3 p-4 border border-(--brd) rounded-2xl bg-(--bg) hover:border-blue-600/40 cursor-pointer transition-all group"
                        >
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-(--bg) border border-(--brd) flex items-center justify-center">
                        {member.avatar_url
                            ? <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                            : <Star size={14} className="text-(--t2)" />
                        }
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-(--t1) group-hover:text-blue-600 transition-colors truncate">{member.username}</p>
                        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">Суддя</p>
                        </div>
                        </div>
                    ))}
                    </div>
                    </div>
                )}
                </>
            )}

            {/* ── Tab: Лідербоард ── */}
            {activeTab === "leaderboard" && leaderboardTouched && (
                <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
                <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-3 border-b border-(--brd)">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                <Trophy size={16} className="text-yellow-500" />
                </div>
                <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">Лідербоард</h2>
                </div>
                <div className="p-4 sm:p-6">
                <InlineLeaderboard
                tournamentId={id}
                tournamentName={tournament.name}
                isAdmin={isAdmin}
                />
                </div>
                </div>
            )}
            </div>
            </main>
            </div>
        );
}
