//frontend/scr/components/sidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, UserCircle, Settings, LogOut, Search, ChevronDown, Menu, Users, Bell, Trophy } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage, LOCALES } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  meta: string | Record<string, any> | null;
  read: boolean;
  created_at: string;
}

function parseSidebarMeta(raw: string | Record<string, any> | null): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

interface SidebarProps {}

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar_collapsed") === "true";
}

export default function Sidebar({}: SidebarProps) {
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [responding, setResponding] = useState<Record<string, "accept" | "decline" | null>>({});
  const [responded, setResponded]   = useState<Record<string, "accepted" | "declined">>({});

  const router   = useRouter();
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const { user, logout, token } = useAuth();
  const [emailNotif, setEmailNotif]             = useState<boolean>(true);
  const [emailNotifSaving, setEmailNotifSaving] = useState(false);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      if (next) {
        setIsSettingsPanelOpen(false);
        setIsNotificationsPanelOpen(false);
      }
      return next;
    });
  };

  const go = (path: string) => router.push(path);
  const avatarLetter = user?.username?.charAt(0).toUpperCase() ?? "?";
  const avatarUrl = user?.avatar_url;



  // Load email_notifications setting
  useEffect(() => {
    if (!user) return;
    const t = (typeof window !== "undefined" && localStorage.getItem("access_token")) || token || "";
    fetch(`${API_URL}/api/users/me/email-notifications-status`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setEmailNotif(d.email_notifications !== false); })
      .catch(() => {});
  }, [user]);

  const toggleEmailNotif = async (val: boolean) => {
    setEmailNotifSaving(true);
    try {
      const t = (typeof window !== "undefined" && localStorage.getItem("access_token")) || token || "";
      await fetch(`${API_URL}/api/users/me/email-notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ enabled: val }),
      });
      setEmailNotif(val);
    } finally {
      setEmailNotifSaving(false);
    }
  };

  // Fetch notifications when panel opens, then mark all as read
  useEffect(() => {
    if (!isNotificationsPanelOpen) return;
    setNotifLoading(true);
    const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
    fetch(`${API_URL}/api/notifications?limit=2`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const list: Notification[] = data.notifications ?? data ?? [];
      const hasUnread = list.some((n: Notification) => !n.read);
      if (hasUnread) {
        fetch(`${API_URL}/api/notifications/mark-read`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ all: true }),
        }).catch(() => {});
        setNotifications(list.map((n: Notification) => ({ ...n, read: true })));
        setUnreadCount(0);
      } else {
        setNotifications(list);
        setUnreadCount(0);
      }
    })
    .catch(() => setNotifications([]))
    .finally(() => setNotifLoading(false));
  }, [isNotificationsPanelOpen]);

  // Fetch unread count on mount
  useEffect(() => {
    const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
    if (!token) return;
    fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => setUnreadCount(data.count ?? 0))
    .catch(() => {});
  }, []);

  const markAllNotificationsRead = async () => {
    const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/notifications/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotificationsClick = () => {
    if (!collapsed) {
      const opening = !isNotificationsPanelOpen;
      setIsNotificationsPanelOpen(opening);
      if (isSettingsPanelOpen) setIsSettingsPanelOpen(false);
      if (opening && unreadCount > 0) {
        markAllNotificationsRead();
      }
    }
  };

  const handleProfileClick = () => {
    if (unreadCount > 0) {
      markAllNotificationsRead();
    }
    go("/profile");
  };

  const respondInvitation = async (notif: Notification, accept: boolean) => {
    const meta = parseSidebarMeta(notif.meta);
    const invitationId = meta.invitation_id;
    if (!invitationId) return;
    setResponding(prev => ({ ...prev, [notif.id]: accept ? "accept" : "decline" }));
    try {
      const token = (typeof window !== "undefined" && localStorage.getItem("access_token")) || "";
      // Вибираємо правильний endpoint залежно від типу запрошення
      const endpoint = notif.type === "jury_invitation"
      ? `${API_URL}/api/jury-invitations/respond`
      : `${API_URL}/api/invitations/respond`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invitation_id: invitationId, accept }),
      });
      if (res.ok) {
        setResponded(prev => ({ ...prev, [notif.id]: accept ? "accepted" : "declined" }));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {}
    finally { setResponding(prev => ({ ...prev, [notif.id]: null })); }
  };

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
      const localeMap: Record<string, string> = { ua: "uk-UA", ru: "ru-RU", en: "en-US" };
      const loc = localeMap[locale] ?? "uk-UA";
      if (diff < 60) return locale === "en" ? `${diff}s ago` : `${diff}с тому`;
      if (diff < 3600) return locale === "en" ? `${Math.floor(diff/60)}m ago` : `${Math.floor(diff/60)}хв тому`;
      if (diff < 86400) return locale === "en" ? `${Math.floor(diff/3600)}h ago` : `${Math.floor(diff/3600)}год тому`;
      return date.toLocaleDateString(loc, { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  return (
    <aside
    style={{
      willChange: "width",
      transition: "width 280ms cubic-bezier(.22,1,.36,1)",
    }}
    className={`relative flex-shrink-0 h-screen sticky top-0 bg-(--card) border-r border-(--brd) flex flex-col overflow-hidden ${
      collapsed ? "w-[72px]" : "w-72"
    }`}
    >
    <style>{`
      .lbl {
        white-space: nowrap;
        overflow: hidden;
      }
      .nav-icon {
        min-width: 18px;
        display: flex;
        justify-content: center;
      }
      .sd-anim {
        animation: slideDown 200ms ease forwards;
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .notif-dot {
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.5; }
      }
      `}</style>

      {/* Header */}
      <div className={`flex items-center border-b border-(--brd) flex-shrink-0 ${collapsed ? "justify-center px-4 py-[18px]" : "justify-between px-5 py-[18px]"}`}>
      {!collapsed && (
        <button onClick={() => go("/")} className="lbl font-black text-xs uppercase tracking-[0.22em] text-(--t2) hover:text-blue-600 transition-colors whitespace-nowrap">
        Code Future
        </button>
      )}
      <button
      onClick={toggleCollapse}
      className={`
        w-9 h-9 rounded-xl bg-(--bg) border border-(--brd)
        flex items-center justify-center transition-all duration-500
        hover:scale-110 active:scale-95 flex-shrink-0
        ${collapsed
          ? "rotate-180 text-blue-600 border-blue-600/20 shadow-lg shadow-blue-600/10"
          : "rotate-0 text-(--t2) hover:text-blue-600 hover:border-blue-600/40"
        }
        `}
        title={collapsed ? t.sidebar.mainPage : undefined}
        >
        <Menu size={16} />
        </button>
        </div>

        {/* Avatar */}
        <button
        onClick={() => go("/profile")}
        title={collapsed ? user?.username : undefined}
        className={`flex items-center gap-3 hover:bg-(--bg) transition-colors w-full text-left flex-shrink-0 ${collapsed ? "justify-center p-4" : "p-5"}`}
        >
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md shadow-blue-600/20 overflow-hidden">
        {avatarUrl
          ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          : avatarLetter
        }
        </div>
        {!collapsed && (
          <div className="overflow-hidden lbl">
          <p className="text-sm font-bold text-(--t1) truncate leading-tight">{user?.username}</p>
          <p className="text-[10px] uppercase tracking-widest font-bold text-(--t2)">{user?.role}</p>
          </div>
        )}
        </button>

        {/* Notifications */}
        <div className="border-b border-(--brd) flex-shrink-0 px-3 py-1">
        <button
        onClick={handleNotificationsClick}
        title={collapsed ? t.sidebar.notifications : undefined}
        className={`flex items-center gap-3 transition-colors w-full text-left rounded-xl
          ${collapsed ? "justify-center p-3" : "px-4 py-3"}
          ${isNotificationsPanelOpen ? "bg-blue-600 text-white shadow-lg" : "hover:bg-(--bg) text-(--t2)"}
          `}
          >
          <div className="w-[18px] flex-shrink-0 flex items-center justify-center">
          <div className="relative">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none ${isNotificationsPanelOpen ? "" : "notif-dot"}`}>
            {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          </div>
          </div>
          {!collapsed && (
            <>
            <span className="flex-1 text-sm font-bold lbl">{t.sidebar.notifications}</span>
            <ChevronDown
            size={13}
            className={`transition-transform flex-shrink-0 ${isNotificationsPanelOpen ? "rotate-180" : ""}`}
            />
            </>
          )}
          </button>

          {/* Dropdown panel */}
          {isNotificationsPanelOpen && !collapsed && (
            <div className="sd-anim border-t border-(--brd)">
            {notifLoading ? (
              <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-5 px-4 text-center">
              <Bell size={20} className="mx-auto mb-2 text-(--t2) opacity-40" />
              <p className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.sidebar.noNotifications}</p>
              </div>
            ) : (
              <div className="divide-y divide-(--brd)">
              {notifications.map(n => {
                const isTeamInvite = n.type === "team_invitation";
                const isJuryInvite = n.type === "jury_invitation";
                const isInvite = isTeamInvite || isJuryInvite;
                const res = responded[n.id];
                const rsp = responding[n.id];
                return (
                  <div
                  key={n.id}
                  className={`px-4 py-3 flex gap-2.5 items-start ${!n.read ? "bg-blue-500/5" : ""}`}
                  >
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!n.read ? "bg-blue-500" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-wide truncate ${!n.read ? "text-(--t1)" : "text-(--t2)"}`}>{n.title}</p>
                  <p className="text-[10px] font-bold text-(--t2) line-clamp-2 leading-relaxed mt-0.5">{n.message}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-(--t2) opacity-60 mt-1">{formatTime(n.created_at)}</p>
                  {isInvite && !res && (
                    <div className="flex gap-1.5 mt-2.5">
                    <button
                    onClick={() => respondInvitation(n, true)}
                    disabled={!!rsp}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-white font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 ${isJuryInvite ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}
                    >
                    {rsp === "accept"
                      ? <><span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin inline-block" /> {t.sidebar.notifAccepting}</>
                      : t.sidebar.notifAccept
                    }
                    </button>
                    <button
                    onClick={() => respondInvitation(n, false)}
                    disabled={!!rsp}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-(--bg) border border-(--brd) text-(--t2) font-black text-[9px] uppercase tracking-widest hover:border-red-500/40 hover:text-red-500 active:scale-95 transition-all disabled:opacity-50"
                    >
                    {rsp === "decline"
                      ? <><span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" /> {t.sidebar.notifDeclining}</>
                      : t.sidebar.notifDecline
                    }
                    </button>
                    </div>
                  )}
                  {isInvite && res && (
                    <span className={`mt-2 inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${res === "accepted" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                    {res === "accepted" ? t.sidebar.notifAccepted : t.sidebar.notifDeclined}
                    </span>
                  )}
                  </div>
                  </div>
                );
              })}
              </div>
            )}
            <button
            onClick={() => go("/profile")}
            className="w-full py-2.5 mx-0 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10 transition-colors border-t border-(--brd) rounded-b-2xl"
            >
            {t.sidebar.notifMore}
            </button>
            </div>
          )}
          </div>

          {/* Nav */}
          <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto overflow-x-hidden">
          <NavItem icon={<UserCircle size={18} />}      label={t.sidebar.profile}   active={pathname === "/profile"}   collapsed={collapsed} onClick={() => go("/profile")}    href="/profile" />
          <NavItem icon={<LayoutDashboard size={18} />} label={t.sidebar.mainPage}  active={pathname === "/dashboard"} collapsed={collapsed} onClick={() => go("/dashboard")} href="/dashboard" />
          <NavItem icon={<Search size={18} />}          label={t.sidebar.search}    active={pathname === "/search"}    collapsed={collapsed} onClick={() => go("/search")}    href="/search" />
          <NavItem
          icon={<Trophy size={18} />}
          label={t.sidebar.tournaments}
          active={pathname === "/tournaments" || pathname?.startsWith("/tournaments/")}
          collapsed={collapsed}
          onClick={() => go("/tournaments")}
          href="/tournaments"
          />
          <NavItem
          icon={<Users size={18} />}
          label={t.sidebar.teams}
          active={pathname === "/teams" || pathname?.startsWith("/teams/")}
          collapsed={collapsed}
          onClick={() => go("/teams")}
          href="/teams"
          />
          <NavItem
          icon={<Settings size={18} />}
          label={t.sidebar.settings}
          active={isSettingsPanelOpen}
          collapsed={collapsed}
          onClick={() => { if (!collapsed) { setIsSettingsPanelOpen(p => !p); setIsNotificationsPanelOpen(false); } }}
          suffix={!collapsed ? <ChevronDown size={13} className={`transition-transform flex-shrink-0 ${isSettingsPanelOpen ? "rotate-180" : ""}`} /> : undefined}
          />

          {isSettingsPanelOpen && !collapsed && (
            <div className="sd-anim mx-1 bg-(--bg) border border-(--brd) rounded-2xl p-4 space-y-4">
            <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.settings.theme}</span>
            <button onClick={toggle} className="flex items-center justify-between px-3 py-2 rounded-xl bg-(--card) hover:bg-(--brd) transition border border-(--brd)">
            <span className="text-xs font-black uppercase tracking-wide text-(--t1)">{dark ? `🌙 ${t.settings.dark}` : `☀️ ${t.settings.light}`}</span>
            <div className={`w-10 h-5 rounded-full transition-all relative ${dark ? "bg-blue-600" : "bg-gray-400"}`}>
            <div className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-all ${dark ? "translate-x-5" : "translate-x-0"}`} />
            </div>
            </button>
            </div>
            <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.settings.lang}</span>
            <div className="flex bg-(--card) p-1 rounded-xl gap-1 border border-(--brd)">
            {LOCALES.map(({ value }) => (
              <button key={value} onClick={() => setLocale(value)}
              className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 ${locale === value ? "bg-(--bg) shadow-sm text-blue-600" : "text-(--t2) hover:text-blue-400"}`}>
              <span>{value.toUpperCase()}</span>
              </button>
            ))}
            </div>
            </div>

            <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Email</span>
            <button
              onClick={() => toggleEmailNotif(!emailNotif)}
              disabled={emailNotifSaving}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-(--card) hover:bg-(--brd) transition border border-(--brd)"
            >
              <span className="text-xs font-black uppercase tracking-wide text-(--t1)">
                {emailNotif ? "✉️ Сповіщення вкл." : "✉️ Сповіщення викл."}
              </span>
              <div className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${emailNotif ? "bg-blue-600" : "bg-gray-400"} ${emailNotifSaving ? "opacity-50" : ""}`}>
                <div className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-all ${emailNotif ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </button>
            </div>

            </div>
          )}
          </nav>

          {/* Logout */}
          <div className="border-t border-(--brd) p-3 flex-shrink-0">
          <button
          onClick={logout}
          title={collapsed ? t.sidebar.logout : undefined}
          className={`flex items-center gap-3 rounded-xl text-sm font-bold transition-colors text-(--t2) hover:text-red-500 hover:bg-red-500/5 w-full ${collapsed ? "justify-center p-3" : "px-4 py-2.5"}`}
          >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="lbl">{t.sidebar.logout}</span>}
          </button>
          </div>
          </aside>
  );
}

function NavItem({ icon, label, active, collapsed, onClick, suffix, href }: any) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Middle click — браузер сам відкриє в новій вкладці завдяки <a>
    if (e.button === 1) return;
    // Звичайний клік — використовуємо клієнтську навігацію Next.js
    e.preventDefault();
    onClick?.();
  };

  return (
    <a
    href={href ?? "#"}
    onClick={handleClick}
    className={`
      flex items-center gap-3 rounded-xl text-sm font-bold transition-all w-full cursor-pointer
      ${collapsed ? "justify-center p-3" : "px-4 py-3"}
      ${active ? "bg-blue-600 text-white shadow-lg" : "text-(--t2) hover:bg-(--bg)"}
      `}
      >
      <div className="w-[18px] flex-shrink-0 flex items-center justify-center">
      {icon}
      </div>
      {!collapsed && (
        <span className="flex-1 text-left lbl overflow-hidden">
        {label}
        </span>
      )}
      {!collapsed && suffix}
      </a>
  );
}
