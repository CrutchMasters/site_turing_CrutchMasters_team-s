//src/app/tournaments/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase, authedSupabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import RoundSettingsPanel, { type RoundData, type Criterion, validateRoundsData } from "@/components/RoundSettingsPanel";
import TournamentTimeline, { type RoundSlice } from "@/components/TournamentTimeline";
import JuryInvitePanel from "@/components/JuryInvitePanel";
import { DatePicker, TimePicker } from "@/components/DateTimePicker";
import {
    Trophy, ChevronRight, Save, AlertCircle,
    CheckCircle, Clock, Layers, Zap, Users, ArrowLeft, Trash2, ImageIcon, Upload, X, Lock,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import BannerEditorModal from "@/components/BannerEditorModal";

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
    banner_url?: string;
}

interface RoundRow {
    id: string;
    number: number;
    name?: string;
    description?: string;
    criteria?: string | any[];
    technologies?: string[];
    start_at?: string;
    end_at?: string;
    status?: string;
    attachments?: { id: string; name: string; url: string; type: string }[];
}

// Імпортуємо утиліти з lib/datetime для коректної роботи з часовими поясами.
// isoToLocalDate/isoToLocalTime → конвертують UTC з БД у ЛОКАЛЬНИЙ час браузера для пікера.
// localToIso → зворотна конвертація локального часу → UTC для збереження в БД.
import { isoToLocalDate as toDateStr, isoToLocalTime as toTimeStr, localToIso as toIso } from "@/lib/datetime";

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

// ── FieldError bubble ─────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return (
        <div className="relative flex items-start gap-2 mt-1.5">
            <span className="absolute -top-1.5 left-4 w-0 h-0
                border-l-[6px] border-l-transparent
                border-r-[6px] border-r-transparent
                border-b-[6px] border-b-red-500/80" />
            <div className="flex items-center gap-1.5 w-full px-3 py-2 rounded-xl
                bg-red-500/10 border border-red-500/40 text-red-500 text-[11px] font-bold
                shadow-sm shadow-red-500/10">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span>{msg}</span>
            </div>
        </div>
    );
}

