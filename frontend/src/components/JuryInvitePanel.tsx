//site_turing_CrutchMasters_team-s/frontend/src/components/JuryInvitePanel.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, Search, Check, X, Loader, ChevronDown, ChevronUp, UserPlus, Shield } from "lucide-react";

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
}

export default function JuryInvitePanel({ tournamentId, tournamentName }: Props) {
    const [open, setOpen]               = useState(false);
    const [candidates, setCandidates]   = useState<JuryUser[]>([]);
    const [activeJury, setActiveJury]   = useState<ActiveJury[]>([]);
    const [loading, setLoading]         = useState(false);
    const [search, setSearch]           = useState("");
    const [sending, setSending]         = useState<Record<string, boolean>>({});
    const [sent, setSent]               = useState<Record<string, boolean>>({});
    const [error, setError]             = useState<string | null>(null);

    const authHeader = useCallback((): Record<string, string> => {
        const t = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
        return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
    }, []);

    const fetchData = useCallback(async () => {
        if (!open) return;
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
    }, [open, tournamentId, authHeader]);

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
                return;
            }
            setSent(prev => ({ ...prev, [juryId]: true }));
            // прибираємо з кандидатів
            setCandidates(prev => prev.filter(c => c.id !== juryId));
        } catch { setError("Помилка з'єднання"); }
        finally { setSending(prev => ({ ...prev, [juryId]: false })); }
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

        {/* Header — toggle */}
        <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-6 sm:px-8 py-4 hover:bg-amber-500/5 transition-colors text-left"
        >
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
        <Star size={15} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-widest text-amber-500">Журі турніру</p>
        <p className="text-[10px] font-bold text-(--t2) mt-0.5">
        {activeJury.length > 0 ? `${activeJury.length} журі залучено` : "Запросіть журі для оцінювання"}
        </p>
        </div>
        {open ? <ChevronUp size={16} className="text-(--t2) flex-shrink-0" /> : <ChevronDown size={16} className="text-(--t2) flex-shrink-0" />}
        </button>

        {open && (
            <div className="border-t border-amber-500/20 p-6 sm:p-8 space-y-6">

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
                        onClick={() => sendInvite(c.id)}
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
        )}
        </div>
    );
}
