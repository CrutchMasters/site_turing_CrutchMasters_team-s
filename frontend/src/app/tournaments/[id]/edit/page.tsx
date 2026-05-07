//src/app/tournaments/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase, authedSupabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import RoundSettingsPanel, { type RoundData } from "@/components/RoundSettingsPanel";
import JuryInvitePanel from "@/components/JuryInvitePanel";
import { DatePicker, TimePicker } from "@/components/DateTimePicker";
import {
    Trophy, ChevronRight, Save, AlertCircle,
    CheckCircle, Clock, Layers, Zap, Users, ArrowLeft, Trash2,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

interface Tournament {
    id: string;
    name: string;
    rules?: string;
    status: string;
    start_at: string;
    end_at?: string;
    registration_from?: string;
    registration_to?: string;
    max_teams?: number;
    rounds?: number;
    jury_per_submission?: number;
    created_by?: string;
}

interface RoundRow {
    id: string;
    number: number;
    name?: string;
    description?: string;
    criteria?: string;
    technologies?: string[];
    start_at?: string;
    end_at?: string;
    attachments?: { id: string; name: string; url: string; type: string }[];
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
    const localStr = `${date}T${time || "00:00"}:00`;
    return new Date(localStr).toISOString();
}

async function getToken(): Promise<string> {
    const stored = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    await authedSupabase(stored || null);
    return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

const inp = "w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none transition-all";
const label10 = "text-[10px] font-black uppercase tracking-widest text-(--t2)";

function DateTimePair({
    label, dateVal, onDate, timeVal, onTime, required,
}: {
    label: string;
    dateVal: string; onDate: (v: string) => void;
    timeVal: string; onTime: (v: string) => void;
    required?: boolean;
}) {
    return (
        <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
        <span className={label10}>{label}</span>
        {required && (
            <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 fill-red-500" /> Обов&apos;язково
            </span>
        )}
        </div>
        <DatePicker value={dateVal} onChange={onDate} />
        <TimePicker value={timeVal} onChange={onTime} />
        </div>
    );
}

export default function TournamentEditPage() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const params = useParams();
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { t } = useT();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState("");
    const [success, setSuccess]   = useState("");
    const [tourney, setTourney]   = useState<Tournament | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting]               = useState(false);

    const [name, setName]               = useState("");
    const [rules, setRules]             = useState("");
    const [startDate, setStartDate]     = useState("");
    const [startTime, setStartTime]     = useState("");
    const [endDate, setEndDate]         = useState("");
    const [endTime, setEndTime]         = useState("");
    const [regFromDate, setRegFromDate] = useState("");
    const [regFromTime, setRegFromTime] = useState("");
    const [regToDate, setRegToDate]     = useState("");
    const [regToTime, setRegToTime]     = useState("");
    const [maxTeams, setMaxTeams]             = useState(0);
    const [juryPerSubmission, setJuryPerSubmission] = useState(1);
    const [roundCount, setRoundCount]   = useState<number>(1);

    const [selectedRoundTab, setSelectedRoundTab]   = useState<number>(1);
    const [roundsData, setRoundsData]               = useState<Record<number, RoundData>>({});
    const [initialRoundsData, setInitialRoundsData] = useState<Record<number, Partial<RoundData>>>({});

    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    const isOwner = !!tourney && tourney.created_by === user?.id;
    const canEdit = isAdmin || isOwner;

    const API_URL =
    typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
        if (!authLoading && user && !loading && !canEdit) router.push("/tournaments");
    }, [authLoading, user, loading, canEdit, router]);

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
                setName(data.name ?? "");
                setRules(data.rules ?? "");
                setStartDate(toDateStr(data.start_at));
                setStartTime(toTimeStr(data.start_at));
                setEndDate(toDateStr(data.end_at));
                setEndTime(toTimeStr(data.end_at));
                setRegFromDate(toDateStr(data.registration_from));
                setRegFromTime(toTimeStr(data.registration_from));
                setRegToDate(toDateStr(data.registration_to));
                setRegToTime(toTimeStr(data.registration_to));
                setMaxTeams(data.max_teams ?? 0);
                setJuryPerSubmission(data.jury_per_submission ?? 1);
                setRoundCount(data.rounds ?? 1);

                const { data: roundRows, error: roundErr } = await supabase
                .from("rounds")
                .select("*")
                .eq("tournament_id", id)
                .order("number");

                if (!roundErr && roundRows) {
                    const initial: Record<number, Partial<RoundData>> = {};
                    for (const r of roundRows as RoundRow[]) {
                        initial[r.number] = {
                            name:         r.name        ?? "",
                            description:  r.description ?? "",
                            startDate:    toDateStr(r.start_at),
                                         startTime:    toTimeStr(r.start_at),
                                         deadlineDate: toDateStr(r.end_at),
                                         deadlineTime: toTimeStr(r.end_at),
                                         requirements: r.technologies ?? [],
                                         criteria:     r.criteria
                                         ? r.criteria.split("\n").filter(Boolean)
                                         : [],
                                         links: (r.attachments ?? [])
                                         .filter((a: any) => a.type === "link")
                                         .map((a: any) => a.url),
                                         files: (r.attachments ?? [])
                                         .filter((a: any) => a.type === "file")
                                         .map((a: any) => ({
                                             file: null,
                                             name: a.name,
                                             size: 0,
                                             type: "",
                                             url:  a.url,
                                             existing: true,
                                         })) as any,
                        };
                    }
                    setInitialRoundsData(initial);
                }
            } catch (e: any) {
                setError(e?.message ?? "Помилка завантаження");
            } finally {
                setLoading(false);
            }
        }, [id]);

        useEffect(() => { fetchTourney(); }, [fetchTourney]);

        const uploadFile = async (file: File, roundNumber: number): Promise<string> => {
            const token = await getToken();
            if (!token) throw new Error("Не вдалося отримати токен авторизації. Спробуйте увійти знову.");
            const form = new FormData();
            form.append("round_number", String(roundNumber));
            form.append("file", file);
            const res = await fetch(`${API_URL}/api/upload/round-file`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`Помилка завантаження файлу "${file.name}": ${err.detail ?? res.statusText}`);
            }
            const data = await res.json();
            return data.signed_url as string;
        };

        const handleSave = async (e: React.FormEvent) => {
            e.preventDefault();
            setError(""); setSuccess("");

            if (!name.trim()) { setError(t.editTourney?.errNameRequired ?? "Назва обов'язкова"); return; }
            if (!startDate)   { setError(t.editTourney?.errStartRequired ?? "Дата старту обов'язкова"); return; }

            setSaving(true);
            try {
                const token = await getToken();
                if (!token) throw new Error("Не вдалося отримати токен авторизації. Спробуйте увійти знову.");

                const payload: Record<string, any> = {
                    name:              name.trim(),
                    rules:             rules.trim() || null,
                    start_at:          toIso(startDate, startTime),
                    end_at:            toIso(endDate, endTime) || null,
                    registration_from: toIso(regFromDate, regFromTime),
                    registration_to:   toIso(regToDate, regToTime),
                    max_teams:              maxTeams > 0 ? maxTeams : null,
                    jury_per_submission:    juryPerSubmission >= 1 ? juryPerSubmission : 1,
                    rounds:            roundCount,
                };

                const tourneyRes = await fetch(`${API_URL}/api/tournaments/${id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                });
                if (!tourneyRes.ok) {
                    const err = await tourneyRes.json().catch(() => ({}));
                    throw new Error(err.detail ?? `Помилка збереження турніру: ${tourneyRes.statusText}`);
                }

                const roundsPayload = await Promise.all(
                    Array.from({ length: roundCount }, async (_, i) => {
                        const n  = i + 1;
                        const rd = roundsData[n];

                        const linkAttachments = (rd?.links ?? [])
                        .filter(Boolean)
                        .map((url, idx) => ({
                            id: `link-${n}-${idx}`,
                            name: url,
                            url,
                            type: "link" as const,
                        }));

                        const fileAttachments: { id: string; name: string; url: string; type: "file" }[] = [];

                        const existingFiles = ((rd as any)?.files ?? []).filter(
                            (f: any) => f?.existing === true
                        );
                        for (let fi = 0; fi < existingFiles.length; fi++) {
                            const f = existingFiles[fi];
                            fileAttachments.push({
                                id: `file-existing-${n}-${fi}`,
                                name: f.name,
                                url: f.url,
                                type: "file" as const,
                            });
                        }

                        const rawFiles: File[] = ((rd as any)?.files ?? [])
                        .filter((f: any) => !f?.existing)
                        .map((f: unknown): File | null => {
                            if (f instanceof File) return f;
                            if (f && typeof f === "object" && (f as any).file instanceof File)
                                return (f as any).file as File;
                            return null;
                        })
                        .filter((f: File | null): f is File => f !== null);
                        for (let fi = 0; fi < rawFiles.length; fi++) {
                            const file = rawFiles[fi];
                            const publicUrl = await uploadFile(file, n);
                            fileAttachments.push({
                                id: `file-new-${n}-${fi}`,
                                name: file.name,
                                url: publicUrl,
                                type: "file" as const,
                            });
                        }

                        const attachments = [...linkAttachments, ...fileAttachments];

                        return {
                            number:       n,
                            name:         rd?.name?.trim()                         || `Раунд ${n}`,
                               description:  rd?.description?.trim()                  || null,
                               criteria:     rd?.criteria?.filter(Boolean).join("\n") || null,
                               technologies: rd?.requirements?.filter(Boolean)        ?? [],
                               start_at:     toIso(rd?.startDate ?? "", rd?.startTime ?? "") ?? null,
                               end_at:       toIso(rd?.deadlineDate ?? "", rd?.deadlineTime ?? "") ?? null,
                               links:        linkAttachments,
                               attachments,
                               status:       "pending",
                        };
                    })
                );

                if (roundsPayload.length > 8) {
                    throw new Error(t.editTourney?.errMaxRounds ?? "Максимальна кількість раундів — 8");
                }

                const roundsRes = await fetch(`${API_URL}/api/tournaments/${id}/rounds`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({ rounds: roundsPayload }),
                });

                if (!roundsRes.ok) {
                    const err = await roundsRes.json().catch(() => ({}));
                    const errMsg: string = err.detail ?? JSON.stringify(err);
                    if (errMsg.includes("rounds_number_check") || errMsg.includes("number_check")) {
                        throw new Error("Номер раунду має бути від 1 до 8. Перевірте кількість раундів.");
                    }
                    throw new Error(`Турнір збережено, але раунди не оновлено: ${errMsg}`);
                }

                setSuccess(t.editTourney?.successSaved ?? "Зміни збережено ✓");
                await fetchTourney();
            } catch (e: any) {
                const msg: string = e?.message ?? "";
                if (msg.includes("rounds_number_check") || msg.includes("number_check")) {
                    setError("Номер раунду має бути від 1 до 8. Перевірте кількість раундів.");
                } else {
                    setError(msg || "Виникла помилка. Спробуйте ще раз.");
                }
            } finally {
                setSaving(false);
            }
        };

        const handleDelete = async () => {
            setDeleting(true);
            setError("");
            try {
                const token = await getToken();
                if (!token) throw new Error("Не вдалося отримати токен авторизації.");
                const res = await fetch(`${API_URL}/api/tournaments/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail ?? `Помилка видалення: ${res.statusText}`);
                }
                router.push("/tournaments");
            } catch (e: any) {
                setError(e?.message ?? (t.editTourney?.deleteError ?? "Не вдалося видалити турнір"));
                setShowDeleteModal(false);
            } finally {
                setDeleting(false);
            }
        };

        if (authLoading || !user || loading) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        if (!tourney) {
            return (
                <div className="min-h-screen bg-(--bg) flex items-center justify-center flex-col gap-4">
                <Trophy size={48} className="text-(--t2) opacity-30" />
                <p className="font-black text-(--t1) uppercase">{t.editTourney?.errNotFound ?? "Турнір не знайдено"}</p>
                <a href={"/tournaments"} onClick={(e) => { e.preventDefault(); router.push("/tournaments"); }} className="text-blue-600 text-sm font-bold">{t.editTourney?.backToTournaments ?? "← До турнірів"}</a>
                </div>
            );
        }

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style jsx global>{`
                @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                @keyframes cardDrop { from{opacity:0;transform:translateY(-26px) scale(.97)} to{opacity:1;transform:none} }
                @keyframes slideInRight { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
                .fuIn  { animation: fadeUp      340ms cubic-bezier(.22,1,.36,1) both }
                .cdIn  { animation: cardDrop    500ms cubic-bezier(.22,1,.36,1) both }
                .sirIn { animation: slideInRight 400ms cubic-bezier(.22,1,.36,1) both }
                input[type="date"]::-webkit-calendar-picker-indicator,
                input[type="time"]::-webkit-calendar-picker-indicator { display: none !important; opacity: 0 !important; width: 0 !important; }
                input[type="date"], input[type="time"] { -moz-appearance: textfield; }
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

                <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
                <MobileHeader
                onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                title={t.editTourney?.mobileTitle ?? "Редагування турніру"}
                icon={<Trophy size={18} className="text-blue-600" />}
                />

                <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2) flex-wrap">
                <a href={"/"} onClick={(e) => { e.preventDefault(); router.push("/"); }} className="hover:text-blue-600 transition-colors">{t.nav?.home ?? "Головна"}</a>
                <ChevronRight size={10} />
                <a href={"/tournaments"} onClick={(e) => { e.preventDefault(); router.push("/tournaments"); }} className="hover:text-blue-600 transition-colors">{t.editTourney?.breadcrumbTournaments ?? "Турніри"}</a>
                <ChevronRight size={10} />
                <a href={`/tournaments/${id}`} onClick={(e) => { e.preventDefault(); router.push(`/tournaments/${id}`); }} className="hover:text-blue-600 transition-colors truncate max-w-[120px]">{tourney.name}</a>
                <ChevronRight size={10} />
                <span className="text-(--t1)">{t.editTourney?.breadcrumbEdit ?? "Редагування"}</span>
                </nav>

                <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-(--t2) hover:text-blue-600 transition-colors">
                <ArrowLeft size={14} /> {t.editTourney?.back ?? "Назад"}
                </button>

                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-(--t1) mb-8">
                {t.editTourney?.pageTitle ?? "Редагування турніру"}
                </h1>

                <form className="space-y-5" onSubmit={handleSave}>
                <div className="flex flex-col xl:flex-row gap-6 items-start w-full">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-5 w-full xl:flex-1 xl:min-w-0">

                {/* BLOCK 1: Загальна інформація */}
                <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden">
                <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                <Trophy size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{ t.editTourney?.block1 ?? "1. Загальна інформація"}</span>
                </div>
                <div className="p-6 sm:p-8 space-y-5">
                <div>
                <div className="flex items-center justify-between mb-2">
                <label className={label10}>{t.editTourney?.nameLabel ?? "Назва турніру"}</label>
                <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 fill-red-500" /> {t.editTourney?.required ?? "Обов'язково"}
                </span>
                </div>
                <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.editTourney?.namePlaceholder ?? "Назва турніру..."}
                className={inp}
                />
                </div>
                <div>
                <label className={`block ${label10} mb-2`}>{t.editTourney?.rulesLabel ?? "Опис / Правила"}</label>
                <RichTextEditor
                value={rules}
                onChange={setRules}
                placeholder={t.editTourney?.rulesPlaceholder ?? "Введіть опис та правила турніру..."}
                rows={7}
                />
                </div>
                </div>
                </section>

                {/* BLOCK 2: Реєстрація + Дати */}
                <section className="cdIn grid grid-cols-1 md:grid-cols-2 gap-5" style={{ animationDelay: "60ms" }}>

                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                <Users size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.editTourney?.block2regTeams ?? "Реєстрація команд"}</span>
                </div>
                <div className="p-6 space-y-4 flex-1">
                <DateTimePair label={t.editTourney?.regStart ?? "Початок реєстрації"} dateVal={regFromDate} onDate={setRegFromDate} timeVal={regFromTime} onTime={setRegFromTime} />
                <div className="border-t border-(--brd)" />
                <DateTimePair label={t.editTourney?.regEnd ?? "Кінець реєстрації"} dateVal={regToDate} onDate={setRegToDate} timeVal={regToTime} onTime={setRegToTime} />
                </div>
                </div>

                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                <Clock size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.editTourney?.block2startDates ?? "Дати старту"}</span>
                </div>
                <div className="p-6 space-y-4 flex-1">
                <DateTimePair label={t.editTourney?.tourStart ?? "Початок турніру"} dateVal={startDate} onDate={setStartDate} timeVal={startTime} onTime={setStartTime} required />
                <div className="border-t border-(--brd)" />
                <DateTimePair label={t.editTourney?.tourEnd ?? "Кінець турніру"} dateVal={endDate} onDate={setEndDate} timeVal={endTime} onTime={setEndTime} />
                </div>
                </div>
                </section>

                {/* BLOCK 3: Формат + Команди */}
                <section className="cdIn grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch" style={{ animationDelay: "120ms" }}>

                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                <Layers size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">{t.editTourney?.block3format ?? "3. Формат"}</span>
                <span className="text-[9px] font-black uppercase text-red-500 flex items-center gap-1 whitespace-nowrap">
                <Zap className="w-2 h-2 fill-red-500" /> {t.editTourney?.required ?? "Обов'язково"}
                </span>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.editTourney?.roundCountLabel ?? "Кількість раундів"}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">
                {t.editTourney?.roundSelected ?? "Вибрано:"} <span className="text-blue-500">{roundCount}</span>{" "}
                {roundCount === 1
                    ? (t.editTourney?.roundWord_1 ?? "раунд")
                    : roundCount < 5
                    ? (t.editTourney?.roundWord_2 ?? "раунди")
                    : (t.editTourney?.roundWord_5 ?? "раундів")}
                </p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button key={n} type="button"
                    onClick={() => { setRoundCount(n); if (selectedRoundTab > n) setSelectedRoundTab(1); }}
                    className={`h-10 rounded-xl font-black text-sm border transition-all duration-150 active:scale-90 ${
                        n === roundCount
                        ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30"
                        : n <= roundCount
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-500"
                        : "bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600"
                    }`}>
                    {n}
                    </button>
                ))}
                </div>
                </div>
                </div>

                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                <Users size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">{t.editTourney?.teamsBlock ?? "Команди"}</span>
                <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full">{t.editTourney?.optional ?? "Опціонально"}</span>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.editTourney?.teamCountLabel ?? "Кількість команд"}</p>
                <div className="flex items-center justify-center gap-3 flex-1">
                <button type="button" onClick={() => setMaxTeams(Math.max(0, maxTeams - 1))}
                className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">−</button>
                <input
                type="number" min={0}
                value={maxTeams === 0 ? "" : maxTeams}
                onChange={e => { const v = parseInt(e.target.value, 10); setMaxTeams(isNaN(v) || v < 0 ? 0 : v); }}
                placeholder="∞"
                className="w-16 text-center text-2xl font-black bg-transparent outline-none text-(--t1) placeholder:text-(--t2)/60 border-b-2 border-(--brd) focus:border-blue-500 transition-colors tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button type="button" onClick={() => setMaxTeams(maxTeams + 1)}
                className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">+</button>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-center">
                {[0, 8, 16, 32, 64].map(n => (
                    <button key={n} type="button" onClick={() => setMaxTeams(n)}
                    className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest transition-all active:scale-95 ${
                        maxTeams === n
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30"
                        : "bg-(--bg) border-(--brd) text-(--t2) hover:border-blue-600/50 hover:text-blue-600"
                    }`}>
                    {n === 0 ? (t.editTourney?.noLimit ?? "Без ліміту") : n}
                    </button>
                ))}
                </div>
                </div>
                </div>
                </section>

                {/* Jury per submission block */}
                <section className="flex flex-col gap-4">
                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2) flex-1">Оцінювання журі</span>
                <span className="text-[9px] font-bold text-(--t2) bg-(--bg) border border-(--brd) px-2 py-0.5 rounded-full">Розподіл робіт</span>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">Журі на роботу (K)</p>
                <p className="text-[10px] text-(--t2)/70">Скільки членів журі оцінює кожну подану роботу</p>
                <div className="flex items-center justify-center gap-3 flex-1">
                <button type="button" onClick={() => setJuryPerSubmission(Math.max(1, juryPerSubmission - 1))}
                className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-amber-600 hover:border-amber-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">−</button>
                <input
                type="number" min={1}
                value={juryPerSubmission}
                onChange={e => { const v = parseInt(e.target.value, 10); setJuryPerSubmission(isNaN(v) || v < 1 ? 1 : v); }}
                className="w-16 text-center text-2xl font-black bg-transparent outline-none text-(--t1) border-b-2 border-(--brd) focus:border-amber-500 transition-colors tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button type="button" onClick={() => setJuryPerSubmission(juryPerSubmission + 1)}
                className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-amber-600 hover:border-amber-600/40 transition-all active:scale-90 font-black text-lg flex-shrink-0">+</button>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-center">
                {[1, 2, 3, 5].map(n => (
                    <button key={n} type="button" onClick={() => setJuryPerSubmission(n)}
                    className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest transition-all active:scale-95 ${
                        juryPerSubmission === n
                        ? "bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/30"
                        : "bg-(--bg) border-(--brd) text-(--t2) hover:border-amber-500/50 hover:text-amber-600"
                    }`}>
                    {n === 1 ? "1 — швидко" : n === 2 ? "2 — стандарт" : n === 3 ? "3 — суворо" : `${n}`}
                    </button>
                ))}
                </div>
                </div>
                </div>
                </section>

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

                <div className="cdIn" style={{ animationDelay: "160ms" }}>
                <JuryInvitePanel tournamentId={id as string} tournamentName={name} />
                </div>

                <div className="cdIn flex flex-col sm:flex-row gap-3 pb-8" style={{ animationDelay: "180ms" }}>
                <button type="submit" disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed">
                {saving
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t.editTourney?.saving ?? "Збереження..."}</>
                    : <><Save size={15} /> {t.editTourney?.saveBtn ?? "Зберегти зміни"}</>
                }
                </button>
                <a href={`/tournaments/${id}`} onClick={(e) => { e.preventDefault(); router.push(`/tournaments/${id}`); }}
                className="flex-1 px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all">
                {t.editTourney?.cancelBtn ?? "Скасувати"}
                </a>
                <button type="button" onClick={() => setShowDeleteModal(true)} disabled={saving || deleting}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/50 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                <Trash2 size={15} /> {t.editTourney?.deleteBtn ?? "Видалити"}
                </button>
                </div>

                </div>
                {/* end LEFT COLUMN */}

                {/* ── RIGHT COLUMN ── */}
                <div className="w-full xl:sticky xl:top-6 xl:flex-1 xl:min-w-0">
                <RoundSettingsPanel
                roundCount={roundCount}
                selectedRound={selectedRoundTab}
                onSelectRound={setSelectedRoundTab}
                onRoundsChange={setRoundsData}
                initialData={initialRoundsData}
                />
                </div>

                </div>
                </form>
                </div>
                </main>

                {/* ── DELETE CONFIRMATION MODAL ── */}
                {showDeleteModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-(--card) border border-(--brd) rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 animate-[cardDrop_300ms_cubic-bezier(.22,1,.36,1)_both]">
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={18} className="text-red-500" />
                    </div>
                    <h2 className="text-base font-black uppercase tracking-widest text-(--t1)">
                    {t.editTourney?.deleteConfirmTitle ?? "Видалити турнір?"}
                    </h2>
                    </div>
                    <p className="text-sm text-(--t2) leading-relaxed">
                    {t.editTourney?.deleteConfirmText ?? "Цю дію неможливо скасувати. Всі раунди та реєстрації команд будуть видалені назавжди."}
                    </p>
                    <div className="px-4 py-3 bg-(--bg) border border-(--brd) rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-1">{t.editTourney?.deleteConfirmName ?? "Турнір:"}</p>
                    <p className="text-sm font-black text-(--t1) truncate">{tourney?.name}</p>
                    </div>
                    <div className="flex gap-3">
                    <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="flex-1 px-5 py-3 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all disabled:opacity-60">
                    {t.editTourney?.deleteCancelBtn ?? "Скасувати"}
                    </button>
                    <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/25 disabled:opacity-60 disabled:cursor-not-allowed">
                    {deleting
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t.editTourney?.deleteConfirming ?? "Видалення..."}</>
                        : <><Trash2 size={14} /> {t.editTourney?.deleteConfirmBtn ?? "Так, видалити"}</>
                    }
                    </button>
                    </div>
                    </div>
                    </div>
                )}
                </div>
        );
}
