"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, UserCircle, Settings, LogOut, Search, ChevronDown, Menu } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage, LOCALES } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps { backendMessage?: string; }

export default function Sidebar({ backendMessage = "waiting..." }: SidebarProps) {
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const router   = useRouter();
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const { user, logout } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      if (next) setIsSettingsPanelOpen(false);
      return next;
    });
  };

  const go = (path: string) => router.push(path);
  const avatarLetter = user?.username?.charAt(0).toUpperCase() ?? "?";

  return (
    <aside
      style={{ transition: "width 280ms cubic-bezier(.22,1,.36,1)" }}
      className={`relative flex-shrink-0 h-screen sticky top-0 bg-(--card) border-r border-(--brd) flex flex-col overflow-hidden ${collapsed ? "w-[72px]" : "w-72"}`}
    >
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:none } }
        @keyframes fadeLabel { from { opacity:0; transform:translateX(-6px) } to { opacity:1; transform:none } }
        .sd-anim  { animation: slideDown 240ms cubic-bezier(.22,1,.36,1) both }
        .lbl-anim { animation: fadeLabel 200ms 80ms ease both }
        .spr { transition: transform 160ms cubic-bezier(.22,1,.36,1), background 140ms ease, color 140ms ease }
        .spr:hover { transform: translateY(-1px) scale(1.02) }
      `}</style>

      {/* Header */}
      <div className={`flex items-center border-b border-(--brd) flex-shrink-0 ${collapsed ? "justify-center px-4 py-[18px]" : "justify-between px-5 py-[18px]"}`}>
        {!collapsed && <span className="lbl-anim font-black text-xs uppercase tracking-[0.22em] text-(--t2) select-none whitespace-nowrap">Code Future</span>}
        <button onClick={toggleCollapse} className="w-9 h-9 rounded-xl bg-(--bg) border border-(--brd) flex items-center justify-center text-(--t2) hover:text-blue-600 hover:border-blue-600/40 active:scale-95 transition-all flex-shrink-0" title={collapsed ? t.sidebar.mainPage : undefined}>
          <Menu size={16} />
        </button>
      </div>

      {/* Avatar */}
      <button onClick={() => go("/profile")} title={collapsed ? user?.username : undefined}
        className={`flex items-center gap-3 hover:bg-(--bg) border-b border-(--brd) transition-colors w-full text-left flex-shrink-0 ${collapsed ? "justify-center p-4" : "p-5"}`}>
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md shadow-blue-600/20">{avatarLetter}</div>
        {!collapsed && (
          <div className="overflow-hidden lbl-anim">
            <p className="text-sm font-bold text-(--t1) truncate leading-tight">{user?.username}</p>
            <p className="text-[10px] uppercase tracking-widest font-bold text-(--t2)">{user?.role}</p>
          </div>
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto overflow-x-hidden">
        <NavItem icon={<UserCircle size={18} />}      label={t.sidebar.profile}      active={pathname === "/profile"}   collapsed={collapsed} onClick={() => go("/profile")} />
        <NavItem icon={<LayoutDashboard size={18} />} label={t.sidebar.mainPage}     active={pathname === "/main_page"} collapsed={collapsed} onClick={() => go("/main_page")} />
        <NavItem icon={<Search size={18} />}          label={t.sidebar.search}       active={pathname === "/search"}    collapsed={collapsed} onClick={() => go("/search")} />
        <NavItem
          icon={<Settings size={18} />}
          label={t.sidebar.settings}
          active={isSettingsPanelOpen}
          collapsed={collapsed}
          onClick={() => { if (!collapsed) setIsSettingsPanelOpen(p => !p); }}
          suffix={!collapsed ? <ChevronDown size={13} className={`transition-transform flex-shrink-0 ${isSettingsPanelOpen ? "rotate-180" : ""}`} /> : undefined}
        />

        {isSettingsPanelOpen && !collapsed && (
          <div className="sd-anim mx-1 bg-(--bg) border border-(--brd) rounded-2xl p-4 space-y-4">
            {/* Theme */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.settings.theme}</span>
              <button onClick={toggle} className="flex items-center justify-between px-3 py-2 rounded-xl bg-(--card) hover:bg-(--brd) transition border border-(--brd)">
                <span className="text-xs font-black uppercase tracking-wide text-(--t1)">{dark ? `🌙 ${t.settings.dark}` : `☀️ ${t.settings.light}`}</span>
                <div className={`w-10 h-5 rounded-full transition-all relative ${dark ? "bg-blue-600" : "bg-gray-400"}`}>
                  <div className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-all ${dark ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </button>
            </div>
            {/* Language */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.settings.lang}</span>
              <div className="flex bg-(--card) p-1 rounded-xl gap-1 border border-(--brd)">
                {LOCALES.map(({ value, flag }) => (
                  <button key={value} onClick={() => setLocale(value)}
                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 ${locale === value ? "bg-(--bg) shadow-sm text-blue-600" : "text-(--t2) hover:text-blue-400"}`}>
                    <span>{flag}</span>
                    <span>{value.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Backend status */}
            <div className="pt-2 border-t border-(--brd)">
              <span className="text-[10px] font-black text-(--t2) uppercase tracking-tighter block mb-0.5">{t.settings.status}:</span>
              <span className="text-[10px] font-bold text-(--t1) break-all">{backendMessage}</span>
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-(--brd) p-3 flex-shrink-0">
        <button onClick={logout} title={collapsed ? t.sidebar.logout : undefined}
          className={`flex items-center gap-3 rounded-xl text-sm font-bold transition-colors text-(--t2) hover:text-red-500 hover:bg-red-500/5 w-full ${collapsed ? "justify-center p-3" : "px-4 py-2.5"}`}>
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="lbl-anim">{t.sidebar.logout}</span>}
        </button>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active = false, collapsed, onClick, suffix }: {
  icon: React.ReactNode; label: string; active?: boolean;
  collapsed: boolean; onClick: () => void; suffix?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm font-bold spr transition-all w-full ${collapsed ? "justify-center p-3" : "px-4 py-3"} ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-(--t2) hover:bg-(--bg) hover:text-blue-600"}`}>
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && <span className="flex-1 text-left lbl-anim">{label}</span>}
      {!collapsed && suffix}
    </button>
  );
}
