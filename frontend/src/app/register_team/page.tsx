//site_turing_CrutchMasters_team-s/frontend/src/app/register_team/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import {
  Users, ChevronRight, Crown, Search, X, Plus,
  Send, Mail, Check, Loader, AlertCircle,
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface SearchedUser {
  id: string;
  username: string;
  login: string;
  email: string;
  role: string;
  avatar_url?: string;
}

// ── Portal dropdown — renders at document.body, always above everything ──────

function PortalDropdown({
  anchorRef,
  open,
  children,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    };
      update();
      // update on every scroll/resize so it stays glued while page scrolls
      window.addEventListener("scroll", update, true);
      window.addEventListener("resize", update);
      return () => {
        window.removeEventListener("scroll", update, true);
        window.removeEventListener("resize", update);
      };
  }, [open, anchorRef]);

  if (!open || !rect) return null;

  return createPortal(
    <div
    style={{
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
    }}
    >
    {children}
    </div>,
    document.body
  );
}

// ── User avatar with fallback to initials ────────────────────────────────────
function UserAvatar({ user, variant = "md" }: { user: SearchedUser; variant?: "sm" | "md" }) {
  const [imgError, setImgError] = useState(false);
  const initial = (user.username || user.login || "?").charAt(0).toUpperCase();
  const sizeClass = variant === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-sm";
  if (user.avatar_url && !imgError) {
    return (
      <img
        src={user.avatar_url}
        alt={user.username}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-blue-600/25`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-black flex-shrink-0`}>
      {initial}
    </div>
  );
}

// ── User search field with dropdown ──────────────────────────────────────────
function UserSearchDropdown({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  excludeIds = [],
  maxVisible = 3,
}: {
  label: string;
  placeholder: string;
  selected: SearchedUser | null;
  onSelect: (u: SearchedUser) => void;
  onClear: () => void;
  excludeIds?: string[];
  maxVisible?: number;
}) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
      .from("account")
      .select("id, username, login, email, role, avatar_url")
      .or(`username.ilike.%${q}%,login.ilike.%${q}%`)
      .eq("status", "active")
      .limit(12);
      setResults((data ?? []).filter((u: SearchedUser) => !excludeIds.includes(u.id)));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [excludeIds]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 280);
  };

  const pick = (u: SearchedUser) => {
    onSelect(u);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const letter = (u: SearchedUser) =>
  (u.username || u.login || "?").charAt(0).toUpperCase();

  const ITEM_H = 56;
  const showDropdown = open && (results.length > 0 || (!!query.trim() && !loading));

  // ── Selected state ──
  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">{label}</label>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-(--bg) border border-blue-600/40">
      <UserAvatar key={selected.avatar_url ?? selected.id} user={selected} variant="md" />
      <div className="flex-1 min-w-0">
      <p className="font-black text-(--t1) text-sm truncate">{selected.username}</p>
      <p className="text-[10px] text-(--t2) font-bold">@{selected.login}</p>
      </div>
      <button
      type="button"
      onClick={onClear}
      className="text-(--t2) hover:text-red-500 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-red-500/10"
      >
      <X size={15} />
      </button>
      </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">{label}</label>

    <div className="relative" ref={wrapperRef}>
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--t2) pointer-events-none w-4 h-4 z-10" />
    <input
    type="text"
    placeholder={placeholder}
    value={query}
    onChange={handleChange}
    onFocus={() => { if (query) setOpen(true); }}
    autoComplete="off"
    className="w-full pl-10 pr-10 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none text-sm transition-all"
    />
    {loading && (
      <Loader className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 w-4 h-4 animate-spin z-10" />
    )}

    {/* Portal dropdown — rendered at body, above all panels */}
    <PortalDropdown anchorRef={wrapperRef} open={showDropdown}>
    <div
    style={{
      borderRadius: "1.25rem",
      backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          background: "var(--card)",
          border: "1px solid var(--brd)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
    }}
    >
    {results.length === 0 ? (
      <div className="px-4 py-4 text-[11px] font-bold text-(--t2) text-center uppercase tracking-wider">
      Нічого не знайдено
      </div>
    ) : (
      <div
      style={{ maxHeight: `${maxVisible * ITEM_H}px`, overflowY: "auto" }}
      className="dropdown-scroll"
      >
      {results.map((u, i) => (
        <button
        key={u.id}
        type="button"
        onMouseDown={e => { e.preventDefault(); pick(u); }}
        className="w-full flex items-center gap-3 px-4 hover:bg-(--bg) transition-colors text-left"
        style={{
          height: `${ITEM_H}px`,
          borderTop: i > 0 ? "1px solid var(--brd)" : "none",
        }}
        >
        <UserAvatar user={u} variant="md" />
        <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-(--t1) truncate leading-tight">{u.username}</p>
        <p className="text-[10px] text-(--t2) font-bold">@{u.login}</p>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-(--bg) border border-(--brd) text-(--t2) flex-shrink-0 ml-2">
        {u.role}
        </span>
        </button>
      ))}
      </div>
    )}
    </div>
    </PortalDropdown>
    </div>
    </div>
  );
}

