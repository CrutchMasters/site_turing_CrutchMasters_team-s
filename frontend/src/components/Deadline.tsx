"use client";

import React from "react";
import { Clock, Calendar } from "lucide-react";

// ── Хук таймера ──────────────────────────────────────────────────────────────
function useCountdown(endAt?: string) {
    const [time, setTime] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    React.useEffect(() => {
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

// ── Ячейка таймера ───────────────────────────────────────────────────────────
function TimeBlock({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-1.5 flex-1">
        <div className={`w-full py-4 rounded-2xl border flex items-center justify-center ${urgent ? "bg-red-500/10 border-red-500/25" : "bg-(--bg) border-(--brd)"}`}>
        <span className={`text-3xl font-black tabular-nums ${urgent ? "text-red-500" : "text-(--t1)"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {String(value).padStart(2, "0")}
        </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
        </div>
    );
}

function fmtDate(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("uk-UA", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// ── Пропси компонента ────────────────────────────────────────────────────────
/**
 * Универсальный блок дедлайна. Работает для:
 *
 *  - Реєстрації команд:
 *      <Deadline endAt={tournament.registration_to} startAt={tournament.registration_from}
 *                activeLabel="До завершення реєстрації команд"
 *                endedLabel="Реєстрація завершена" />
 *
 *  - Дедлайн здачі роботи раунду (rounds/[id]/page, rounds/[id]/submit/page):
 *      <Deadline endAt={round.end_at} startAt={round.start_at}
 *                activeLabel={`До дедлайну здачі — ${fmtDate(round.end_at)}`}
 *                endedLabel="Дедлайн здачі минув" />
 *
 *  - Дедлайн журі (judging_deadline):
 *      <Deadline endAt={round.judging_deadline} startAt={round.end_at}
 *                activeLabel="До завершення оцінювання"
 *                endedLabel="Оцінювання завершено"
 *                accentColor="purple" />
 *
 *  - Реєстрація журі:
 *      <Deadline endAt={tournament.jury_registration_to} startAt={tournament.jury_registration_from}
 *                activeLabel="До завершення реєстрації журі"
 *                endedLabel="Реєстрація журі завершена"
 *                accentColor="amber" />
 */
export interface DeadlineProps {
    /** ISO-строка конца периода (обязательна) */
    endAt: string;
    /** ISO-строка начала периода (для прогресс-бара) */
    startAt?: string;
    /** Заголовок пока таймер идёт */
    activeLabel?: string;
    /** Заголовок когда время вышло */
    endedLabel?: string;
    /** Дополнительный текст под таймером когда время вышло */
    endedDescription?: string;
    /**
     * Цвет акцента прогресс-бара и "срочного" состояния.
     * "blue" (по умолчанию) | "purple" | "amber" | "green"
     */
    accentColor?: "blue" | "purple" | "amber" | "green";
    /** Порог (0–100) после которого включается urgent-режим. По умолчанию: 80 */
    urgentThreshold?: number;
}

const ACCENT: Record<NonNullable<DeadlineProps["accentColor"]>, { normal: string; urgent: string; urgentBg: string; urgentBorder: string }> = {
    blue:   { normal: "linear-gradient(90deg,#2563eb,#1d4ed8)", urgent: "#ef4444", urgentBg: "bg-red-500/10",    urgentBorder: "border-red-500/25"    },
    purple: { normal: "linear-gradient(90deg,#7c3aed,#6d28d9)", urgent: "#ef4444", urgentBg: "bg-red-500/10",    urgentBorder: "border-red-500/25"    },
    amber:  { normal: "linear-gradient(90deg,#d97706,#b45309)", urgent: "#ef4444", urgentBg: "bg-red-500/10",    urgentBorder: "border-red-500/25"    },
    green:  { normal: "linear-gradient(90deg,#16a34a,#15803d)", urgent: "#ef4444", urgentBg: "bg-red-500/10",    urgentBorder: "border-red-500/25"    },
};

export function Deadline({
    endAt,
    startAt,
    activeLabel = "До завершення",
    endedLabel  = "Завершено",
    endedDescription,
    accentColor = "blue",
    urgentThreshold = 80,
}: DeadlineProps) {
    const countdown = useCountdown(endAt);
    const accent    = ACCENT[accentColor];

    const endTs   = new Date(endAt).getTime();
    const startTs = startAt ? new Date(startAt).getTime() : 0;
    const now     = Date.now();

    const progressPct =
    endTs > 0 && startTs > 0 && endTs > startTs
    ? Math.min(100, Math.max(0, ((now - startTs) / (endTs - startTs)) * 100))
    : 0;

    const isUrgent = progressPct > urgentThreshold;
    const isEnded  = endTs > 0 && now > endTs;

    const dotStyle = isUrgent
    ? { background: accent.urgent, boxShadow: "0 0 0 3px rgba(239,68,68,0.25)" }
    : { background: accent.normal.match(/#[0-9a-f]{6}/i)?.[0] ?? "#2563eb", boxShadow: "0 0 0 3px rgba(37,99,235,0.25)" };

    return (
        <div className="rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
        {/* ── Заголовок ── */}
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-3 border-b border-(--brd)">
        <div className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center flex-shrink-0">
        <Clock size={16} className="text-(--t2)" />
        </div>
        <h2 className="font-black text-base sm:text-lg text-(--t1) uppercase tracking-tight">
        {isEnded ? endedLabel : activeLabel}
        </h2>
        </div>

        {/* ── Тіло ── */}
        <div className="p-4 sm:p-6 md:p-8">
        {/* Таймер */}
        <div className="flex items-end gap-2 mb-5">
        <TimeBlock value={countdown.days}    label="днів"  urgent={isUrgent} />
        <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
        <TimeBlock value={countdown.hours}   label="год"   urgent={isUrgent} />
        <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
        <TimeBlock value={countdown.minutes} label="хв"    urgent={isUrgent} />
        <span className="text-2xl font-black text-(--t2) mb-6 flex-shrink-0">:</span>
        <TimeBlock value={countdown.seconds} label="сек"   urgent={isUrgent} />
        </div>

        {/* Прогрес-бар + дати */}
        {endTs > 0 && (
            <>
            <div className="relative h-2 rounded-full bg-(--brd) overflow-hidden mb-1">
            <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
            style={{
                width: `${progressPct}%`,
                background: isUrgent
                ? "linear-gradient(90deg,#f97316,#ef4444)"
                : accent.normal,
                minWidth: progressPct > 0 ? 8 : 0,
            }}
            />
            {progressPct > 0 && progressPct < 100 && (
                <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-(--card) transition-all duration-1000"
                style={{ left: `calc(${progressPct}% - 8px)`, ...dotStyle }}
                />
            )}
            </div>
            <div className="flex items-center justify-between">
            <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
            <Calendar size={12} /> {startAt ? fmtDate(startAt) : "Старт не вказано"}
            </span>
            <span className="text-xs text-(--t2) font-bold flex items-center gap-1.5">
            {fmtDate(endAt)} <Calendar size={12} />
            </span>
            </div>
            </>
        )}

        {/* Опис після завершення */}
        {isEnded && endedDescription && (
            <p className="mt-4 text-sm text-(--t2) font-medium">{endedDescription}</p>
        )}
        </div>
        </div>
    );
}

// ── Обратная совместимость (старое название) ──────────────────────────────────
/** @deprecated Используй <Deadline /> напрямую */
export const RegistrationDeadline = (props: {
    registrationFrom?: string;
    registrationTo: string;
    activeLabel?: string;
    endedLabel?: string;
    endedDescription?: string;
}) => (
    <Deadline
    endAt={props.registrationTo}
    startAt={props.registrationFrom}
    activeLabel={props.activeLabel ?? "До завершення реєстрації команд"}
    endedLabel={props.endedLabel ?? "Реєстрація завершена"}
    endedDescription={props.endedDescription}
    />
);
