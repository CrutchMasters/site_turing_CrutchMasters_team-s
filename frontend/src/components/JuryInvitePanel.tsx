//site_turing_CrutchMasters_team-s/frontend/src/components/JuryInvitePanel.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, Search, Check, X, Loader, UserPlus, Shield, Trash2 } from "lucide-react";
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
}

export default function JuryInvitePanel({ tournamentId, tournamentName, onRemoveJury }: Props) {
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
            const [candRes, juryRes] = await Promise.all([
                fetch(`${API_URL}/api/tournaments/${tournamentId}/jury-candidates`, { headers: authHeader() }),
                fetch(`${API_URL}/api/tournaments/${tournamentId}/jury`, { headers: authHeader() }),
            ]);
            if (candRes.ok) setCandidates((await candRes.json()).candidates ?? []);
            if (juryRes.ok) setActiveJury((await juryRes.json()).jury ?? []);
        } catch { setError("Помилка завантаження даних"); }
        finally { setLoading(false); }
    }, [tournamentId, authHeader]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const sendInvite = async (juryId: string) => {
        setSending(prev => ({ ...prev, [juryId]: true }));
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/jury-invitations/send`, {
                method: "POST", headers: authHeader(),
                body: JSON.stringify({ tournament_id: tournamentId, jury_id: juryId }),
            });
            if (!res.ok) {
                const err = await res.json();
                setError(err.detail ?? "Помилка відправки запрошення");
                showToast(err.detail ?? "Помилка відправки запрошення", "error");
                return;
            }
            setSent(prev => ({ ...prev, [juryId]: true }));
            setCandidates(prev => prev.filter(c => c.id !== juryId));
            showToast("Запрошення надіслано!");
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

    return (
        <div className="bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-amber-500/30 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="w-full flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-amber-500/20">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
        <Star size={15} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-widest text-amber-500">Журі турніру</p>
        <p className="text-[10px] font-bold text-(--t2) mt-0.5">
        {activeJury.length > 0 ? `${activeJury.length} журі залучено` : "Запросіть журі для оцінювання"}
        </p>
        </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[11px] font-bold">
                <X size={13} /> {error}
                </div>
            )}

            {/* Active jury list */}
            {activeJury.length > 0 && (
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
            <p className="text-[10px] font-black uppercase tracking-widest text-(--t2) mb-3 flex items-center gap-2">
            <UserPlus size={11} className="text-amber-500" /> Запросити нового журі
            </p>

            <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-4 h-4" />
            <input
            type="text"
            placeholder="Пошук за іменем або логіном..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none text-sm transition-all"
            />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                <Loader className="w-5 h-5 text-amber-500 animate-spin" />
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
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-(--brd) bg-(--bg) hover:border-amber-500/30 transition-all">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-black text-sm flex-shrink-0 overflow-hidden">
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
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

        {/* Toast повідомлення */}
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
                <div className="bg-(--card) rounded-2xl border border-amber-500/30 shadow-2xl w-full max-w-sm p-6 space-y-4">
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <Star size={18} className="text-amber-500" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-(--t1)">Запросити журі?</p>
                        <p className="text-[11px] font-bold text-(--t2) mt-0.5">Буде надіслано запрошення</p>
                    </div>
                    </div>
                    {jury && (
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-black text-sm flex-shrink-0 overflow-hidden">
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
                        className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all active:scale-95">
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