// ── Member chip ───────────────────────────────────────────────────────────────
function MemberChip({ user: u, onRemove }: { user: SearchedUser; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-(--bg) border border-(--brd) rounded-xl px-3 py-2 hover:border-red-400/40 transition-all">
    <UserAvatar user={u} variant="sm" />
    <span className="text-xs font-bold text-(--t1) max-w-[100px] truncate">{u.username}</span>
    <button type="button" onClick={onRemove} className="text-(--t2) hover:text-red-500 transition-colors ml-0.5">
    <X size={12} />
    </button>
    </div>
  );
}

// ── Section card header ───────────────────────────────────────────────────────
function SectionHeader({ num, title, right }: { num: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-6 sm:px-8 py-4 border-b border-(--brd) bg-(--bg)/40">
    <span className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-xs font-black text-blue-600 flex-shrink-0">
    {num}
    </span>
    <h2 className="font-black text-sm uppercase tracking-widest text-(--t1)">{title}</h2>
    {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

// ── Draft persistence (sessionStorage, TTL 5 min) ────────────────────────────
const DRAFT_KEY = "register_team_draft";
const DRAFT_TTL = 5 * 60 * 1000; // 5 minutes in ms

interface DraftData {
  teamName: string;
  organization: string;
  contactEmail: string;
  showDiscord: boolean;
  showTelegram: boolean;
  discordLink: string;
  telegramLink: string;
  captain: SearchedUser | null;
  members: SearchedUser[];
  savedAt: number;
}

function loadDraft(): DraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data: DraftData = JSON.parse(raw);
    if (Date.now() - data.savedAt > DRAFT_TTL) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function saveDraft(data: Omit<DraftData, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {}
}

function clearDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RegisterTeamPage() {
  const { dark } = useTheme();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // ── Restore from draft on first render ──
  const draft = typeof window !== "undefined" ? loadDraft() : null;

  const [teamName, setTeamName]         = useState(draft?.teamName     ?? "");
  const [organization, setOrganization] = useState(draft?.organization ?? "");
  const [contactEmail, setContactEmail] = useState(draft?.contactEmail ?? "");
  const [showDiscord, setShowDiscord]   = useState(draft?.showDiscord  ?? false);
  const [showTelegram, setShowTelegram] = useState(draft?.showTelegram ?? false);
  const [discordLink, setDiscordLink]   = useState(draft?.discordLink  ?? "");
  const [telegramLink, setTelegramLink] = useState(draft?.telegramLink ?? "");
  const [captain, setCaptain]           = useState<SearchedUser | null>(draft?.captain ?? null);
  const [members, setMembers]           = useState<SearchedUser[]>(draft?.members ?? []);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);

  // ── Auto-save draft on every change ──
  useEffect(() => {
    saveDraft({ teamName, organization, contactEmail, showDiscord, showTelegram, discordLink, telegramLink, captain, members });
  }, [teamName, organization, contactEmail, showDiscord, showTelegram, discordLink, telegramLink, captain, members]);

  const [discordError, setDiscordError]   = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [submitError, setSubmitError]     = useState("");

  // ── Link validators ──
  const validateDiscord = (val: string) => {
    if (!val) return "";
    const ok = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9\-_]+$/.test(val.trim());
    return ok ? "" : "Введіть коректне посилання: https://discord.gg/... або https://discord.com/invite/...";
  };
  const validateTelegram = (val: string) => {
    if (!val) return "";
    const ok = /^https:\/\/t\.me\/[a-zA-Z0-9_\-\+]+/.test(val.trim());
    return ok ? "" : "Введіть коректне посилання: https://t.me/...";
  };

  useEffect(() => {
    if (!user) return;
    if (!captain) {
      // Вперше — встановлюємо капітана з поточного юзера
      setCaptain({ id: user.id, username: user.username, login: user.login, email: user.email, role: user.role, avatar_url: user.avatar_url });
    } else if (captain.id === user.id && captain.avatar_url !== user.avatar_url) {
      // Якщо капітан — це поточний юзер і avatar_url оновився (після refreshRole) — синхронізуємо
      setCaptain(prev => prev ? { ...prev, avatar_url: user.avatar_url } : prev);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

    const addMember = (u: SearchedUser) => {
      if (members.length >= 10 || members.find(m => m.id === u.id)) return;
      setMembers(prev => [...prev, u]);
    };
    const removeMember = (id: string) => setMembers(prev => prev.filter(m => m.id !== id));
    const excludedFromMembers = [...(captain ? [captain.id] : []), ...members.map(m => m.id)];

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!teamName.trim() || !captain) return;

      const dErr = validateDiscord(discordLink);
      const tErr = validateTelegram(telegramLink);
      setDiscordError(dErr);
      setTelegramError(tErr);
      if (dErr || tErr) return;

      setSubmitting(true);
      setSubmitError("");

      try {
        const token =
          (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";

        // 1. Створити команду через бекенд (не напряму в Supabase)
        const teamRes = await fetch(`${API_URL}/api/teams`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${token}`,
          },
          body: JSON.stringify({
            name:            teamName.trim(),
            city_school_org: organization.trim() || null,
            telegram_url:    telegramLink.trim() || null,
            discord_url:     discordLink.trim()  || null,
          }),
        });

        if (!teamRes.ok) {
          const errData = await teamRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Помилка ${teamRes.status}`);
        }

        const teamData = await teamRes.json();
        const teamId = teamData.team?.id;

        if (!teamId) throw new Error("Не вдалося отримати ID команди");

        // 2. Надіслати запрошення всім обраним учасникам через бекенд
        if (members.length > 0) {
          const inviteResults = await Promise.allSettled(
            members.map(m =>
              fetch(`${API_URL}/api/invitations/send`, {
                method:  "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization:  `Bearer ${token}`,
                },
                body: JSON.stringify({ team_id: teamId, invitee_id: m.id }),
              })
            )
          );

          const failed = inviteResults.filter(r => r.status === "rejected").length;
          if (failed > 0) {
            console.warn(`${failed} invitations failed to send`);
          }
        }

        clearDraft();
        setSubmitted(true);
        setTimeout(() => router.push("/teams"), 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Невідома помилка";
        setSubmitError(`Помилка збереження: ${msg}`);
      } finally {
        setSubmitting(false);
      }
    };

    if (isLoading || !user) {
      return (
        <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    return (
      <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
      <style jsx global>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes cardDrop { from{opacity:0;transform:translateY(-16px) scale(.98)} to{opacity:1;transform:none} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        @keyframes successPop {
          0%   { transform:scale(.82); opacity:0 }
          60%  { transform:scale(1.06) }
          100% { transform:scale(1);  opacity:1 }
        }
        .fuIn        { animation: fadeUp   340ms cubic-bezier(.22,1,.36,1) both }
        .cdIn        { animation: cardDrop 400ms cubic-bezier(.22,1,.36,1) both }
        .fadeIn      { animation: fadeIn   200ms ease both }
        .success-pop { animation: successPop 480ms cubic-bezier(.22,1,.36,1) both }

        .dropdown-scroll { scrollbar-width: thin; scrollbar-color: var(--brd) transparent; }
        .dropdown-scroll::-webkit-scrollbar { width: 4px; }
        .dropdown-scroll::-webkit-scrollbar-thumb { background: var(--brd); border-radius: 4px; }
        `}</style>

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
        <MobileHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} title="Нова команда" icon={<Users size={18} className="text-blue-600" />} />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">

        <nav className="flex items-center gap-2 text-[10px] font-black mb-6 uppercase tracking-widest text-(--t2)">
        <button data-href="/" onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
        <ChevronRight size={10} />
        <button data-href="/teams" onClick={() => router.push("/teams")} className="hover:text-blue-600 transition-colors">Команди</button>
        <ChevronRight size={10} />
        <span className="text-(--t1)">Реєстрація</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-(--t1) uppercase mb-8">
        🏅 Реєстрація команди
        </h1>

        {/* Success */}
        {submitted && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-(--bg)/80 backdrop-blur-md">
          <div className="success-pop bg-(--card) border border-green-500/30 rounded-3xl p-10 text-center shadow-2xl max-w-sm mx-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-green-500" />
          </div>
          <p className="text-xl font-black text-(--t1) uppercase tracking-tight mb-1">Команду створено!</p>
          {members.length > 0 && (
            <p className="text-sm text-blue-500 font-bold mt-2">
            📨 Запрошення надіслано {members.length} учасник{members.length === 1 ? "у" : "ам"}
            </p>
          )}
          <p className="text-sm text-(--t2) font-bold mt-1">Перенаправляємо на список команд...</p>
          </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">

        {/* 1. Загальна інформація */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-xl">
        <SectionHeader num="1" title="Загальна інформація" />
        <div className="p-6 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">
        Назва команди <span className="text-red-500">*</span>
        </label>
        <input type="text" placeholder="Team Alpha..." value={teamName} onChange={e => setTeamName(e.target.value)} required
        className="w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none text-sm transition-all" />
        </div>
        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">Організація</label>
        <input type="text" placeholder="КПІ, Polytechnic..." value={organization} onChange={e => setOrganization(e.target.value)}
        className="w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none text-sm transition-all" />
        </div>
        </div>

        <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1 flex items-center gap-1.5">
        <Mail size={11} /> Контактний email
        </label>
        <input type="email" placeholder="team@example.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-2xl border border-(--brd) bg-(--bg) text-(--t1) focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-(--card) outline-none text-sm transition-all" />
        </div>

        <div className="space-y-3">
        <p className="text-[10px] font-black text-(--t2) uppercase tracking-[0.15em] ml-1">
        Соціальні мережі <span className="opacity-50">(необов'язково)</span>
        </p>
        <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setShowDiscord(p => !p)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${showDiscord ? "bg-indigo-600/10 border-indigo-600/40 text-indigo-500" : "bg-(--bg) border-(--brd) text-(--t2) hover:border-indigo-600/30 hover:text-indigo-400"}`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        Discord {showDiscord ? <X size={11} /> : <Plus size={11} />}
        </button>
        <button type="button" onClick={() => setShowTelegram(p => !p)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${showTelegram ? "bg-sky-600/10 border-sky-600/40 text-sky-500" : "bg-(--bg) border-(--brd) text-(--t2) hover:border-sky-600/30 hover:text-sky-400"}`}>
        <Send size={13} />
        Telegram {showTelegram ? <X size={11} /> : <Plus size={11} />}
        </button>
        </div>

        {showDiscord && (
          <div className="fadeIn flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.15em] ml-1">Посилання на Discord сервер</label>
          <input
          type="text"
          placeholder="https://discord.gg/..."
          value={discordLink}
          onChange={e => { setDiscordLink(e.target.value); setDiscordError(validateDiscord(e.target.value)); }}
          onBlur={e => setDiscordError(validateDiscord(e.target.value))}
          className={`w-full px-4 py-3 rounded-2xl border bg-(--bg) text-(--t1) focus:ring-2 focus:bg-(--card) outline-none text-sm transition-all ${discordError ? "border-red-500/60 focus:ring-red-500/20 focus:border-red-500" : "border-indigo-600/30 focus:ring-indigo-500/20 focus:border-indigo-600"}`}
          />
          {discordError && (
            <p className="text-[10px] font-bold text-red-500 ml-1 flex items-center gap-1">
            <AlertCircle size={10} /> {discordError}
            </p>
          )}
          </div>
        )}
        {showTelegram && (
          <div className="fadeIn flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-sky-400 uppercase tracking-[0.15em] ml-1">Посилання на Telegram канал/чат</label>
          <input
          type="text"
          placeholder="https://t.me/..."
          value={telegramLink}
          onChange={e => { setTelegramLink(e.target.value); setTelegramError(validateTelegram(e.target.value)); }}
          onBlur={e => setTelegramError(validateTelegram(e.target.value))}
          className={`w-full px-4 py-3 rounded-2xl border bg-(--bg) text-(--t1) focus:ring-2 focus:bg-(--card) outline-none text-sm transition-all ${telegramError ? "border-red-500/60 focus:ring-red-500/20 focus:border-red-500" : "border-sky-600/30 focus:ring-sky-500/20 focus:border-sky-600"}`}
          />
          {telegramError && (
            <p className="text-[10px] font-bold text-red-500 ml-1 flex items-center gap-1">
            <AlertCircle size={10} /> {telegramError}
            </p>
          )}
          </div>
        )}
        </div>
        </div>
        </section>

        {/* 2. Капітан */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-xl overflow-visible" style={{ animationDelay: "70ms" }}>
        <SectionHeader num="2" title="Капітан" right={<Crown size={15} className="text-amber-500" />} />
        <div className="p-6 sm:p-8 overflow-visible">
        <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest mb-4">
        За замовчуванням — ваш акаунт. Можна змінити через пошук.
        </p>
        <UserSearchDropdown
        label="Капітан команди *"
        placeholder="Пошук за логіном або ім'ям..."
        selected={captain}
        onSelect={setCaptain}
        onClear={() => setCaptain(null)}
        excludeIds={members.map(m => m.id)}
        maxVisible={3}
        />
        </div>
        </section>

        {/* 3. Учасники */}
        <section className="cdIn bg-(--card) rounded-2xl sm:rounded-[2.5rem] border border-(--brd) shadow-xl overflow-visible" style={{ animationDelay: "140ms" }}>
        <SectionHeader
        num="3"
        title="Учасники"
        right={
          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${members.length >= 10 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-(--bg) text-(--t2) border-(--brd)"}`}>
          {members.length} / 10
          </span>
        }
        />
        <div className="p-6 sm:p-8 space-y-4 overflow-visible">
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2">
          {members.map(m => <MemberChip key={m.id} user={m} onRemove={() => removeMember(m.id)} />)}
          </div>
        )}

        {members.length < 10 ? (
          <UserSearchDropdown
          label="Додати учасника"
          placeholder="Пошук за логіном або ім'ям..."
          selected={null}
          onSelect={addMember}
          onClear={() => {}}
          excludeIds={excludedFromMembers}
          maxVisible={3}
          />
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-red-500 bg-red-500/5 border border-red-500/20 rounded-2xl px-4 py-3">
          <AlertCircle size={14} /> Максимум 10 учасників досягнуто
          </div>
        )}

        {members.length === 0 && (
          <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest opacity-60">
          Команда може бути без учасників — додайте їх пізніше
          </p>
        )}
        {members.length > 0 && (
          <p className="text-[10px] font-bold text-blue-500/70 uppercase tracking-widest flex items-center gap-1">
          📨 Запрошення буде надіслано — учасники потраплять до команди після підтвердження
          </p>
        )}
        </div>
        </section>

        {/* Кнопки */}
        <div className="fuIn flex flex-col sm:flex-row gap-3 pt-2" style={{ animationDelay: "200ms" }}>
        <button
        type="submit"
        disabled={!teamName.trim() || !captain || submitting || !!discordError || !!telegramError}
        className={`flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex-1 sm:flex-none ${!teamName.trim() || !captain || submitting || !!discordError || !!telegramError ? "bg-(--brd) text-(--t2) cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25"}`}
        >
        {submitting ? <><Loader size={14} className="animate-spin" /> Створення...</> : <><Users size={14} /> Створити команду</>}
        </button>
        <button type="button" data-href="/teams" onClick={() => router.push("/teams")}
        className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-(--brd) bg-(--bg) text-(--t2) hover:bg-(--card) hover:text-(--t1) transition-all active:scale-95">
        Скасувати
        </button>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 text-[11px] font-bold text-red-500 bg-red-500/5 border border-red-500/20 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="flex-shrink-0" /> {submitError}
          </div>
        )}

        </form>
        </div>
        </main>
        </div>
    );
}