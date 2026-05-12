"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trophy, Flag, ClipboardList, Megaphone, Clock, HelpCircle, Globe, User as UserIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export interface CalendarEvent {
  id: string;
  date: string;
  label: string;
  type: "tournament_start" | "tournament_end" | "round_start" | "round_end" | "registration_start" | "registration_end" | "announcement";
  link?: string;
  /** true = личное событие пользователя (его турнир/раунд/регистрация) */
  isMine?: boolean;
}

function isoToDateStr(iso: string) { return iso.slice(0, 10); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }

const EVENT_COLORS: Record<CalendarEvent["type"], string> = {
  tournament_start:   "bg-blue-500",
  tournament_end:     "bg-gray-400",
  round_start:        "bg-green-500",
  round_end:          "bg-orange-400",
  registration_start: "bg-emerald-400",
  registration_end:   "bg-rose-500",
  announcement:       "bg-amber-400",
};

const EVENT_ICONS: Record<CalendarEvent["type"], React.ReactNode> = {
  tournament_start:   <Trophy size={10} />,
  tournament_end:     <Trophy size={10} />,
  round_start:        <Flag size={10} />,
  round_end:          <Flag size={10} />,
  registration_start: <ClipboardList size={10} />,
  registration_end:   <ClipboardList size={10} />,
  announcement:       <Megaphone size={10} />,
};

// В режиме "Мои события" показываем только эти типы + только isMine=true
const MINE_TYPES = new Set<CalendarEvent["type"]>([
  "tournament_start",
  "tournament_end",
  "round_start",
  "round_end",
  "registration_start",
  "registration_end",
  "announcement",
]);

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_UA = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DAYS_UA = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];
const DAYS_EN = ["Mo","Tu","We","Th","Fr","Sa","Su"];

const LEGEND: { type: CalendarEvent["type"]; ua: string; en: string }[] = [
  { type: "tournament_start",   ua: "Початок турніру",    en: "Tournament start" },
{ type: "tournament_end",     ua: "Кінець турніру",     en: "Tournament end"   },
{ type: "registration_start", ua: "Початок реєстрації", en: "Reg. start"       },
{ type: "registration_end",   ua: "Кінець реєстрації",  en: "Reg. end"         },
{ type: "round_start",        ua: "Початок раунду",     en: "Round start"      },
{ type: "round_end",          ua: "Кінець раунду",      en: "Round end"        },
{ type: "announcement",       ua: "Оголошення",         en: "Announcement"     },
];

