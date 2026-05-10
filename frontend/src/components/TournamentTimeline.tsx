"use client";
// src/components/TournamentTimeline.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, GripHorizontal } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" + "HH:MM" → Date (local). Falls back to epoch. */
function parseLocal(date: string, time: string): Date {
    if (!date) return new Date(0);
    const [y, mo, d] = date.split("-").map(Number);
    const [h = 0, m = 0] = (time ?? "").split(":").map(Number);
    return new Date(y, mo - 1, d, h, m);
}

/** Date → "YYYY-MM-DD" */
function toDateStr(d: Date): string {
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${dd}`;
}

/** Date → "HH:MM" */
function toTimeStr(d: Date): string {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Format date for label */
function fmtLabel(d: Date): string {
    if (d.getTime() === 0) return "—";
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ─── types ───────────────────────────────────────────────────────────────────

export interface RoundSlice {
    number:       number;
    startDate:    string;
    startTime:    string;
    deadlineDate: string;
    deadlineTime: string;
}

export interface TimelineProps {
    // Tournament-level dates
    regFromDate:    string; setRegFromDate:    (v: string) => void;
    regFromTime:    string; setRegFromTime:    (v: string) => void;
    regToDate:      string; setRegToDate:      (v: string) => void;
    regToTime:      string; setRegToTime:      (v: string) => void;
    startDate:      string; setStartDate:      (v: string) => void;
    startTime:      string; setStartTime:      (v: string) => void;
    endDate:        string; setEndDate:        (v: string) => void;
    endTime:        string; setEndTime:        (v: string) => void;
    // Round slices (array indexed by round number, 1-based)
    rounds:         RoundSlice[];
    onRoundChange:  (num: number, patch: Partial<RoundSlice>) => void;
}

// ─── constants ───────────────────────────────────────────────────────────────

const SEGMENT_COLORS = [
    { bg: "bg-blue-500/20",   border: "border-blue-500/50",   handle: "bg-blue-500",   text: "text-blue-400"   },
    { bg: "bg-violet-500/20", border: "border-violet-500/50", handle: "bg-violet-500", text: "text-violet-400" },
    { bg: "bg-amber-500/20",  border: "border-amber-500/50",  handle: "bg-amber-500",  text: "text-amber-400"  },
    { bg: "bg-emerald-500/20",border: "border-emerald-500/50",handle: "bg-emerald-500",text: "text-emerald-400"},
    { bg: "bg-rose-500/20",   border: "border-rose-500/50",   handle: "bg-rose-500",   text: "text-rose-400"   },
    { bg: "bg-cyan-500/20",   border: "border-cyan-500/50",   handle: "bg-cyan-500",   text: "text-cyan-400"   },
    { bg: "bg-orange-500/20", border: "border-orange-500/50", handle: "bg-orange-500", text: "text-orange-400" },
    { bg: "bg-pink-500/20",   border: "border-pink-500/50",   handle: "bg-pink-500",   text: "text-pink-400"   },
];
const REG_COLOR  = { bg: "bg-teal-500/15",  border: "border-teal-500/40",  handle: "bg-teal-500",  text: "text-teal-400"  };
const TOUR_COLOR = { bg: "bg-indigo-500/15",border: "border-indigo-500/40",handle: "bg-indigo-500",text: "text-indigo-400"};

const MIN_SEGMENT_MS = 5 * 60 * 1000; // 5 хвилин мінімум
const ROW_H = 36; // px height per row

// ─── component ───────────────────────────────────────────────────────────────

export default function TournamentTimeline({
    regFromDate, setRegFromDate, regFromTime, setRegFromTime,
    regToDate,   setRegToDate,   regToTime,   setRegToTime,
    startDate,   setStartDate,   startTime,   setStartTime,
    endDate,     setEndDate,     endTime,     setEndTime,
    rounds,      onRoundChange,
}: TimelineProps) {

    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<null | {
        id: string; // "reg" | "tour" | "r1"…
        edge: "start" | "end" | "move";
        startX: number;
        origStart: number; // ms
        origEnd:   number; // ms
        viewMin:   number;
        viewRange: number;
    }>(null);

    // ── derive all segments from props ──────────────────────────────────────

    const regStart  = parseLocal(regFromDate, regFromTime).getTime();
    const regEnd    = parseLocal(regToDate,   regToTime).getTime();
    const tourStart = parseLocal(startDate,   startTime).getTime();
    const tourEnd   = parseLocal(endDate,     endTime).getTime();

    const roundMs = useMemo(() => rounds.map(r => ({
        num:   r.number,
        start: parseLocal(r.startDate,    r.startTime).getTime(),
        end:   parseLocal(r.deadlineDate, r.deadlineTime).getTime(),
    })), [rounds]);

    // ── compute view window ─────────────────────────────────────────────────

    const allTimes = [
        regStart, regEnd, tourStart, tourEnd,
        ...roundMs.flatMap(r => [r.start, r.end]),
    ].filter(t => t > 0);

    const hasData = allTimes.length >= 2;

    const rawMin = hasData ? Math.min(...allTimes) : Date.now();
    const rawMax = hasData ? Math.max(...allTimes) : Date.now() + 7 * 86400000;
    const pad    = Math.max((rawMax - rawMin) * 0.08, 3600000);
    const viewMin   = rawMin - pad;
    const viewRange = (rawMax + pad) - viewMin;

    // ── position helpers ────────────────────────────────────────────────────

    const toPct = useCallback((ms: number) =>
        hasData ? clamp((ms - viewMin) / viewRange * 100, 0, 100) : 0,
    [viewMin, viewRange, hasData]);

    // ── drag logic ──────────────────────────────────────────────────────────

    const startDrag = (
        e: React.MouseEvent | React.TouchEvent,
        id: string,
        edge: "start" | "end" | "move",
        segStart: number,
        segEnd: number,
    ) => {
        e.preventDefault();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        setDragging({ id, edge, startX: clientX, origStart: segStart, origEnd: segEnd, viewMin, viewRange });
    };

    useEffect(() => {
        if (!dragging) return;

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!trackRef.current) return;
            const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
            const rect    = trackRef.current.getBoundingClientRect();
            const dx      = clientX - dragging.startX;
            const dms     = (dx / rect.width) * dragging.viewRange;

            let newStart = dragging.origStart;
            let newEnd   = dragging.origEnd;

            if (dragging.edge === "move") {
                const dur = dragging.origEnd - dragging.origStart;
                newStart  = dragging.origStart + dms;
                newEnd    = newStart + dur;
            } else if (dragging.edge === "start") {
                newStart = Math.min(dragging.origStart + dms, dragging.origEnd - MIN_SEGMENT_MS);
            } else {
                newEnd   = Math.max(dragging.origEnd + dms, dragging.origStart + MIN_SEGMENT_MS);
            }

            const startD = new Date(newStart);
            const endD   = new Date(newEnd);

            if (dragging.id === "reg") {
                setRegFromDate(toDateStr(startD)); setRegFromTime(toTimeStr(startD));
                setRegToDate(toDateStr(endD));     setRegToTime(toTimeStr(endD));
            } else if (dragging.id === "tour") {
                setStartDate(toDateStr(startD)); setStartTime(toTimeStr(startD));
                setEndDate(toDateStr(endD));     setEndTime(toTimeStr(endD));
            } else if (dragging.id.startsWith("r")) {
                const num = parseInt(dragging.id.slice(1), 10);
                onRoundChange(num, {
                    startDate:    toDateStr(startD), startTime:    toTimeStr(startD),
                    deadlineDate: toDateStr(endD),   deadlineTime: toTimeStr(endD),
                });
            }
        };

        const onUp = () => setDragging(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup",   onUp);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend",  onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup",   onUp);
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend",  onUp);
        };
    }, [dragging, setRegFromDate, setRegFromTime, setRegToDate, setRegToTime,
        setStartDate, setStartTime, setEndDate, setEndTime, onRoundChange]);

    // ── rows config ─────────────────────────────────────────────────────────

    type RowDef = {
        id:    string;
        label: string;
        start: number;
        end:   number;
        color: typeof REG_COLOR;
        valid: boolean;
    };

    const rows: RowDef[] = [
        {
            id: "reg", label: "Реєстрація",
            start: regStart, end: regEnd,
            color: REG_COLOR,
            valid: regStart > 0 && regEnd > regStart,
        },
        {
            id: "tour", label: "Турнір",
            start: tourStart, end: tourEnd,
            color: TOUR_COLOR,
            valid: tourStart > 0 && tourEnd > tourStart,
        },
        ...roundMs.map((r, i) => ({
            id:    `r${r.num}`,
            label: `Раунд ${r.num}`,
            start: r.start,
            end:   r.end,
            color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            valid: r.start > 0 && r.end > r.start,
        })),
    ];

    // ── tick marks ─────────────────────────────────────────────────────────

    const ticks = useMemo(() => {
        if (!hasData) return [];
        const count  = 5;
        const result = [];
        for (let i = 0; i <= count; i++) {
            const ms = viewMin + (viewRange * i) / count;
            result.push({ pct: (i / count) * 100, label: new Date(ms).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) });
        }
        return result;
    }, [viewMin, viewRange, hasData]);

    // ── "now" marker ────────────────────────────────────────────────────────
    const nowPct = toPct(Date.now());
    const showNow = nowPct > 0 && nowPct < 100;

    // ── scroll zoom ─────────────────────────────────────────────────────────
    // (intentionally omitted for simplicity — the view auto-fits)

    const totalH = rows.length * (ROW_H + 8) + 48;

    return (
        <div className="flex flex-col gap-3 select-none">
            {/* header */}
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <Calendar size={12} className="text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">
                    Таймлайн турніру
                </span>
                {!hasData && (
                    <span className="ml-auto text-[9px] font-bold text-(--t2)/50 uppercase tracking-wider">
                        Заповніть дати щоб побачити таймлайн
                    </span>
                )}
            </div>

            {/* track area */}
            <div className="rounded-2xl border border-(--brd) bg-(--bg)/60 overflow-hidden">
                {/* labels + bars */}
                <div className="flex">
                    {/* label column */}
                    <div className="flex flex-col pt-6 pb-3 pr-3 pl-4 gap-2 flex-shrink-0"
                         style={{ minWidth: 96 }}>
                        {rows.map(row => (
                            <div key={row.id}
                                 style={{ height: ROW_H }}
                                 className="flex items-center">
                                <span className={`text-[9px] font-black uppercase tracking-widest truncate ${row.color.text}`}>
                                    {row.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* bar track */}
                    <div className="flex-1 relative pt-6 pb-3 pr-4 overflow-hidden"
                         ref={trackRef}>

                        {/* grid lines */}
                        {ticks.map((t, i) => (
                            <div key={i}
                                 className="absolute top-0 bottom-3 border-l border-(--brd)/40"
                                 style={{ left: `${t.pct}%` }} />
                        ))}

                        {/* "now" line */}
                        {showNow && (
                            <div className="absolute top-0 bottom-3 border-l-2 border-red-500/60 border-dashed z-10"
                                 style={{ left: `${nowPct}%` }}>
                                <span className="absolute top-0 left-1 text-[8px] font-black text-red-400 uppercase tracking-widest whitespace-nowrap">
                                    зараз
                                </span>
                            </div>
                        )}

                        {/* row bars */}
                        <div className="flex flex-col gap-2">
                            {rows.map(row => {
                                const startPct = toPct(row.start);
                                const endPct   = toPct(row.end);
                                const widthPct = Math.max(endPct - startPct, 0.5);

                                return (
                                    <div key={row.id}
                                         style={{ height: ROW_H }}
                                         className="relative flex items-center">

                                        {row.valid ? (
                                            <div
                                                className={`absolute flex items-center rounded-xl border ${row.color.bg} ${row.color.border} group transition-all`}
                                                style={{
                                                    left:   `${startPct}%`,
                                                    width:  `${widthPct}%`,
                                                    height: ROW_H - 6,
                                                    minWidth: 24,
                                                }}
                                            >
                                                {/* left handle */}
                                                <div
                                                    className={`absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-ew-resize rounded-l-xl ${row.color.handle} opacity-70 hover:opacity-100 transition-opacity z-10`}
                                                    onMouseDown={e => startDrag(e, row.id, "start", row.start, row.end)}
                                                    onTouchStart={e => startDrag(e, row.id, "start", row.start, row.end)}
                                                >
                                                    <ChevronLeft size={8} className="text-white" />
                                                </div>

                                                {/* move area */}
                                                <div
                                                    className="absolute inset-0 left-3 right-3 cursor-grab active:cursor-grabbing flex items-center justify-center"
                                                    onMouseDown={e => startDrag(e, row.id, "move", row.start, row.end)}
                                                    onTouchStart={e => startDrag(e, row.id, "move", row.start, row.end)}
                                                >
                                                    <GripHorizontal size={10} className={`${row.color.text} opacity-50 group-hover:opacity-100 transition-opacity`} />
                                                </div>

                                                {/* right handle */}
                                                <div
                                                    className={`absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-ew-resize rounded-r-xl ${row.color.handle} opacity-70 hover:opacity-100 transition-opacity z-10`}
                                                    onMouseDown={e => startDrag(e, row.id, "end", row.start, row.end)}
                                                    onTouchStart={e => startDrag(e, row.id, "end", row.start, row.end)}
                                                >
                                                    <ChevronRight size={8} className="text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            // placeholder bar for missing dates
                                            <div className="w-full h-[calc(100%-6px)] rounded-xl border border-dashed border-(--brd)/50 opacity-30" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* tick labels */}
                        <div className="relative h-5 mt-1">
                            {ticks.map((t, i) => (
                                <span
                                    key={i}
                                    className="absolute text-[8px] font-bold text-(--t2)/50 uppercase tracking-wider"
                                    style={{
                                        left:      `${t.pct}%`,
                                        transform: i === ticks.length - 1 ? "translateX(-100%)" : i === 0 ? "none" : "translateX(-50%)",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {t.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* tooltip while dragging */}
            {dragging && (() => {
                const row = rows.find(r => r.id === dragging.id);
                if (!row) return null;
                return (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-(--card) border border-(--brd) text-[10px] font-bold text-(--t2)">
                        <span className={`font-black ${row.color.text}`}>{row.label}</span>
                        <span>·</span>
                        <span>{fmtLabel(new Date(row.start))}</span>
                        <span className="text-(--t2)/30">→</span>
                        <span>{fmtLabel(new Date(row.end))}</span>
                    </div>
                );
            })()}
        </div>
    );
}
