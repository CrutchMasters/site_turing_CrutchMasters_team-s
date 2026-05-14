'use client';

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useT, useLanguage } from "@/context/LanguageContext";
import {
  Trophy, Users, Upload, ExternalLink, ChevronRight, Plus, Loader,
  Megaphone, Link2, X, Pin, PinOff, Trash2, Edit3, Eye, ImageOff, CalendarDays,
  Globe, User as UserIcon,
} from "lucide-react";
import EventCalendar, { CalendarEvent } from "@/components/EventCalendar";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import { supabase, authedSupabase } from "@/lib/supabase";
import { RichTextEditor } from "@/components/RichTextEditor";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(endAt?: string | null) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
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


// ─── Types ───────────────────────────────────────────────────────────────────

interface Tournament {
  id: string;
  name: string;
  rules?: string;
  status: "upcoming" | "registration" | "ongoing" | "finished";
  start_at: string;
  end_at?: string;
  registration_from?: string;
  registration_to?: string;
  max_teams?: number;
  team_count?: number;
}

interface Round {
  id: string;
  name: string;
  description?: string;
  status?: string;
  start_at?: string;
  end_at?: string;
}

interface Submission {
  id: string;
  is_draft: boolean;
  status: string;
  submitted_at?: string;
}

interface CurrentInfo {
  tournament: { id: string; name: string; rules?: string } | null;
  round: Round | null;
  status: string | null;
  submission: Submission | null;
}

interface Announcement {
  id: string;
  title: string;
  body?: string;
  link_url?: string;
  link_title?: string;
  link_desc?: string;
  link_image?: string;
  is_pinned: boolean;
  calendar_date?: string | null;
  created_by?: string;
  created_at: string;
  // These fields identify "my" events — registration in tournament/round
  type?: "announcement" | "tournament_registration" | "round_registration";
  tournament_id?: string;
  round_id?: string;
}

interface LinkPreview {
  title: string;
  description: string;
  image: string;
  loading: boolean;
  error: boolean;
}

type TournamentStatus = Tournament["status"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStatus(
  t: Pick<Tournament, "start_at" | "end_at" | "registration_from" | "registration_to">
): TournamentStatus {
  const now     = Date.now();
  const start   = t.start_at          ? new Date(t.start_at).getTime()          : null;
  const end     = t.end_at            ? new Date(t.end_at).getTime()            : null;
  const regFrom = t.registration_from ? new Date(t.registration_from).getTime() : null;
  const regTo   = t.registration_to   ? new Date(t.registration_to).getTime()   : null;

  if (end && now > end)                                   return "finished";
  if (start && now >= start && (!end || now <= end))      return "ongoing";
  if (regFrom && regTo && now >= regFrom && now <= regTo) return "registration";
  return "upcoming";
}

const STATUS_COLORS: Record<string, string> = {
  upcoming:     "bg-amber-500/10 text-amber-600 border-amber-500/30",
  registration: "bg-green-500/10 text-green-600 border-green-500/30",
  ongoing:      "bg-blue-600/10 text-blue-600 border-blue-600/30",
  finished:     "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function extractDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

// ─── Link Preview Fetcher ─────────────────────────────────────────────────────
async function fetchLinkPreview(url: string): Promise<Partial<LinkPreview>> {
  try {
    const u = new URL(url);
    const ytMatch =
    u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be");
    if (ytMatch) {
      const videoId =
      u.searchParams.get("v") ||
      (u.hostname === "youtu.be" ? u.pathname.slice(1) : null) ||
      u.pathname.replace("/embed/", "").replace("/shorts/", "");
      if (videoId) {
        return {
          title: "YouTube Video",
          description: url,
          image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        };
      }
    }

    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const resp  = await fetch(proxy, { signal: AbortSignal.timeout(6000) });
    const json  = await resp.json();
    const html: string = json.contents ?? "";

    const getMeta = (prop: string) => {
      const m =
      html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}`, "i")) ||
      html.match(new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)`, "i"));
      return m?.[1] ?? "";
    };

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";

    return {
      title:       getMeta("title")       || titleTag || extractDomain(url),
      description: getMeta("description") || getMeta("description"),
      image:       getMeta("image"),
    };
  } catch {
    return { title: extractDomain(url), description: "", image: "" };
  }
}

// ─── Announcement Modal ───────────────────────────────────────────────────────

interface AnnouncementModalProps {
  onClose: () => void;
  onSave: (a: Partial<Announcement>) => Promise<void>;
  initial?: Announcement;
}