function EventRow({ event }: { event: CalendarEvent }) {
  const inner = (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-(--bg) transition-colors group cursor-pointer">
    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-white ${EVENT_COLORS[event.type]}`}>
    {EVENT_ICONS[event.type]}
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-[11px] font-black text-(--t1) truncate group-hover:text-blue-600 transition-colors leading-tight">{event.label}</p>
    <p className="text-[9px] font-bold text-(--t2)">{event.date}</p>
    </div>
    </div>
  );
  if (event.link) return <a href={event.link}>{inner}</a>;
  return <div>{inner}</div>;
}

interface EventCalendarProps {
  extraEvents?: CalendarEvent[];
  eventsFilter?: "all" | "mine";
  onEventsFilterChange?: (f: "all" | "mine") => void;
}

export default function EventCalendar({ extraEvents = [], eventsFilter = "all", onEventsFilterChange }: EventCalendarProps) {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const today = new Date();

  const [year, setYear]             = useState(today.getFullYear());
  const [month, setMonth]           = useState(today.getMonth());
  const [events, setEvents]         = useState<CalendarEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const MONTHS = locale === "ua" ? MONTHS_UA : locale === "en" ? MONTHS_EN : MONTHS_RU;
  const DAYS   = locale === "ua" ? DAYS_UA   : locale === "en" ? DAYS_EN   : DAYS_RU;

  const title        = locale === "ua" ? "Календар подій"  : locale === "en" ? "Event Calendar"  : "Календарь событий";
  const upcomingLbl  = locale === "ua" ? "Найближчі події" : locale === "en" ? "Upcoming events" : "Ближайшие события";
  const noEventsLbl  = locale === "ua" ? "Немає подій"     : locale === "en" ? "No events"       : "Нет событий";
  const legendLbl    = locale === "ua" ? "Легенда"         : locale === "en" ? "Legend"           : "Легенда";
  const allEventsLbl = locale === "ua" ? "Всі події"       : locale === "en" ? "All events"       : "Все события";
  const myEventsLbl  = locale === "ua" ? "Мої події"       : locale === "en" ? "My events"        : "Мои события";

  useEffect(() => {
    setLoading(true);
    (async () => {
      const evs: CalendarEvent[] = [];
      try {
        if (!user) {
          // Guest: load all public tournament & round events
          const { data: tours } = await supabase
            .from("tournaments")
            .select("id,name,start_at,end_at,registration_from,registration_to")
            .limit(50);
          for (const t of tours ?? []) {
            if (t.start_at)          evs.push({ id: `ts-${t.id}`,  date: isoToDateStr(t.start_at),          label: t.name, type: "tournament_start",   link: `/tournaments/${t.id}`, isMine: false });
            if (t.end_at)            evs.push({ id: `te-${t.id}`,  date: isoToDateStr(t.end_at),            label: t.name, type: "tournament_end",     link: `/tournaments/${t.id}`, isMine: false });
            if (t.registration_from) evs.push({ id: `rs-${t.id}`,  date: isoToDateStr(t.registration_from), label: t.name, type: "registration_start", link: `/tournaments/${t.id}`, isMine: false });
            if (t.registration_to)   evs.push({ id: `re-${t.id}`,  date: isoToDateStr(t.registration_to),   label: t.name, type: "registration_end",   link: `/tournaments/${t.id}`, isMine: false });
          }
          const tourIds = (tours ?? []).map((t: any) => t.id);
          if (tourIds.length) {
            const { data: rounds } = await supabase.from("rounds").select("id,name,start_at,end_at,tournament_id").in("tournament_id", tourIds);
            for (const r of rounds ?? []) {
              if (r.start_at) evs.push({ id: `rds-${r.id}`, date: isoToDateStr(r.start_at), label: r.name, type: "round_start", link: `/rounds/${r.id}`, isMine: false });
              if (r.end_at)   evs.push({ id: `rde-${r.id}`, date: isoToDateStr(r.end_at),   label: r.name, type: "round_end",   link: `/rounds/${r.id}`, isMine: false });
            }
          }
        } else {
          // Authenticated user
          const isAdminRole = user.role === "admin" || user.role === "superadmin";

          const { data: captainTeams } = await supabase.from("teams").select("id,tournament_id").eq("captain_id", user.id).not("tournament_id","is",null);
          const { data: memberTeams  } = await supabase.from("teams").select("id,tournament_id").contains("members_ids",[user.id]).not("tournament_id","is",null);
          const teams = [...(captainTeams ?? []), ...(memberTeams ?? [])];
          const personalTourIds = new Set<string>(teams.map((t: any) => t.tournament_id).filter(Boolean));

          const { data: juryRows } = await supabase.from("jury_assignments").select("round_id").eq("jury_id", user.id);
          const juryRoundIds = new Set<string>((juryRows ?? []).map((r: any) => r.round_id));

          // Always load all tournaments (needed for "all" tab; admins also own all)
          const { data: tours } = await supabase
            .from("tournaments")
            .select("id,name,start_at,end_at,registration_from,registration_to")
            .limit(50);

          for (const t of tours ?? []) {
            const isMine = isAdminRole || personalTourIds.has(t.id);
            if (t.start_at)          evs.push({ id: `ts-${t.id}`,  date: isoToDateStr(t.start_at),          label: t.name, type: "tournament_start",   link: `/tournaments/${t.id}`, isMine });
            if (t.end_at)            evs.push({ id: `te-${t.id}`,  date: isoToDateStr(t.end_at),            label: t.name, type: "tournament_end",     link: `/tournaments/${t.id}`, isMine });
            if (t.registration_from) evs.push({ id: `rs-${t.id}`,  date: isoToDateStr(t.registration_from), label: t.name, type: "registration_start", link: `/tournaments/${t.id}`, isMine });
            if (t.registration_to)   evs.push({ id: `re-${t.id}`,  date: isoToDateStr(t.registration_to),   label: t.name, type: "registration_end",   link: `/tournaments/${t.id}`, isMine });
          }

          const allTourIds = (tours ?? []).map((t: any) => t.id);
          if (allTourIds.length) {
            const { data: rounds } = await supabase.from("rounds").select("id,name,start_at,end_at,tournament_id").in("tournament_id", allTourIds);
            for (const r of rounds ?? []) {
              const isMine = isAdminRole || personalTourIds.has(r.tournament_id) || juryRoundIds.has(r.id);
              if (r.start_at) evs.push({ id: `rds-${r.id}`, date: isoToDateStr(r.start_at), label: r.name, type: "round_start", link: `/rounds/${r.id}`, isMine });
              if (r.end_at)   evs.push({ id: `rde-${r.id}`, date: isoToDateStr(r.end_at),   label: r.name, type: "round_end",   link: `/rounds/${r.id}`, isMine });
            }
          }
        }
      } catch (e) { console.error("EventCalendar", e); }
      setEvents(evs);
      setLoading(false);
    })();
  }, [user]);

  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    // extraEvents — announcements from page, always shown as "mine"
    const taggedExtra = extraEvents.map(e => ({ ...e, isMine: true }));
    return [...events, ...taggedExtra].filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  }, [events, extraEvents]);

  // "Мои события": только личные события релевантных типов (без объявлений и чужих турниров)
  const visibleEvents = useMemo(() => {
    if (eventsFilter === "all") return allEvents;
    return allEvents.filter(e => e.isMine && MINE_TYPES.has(e.type));
  }, [allEvents, eventsFilter]);

  const byDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of visibleEvents) { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); }
    return map;
  }, [visibleEvents]);

  const upcoming = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    const limit = new Date(t); limit.setDate(limit.getDate() + 30);
    return visibleEvents
    .filter(e => { const d = new Date(e.date); return d >= t && d <= limit; })
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 6);
  }, [visibleEvents]);

  const todayStr    = isoToDateStr(today.toISOString());
  const days        = daysInMonth(year, month);
  const firstDay    = firstDayOfMonth(year, month);
  const selectedEvs = selected ? (byDate[selected] ?? []) : [];

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const cardContent = (
    <div className="flex flex-col gap-4">

    {/* ── Декоративный обод: месяц + навигация ── */}
    <div className="relative flex items-center justify-between rounded-2xl border border-(--brd) bg-(--bg) px-2 py-1.5 overflow-hidden">
    {/* Градиентный фон */}
    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-blue-600/5 pointer-events-none" />
    {/* Боковые акцентные полосы */}
    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-blue-600/0 via-blue-600/50 to-blue-600/0 pointer-events-none" />
    <div className="absolute right-0 top-0 bottom-0 w-[3px] rounded-r-2xl bg-gradient-to-b from-blue-600/0 via-blue-600/50 to-blue-600/0 pointer-events-none" />

    <button onClick={prevMonth} className="relative z-10 p-1.5 rounded-xl text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors">
    <ChevronLeft size={15} />
    </button>

    <div className="relative z-10 flex items-center gap-2">
    <div className="w-5 h-5 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
    <Calendar size={10} className="text-blue-600" />
    </div>
    <span className="text-xs font-black text-(--t1) uppercase tracking-wider">
    {MONTHS[month]} {year}
    </span>
    </div>

    <button onClick={nextMonth} className="relative z-10 p-1.5 rounded-xl text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors">
    <ChevronRight size={15} />
    </button>
    </div>

    {/* Сетка дней */}
    <div className="grid grid-cols-7 gap-0.5">
    {DAYS.map(d => (
      <div key={d} className="text-center text-[8px] font-black uppercase tracking-widest text-(--t2) py-1">{d}</div>
    ))}
    {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
    {Array.from({ length: days }).map((_, i) => {
      const day     = i + 1;
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const dayEvs  = byDate[dateStr] ?? [];
      const isToday = dateStr === todayStr;
      const isSel   = dateStr === selected;
      return (
        <button
        key={dateStr}
        onClick={() => setSelected(isSel ? null : dateStr)}
        className={`relative flex flex-col items-center justify-start pt-1 pb-0.5 rounded-lg h-9 transition-all text-[11px] font-bold
          ${isSel   ? "bg-blue-600 text-white shadow-md"
            : isToday ? "bg-blue-600/15 text-blue-600 font-black"
            :           "text-(--t2) hover:bg-(--bg) hover:text-(--t1)"}`}
            >
            <span>{day}</span>
            {dayEvs.length > 0 && (
              <div className="flex gap-[2px] mt-0.5 flex-wrap justify-center">
              {dayEvs.slice(0,3).map((e,idx) => (
                <span key={idx} className={`w-1 h-1 rounded-full ${isSel ? "bg-white/80" : EVENT_COLORS[e.type]}`} />
              ))}
              </div>
            )}
            </button>
      );
    })}
    </div>

    {/* Выбранная дата */}
    {selected && (
      <div className="rounded-2xl border border-(--brd) bg-(--bg) overflow-hidden">
      <div className="px-3 py-2 border-b border-(--brd) flex items-center gap-1.5">
      <Clock size={10} className="text-(--t2)" />
      <span className="text-[9px] font-black uppercase tracking-widest text-(--t2)">{selected}</span>
      </div>
      {selectedEvs.length === 0
        ? <p className="px-3 py-3 text-[10px] font-bold text-(--t2)">{noEventsLbl}</p>
        : <div className="p-1 flex flex-col gap-0.5">{selectedEvs.map(e => <EventRow key={e.id} event={e} />)}</div>
      }
      </div>
    )}

    {/* Ближайшие события */}
    {loading ? (
      <div className="flex items-center justify-center py-3">
      <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    ) : eventsFilter === "mine" && !user ? (
      <div className="py-4 text-center flex flex-col items-center gap-3">
      <p className="text-[10px] font-bold text-(--t2)">
        {locale === "ua" ? "Увійдіть, щоб бачити свої події" : locale === "en" ? "Sign in to see your events" : "Войдите, чтобы видеть свои события"}
      </p>
      <div className="flex items-center gap-2">
        <a href="/login" className="text-[9px] font-black px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          {locale === "ua" ? "Увійти" : locale === "en" ? "Sign in" : "Войти"}
        </a>
        <a href="/register" className="text-[9px] font-black px-3 py-1.5 rounded-xl border border-(--brd) text-(--t2) hover:border-blue-600/40 hover:text-(--t1) transition-colors">
          {locale === "ua" ? "Реєстрація" : locale === "en" ? "Register" : "Регистрация"}
        </a>
      </div>
      </div>
    ) : upcoming.length > 0 ? (
      <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) mb-1.5 px-1">{upcomingLbl}</p>
      <div className="flex flex-col gap-0.5">
      {upcoming.map(e => <EventRow key={e.id} event={e} />)}
      </div>
      </div>
    ) : null}

    {/* Легенда */}
    <div className="border-t border-(--brd) pt-3">
    <button
    onClick={() => setLegendOpen(v => !v)}
    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all text-left
      ${legendOpen
        ? "bg-blue-600/10 border-blue-600/30 text-blue-600"
        : "bg-(--bg) border-(--brd) text-(--t2) hover:text-(--t1) hover:border-(--t2)/30"
      }`}
      >
      <div className="flex items-center gap-2">
      <HelpCircle size={12} className={legendOpen ? "text-blue-600" : "text-(--t2)"} />
      <span className="text-[9px] font-black uppercase tracking-widest">{legendLbl}</span>
      </div>
      {legendOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {legendOpen && (
        <div className="mt-2 rounded-xl border border-(--brd) bg-(--bg) p-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {LEGEND.map(item => (
          <div key={item.type} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${EVENT_COLORS[item.type]}`} />
          <span className="text-[9px] font-black text-(--t2) truncate">
          {locale === "ua" ? item.ua : item.en}
          </span>
          </div>
        ))}
        </div>
      )}
      </div>

      </div>
  );

  return (
    <div className="w-full">

    {/* Mobile toggle header */}
    <button
    className="w-full flex items-center justify-between gap-3 mb-3"
    onClick={() => setMobileOpen(v => !v)}
    >
    <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
    <Calendar size={15} className="text-blue-600" />
    </div>
    <div className="text-left">
    <h2 className="text-sm font-black uppercase tracking-widest text-(--t1)">{title}</h2>
    <p className="text-[10px] font-bold text-(--t2) uppercase tracking-widest">
    {loading ? "..." : `${upcoming.length} ${locale === "en" ? "upcoming" : locale === "ua" ? "подій" : "событий"}`}
    </p>
    </div>
    </div>
    <span className="xl:hidden text-(--t2)">
    {mobileOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </span>
    </button>

    {/* Все события / Мои события */}
    {onEventsFilterChange && (
      <div className="flex items-center rounded-xl border border-(--brd) overflow-hidden bg-(--bg) mb-3 w-full">
      <button
      onClick={() => onEventsFilterChange("all")}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
        eventsFilter === "all"
        ? "bg-blue-600 text-white shadow-inner"
        : "text-(--t2) hover:text-(--t1)"
      }`}
      >
      <Globe size={10} />
      {allEventsLbl}
      </button>
      <button
      onClick={() => onEventsFilterChange("mine")}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
        eventsFilter === "mine"
        ? "bg-blue-600 text-white shadow-inner"
        : "text-(--t2) hover:text-(--t1)"
      }`}
      >
      <UserIcon size={10} />
      {myEventsLbl}
      </button>
      </div>
    )}

    {/* Mobile: expanded panel */}
    <div className="xl:hidden">
    {mobileOpen && (
      <div className="bg-(--card) rounded-2xl shadow-xl border border-(--brd) p-4">
      {cardContent}
      </div>
    )}
    </div>

    <div className="hidden xl:block">
    <div className="bg-(--card) rounded-[2rem] shadow-xl border border-(--brd) p-5">
    {cardContent}
    </div>
    </div>

    </div>
  );
}
