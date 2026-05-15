//site_turing_CrutchMasters_team-s/frontend/src/components/JuryInvitePanel.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, Search, Check, X, Loader, UserPlus, Shield, Trash2, Globe, Hash } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface JuryUser {
    id: string;
    username: string;
    login: string;
    email: string;
    avatar_url?: string;
}

interface ActiveJury {
    id: string;
    username: string;
    login: string;
    email: string;
    avatar_url?: string;
}

interface Props {
    tournamentId: string;
    tournamentName?: string;
    onRemoveJury?: (juryId: string) => Promise<void>;
    // Опціональні: якщо передано — панель працює в режимі "конкретний раунд"
    roundId?: string;
    roundName?: string;
    roundNumber?: number;
}

export default function JuryInvitePanel({ tournamentId, tournamentName, onRemoveJury, roundId, roundName, roundNumber }: Props) {
    const { token: authToken } = useAuth();
    const [candidates, setCandidates]   = useState<JuryUser[]>([]);
    const [activeJury, setActiveJury]   = useState<ActiveJury[]>([]);
    const [loading, setLoading]         = useState(false);
    const [search, setSearch]           = useState("");
    const [sending, setSending]         = useState<Record<string, boolean>>({});
    const [sent, setSent]               = useState<Record<string, boolean>>({});
    const [removing, setRemoving]       = useState<Record<string, boolean>>({});
    const [error, setError]             = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [confirmInvite, setConfirmInvite] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Чи ми в режимі "конкретний раунд"
    const isRoundScope = Boolean(roundId);
    const scopeLabel   = roundName || (roundNumber ? `Раунд ${roundNumber}` : "цей раунд");

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const authHeader = useCallback((): Record<string, string> => {
        const t = authToken ?? "";
        return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
    }, [authToken]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Формуємо URL кандидатів з урахуванням scope
            let candUrl = `${API_URL}/api/tournaments/${tournamentId}/jury-candidates`;
            if (isRoundScope && roundId) {
                candUrl += `?scope=round&round_id=${roundId}`;
            } else {
                candUrl += `?scope=tournament`;
            }

            const [candRes, juryRes] = await Promise.all([
                fetch(candUrl, { headers: authHeader() }),
                fetch(`${API_URL}/api/tournaments/${tournamentId}/jury`, { headers: authHeader() }),
            ]);
            if (candRes.ok) setCandidates((await candRes.json()).candidates ?? []);
            if (juryRes.ok) setActiveJury((await juryRes.json()).jury ?? []);
        } catch { setError("Помилка завантаження даних"); }
        finally { setLoading(false); }
    }, [tournamentId, roundId, isRoundScope, authHeader]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const sendInvite = async (juryId: string) => {
        setSending(prev => ({ ...prev, [juryId]: true }));
        setError(null);
        try {
            const body: Record<string, string> = {
                tournament_id: tournamentId,
                jury_id: juryId,
            };
            // Якщо є roundId — запрошуємо на конкретний раунд
            if (isRoundScope && roundId) {
                body.round_id = roundId;
            }

            const res = await fetch(`${API_URL}/api/jury-invitations/send`, {
                method: "POST", headers: authHeader(),
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json();
                setError(err.detail ?? "Помилка відправки запрошення");
                showToast(err.detail ?? "Помилка відправки запрошення", "error");
                return;
            }
            setSent(prev => ({ ...prev, [juryId]: true }));
            setCandidates(prev => prev.filter(c => c.id !== juryId));
            const scopeMsg = isRoundScope ? `до «${scopeLabel}»` : "до турніру";
            showToast(`Запрошення ${scopeMsg} надіслано!`);
        } catch { setError("Помилка з'єднання"); }
        finally { setSending(prev => ({ ...prev, [juryId]: false })); }
    };

    const confirmSendInvite = async () => {
        const juryId = confirmInvite;
        if (!juryId) return;
        setConfirmInvite(null);
        await sendInvite(juryId);
    };

    const removeJury = async (juryId: string) => {
        if (!onRemoveJury) return;
        setRemoving(prev => ({ ...prev, [juryId]: true }));
        setError(null);
        try {
            await onRemoveJury(juryId);
            const removed = activeJury.find(j => j.id === juryId);
            setActiveJury(prev => prev.filter(j => j.id !== juryId));
            if (removed) setCandidates(prev => [removed, ...prev]);
            showToast("Журі видалено з турніру");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Помилка видалення журі";
            setError(msg);
            showToast(msg, "error");
        } finally {
            setRemoving(prev => ({ ...prev, [juryId]: false }));
        }
    };

    const confirmRemoveJury = async () => {
        const juryId = confirmRemove;
        if (!juryId) return;
        setConfirmRemove(null);
        await removeJury(juryId);
    };

    const filtered = candidates.filter(c =>
        !search.trim() ||
        c.username.toLowerCase().includes(search.toLowerCase()) ||
        c.login.toLowerCase().includes(search.toLowerCase())
    );

    const letter = (u: JuryUser | ActiveJury) =>
        (u.username || u.login || "?").charAt(0).toUpperCase();

    // Кольорова схема залежно від scope
    const accentColor  = isRoundScope ? "violet" : "amber";
    const borderClass  = isRoundScope ? "border-violet-500/30" : "border-amber-500/30";
    const headerBorder = isRoundScope ? "border-violet-500/20" : "border-amber-500/20";
    const iconBg       = isRoundScope ? "bg-violet-500/15 border-violet-500/30" : "bg-amber-500/15 border-amber-500/30";
    const iconColor    = isRoundScope ? "text-violet-500" : "text-amber-500";
    const titleColor   = isRoundScope ? "text-violet-500" : "text-amber-500";
    const searchFocus  = isRoundScope ? "focus:ring-violet-500/30 focus:border-violet-500" : "focus:ring-amber-500/30 focus:border-amber-500";
    const btnBg        = isRoundScope
        ? "bg-violet-500/10 border-violet-500/30 text-violet-600 hover:bg-violet-500 hover:text-white"
        : "bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500 hover:text-white";
    const confirmBorder = isRoundScope ? "border-violet-500/30" : "border-amber-500/30";
    const confirmBtnBg  = isRoundScope ? "bg-violet-500 hover:bg-violet-600" : "bg-amber-500 hover:bg-amber-600";

    return (
        <div className={`bg-(--card) rounded-2xl sm:rounded-[2.5rem] border ${borderClass} shadow-sm overflow-hidden`}>

        {/* Header */}
        <div className={`w-full flex items-center gap-3 px-6 sm:px-8 py-4 border-b ${headerBorder}`}>
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
            {isRoundScope
                ? <Hash size={15} className={iconColor} />
                : <Star size={15} className={iconColor} />
            }
        </div>
        <div className="flex-1 min-w-0">
        <p className={`text-xs font-black uppercase tracking-widest ${titleColor}`}>
            {isRoundScope ? `Журі раунду` : "Журі турніру"}
        </p>
        <p className="text-[10px] font-bold text-(--t2) mt-0.5">
            {isRoundScope
                ? <span>Для <span className="font-black text-(--t1)">«{scopeLabel}»</span> — доступ тільки до цього раунду</span>
                : (activeJury.length > 0 ? `${activeJury.length} журі залучено` : "Запросіть журі для оцінювання")
            }
        </p>
        </div>
        {!isRoundScope && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[9px] font-black uppercase tracking-wider">
                <Globe size={9} /> Всі раунди
            </div>
        )}
        </div>

        <div className="p-6 sm:p-8 space-y-6">

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[11px] font-bold">
                <X size={13} /> {error}
                </div>
            )}

            {/* Active jury list — тільки якщо scope=tournament (для раунду показуємо RoundJuryEmailInvitePanel) */}
            {!isRoundScope && activeJury.length > 0 && (
                <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3 flex items-center gap-2">
                <Shield size={11} className="text-green-500" /> Залучені журі ({activeJury.length})
                </p>
                <div className="space-y-2">
                {activeJury.map(j => (
                    <div key={j.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600 font-black text-sm flex-shrink-0 overflow-hidden">
                    {j.avatar_url ? <img src={j.avatar_url} alt="" className="w-full h-full object-cover" /> : letter(j)}
                    </div>
                    <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-(--t1) truncate">{j.username}</p>
                    <p className="text-[10px] font-bold text-(--t2)">@{j.login}</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-[9px] font-black uppercase">
                    <Check size={9} /> Активний
                    </div>
                    {onRemoveJury && (
                        <button
                        type="button"
                        onClick={() => setConfirmRemove(j.id)}
                        disabled={removing[j.id]}
                        title="Видалити журі з турніру"
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-40"
                        >
                        {removing[j.id] ? <Loader size={10} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                    )}
                    </div>
                ))}
                </div>
                </div>
            )}

            {/* Search + candidates */}
            <div>
            <p className={`text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3 flex items-center gap-2`}>
            <UserPlus size={11} className={iconColor} />
            {isRoundScope ? `Запросити до «${scopeLabel}»` : "Запросити нового журі"}
            </p>

            <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-4 h-4" />
            <input
            type="text"
            placeholder="Пошук за іменем або логіном..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) ${searchFocus} outline-none text-sm transition-all`}
            />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                <Loader className={`w-5 h-5 ${iconColor} animate-spin`} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                <Star className="w-10 h-10 text-(--t2) opacity-30 mx-auto mb-2" />
                <p className="text-[11px] font-black uppercase tracking-widest text-(--t2)">
                {search ? "Нікого не знайдено" : "Всі журі вже запрошені"}
                </p>
                </div>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filtered.map(c => (
                    <div key={c.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) hover:border-${accentColor}-500/30 transition-all`}>
                    <div className={`w-8 h-8 rounded-full bg-${accentColor}-500/10 border border-${accentColor}-500/20 flex items-center justify-center text-${accentColor}-600 font-black text-sm flex-shrink-0 overflow-hidden`}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : letter(c)}
                    </div>
                    <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-(--t1) truncate">{c.username}</p>
                    <p className="text-[10px] font-bold text-(--t2)">@{c.login}</p>
                    </div>
                    {sent[c.id] ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase">
                        <Check size={10} /> Надіслано
                        </div>
                    ) : (
                        <button
                        type="button"
                        onClick={() => setConfirmInvite(c.id)}
                        disabled={sending[c.id]}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${btnBg}`}
                        >
                        {sending[c.id] ? <Loader size={10} className="animate-spin" /> : <Star size={10} />}
                        {sending[c.id] ? "..." : "Запросити"}
                        </button>
                    )}
                    </div>
                ))}
                </div>
            )}
            </div>
        </div>

        {/* Toast */}
        {toast && (
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-black transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 ${
                toast.type === "success"
                    ? "bg-green-500 border-green-400 text-white"
                    : "bg-red-500 border-red-400 text-white"
            }`}>
                {toast.type === "success" ? <Check size={15} /> : <X size={15} />}
                {toast.message}
            </div>
        )}

        {/* Підтвердження запрошення */}
        {confirmInvite && (() => {
            const jury = candidates.find(c => c.id === confirmInvite);
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className={`bg-(--card) rounded-2xl border ${confirmBorder} shadow-2xl w-full max-w-sm p-6 space-y-4`}>
                    <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                        {isRoundScope ? <Hash size={18} className={iconColor} /> : <Star size={18} className={iconColor} />}
                    </div>
                    <div>
                        <p className="text-sm font-black text-(--t1)">Запросити журі?</p>
                        <p className="text-[11px] font-bold text-(--t2) mt-0.5">
                        {isRoundScope
                            ? <>Доступ тільки до <span className="text-(--t1)">«{scopeLabel}»</span></>
                            : "Доступ до всіх раундів турніру"
                        }
                        </p>
                    </div>
                    </div>
                    {jury && (
                        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-${accentColor}-500/5 border border-${accentColor}-500/15`}>
                        <div className={`w-8 h-8 rounded-full bg-${accentColor}-500/10 border border-${accentColor}-500/20 flex items-center justify-center text-${accentColor}-600 font-black text-sm flex-shrink-0 overflow-hidden`}>
                            {jury.avatar_url ? <img src={jury.avatar_url} alt="" className="w-full h-full object-cover" /> : letter(jury)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black text-(--t1) truncate">{jury.username}</p>
                            <p className="text-[10px] font-bold text-(--t2)">@{jury.login}</p>
                        </div>
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setConfirmInvite(null)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-black uppercase tracking-widest hover:border-amber-500/40 transition-all">
                        Скасувати
                        </button>
                        <button type="button" onClick={confirmSendInvite}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${confirmBtnBg}`}>
                        Запросити
                        </button>
                    </div>
                </div>
                </div>
            );
        })()}

        {/* Підтвердження видалення */}
        {confirmRemove && (() => {
            const jury = activeJury.find(j => j.id === confirmRemove);
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-(--card) rounded-2xl border border-red-500/30 shadow-2xl w-full max-w-sm p-6 space-y-4">
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={18} className="text-red-500" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-(--t1)">Видалити журі?</p>
                        <p className="text-[11px] font-bold text-(--t2) mt-0.5">Цю дію не можна скасувати</p>
                    </div>
                    </div>
                    {jury && (
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/15">
                        <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 font-black text-sm flex-shrink-0 overflow-hidden">
                            {jury.avatar_url ? <img src={jury.avatar_url} alt="" className="w-full h-full object-cover" /> : letter(jury)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black text-(--t1) truncate">{jury.username}</p>
                            <p className="text-[10px] font-bold text-(--t2)">@{jury.login}</p>
                        </div>
                        </div>
                    )}
                    <p className="text-[11px] text-(--t2) font-medium leading-relaxed">
                        Журі буде відкликано з турніру. Виставлені оцінки збережуться в системі.
                    </p>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setConfirmRemove(null)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) text-xs font-black uppercase tracking-widest hover:border-amber-500/40 transition-all">
                        Скасувати
                        </button>
                        <button type="button" onClick={confirmRemoveJury}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95">
                        Видалити
                        </button>
                    </div>
                </div>
                </div>
            );
        })()}
        </div>
    );
}