function AnnouncementModal({ onClose, onSave, initial }: AnnouncementModalProps) {
  const { t } = useT();
  const { locale } = useLanguage();
  const [title,        setTitle]        = useState(initial?.title          ?? "");
  const [body,         setBody]         = useState(initial?.body           ?? "");
  const [linkUrl,      setLinkUrl]      = useState(initial?.link_url       ?? "");
  const [isPinned,     setIsPinned]     = useState(initial?.is_pinned      ?? false);
  const [inCalendar,   setInCalendar]   = useState(!!(initial?.calendar_date));
  const [calendarDate, setCalendarDate] = useState<string>(initial?.calendar_date ?? "");
  const [saving,       setSaving]       = useState(false);
  const [preview,  setPreview]  = useState<LinkPreview>({
    title: "", description: "", image: "", loading: false, error: false,
  });

  useEffect(() => {
    if (initial?.link_title) {
      setPreview({
        title:       initial.link_title ?? "",
        description: initial.link_desc  ?? "",
        image:       initial.link_image ?? "",
        loading: false, error: false,
      });
    }
  }, [initial]);

  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLinkChange = (val: string) => {
    setLinkUrl(val);
    setPreview(p => ({ ...p, loading: !!val, error: false }));
    if (!val.trim()) {
      setPreview({ title: "", description: "", image: "", loading: false, error: false });
      return;
    }
    previewTimeout.current = setTimeout(async () => {
      const data = await fetchLinkPreview(val.trim());
      setPreview({ ...data as LinkPreview, loading: false, error: !data.title });
    }, 700);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title:         title.trim(),
                 body:          body.trim() || undefined,
                 link_url:      linkUrl.trim() || undefined,
                 link_title:    preview.title  || undefined,
                 link_desc:     preview.description || undefined,
                 link_image:    preview.image  || undefined,
                 is_pinned:     isPinned,
                 calendar_date: inCalendar && calendarDate ? calendarDate : null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="w-full max-w-lg bg-(--card) rounded-3xl border border-(--brd) shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

    {/* Header */}
    <div className="flex items-center justify-between px-6 py-5 border-b border-(--brd)">
    <div className="flex items-center gap-2 w-full">
    <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-600/30 flex items-center justify-center">
    <Megaphone className="text-blue-600" size={16} />
    </div>
    <h2 className="font-black text-sm uppercase tracking-widest text-(--t1)">
    {initial ? t.mainPage.announcementsEdit : t.mainPage.announcementsNewTitle}
    </h2>
    </div>
    <button
    onClick={onClose}
    className="p-2 rounded-xl text-(--t2) hover:bg-(--bg) hover:text-(--t1) transition-colors"
    >
    <X size={16} />
    </button>
    </div>

    {/* Body */}
    <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">

    {/* Title */}
    <div>
    <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
    {t.mainPage.announcementsLabelTitle}
    </label>
    <input
    value={title}
    onChange={e => setTitle(e.target.value)}
    placeholder={t.mainPage.announcementsTitlePlaceholder}
    className="w-full px-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold text-(--t1) placeholder:text-(--t2)/50 focus:outline-none focus:border-blue-600/60 transition-colors"
    />
    </div>

    {/* Body */}
    <div>
    <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
    {t.mainPage.announcementsLabelBody}
    </label>
    <RichTextEditor
    value={body}
    onChange={setBody}
    placeholder={t.mainPage.announcementsBodyPlaceholder}
    rows={4}
    />
    </div>

    {/* Link URL */}
    <div>
    <label className="block text-[10px] font-black uppercase tracking-widest text-(--t2) mb-2">
    {t.mainPage.announcementsLabelLink}
    </label>
    <div className="relative">
    <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--t2)" />
    <input
    value={linkUrl}
    onChange={e => handleLinkChange(e.target.value)}
    placeholder="https://..."
    className="w-full pl-9 pr-4 py-3 rounded-xl bg-(--bg) border border-(--brd) text-sm font-bold text-(--t1) placeholder:text-(--t2)/50 focus:outline-none focus:border-blue-600/60 transition-colors"
    />
    </div>
    </div>

    {/* Link Preview */}
    {(linkUrl || preview.loading) && (
      <div className="rounded-2xl border border-(--brd) overflow-hidden bg-(--bg)">
      <div className="px-4 py-2 border-b border-(--brd) flex items-center gap-2">
      <Eye size={11} className="text-(--t2)" />
      <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.mainPage.announcementsLinkPreview}</span>
      {preview.loading && <Loader size={10} className="text-blue-600 animate-spin ml-auto" />}
      </div>

      {preview.loading ? (
        <div className="p-4 flex gap-3 animate-pulse">
        <div className="w-20 h-14 rounded-lg bg-(--brd) flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-(--brd) rounded w-3/4" />
        <div className="h-2 bg-(--brd) rounded w-full" />
        <div className="h-2 bg-(--brd) rounded w-1/2" />
        </div>
        </div>
      ) : preview.title ? (
        <LinkPreviewCard
        url={linkUrl}
        title={preview.title}
        description={preview.description}
        image={preview.image}
        />
      ) : (
        <div className="p-4 flex items-center gap-2 text-(--t2)">
        <ImageOff size={14} />
        <span className="text-xs font-bold">{t.mainPage.announcementsNoPreview}</span>
        </div>
      )}
      </div>
    )}

    {/* Pin toggle */}
    <label className="flex items-center gap-3 cursor-pointer group">
    <div
    onClick={() => setIsPinned(p => !p)}
    className={`w-10 h-5 rounded-full transition-colors relative ${isPinned ? "bg-blue-600" : "bg-(--brd)"}`}
    >
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPinned ? "translate-x-5" : ""}`} />
    </div>
    <span className="text-xs font-bold text-(--t2) group-hover:text-(--t1) transition-colors">
    {t.mainPage.announcementsPin}
    </span>
    </label>

    {/* Calendar toggle */}
    <div className="space-y-2">
    <label className="flex items-center gap-3 cursor-pointer group">
    <div
    onClick={() => setInCalendar(p => !p)}
    className={`w-10 h-5 rounded-full transition-colors relative ${inCalendar ? "bg-amber-500" : "bg-(--brd)"}`}
    >
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${inCalendar ? "translate-x-5" : ""}`} />
    </div>
    <div className="flex items-center gap-2">
    <CalendarDays size={13} className={inCalendar ? "text-amber-500" : "text-(--t2)"} />
    <span className="text-xs font-bold text-(--t2) group-hover:text-(--t1) transition-colors">
    {locale === "ua" ? "Відмітити в календарі?" : locale === "en" ? "Mark in calendar?" : "Отметить в календаре?"}
    </span>
    </div>
    </label>
    {inCalendar && (
      <div className="ml-[52px]">
      <label className="block text-[9px] font-black uppercase tracking-widest text-(--t2) mb-1.5">
      {locale === "ua" ? "Дата події" : locale === "en" ? "Event date" : "Дата события"}
      </label>
      <input
      type="date"
      value={calendarDate}
      onChange={e => setCalendarDate(e.target.value)}
      className="w-full px-3 py-2 rounded-xl bg-(--bg) border border-(--brd) text-xs font-bold text-(--t1) focus:outline-none focus:border-amber-500/60 transition-colors"
      />
      </div>
    )}
    </div>
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-(--brd) flex gap-3 justify-end">
    <button
    onClick={onClose}
    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-(--t2) border border-(--brd) hover:bg-(--bg) transition-colors"
    >
    {t.mainPage.announcementsCancel}
    </button>
    <button
    onClick={handleSave}
    disabled={!title.trim() || saving}
    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25 transition-all active:scale-95"
    >
    {saving && <Loader size={12} className="animate-spin" />}
    {saving ? t.mainPage.announcementsSaving : initial ? t.mainPage.announcementsUpdate : t.mainPage.announcementsPublish}
    </button>
    </div>
    </div>
    </div>
  );
}