export default function TournamentEditPage() {
    const params = useParams();
    const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar } = useSidebar();
  const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { t } = useT();
    const { dark } = useTheme();
    const id = params?.id as string;

    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [success, setSuccess]   = useState("");
    const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const showSuccess = (msg: string) => {
        setSuccess(msg);
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccess(""), 4500);
    };
    const clearFieldError = (key: string) => {
        setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    };
    const [tourney, setTourney]   = useState<Tournament | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting]               = useState(false);

    const [bannerUrl, setBannerUrl]               = useState("");
    const [showBannerEditor, setShowBannerEditor] = useState(false);
    const [bannerError, setBannerError]           = useState("");

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
    // round number → { id, status } for admin status control
    const [roundMeta, setRoundMeta] = useState<Record<number, { id: string; status: string }>>({});
    const [statusChanging, setStatusChanging] = useState(false);

    // Хелпер для таймлайну — оновлює окремий раунд в roundsData
    const handleRoundTimelineChange = useCallback((num: number, patch: Partial<RoundSlice>) => {
        setRoundsData(prev => ({
            ...prev,
            [num]: {
                ...(prev[num] ?? {
                    name: `Раунд ${num}`, description: "", startDate: "", startTime: "",
                    deadlineDate: "", deadlineTime: "", evalStartDate: "", evalStartTime: "",
                    evalEndDate: "", evalEndTime: "", requirements: [], criteria: [], links: [], files: [],
                }),
                ...(patch.startDate    !== undefined ? { startDate:    patch.startDate }    : {}),
                               ...(patch.startTime    !== undefined ? { startTime:    patch.startTime }    : {}),
                               ...(patch.deadlineDate !== undefined ? { deadlineDate: patch.deadlineDate } : {}),
                               ...(patch.deadlineTime !== undefined ? { deadlineTime: patch.deadlineTime } : {}),
            },
        }));
        // Також оновлюємо externalRoundDates щоб RoundSettingsPanel отримав нові дати
        setExternalRoundDates(prev => ({
            ...prev,
            [num]: {
                ...(prev[num] ?? {}),
                                       ...(patch.startDate    !== undefined ? { startDate:    patch.startDate }    : {}),
                                       ...(patch.startTime    !== undefined ? { startTime:    patch.startTime }    : {}),
                                       ...(patch.deadlineDate !== undefined ? { deadlineDate: patch.deadlineDate } : {}),
                                       ...(patch.deadlineTime !== undefined ? { deadlineTime: patch.deadlineTime } : {}),
            },
        }));
    }, []);

    // Live-валідація для таймлайну (без сабміту)
    const timelineErrors = React.useMemo(() => {
        const errs: string[] = [];
        const parseLocalDt = (date: string, time: string) => {
            if (!date) return null;
            const [y, mo, d] = date.split("-").map(Number);
            const [h = 0, m = 0] = (time ?? "").split(":").map(Number);
            return new Date(y, mo - 1, d, h, m).getTime();
        };
        const rf = parseLocalDt(regFromDate, regFromTime);
        const rt = parseLocalDt(regToDate,   regToTime);
        const ts = parseLocalDt(startDate,   startTime);
        const te = parseLocalDt(endDate,     endTime);

        if (rf && ts && rf >= ts)
            errs.push("Реєстрація повинна починатися раніше за старт турніру.");
        if (rt && ts && rt > ts)
            errs.push("Реєстрація повинна закінчуватися не пізніше старту турніру.");
        if (rf && rt && rf >= rt)
            errs.push("Початок реєстрації повинен бути раніше за кінець реєстрації.");
        if (ts && te && ts >= te)
            errs.push("Початок турніру повинен бути раніше за кінець турніру.");

        const roundSlices = Array.from({ length: roundCount }, (_, i) => {
            const n = i + 1;
            const rd = roundsData[n];
            return {
                n,
                start: parseLocalDt(rd?.startDate ?? "", rd?.startTime ?? ""),
                end:   parseLocalDt(rd?.deadlineDate ?? "", rd?.deadlineTime ?? ""),
            };
        }).filter(r => r.start || r.end);

        for (const r of roundSlices) {
            if (r.start && r.end && r.start >= r.end)
                errs.push(`Раунд ${r.n}: початок повинен бути раніше за дедлайн.`);
            if (ts && r.start && r.start < ts)
                errs.push(`Раунд ${r.n}: не може починатися раніше за старт турніру.`);
            if (te && r.end && r.end > te)
                errs.push(`Раунд ${r.n}: дедлайн виходить за межі турніру.`);
        }
        for (let i = 0; i < roundSlices.length - 1; i++) {
            const cur = roundSlices[i];
            const nxt = roundSlices[i + 1];
            if (cur.end && nxt.start && cur.end > nxt.start)
                errs.push(`Раунд ${nxt.n} починається до завершення раунду ${cur.n}.`);
        }
        return errs;
    }, [regFromDate, regFromTime, regToDate, regToTime,
        startDate, startTime, endDate, endTime,
        roundCount, roundsData]);

    // Зовнішні дати для RoundSettingsPanel (від таймлайну)
    const [externalRoundDates, setExternalRoundDates] = useState<
    Record<number, Partial<Pick<RoundData, "startDate"|"startTime"|"deadlineDate"|"deadlineTime">>>
    >({});

    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    const API_URL =
    typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://site-turing-crutchmasters-team-s.onrender.com";

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
        if (!authLoading && user && !isAdmin) router.push("/tournaments");
    }, [authLoading, user, isAdmin, router]);

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
                setBannerUrl(data.banner_url ?? "");

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
                                         criteria:     (() => {
                                             if (!r.criteria) return [];
                                             // New format: already an array of {key,label,weight}
                                             if (Array.isArray(r.criteria)) {
                                                 return (r.criteria as any[]).map((c, idx) => ({
                                                     key:    c.key   ?? `criterion_${idx}`,
                                                     label:  c.label ?? c.name ?? String(c),
                                                                                               weight: typeof c.weight === 'number' ? c.weight : Math.floor(100 / (r.criteria as any[]).length),
                                                 }));
                                             }
                                             // Legacy format: newline-separated strings → convert to equal-weight criteria
                                             const labels = (r.criteria as string).split('\n').filter(Boolean);
                                             const w = labels.length > 0 ? Math.floor(100 / labels.length) : 0;
                                             return labels.map((lbl, idx) => ({
                                                 key:    `criterion_${idx}`,
                                                 label:  lbl,
                                                 weight: idx < labels.length - 1 ? w : 100 - w * (labels.length - 1),
                                             }));
                                         })(),
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
                    // Save round id+status for admin status control
                    const meta: Record<number, { id: string; status: string }> = {};
                    for (const r of roundRows as RoundRow[]) {
                        if (r.id) meta[r.number] = { id: r.id, status: r.status ?? "pending" };
                    }
                    setRoundMeta(meta);
                }
            } catch (e: any) {
                setFieldErrors({ general: e?.message ?? "Помилка завантаження" });
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

        const apiBannerUpload = async (blob: Blob): Promise<string> => {
            const token = await getToken();
            if (!token) throw new Error("Не вдалося отримати токен авторизації");

            const form = new FormData();
            form.append("file", new File([blob], "banner.webp", { type: "image/webp" }));

            const res = await fetch(`${API_URL}/api/tournaments/${id}/banner`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? `Помилка завантаження: ${res.statusText}`);
            }
            const data = await res.json();
            return data.banner_url as string;
        };

        const handleBannerDelete = async () => {
            if (!id) return;
            try {
                const token = await getToken();
                if (!token) throw new Error("Не вдалося отримати токен авторизації");
                const res = await fetch(`${API_URL}/api/tournaments/${id}/banner`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail ?? "Помилка видалення банера");
                }
                setBannerUrl("");
            } catch (e: any) {
                setBannerError(e?.message ?? "Помилка видалення банера");
            }
        };

        const handleSave = async (e: React.FormEvent) => {
            e.preventDefault();
            setFieldErrors({}); setSuccess("");

            const fe: Record<string, string> = {};
            let hasErr = false;
            const addErr = (key: string, msg: string) => { if (!fe[key]) fe[key] = msg; hasErr = true; };

            if (!name.trim()) addErr("name", t.editTourney?.errNameRequired ?? "Назва обов'язкова");
            if (!startDate)   addErr("startDate", t.editTourney?.errStartRequired ?? "Дата старту обов'язкова");

            // ── Валідація часової послідовності ──────────────────────────────
            const parseLocalDt = (date: string, time: string) => {
                if (!date) return null;
                const [y, mo, d] = date.split("-").map(Number);
                const [h = 0, m = 0] = (time ?? "").split(":").map(Number);
                return new Date(y, mo - 1, d, h, m).getTime();
            };

            const rf  = parseLocalDt(regFromDate, regFromTime);
            const rt  = parseLocalDt(regToDate,   regToTime);
            const ts  = parseLocalDt(startDate,   startTime);
            const te  = parseLocalDt(endDate,      endTime);

            if (rf && ts && rf >= ts)
                addErr("regFromDate", "Реєстрація повинна починатися раніше за старт турніру.");
            if (rt && ts && rt > ts)
                addErr("regToDate", "Реєстрація повинна закінчуватися не пізніше старту турніру.");
            if (rf && rt && rf >= rt)
                addErr("regFromDate", fe["regFromDate"] ?? "Початок реєстрації повинен бути раніше за кінець.");
            if (ts && te && ts >= te)
                addErr("startDate", fe["startDate"] ?? "Початок турніру повинен бути раніше за кінець.");

            // Валідація раундів
            const roundSlices = Array.from({ length: roundCount }, (_, i) => {
                const n = i + 1;
                const rd = roundsData[n];
                return {
                    n,
                    start: parseLocalDt(rd?.startDate ?? "", rd?.startTime ?? ""),
                    end:   parseLocalDt(rd?.deadlineDate ?? "", rd?.deadlineTime ?? ""),
                };
            }).filter(r => r.start || r.end);

            for (const r of roundSlices) {
                if (r.start && r.end && r.start >= r.end)
                    addErr(`round_${r.n}_start`, `Раунд ${r.n}: початок повинен бути раніше за дедлайн.`);
                if (ts && r.start && r.start < ts)
                    addErr(`round_${r.n}_start`, fe[`round_${r.n}_start`] ?? `Раунд ${r.n}: початок раунду не може бути раніше за старт турніру.`);
                if (te && r.end && r.end > te)
                    addErr(`round_${r.n}_end`, `Раунд ${r.n}: дедлайн не може виходити за межі турніру.`);
            }
            for (let i = 0; i < roundSlices.length - 1; i++) {
                const cur = roundSlices[i];
                const nxt = roundSlices[i + 1];
                if (cur.end && nxt.start && cur.end > nxt.start)
                    addErr(`round_${nxt.n}_start`, `Раунд ${nxt.n} починається до завершення раунду ${cur.n}.`);
            }
            // ─────────────────────────────────────────────────────────────────

            const criteriaErr = validateRoundsData(roundsData, roundCount);
            if (criteriaErr) addErr("criteria", criteriaErr);

            if (hasErr) { setFieldErrors(fe); return; }

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
                               criteria:     (rd?.criteria && rd.criteria.length > 0)
                               ? rd.criteria.filter(c => c.label.trim())
                               : null,
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

                showSuccess(t.editTourney?.successSaved ?? "Зміни збережено ✓");
                await fetchTourney();
            } catch (e: any) {
                const msg: string = e?.message ?? "";
                if (msg.includes("rounds_number_check") || msg.includes("number_check")) {
                    setFieldErrors({ general: "Номер раунду має бути від 1 до 8. Перевірте кількість раундів." });
                } else {
                    setFieldErrors({ general: msg || "Виникла помилка. Спробуйте ще раз." });
                }
            } finally {
                setSaving(false);
            }
        };

        const handleDelete = async () => {
            setDeleting(true);
            setFieldErrors({});
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
                setFieldErrors({ general: e?.message ?? (t.editTourney?.deleteError ?? "Не вдалося видалити турнір") });
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
                <button onClick={() => router.push("/tournaments")} className="text-blue-600 text-sm font-bold">{t.editTourney?.backToTournaments ?? "← До турнірів"}</button>
                </div>
            );
        }

        return (
            <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
            <style>{`
                @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                @keyframes cardDrop { from{opacity:0;transform:translateY(-26px) scale(.97)} to{opacity:1;transform:none} }
                @keyframes slideDown { from{opacity:0;transform:translateY(-24px) scale(.97)} to{opacity:1;transform:none} }
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
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => closeMobileSidebar()} />
                )}
                <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
                <Sidebar />
                </div>

                <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">

                {/* ── Fixed top success toast ── */}
                {success && (
                    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3.5
                        bg-green-600 text-white rounded-2xl shadow-2xl shadow-green-600/30 text-sm font-black
                        uppercase tracking-wide pointer-events-none select-none"
                        style={{ animation: "slideDown 350ms cubic-bezier(.22,1,.36,1) both" }}>
                        <CheckCircle size={16} className="flex-shrink-0" />
                        {success}
                    </div>
                )}

                {/* ── Fixed top general server-error toast ── */}
                {fieldErrors.general && (
                    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3.5
                        bg-red-600 text-white rounded-2xl shadow-2xl shadow-red-600/30 text-sm font-black
                        uppercase tracking-wide max-w-[90vw]"
                        style={{ animation: "slideDown 350ms cubic-bezier(.22,1,.36,1) both" }}>
                        <AlertCircle size={16} className="flex-shrink-0" />
                        <span className="flex-1">{fieldErrors.general}</span>
                        <button onClick={() => clearFieldError("general")} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
                            <X size={14} />
                        </button>
                    </div>
                )}

                <MobileHeader
                onOpenSidebar={openMobile}
                title={t.editTourney?.mobileTitle ?? "Редагування турніру"}
                icon={<Trophy size={18} className="text-blue-600" />}
                />

                <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

                <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2) flex-wrap">
                <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">{t.nav?.home ?? "Головна"}</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push("/tournaments")} className="hover:text-blue-600 transition-colors">{t.editTourney?.breadcrumbTournaments ?? "Турніри"}</button>
                <ChevronRight size={10} />
                <button onClick={() => router.push(`/tournaments/${id}`)} className="hover:text-blue-600 transition-colors truncate max-w-[120px]">{tourney.name}</button>
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
                <FieldError msg={fieldErrors.name} />
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

                {/* BLOCK BANNER: Банер турніру */}
                <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden" style={{ animationDelay: "40ms" }}>
                <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                <ImageIcon size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-(--t2)">{t.editTourney?.bannerBlock ?? "Банер турніру"}</span>
                </div>
                <div className="p-6 sm:p-8 space-y-4">
                {bannerUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-(--brd) group">
                    <img
                    src={bannerUrl}
                    alt="Banner preview"
                    className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                    <button
                    type="button"
                    onClick={() => { setBannerError(""); setShowBannerEditor(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/90 text-gray-900 rounded-xl text-xs font-black uppercase tracking-wide shadow-lg hover:bg-white transition-all"
                    >
                    <Upload size={14} />
                    {t.editTourney?.bannerChange ?? "Змінити"}
                    </button>
                    </div>
                    <button
                    type="button"
                    onClick={handleBannerDelete}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                    <X size={13} />
                    </button>
                    </div>
                ) : (
                    <button
                    type="button"
                    onClick={() => { setBannerError(""); setShowBannerEditor(true); }}
                    className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-(--brd) hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer"
                    >
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <ImageIcon size={22} className="text-purple-500" />
                    </div>
                    <div className="text-center">
                    <p className="text-sm font-black text-(--t1)">{t.editTourney?.bannerUploadTitle ?? "Завантажити банер"}</p>
                    <p className="text-[11px] text-(--t2) mt-0.5">{t.editTourney?.bannerUploadHint ?? "PNG, JPG, WEBP — рекомендований розмір 1200×400"}</p>
                    </div>
                    </button>
                )}
                {bannerError && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-xs font-bold">
                    <AlertCircle size={14} /> {bannerError}
                    </div>
                )}
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
                <FieldError msg={fieldErrors.regFromDate} />
                <div className="border-t border-(--brd)" />
                <DateTimePair label={t.editTourney?.regEnd ?? "Кінець реєстрації"} dateVal={regToDate} onDate={setRegToDate} timeVal={regToTime} onTime={setRegToTime} />
                <FieldError msg={fieldErrors.regToDate} />
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
                <FieldError msg={fieldErrors.startDate} />
                <div className="border-t border-(--brd)" />
                <DateTimePair label={t.editTourney?.tourEnd ?? "Кінець турніру"} dateVal={endDate} onDate={setEndDate} timeVal={endTime} onTime={setEndTime} />
                </div>
                </div>
                </section>

                {/* TIMELINE */}
                <section className="cdIn" style={{ animationDelay: "90ms" }}>
                <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-(--brd) overflow-hidden p-5">
                <TournamentTimeline
                regFromDate={regFromDate} setRegFromDate={setRegFromDate}
                regFromTime={regFromTime} setRegFromTime={setRegFromTime}
                regToDate={regToDate}     setRegToDate={setRegToDate}
                regToTime={regToTime}     setRegToTime={setRegToTime}
                startDate={startDate}     setStartDate={setStartDate}
                startTime={startTime}     setStartTime={setStartTime}
                endDate={endDate}         setEndDate={setEndDate}
                endTime={endTime}         setEndTime={setEndTime}
                rounds={Array.from({ length: roundCount }, (_, i) => {
                    const n  = i + 1;
                    const rd = roundsData[n];
                    return {
                        number:       n,
                        startDate:    rd?.startDate    ?? "",
                        startTime:    rd?.startTime    ?? "",
                        deadlineDate: rd?.deadlineDate ?? "",
                        deadlineTime: rd?.deadlineTime ?? "",
                    } satisfies RoundSlice;
                })}
                onRoundChange={handleRoundTimelineChange}
                errors={timelineErrors}
                />
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

                    <div className="cdIn" style={{ animationDelay: "160ms" }}>
                    <JuryInvitePanel tournamentId={id as string} tournamentName={name} />
                    </div>

                    {/* Зведена плашка помилок — над кнопкою збереження */}
                    {Object.entries(fieldErrors).filter(([k]) => k !== "general").length > 0 && (
                        <div className="flex flex-col gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs font-black uppercase tracking-widest text-red-500">Виправте помилки перед збереженням</p>
                        </div>
                        <ul className="flex flex-col gap-1 pl-1">
                            {Object.entries(fieldErrors)
                                .filter(([k]) => k !== "general")
                                .map(([key, msg]) => (
                                    <li key={key} className="flex items-start gap-1.5 text-xs font-bold text-red-400">
                                        <span className="mt-0.5 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                                        {msg}
                                    </li>
                                ))
                            }
                        </ul>
                        </div>
                    )}

                    <div className="cdIn flex flex-col sm:flex-row gap-3 pb-8" style={{ animationDelay: "180ms" }}>
                    <button type="submit" disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t.editTourney?.saving ?? "Збереження..."}</>
                        : <><Save size={15} /> {t.editTourney?.saveBtn ?? "Зберегти зміни"}</>
                    }
                    </button>
                    <button type="button" onClick={() => router.push(`/tournaments/${id}`)} disabled={saving}
                    className="flex-1 px-8 py-4 bg-(--bg) border border-(--brd) text-(--t2) rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-(--card) active:scale-95 transition-all disabled:opacity-60">
                    {t.editTourney?.cancelBtn ?? "Скасувати"}
                    </button>
                    <button type="button" onClick={() => setShowDeleteModal(true)} disabled={saving || deleting}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/50 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                    <Trash2 size={15} /> {t.editTourney?.deleteBtn ?? "Видалити"}
                    </button>
                    </div>

                    </div>
                    {/* end LEFT COLUMN */}

                    {/* ── RIGHT COLUMN ── */}
                    <div className="w-full xl:sticky xl:top-6 xl:flex-1 xl:min-w-0 flex flex-col gap-4">

                    {/* ── Round Status Control (admin only) ── */}
                    {roundMeta[selectedRoundTab] && (() => {
                        const meta = roundMeta[selectedRoundTab];
                        const status = meta.status;
                        const isJudged   = status === "judged";
                        const isJudging  = status === "judging";
                        const isActive   = status === "active";
                        const isPending  = status === "pending";

                        const statusLabel: Record<string, string> = {
                            pending:  "Очікується",
                            active:   "Проводиться",
                            judging:  "Оцінювання",
                            judged:   "Оцінено",
                        };
                        const statusColor: Record<string, string> = {
                            pending:  "text-(--t2)",
                            active:   "text-blue-500",
                            judging:  "text-amber-500",
                            judged:   "text-green-500",
                        };

                        const handleSetStatus = async (newStatus: string) => {
                            if (statusChanging) return;
                            setStatusChanging(true);
                            try {
                                const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
                                const res = await fetch(`${API_URL}/api/rounds/${meta.id}/status`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ status: newStatus }),
                                });
                                if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    throw new Error(err?.detail ?? `HTTP ${res.status}`);
                                }
                                setRoundMeta(prev => ({
                                    ...prev,
                                    [selectedRoundTab]: { ...meta, status: newStatus },
                                }));
                            } catch (e: any) {
                                alert(e?.message ?? "Помилка зміни статусу");
                            } finally {
                                setStatusChanging(false);
                            }
                        };

                        return (
                            <div className="rounded-2xl border border-(--brd) bg-(--card) p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Статус раунду</span>
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${statusColor[status] ?? "text-(--t2)"}`}>
                                        {statusLabel[status] ?? status}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {/* judging → judged: закрити оцінювання */}
                                    {isJudging && (
                                        <button type="button"
                                            onClick={() => handleSetStatus("judged")}
                                            disabled={statusChanging}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-green-600/20">
                                            <Lock size={12} />
                                            Закрити оцінювання
                                        </button>
                                    )}
                                    {/* judged → judging: відкрити знову */}
                                    {isJudged && (
                                        <button type="button"
                                            onClick={() => handleSetStatus("judging")}
                                            disabled={statusChanging}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-amber-500/20">
                                            <Lock size={12} />
                                            Відкрити оцінювання
                                        </button>
                                    )}
                                    {/* active/pending → judging: примусово відкрити оцінювання */}
                                    {(isActive || isPending) && (
                                        <button type="button"
                                            onClick={() => handleSetStatus("judging")}
                                            disabled={statusChanging}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-500 font-black text-[10px] uppercase tracking-widest hover:bg-amber-500/20 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                            Перевести в оцінювання
                                        </button>
                                    )}
                                </div>

                                {isJudged && (
                                    <p className="text-[10px] text-(--t2) leading-relaxed">
                                        Оцінювання закрито — журі не може редагувати оцінки.
                                    </p>
                                )}
                                {isJudging && (
                                    <p className="text-[10px] text-(--t2) leading-relaxed">
                                        Журі зараз виставляє оцінки. Натисніть «Закрити оцінювання» коли всі оцінки виставлено.
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    <RoundSettingsPanel
                    roundCount={roundCount}
                    selectedRound={selectedRoundTab}
                    onSelectRound={setSelectedRoundTab}
                    onRoundsChange={setRoundsData}
                    initialData={initialRoundsData}
                    externalData={externalRoundDates}
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
                    {showBannerEditor && (
                        <BannerEditorModal
                        entityId={id as string}
                        currentBannerUrl={bannerUrl || undefined}
                        onSave={(url) => { setBannerUrl(url); }}
                        onClose={() => setShowBannerEditor(false)}
                        supabase={supabase}
                        apiUpload={apiBannerUpload}
                        />
                    )}
                    </div>
        );
}