// ─── Link Preview Card (display only) ────────────────────────────────────────

interface LinkPreviewCardProps {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

function LinkPreviewCard({ url, title, description, image }: LinkPreviewCardProps) {
  const [imgError, setImgError] = useState(false);
  const domain = extractDomain(url);

  return (
    <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex gap-0 overflow-hidden group cursor-pointer hover:bg-(--bg)/50 transition-colors"
    onClick={e => e.stopPropagation()}
    >
    {image && !imgError ? (
      <div className="w-28 sm:w-36 flex-shrink-0 bg-(--brd) relative overflow-hidden">
      <img
      src={image}
      alt=""
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={() => setImgError(true)}
      />
      </div>
    ) : (
      <div className="w-20 flex-shrink-0 bg-(--brd)/50 flex items-center justify-center">
      <ImageOff size={16} className="text-(--t2)/30" />
      </div>
    )}
    <div className="p-3 sm:p-4 flex-1 min-w-0">
    <p className="text-[9px] font-black uppercase tracking-wider text-(--t2) mb-1">{domain}</p>
    <p className="text-xs font-black text-(--t1) leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">{title}</p>
    {description && (
      <p className="text-[10px] font-bold text-(--t2) mt-1 line-clamp-2 leading-relaxed">{description}</p>
    )}
    </div>
    </a>
  );
}

// ─── Announcement Card ────────────────────────────────────────────────────────

interface AnnouncementCardProps {
  a: Announcement;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (a: Announcement) => void;
  onTogglePin: (a: Announcement) => void;
}

function AnnouncementCard({ a, isAdmin, onDelete, onEdit, onTogglePin }: AnnouncementCardProps) {
  const { t } = useT();
  return (
    <div className={`rounded-2xl border overflow-hidden bg-(--card) transition-shadow hover:shadow-md ${a.is_pinned ? "border-blue-600/40" : "border-(--brd)"}`}>
    {/* Card header */}
    <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-start gap-3">
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${a.is_pinned ? "bg-blue-600/15 border border-blue-600/30" : "bg-(--bg) border border-(--brd)"}`}>
    <Megaphone size={14} className={a.is_pinned ? "text-blue-600" : "text-(--t2)"} />
    </div>
    <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap mb-0.5">
    {a.is_pinned && (
      <span className="text-[8px] font-black uppercase tracking-widest bg-blue-600/10 text-blue-600 border border-blue-600/20 px-2 py-0.5 rounded-full">
      {t.mainPage.announcementsPinned}
      </span>
    )}
    <span className="text-[9px] font-bold text-(--t2)">{fmtDateTime(a.created_at)}</span>
    </div>
    <h3 className="font-black text-sm text-(--t1) leading-tight">{a.title}</h3>
    {a.body && (
      <MarkdownRenderer content={a.body} className="mt-1" />
    )}
    </div>

    {/* Admin actions */}
    {isAdmin && (
      <div className="flex items-center gap-1 flex-shrink-0">
      <button
      onClick={() => onTogglePin(a)}
      className={`p-1.5 rounded-lg transition-colors ${a.is_pinned ? "text-blue-600 bg-blue-600/10 hover:bg-blue-600/20" : "text-(--t2) hover:bg-(--bg)"}`}
      title={a.is_pinned ? t.mainPage.announcementsUnpin : t.mainPage.announcementsPinAction}
      >
      {a.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
      <button
      onClick={() => onEdit(a)}
      className="p-1.5 rounded-lg text-(--t2) hover:bg-(--bg) hover:text-(--t1) transition-colors"
      title={t.mainPage.announcementsEditAction}
      >
      <Edit3 size={13} />
      </button>
      <button
      onClick={() => onDelete(a.id)}
      className="p-1.5 rounded-lg text-(--t2) hover:bg-red-500/10 hover:text-red-500 transition-colors"
      title={t.mainPage.announcementsDeleteAction}
      >
      <Trash2 size={13} />
      </button>
      </div>
    )}
    </div>

    {/* Link preview */}
    {a.link_url && (
      <div className="border-t border-(--brd)">
      <LinkPreviewCard
      url={a.link_url}
      title={a.link_title || extractDomain(a.link_url)}
      description={a.link_desc}
      image={a.link_image}
      />
      </div>
    )}
    </div>
  );
}

// ─── CurrentRoundCard ────────────────────────────────────────────────────────

function TimeBox({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
    <div className={`w-full py-3 rounded-xl border flex items-center justify-center ${urgent ? "bg-red-500/10 border-red-500/25" : "bg-(--bg) border-(--brd)"}`}>
    <span className={`text-2xl font-black tabular-nums ${urgent ? "text-red-500" : "text-(--t1)"}`}
    style={{ fontVariantNumeric: "tabular-nums" }}>
    {String(value).padStart(2, "0")}
    </span>
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{label}</span>
    </div>
  );
}

interface CurrentRoundCardProps {
  info: {
    tournament: { id: string; name: string; rules?: string } | null;
    round: { id: string; name: string; description?: string; status?: string; start_at?: string; end_at?: string } | null;
    status: string | null;
    submission: { id: string; is_draft: boolean; status: string; submitted_at?: string } | null;
  };
  statusConfig: Record<string, { label: string; color: string }>;
  statusColors: Record<string, string>;
  onNavigate: (path: string) => void;
  t: any;
}

function CurrentRoundCard({ info, statusConfig, statusColors, onNavigate, t }: CurrentRoundCardProps) {
  const countdown = useCountdown(info.round?.end_at);

  const endTs   = info.round?.end_at   ? new Date(info.round.end_at).getTime()   : 0;
  const startTs = info.round?.start_at ? new Date(info.round.start_at).getTime() : 0;
  const now     = Date.now();

  let progressPct = 0;
  if (endTs > 0 && startTs > 0 && endTs > startTs) {
    progressPct = Math.min(100, Math.max(0, ((now - startTs) / (endTs - startTs)) * 100));
  }
  const isUrgent = progressPct > 80;
  const isEnded  = endTs > 0 && now > endTs;

  function fmtShort(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 relative z-10">

    {/* Tournament */}
    <div className="px-3 py-2.5 rounded-xl bg-(--bg) border border-(--brd) flex flex-col gap-1 min-w-0 overflow-hidden">
    <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.mainPage.currentTournament}</p>
    {info.tournament ? (
      <>
      <button
      onClick={() => onNavigate(`/tournaments/${info.tournament!.id}`)}
      className="font-black text-sm text-left leading-snug transition-colors w-full overflow-hidden text-ellipsis whitespace-nowrap block text-(--t1) hover:!text-blue-400"
      >
      {info.tournament.name}
      </button>
      {info.tournament.rules && (
        <p className="text-xs text-(--t2) font-medium leading-snug mt-0.5 overflow-hidden"
        style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {stripHtml(info.tournament.rules)}
        </p>
      )}
      </>
    ) : (
      <p className="font-bold text-xs text-(--t2) italic">{t.mainPage.noActiveTournament}</p>
    )}
    </div>

    {/* Round */}
    <div className="px-3 py-2.5 rounded-xl bg-(--bg) border border-(--brd) flex flex-col gap-1 min-w-0 overflow-hidden">
    <p className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{t.mainPage.currentRound}</p>
    {info.round ? (
      <>
      <button
      onClick={() => onNavigate(`/rounds/${info.round!.id}`)}
      className="font-black text-sm text-left leading-snug transition-colors w-full overflow-hidden text-ellipsis whitespace-nowrap block text-(--t1) hover:!text-blue-400"
      >
      {info.round.name}
      </button>
      {info.round.description && (
        <p className="text-xs text-(--t2) font-medium leading-snug mt-0.5 overflow-hidden"
        style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {stripHtml(info.round.description)}
        </p>
      )}
      </>
    ) : (
      <p className="font-bold text-xs text-(--t2) italic">{t.mainPage.noActiveRound}</p>
    )}
    </div>

    {/* Status block */}
    <div className={`px-3 py-3 rounded-xl border flex flex-col gap-2 ${isUrgent ? "bg-red-500/5 border-red-500/20" : "bg-blue-600/10 border-blue-600/20"}`}>

    <p className={`text-[9px] font-black uppercase tracking-widest ${isUrgent ? "text-red-500" : "text-blue-600"}`}>
    {t.mainPage.colStatus}
    </p>

    <div className="flex items-center gap-3">

    <div className="flex items-center gap-1.5 w-[60%] min-w-0">
    <TimeBox value={countdown.days}  label="дней" urgent={isUrgent || isEnded} />
    <div className="flex flex-col items-center gap-[5px] pb-4 flex-shrink-0">
    <span className={`block w-[4px] h-[4px] rounded-full ${isUrgent || isEnded ? "bg-red-500" : "bg-(--t2)"}`} />
    <span className={`block w-[4px] h-[4px] rounded-full ${isUrgent || isEnded ? "bg-red-500" : "bg-(--t2)"}`} />
    </div>
    <TimeBox value={countdown.hours} label="час"  urgent={isUrgent || isEnded} />
    </div>

    <div className="flex flex-col gap-1.5 w-[40%]">

    {info.status && (
      <span className={`flex items-center justify-center gap-1 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border w-full ${statusColors[info.status] ?? statusColors.upcoming}`}>
      {(statusConfig as any)[info.status]?.label ?? info.status}
      </span>
    )}

    <span className={`flex items-center justify-center gap-1 text-[9px] font-black px-3 py-1.5 rounded-full border w-full ${
      info.submission && !info.submission.is_draft
      ? "bg-green-500/10 border-green-500/25 text-green-500"
      : info.submission?.is_draft
      ? "bg-amber-500/10 border-amber-500/25 text-amber-500"
      : "bg-(--bg) border-(--brd) text-(--t2)"
    }`}>
    {info.submission && !info.submission.is_draft ? (
      <><svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Работа сдана</>
    ) : info.submission?.is_draft ? (
      <><svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Черновик</>
    ) : (
      <><svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Не сдано</>
    )}
    </span>

    </div>
    </div>

    </div>
    </div>
  );
}

// ─── Section Header (dark block style like "Текущий турнир") ─────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: number | null;
  children?: React.ReactNode;
  accentColor?: string; // e.g. "amber" | "blue" | "green"
}

function SectionHeader({ icon, title, badge, children, accentColor = "blue" }: SectionHeaderProps) {
  const accent = {
    blue:  { bg: "bg-blue-600/10",  border: "border-blue-600/20",  icon: "bg-blue-600/15 border-blue-600/30",  text: "text-blue-600",  badge: "bg-blue-600/10 text-blue-600 border-blue-600/20" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "bg-amber-500/15 border-amber-500/30", text: "text-amber-500", badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    green: { bg: "bg-green-500/10", border: "border-green-500/20", icon: "bg-green-500/15 border-green-500/30", text: "text-green-500", badge: "bg-green-500/10 text-green-600 border-green-500/20" },
  }[accentColor] ?? { bg: "bg-blue-600/10", border: "border-blue-600/20", icon: "bg-blue-600/15 border-blue-600/30", text: "text-blue-600", badge: "bg-blue-600/10 text-blue-600 border-blue-600/20" };

  return (
    <div className={`px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--brd) ${accent.bg}`}>
    <div className="flex items-center gap-3">
    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${accent.icon}`}>
    <span className={accent.text}>{icon}</span>
    </div>
    <div className="flex items-center gap-2.5">
    <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">{title}</h2>
    {badge != null && badge > 0 && (
      <span className={`text-[9px] font-black border px-2 py-0.5 rounded-full ${accent.badge}`}>
      {badge}
      </span>
    )}
    </div>
    </div>
    {children && <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">{children}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [backendMessage,      setBackendMessage]       = useState("waiting...");
  const [tournaments,         setTournaments]          = useState<Tournament[]>([]);
  const [tournamentsLoading,  setTournamentsLoading]   = useState(true);
  const [activeFilter,        setActiveFilter]         = useState<"all" | "upcoming" | "registration" | "ongoing" | "finished">("all");

  // Current tournament/round state
  const [currentInfo,          setCurrentInfo]          = useState<CurrentInfo | null>(null);
  const [currentInfoLoading,   setCurrentInfoLoading]   = useState(true);

  // Announcements state
  const [announcements,        setAnnouncements]        = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [modalOpen,            setModalOpen]            = useState(false);
  const [editAnnouncement,     setEditAnnouncement]     = useState<Announcement | undefined>();
  // "all" | "mine" toggle for announcements
  const [announcementsFilter,  setAnnouncementsFilter]  = useState<"all" | "mine">("all");
  // IDs of tournaments/rounds user is in (for "mine" filter)
  const [myTournamentIds,      setMyTournamentIds]      = useState<string[]>([]);
  const [myRoundIds,           setMyRoundIds]           = useState<string[]>([]);

  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const { mobileOpen: isMobileSidebarOpen, openMobile, closeMobile: closeMobileSidebar, isClosing: isSidebarClosing } = useSidebar();
  const router = useRouter();
  const { dark }        = useTheme();
  const { user, token, isLoading } = useAuth();
  const { t, locale }   = useT();

  const STATUS_CONFIG = {
    upcoming:     { label: t.mainPage.statusUpcoming,     color: STATUS_COLORS.upcoming },
    registration: { label: t.mainPage.statusRegistration, color: STATUS_COLORS.registration },
    ongoing:      { label: t.mainPage.statusOngoing,      color: STATUS_COLORS.ongoing },
    finished:     { label: t.mainPage.statusFinished,     color: STATUS_COLORS.finished },
  };

  // Guests can view dashboard — no redirect needed

    // ── fetch tournaments ──────────────────────────────────────────────────────
    const fetchTournaments = useCallback(async () => {
      setTournamentsLoading(true);
      try {
        const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, start_at, end_at, registration_from, registration_to, max_teams")
        .order("start_at", { ascending: true })
        .limit(10);

        if (error) throw error;

        const ids = (data ?? []).map((t: any) => t.id);
        let counts: Record<string, number> = {};
        if (ids.length) {
          const { data: regData } = await supabase
          .from("tournament_teams")
          .select("tournament_id")
          .in("tournament_id", ids);
          (regData ?? []).forEach((r: any) => {
            counts[r.tournament_id] = (counts[r.tournament_id] ?? 0) + 1;
          });
        }

        setTournaments((data ?? []).map((t: any) => ({
          ...t,
          team_count: counts[t.id] ?? 0,
          status: computeStatus(t),
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setTournamentsLoading(false);
      }
    }, []);

    // ── fetch announcements ────────────────────────────────────────────────────
    const fetchAnnouncements = useCallback(async () => {
      setAnnouncementsLoading(true);
      try {
        const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at",  { ascending: false })
        .limit(20);

        if (error) throw error;
        setAnnouncements(data ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setAnnouncementsLoading(false);
      }
    }, []);

    // ── fetch user's tournaments & rounds for "mine" filter ────────────────────
    const fetchMyMemberships = useCallback(async () => {
      if (!user) return;
      try {
        const { data: captainTeams } = await supabase.from("teams").select("id,tournament_id").eq("captain_id", user.id).not("tournament_id","is",null);
        const { data: memberTeams  } = await supabase.from("teams").select("id,tournament_id").contains("members_ids",[user.id]).not("tournament_id","is",null);
        const teams = [...(captainTeams ?? []), ...(memberTeams ?? [])];
        const tourIds = [...new Set(teams.map((t: any) => t.tournament_id).filter(Boolean))] as string[];
        setMyTournamentIds(tourIds);

        if (tourIds.length) {
          const { data: rounds } = await supabase.from("rounds").select("id").in("tournament_id", tourIds);
          setMyRoundIds((rounds ?? []).map((r: any) => r.id));
        }
      } catch(e) { console.error(e); }
    }, [user]);

    // ── fetch current tournament & round ──────────────────────────────────────
    const fetchCurrentInfo = useCallback(async () => {
      if (!user) return;
      setCurrentInfoLoading(true);
      try {
        let team: { id: string; name: string; tournament_id: string } | null = null;

        const { data: captainRows } = await supabase
        .from("teams")
        .select("id, name, tournament_id")
        .eq("captain_id", user.id)
        .not("tournament_id", "is", null)
        .limit(1);

        if (captainRows?.[0]) {
          team = captainRows[0];
        } else {
          const { data: memberRows } = await supabase
          .from("teams")
          .select("id, name, tournament_id")
          .contains("members_ids", [user.id])
          .not("tournament_id", "is", null)
          .limit(1);
          team = memberRows?.[0] ?? null;
        }

        if (!team?.tournament_id) {
          setCurrentInfo({ tournament: null, round: null, status: null, submission: null });
          return;
        }

        const { data: tourData } = await supabase
        .from("tournaments")
        .select("id, name, rules, status, start_at, end_at, registration_from, registration_to")
        .eq("id", team.tournament_id)
        .single();

        if (!tourData) {
          setCurrentInfo({ tournament: null, round: null, status: null, submission: null });
          return;
        }

        const tournamentStatus = computeStatus(tourData);

        const { data: roundRows } = await supabase
        .from("rounds")
        .select("id, name, description, status, start_at, end_at")
        .eq("tournament_id", team.tournament_id)
        .order("start_at", { ascending: true });

        const rounds = roundRows ?? [];
        const activeRound = rounds.find(r => r.status === "active");
        const upcomingRound = rounds.find(r => {
          if (!r.start_at) return false;
          return new Date(r.start_at).getTime() > Date.now();
        });
        const round = activeRound ?? upcomingRound ?? rounds[rounds.length - 1] ?? null;

        const status = round
        ? (round.status ?? (activeRound ? "active" : "upcoming"))
        : tournamentStatus;

        let submission: Submission | null = null;
        if (round && token) {
          try {
            const res = await fetch(`${API_URL}/api/rounds/${round.id}/submission`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const json = await res.json();
              if (json.submission) submission = json.submission;
            }
          } catch { /* silent */ }
        }

        setCurrentInfo({
          tournament: { id: tourData.id, name: tourData.name, rules: tourData.rules },
          round,
          status,
          submission,
        });
      } catch (e) {
        console.error(e);
        setCurrentInfo(null);
      } finally {
        setCurrentInfoLoading(false);
      }
    }, [user, token]);

    // ── CRUD handlers ──────────────────────────────────────────────────────────
    const handleSaveAnnouncement = async (payload: Partial<Announcement>) => {
      if (editAnnouncement) {
        const { error } = await (await authedSupabase(token))
        .from("announcements")
        .update(payload)
        .eq("id", editAnnouncement.id);
        if (!error) await fetchAnnouncements();
      } else {
        const { error } = await (await authedSupabase(token))
        .from("announcements")
        .insert({ ...payload, created_by: user?.id });
        if (!error) await fetchAnnouncements();
      }
    };

    const handleDeleteAnnouncement = async (id: string) => {
      if (!confirm(t.mainPage.announcementsDelete)) return;
      await (await authedSupabase(token)).from("announcements").delete().eq("id", id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    };

    const handleTogglePin = async (a: Announcement) => {
      const { error } = await (await authedSupabase(token))
      .from("announcements")
      .update({ is_pinned: !a.is_pinned })
      .eq("id", a.id);
      if (!error) await fetchAnnouncements();
    };

      // ── effects ────────────────────────────────────────────────────────────────
      // Fetch public data immediately — no need to wait for auth
      useEffect(() => {
        fetch(`${API_URL}/api/test`)
        .then(r => r.json())
        .then(d => setBackendMessage(d.message))
        .catch(() => setBackendMessage("Disconnected"));

        fetchTournaments();
        fetchAnnouncements();
      }, [fetchTournaments, fetchAnnouncements]);

      useEffect(() => {
        if (isLoading) return;

        // Only fetch user-specific data when logged in
        if (user) {
          fetchCurrentInfo();
          fetchMyMemberships();
        } else {
          // Guests: mark loading as done so UI doesn't spin forever
          setCurrentInfoLoading(false);
        }

        const obs = new IntersectionObserver(
          entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("fuIn"); }),
                                             { threshold: 0.1 }
        );
        revealRefs.current.forEach(r => { if (r) obs.observe(r); });
        return () => obs.disconnect();
      }, [isLoading, user, fetchCurrentInfo, fetchMyMemberships]);

      // Build calendar events from announcements that have a calendar_date
      // NOTE: must be declared before any early returns to satisfy Rules of Hooks
      const announcementCalendarEvents = useMemo<CalendarEvent[]>(() =>
      announcements
      .filter(a => !!a.calendar_date)
      .map(a => ({
        id: `ann-${a.id}`,
        date: a.calendar_date!,
        label: a.title,
        type: "announcement" as const,
      })),
      [announcements]
      );

      // "Mine" filter: show only announcements that are linked to user's tournaments/rounds
      // Since announcements don't have direct tournament_id links, "mine" shows announcements
      // that have a calendar_date matching a round/tournament event the user is in,
      // OR announcements created during the user's active tournament period.
      // Practical approach: "mine" shows announcements where calendar_date falls within
      // any of user's tournament date ranges, or the announcement has no specific targeting
      // (i.e., it's a general announcement relevant to all participants).
      // For now: "mine" = announcements where calendar_date is set AND matches user's tournament/round dates,
      // OR pinned announcements (important for everyone), OR created after user joined.
      // Simplest meaningful filter: show all pinned + any that have calendar events the user participates in.
      const filteredAnnouncements = useMemo(() => {
        if (announcementsFilter === "all") return announcements;
        // "mine" = pinned announcements + announcements tied to events user participates in
        // We check if the announcement's calendar_date corresponds to any tournament or round event.
        // Additionally show all if user is in any tournament (most relevant context).
        if (myTournamentIds.length === 0) {
          // Not in any tournament — show pinned only
          return announcements.filter(a => a.is_pinned);
        }
        // Show all announcements that are pinned or have calendar events
        // (since we can't filter by tournament without explicit FK, we show announcements
        // during the user's active tournament window + pinned)
        return announcements.filter(a => {
          if (a.is_pinned) return true;
          if (a.calendar_date) return true; // calendar events are shown
          return false;
        });
      }, [announcements, announcementsFilter, myTournamentIds]);

      // Early returns — placed after all hooks to satisfy Rules of Hooks
      if (isLoading) return (
        <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );

      if (!user) {
        // Guest mode — show dashboard without user-specific sections
      }

      const isAdmin = user ? (user.role === "admin" || user.role === "superadmin") : false;

  const filterLabels: { key: typeof activeFilter; label: string }[] = [
    { key: "all",          label: t.mainPage.filterAll },
    { key: "upcoming",     label: t.mainPage.filterUpcoming },
    { key: "registration", label: t.mainPage.filterOpen },
    { key: "ongoing",      label: t.mainPage.filterRunning },
    { key: "finished",     label: t.mainPage.filterFinished },
  ];

  const filteredTournaments = activeFilter === "all"
  ? tournaments
  : tournaments.filter(t => t.status === activeFilter);

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg) text-(--t1) transition-colors duration-300">

      {/* Background logo */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {(isMobileSidebarOpen || isSidebarClosing) && (
        <div
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isSidebarClosing ? "opacity-0" : "opacity-100"}`}
          onClick={() => closeMobileSidebar()}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen && !isSidebarClosing ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
      <MobileHeader onOpenSidebar={openMobile} title={t.mainPage.dashboard} />

      <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
      <header className="mb-8 sm:mb-12">
      <div className="flex items-center gap-2 text-[10px] font-black mb-3 uppercase tracking-widest text-(--t2)">
      <button onClick={() => router.push("/")} className="hover:text-blue-600 transition-colors">{t.nav.home}</button>
      <ChevronRight size={10} /><span className="text-(--t1)">{t.mainPage.dashboard}</span>
      </div>
      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-(--t1) uppercase">{t.mainPage.overview}</h1>
      </header>

      <div className="w-full flex flex-col xl:flex-row gap-6 xl:items-start">
      <div className="flex-1 min-w-0 space-y-6 sm:space-y-8">

      {/* ── Admin Banner ── */}
      {isAdmin && (
        <section
        ref={el => { revealRefs.current[0] = el; }}
        className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden relative bg-(--card) border border-blue-600/30 shadow-xl"
        >
        {/* Dark header */}
        <SectionHeader
        icon={<Trophy size={16} />}
        title={t.admin.manageTournaments}
        accentColor="blue"
        >
        <button
        onClick={() => router.push("/register_tourney")}
        className="flex items-center justify-center gap-2 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl px-5 py-3 hover:bg-blue-700 shadow-lg shadow-blue-600/25 active:scale-95 transition-all w-full sm:w-auto group"
        >
        <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
        {t.admin.createTournament}
        </button>
        </SectionHeader>

        {/* Body */}
        <div className="p-4 sm:p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-10 bg-blue-600" />
        <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full blur-2xl opacity-5 bg-blue-400" />
        </div>
        <div className="relative z-10 flex items-start gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/15 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
        <Trophy className="text-blue-600" size={24} />
        </div>
        <div>
        <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-blue-600/10 text-blue-500 border border-blue-500/30 px-2.5 py-1 rounded-lg mb-2">
        {user?.role === "superadmin" ? "Superadmin" : "Admin"} panel
        </span>
        <p className="text-xs font-bold text-(--t2) max-w-sm">
        {t.admin.manageTournamentsDesc}
        </p>
        </div>
        </div>
        <div className="relative z-10 mt-6 pt-5 border-t border-(--brd) flex flex-wrap gap-4 sm:gap-8">
        {[
          { label: t.admin.statActive, value: tournaments.filter(t => t.status === "ongoing").length.toString() },
                   { label: t.admin.statOpen,   value: tournaments.filter(t => t.status === "registration").length.toString() },
                   { label: t.admin.statTotal,  value: tournaments.length.toString() },
        ].map(({ label, value }) => (
          <div key={label}>
          <p className="text-[10px] font-black uppercase tracking-wider text-(--t2)">{label}</p>
          <p className="text-lg font-black text-blue-600">{value}</p>
          </div>
        ))}
        </div>
        </div>
        </section>
      )}

      {/* ── Announcements Section ── */}
      <section
      ref={el => { revealRefs.current[1] = el; }}
      className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl"
      >
      {/* Dark section header */}
      <SectionHeader
      icon={<Megaphone size={16} />}
      title={t.mainPage.announcements}
      badge={announcements.length > 0 ? announcements.length : null}
      accentColor="amber"
      >
      {/* Filter tabs: Всі події / Мої події */}
      <div className="flex items-center rounded-xl border border-(--brd) overflow-hidden bg-(--bg)">
        <button
          onClick={() => setAnnouncementsFilter("all")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
            announcementsFilter === "all"
            ? "bg-blue-600 text-white shadow-inner"
            : "text-(--t2) hover:text-(--t1)"
          }`}
        >
          <Globe size={10} />
          {locale === "ua" ? "Всі події" : locale === "en" ? "All events" : "Все события"}
        </button>
        <button
          onClick={() => setAnnouncementsFilter("mine")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
            announcementsFilter === "mine"
            ? "bg-blue-600 text-white shadow-inner"
            : "text-(--t2) hover:text-(--t1)"
          }`}
        >
          <UserIcon size={10} />
          {locale === "ua" ? "Мої події" : locale === "en" ? "My events" : "Мои события"}
        </button>
      </div>
      {isAdmin && (
        <button
        onClick={() => { setEditAnnouncement(undefined); setModalOpen(true); }}
        className="flex items-center justify-center gap-2 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl px-5 py-3 hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-95 transition-all w-full sm:w-auto group"
        >
        <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
        {t.mainPage.announcementsNew}
        </button>
      )}
      </SectionHeader>

      {/* Announcements list */}
      <div className="p-4 sm:p-6 space-y-3">
      {announcementsLoading ? (
        <div className="flex items-center justify-center py-10">
        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="py-10 text-center">
        <Megaphone className="w-10 h-10 text-(--t2) opacity-20 mx-auto mb-3" />
        <p className="text-sm font-bold text-(--t2)">
        {announcementsFilter === "mine" && !user
          ? (locale === "ua" ? "Щоб бачити свої події, увійдіть або зареєструйтеся" : locale === "en" ? "Sign in or register to see your events" : "Войдите или зарегистрируйтесь, чтобы видеть свои события")
          : announcementsFilter === "mine"
          ? (locale === "ua" ? "Немає подій для вас" : locale === "en" ? "No events for you" : "Нет событий для вас")
          : t.mainPage.announcementsEmpty
        }
        </p>
        {announcementsFilter === "mine" && !user && (
          <div className="flex items-center justify-center gap-3 mt-4">
          <button
          onClick={() => router.push("/login")}
          className="text-xs font-black px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
          {locale === "ua" ? "Увійти" : locale === "en" ? "Sign in" : "Войти"}
          </button>
          <button
          onClick={() => router.push("/register")}
          className="text-xs font-black px-4 py-2 rounded-xl border border-(--brd) text-(--t2) hover:border-blue-600/40 hover:text-(--t1) transition-colors"
          >
          {locale === "ua" ? "Зареєструватися" : locale === "en" ? "Register" : "Зарегистрироваться"}
          </button>
          </div>
        )}
        {isAdmin && announcementsFilter === "all" && (
          <button
          onClick={() => { setEditAnnouncement(undefined); setModalOpen(true); }}
          className="mt-3 text-xs font-black text-blue-600 hover:underline"
          >
          {t.mainPage.announcementsAddFirst}
          </button>
        )}
        </div>
      ) : (
        filteredAnnouncements.map(a => (
          <AnnouncementCard
          key={a.id}
          a={a}
          isAdmin={isAdmin}
          onDelete={handleDeleteAnnouncement}
          onEdit={ann => { setEditAnnouncement(ann); setModalOpen(true); }}
          onTogglePin={handleTogglePin}
          />
        ))
      )}
      </div>
      </section>

      {/* ── Current tournament/round section ── */}
      <section ref={el => { revealRefs.current[2] = el; }} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden relative bg-(--card) border border-(--brd) shadow-xl">
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10 bg-blue-600 pointer-events-none" />

      {/* Dark section header */}
      <SectionHeader
      icon={<Users size={16} />}
      title={t.mainPage.currentTournament}
      accentColor="blue"
      >
      {!currentInfoLoading && currentInfo?.round && (
        <>
        <a
        href={`/rounds/${currentInfo.round.id}`}
        className="flex items-center justify-center gap-1.5 w-40 bg-(--bg) border border-(--brd) text-(--t2) font-black text-[10px] uppercase tracking-widest rounded-2xl px-[6px] py-2.5 hover:border-blue-600/40 hover:text-(--t1) active:scale-95 transition-all whitespace-nowrap"
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Скачать шаблон
        </a>
        <button
        onClick={() => router.push(`/rounds/${currentInfo.round!.id}/submit`)}
        className="flex items-center justify-center gap-1.5 w-40 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl px-4 py-2.5 hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-95 transition-all whitespace-nowrap"
        >
        <Upload size={13} /> {t.mainPage.submitTask ?? "Сдать задание"}
        </button>
        </>
      )}
      </SectionHeader>

      <div className="p-4 sm:p-6 md:p-8 relative z-10">
      {currentInfoLoading ? (
        <div className="flex items-center justify-center py-8">
        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : currentInfo ? (
        <CurrentRoundCard
        info={currentInfo}
        statusConfig={STATUS_CONFIG}
        statusColors={STATUS_COLORS}
        onNavigate={router.push}
        t={t}
        />
      ) : (
        <div className="py-8 text-center">
        <Users className="w-10 h-10 text-(--t2) opacity-20 mx-auto mb-3" />
        <p className="text-sm font-bold text-(--t2)">{t.mainPage.noActiveTournament}</p>
        </div>
      )}
      </div>
      </section>

      {/* ── Tournaments table ── */}
      <section ref={el => { revealRefs.current[3] = el; }} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
      <SectionHeader
      icon={<Trophy size={16} />}
      title={t.mainPage.tournamentList}
      accentColor="green"
      >
      <div className="flex flex-wrap gap-2">
      {filterLabels.map(({ key, label }) => (
        <button
        key={key}
        onClick={() => setActiveFilter(key)}
        className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all spr ${activeFilter === key ? "bg-blue-600 text-white shadow-md" : "bg-(--bg) text-(--t2) border border-(--brd)"}`}
        >
        {label}
        </button>
      ))}
      </div>
      </SectionHeader>

      {tournamentsLoading ? (
        <div className="flex items-center justify-center py-16">
        <Loader className="w-7 h-7 text-blue-600 animate-spin" />
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="py-16 text-center">
        <Trophy className="w-12 h-12 text-(--t2) opacity-30 mx-auto mb-3" />
        <p className="text-sm font-bold text-(--t2)">{t.mainPage.noTournaments}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
        <tr className="bg-(--bg)/50 border-b border-(--brd)">
        {[t.mainPage.colTournament, t.mainPage.colStatus, t.mainPage.colStart, t.mainPage.colTeams, t.mainPage.colActions].map((h, i) => (
          <th key={i} className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2) last:text-right">{h}</th>
        ))}
        </tr>
        </thead>
        <tbody className="text-sm divide-y divide-(--brd)">
        {filteredTournaments.map(tourney => {
          const cfg = STATUS_CONFIG[tourney.status] ?? STATUS_CONFIG.upcoming;
          return (
            <tr key={tourney.id} className="transition-colors hover:bg-(--bg)/30 cursor-pointer" onClick={() => router.push(`/tournaments/${tourney.id}`)}>
            <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-(--t1)">{tourney.name}</td>
            <td className="px-4 sm:px-6 py-4 sm:py-5">
            <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded border ${cfg.color}`}>{cfg.label}</span>
            </td>
            <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-(--t2) text-xs">{fmtDate(tourney.start_at)}</td>
            <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-(--t2) text-xs">
            {tourney.team_count ?? 0}{tourney.max_teams ? ` / ${tourney.max_teams}` : ""}
            </td>
            <td className="px-4 sm:px-6 py-4 sm:py-5 text-right">
            {tourney.status === "registration" ? (
              <button
              onClick={e => { e.stopPropagation(); router.push(`/tournaments/${tourney.id}`); }}
              className="font-black text-[9px] uppercase tracking-tighter px-3 py-2 rounded-lg border border-blue-600 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
              >
              {t.mainPage.actionRegister}
              </button>
            ) : (
              <button
              onClick={e => { e.stopPropagation(); router.push(`/tournaments/${tourney.id}`); }}
              className="p-2 rounded-lg text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors"
              >
              <ExternalLink size={16} />
              </button>
            )}
            </td>
            </tr>
          );
        })}
        </tbody>
        </table>
        </div>
      )}

      <div className="px-4 sm:px-6 py-3 border-t border-(--brd)">
      <button
      onClick={() => router.push("/tournaments")}
      className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
      >
      {t.mainPage.allTournaments}
      </button>
      </div>
      </section>

      </div>
      {/* right column: EventCalendar */}
      <div className="w-full xl:sticky xl:top-6 xl:w-72 xl:flex-shrink-0">
      <EventCalendar extraEvents={announcementCalendarEvents} eventsFilter={announcementsFilter} onEventsFilterChange={setAnnouncementsFilter} />
      </div>
      </div>
      </div>
      </main>

      {/* ── Announcement Modal ── */}
      {modalOpen && (
        <AnnouncementModal
        onClose={() => { setModalOpen(false); setEditAnnouncement(undefined); }}
        onSave={handleSaveAnnouncement}
        initial={editAnnouncement}
        />
      )}
      </div>
  );
}