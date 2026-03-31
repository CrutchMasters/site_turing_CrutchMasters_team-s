'use client';

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Trophy, Users, UserCircle,
  Settings, LogOut, ExternalLink, Upload,
  ChevronRight, Menu, Home,
} from "lucide-react";

const API_URL =
typeof window !== "undefined" && window.location.hostname === "localhost"
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [backendMessage, setBackendMessage] = useState("waiting...");
  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const { user, logout, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

    useEffect(() => {
      fetch(`${API_URL}/api/test`)
      .then((r) => r.json()).then((d) => setBackendMessage(d.message))
      .catch(() => setBackendMessage("Disconnected"));
      const obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("fuIn"); }),
                                           { threshold: 0.1 }
      );
      revealRefs.current.forEach((r) => { if (r) obs.observe(r); });
      return () => obs.disconnect();
    }, []);

    const go = (path: string) => { setIsSidebarOpen(false); setIsSettingsPanelOpen(false); router.push(path); };

    // Спінер під час завантаження сесії
    if (isLoading) return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    );

    if (!user) return null;

    // Аватар — перша літера імені
    const avatarLetter = user.username?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-(--bg) text-(--t1) transition-colors duration-300">
    <style jsx global>{`
      @keyframes fadeUp   {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
      @keyframes cardDrop {from{opacity:0;transform:translateY(-26px) scale(.97)}to{opacity:1;transform:none}}
      @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      .fuIn{animation:fadeUp 340ms cubic-bezier(.22,1,.36,1) both}
      .cdIn{animation:cardDrop 500ms cubic-bezier(.22,1,.36,1) both}
      .spr{transition:transform 170ms cubic-bezier(.22,1,.36,1),box-shadow 170ms ease,background 150ms ease,color 150ms ease}
      .spr:hover{transform:translateY(-2px) scale(1.025)}
      .settings-panel{animation:slideDown 240ms cubic-bezier(.22,1,.36,1) both}
      `}</style>

      {/* Watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${dark ? "opacity-10" : "opacity-5"}`}>
      <img src="/logo_background1.png" alt="" className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`} />
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => { setIsSidebarOpen(false); setIsSettingsPanelOpen(false); }} />}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-(--card) border-r border-(--brd) flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <button onClick={() => go("/profile")} className="p-6 flex items-center gap-3 w-full text-left hover:bg-(--bg) border-b border-(--brd) transition-colors">
      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {avatarLetter}
      </div>
      <div className="overflow-hidden">
      <p className="text-sm font-bold text-(--t1) truncate">{user.username}</p>
      <p className="text-[10px] uppercase tracking-wider font-bold text-(--t2)">{user.role}</p>
      </div>
      </button>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      <button onClick={() => go("/")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all spr text-(--t2) hover:bg-(--bg) hover:text-blue-600 mb-4 border border-(--brd) border-dashed">
      <Home size={18}/><span>На головну</span>
      </button>
      <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active onClick={() => go("/main_page")}/>
      <NavItem icon={<Trophy size={18}/>}          label="Турніри"   onClick={() => {}}/>
      <NavItem icon={<Users size={18}/>}           label="Команди"   onClick={() => {}}/>
      <NavItem icon={<UserCircle size={18}/>}      label="Гравці"    onClick={() => {}}/>
      <NavItem icon={<Settings size={18}/>} label={t.settings.title} active={isSettingsPanelOpen} onClick={() => setIsSettingsPanelOpen(p=>!p)}/>

      {isSettingsPanelOpen && (
        <div className="settings-panel mx-2 mt-1 mb-2 bg-(--bg) border border-(--brd) rounded-2xl p-4 space-y-4">
        <div className="flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">Theme</span>
        <button onClick={toggle} className="flex items-center justify-between px-3 py-2 rounded-xl bg-(--card) hover:bg-(--brd) transition border border-(--brd)">
        <span className="text-xs font-black uppercase tracking-wide text-(--t1)">{dark ? "🌙 Dark" : "☀️ Light"}</span>
        <div className={`w-10 h-5 rounded-full transition-all relative ${dark?"bg-blue-600":"bg-gray-400"}`}>
        <div className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-all ${dark?"translate-x-5":"translate-x-0"}`}/>
        </div>
        </button>
        </div>
        <div className="flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-(--t2)">{t.settings.lang}</span>
        <div className="flex bg-(--card) p-1 rounded-xl gap-1 border border-(--brd)">
        {(["en","ru","ua"] as const).map(lang=>(
          <button key={lang} onClick={()=>setLocale(lang)}
          className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${locale===lang?"bg-(--bg) shadow-sm text-blue-600":"text-(--t2) hover:text-blue-400"}`}>
          {lang.toUpperCase()}
          </button>
        ))}
        </div>
        </div>
        <div className="pt-2 border-t border-(--brd)">
        <span className="text-[10px] font-black text-(--t2) uppercase tracking-tighter block mb-0.5">{t.settings.status}:</span>
        <span className="text-[10px] font-bold text-(--t1) break-all">{backendMessage}</span>
        </div>
        </div>
      )}
      </nav>

      <div className="p-4 border-t border-(--brd)">
      <button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-bold spr rounded-xl transition-colors text-(--t2) hover:text-red-500">
      <LogOut size={18}/> Вихід
      </button>
      </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
      <header className="lg:hidden p-4 flex items-center justify-between bg-(--card) border-b border-(--brd) sticky top-0 z-30">
      <button onClick={()=>setIsSidebarOpen(true)} className="p-2 rounded-xl bg-(--bg) border border-(--brd) text-(--t1) active:scale-95 transition-transform"><Menu size={24}/></button>
      <div className="flex items-center gap-2">
      <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Trophy size={16}/></div>
      <span className="font-black text-xs uppercase tracking-tighter">Code Future</span>
      </div>
      <button onClick={()=>go("/profile")} className="active:scale-95 transition-transform">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs bg-blue-600 border-2 border-(--brd)">{avatarLetter}</div>
      </button>
      </header>

      <div className="p-4 sm:p-6 md:p-8 lg:p-12 overflow-y-auto">
      <header className="mb-8 sm:mb-12">
      <div className="flex items-center gap-2 text-[10px] font-black mb-3 uppercase tracking-widest text-(--t2)">
      <button onClick={()=>router.push("/")} className="hover:text-blue-600 transition-colors">Головна</button>
      <ChevronRight size={10}/><span className="text-(--t1)">Дашборд</span>
      </div>
      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-(--t1) uppercase">Огляд кабінету</h1>
      </header>

      <div className="max-w-6xl space-y-6 sm:space-y-8">
      {/* Tournaments table */}
      <section ref={(el)=>{revealRefs.current[0]=el;}} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
      <div className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--brd)">
      <h2 className="font-black text-lg sm:text-xl text-(--t1) uppercase tracking-tight">🏆 Список турнірів</h2>
      <div className="flex flex-wrap gap-2">
      {["Всі","Open","Running"].map((l,i)=>(
        <button key={l} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all spr ${i===0?"bg-blue-600 text-white shadow-md":"bg-(--bg) text-(--t2) border border-(--brd)"}`}>{l}</button>
      ))}
      </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[500px]">
      <thead>
      <tr className="bg-(--bg)/50 border-b border-(--brd)">
      {["Турнір","Статус","Старт"].map(h=><th key={h} className="px-4 sm:px-8 py-4 text-[10px] font-black uppercase tracking-widest text-(--t2)">{h}</th>)}
      <th className="px-4 sm:px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right text-(--t2)">Дії</th>
      </tr>
      </thead>
      <tbody className="text-sm divide-y divide-(--brd)">
      <TournamentRow title="Хакатон 2026" status="Running" statusType="warning" date="12.01.2026"/>
      <TournamentRow title="Summer Jam"   status="Open"    statusType="info"    date="02.01.2026" isSpecialAction/>
      </tbody>
      </table>
      </div>
      </section>

      {/* Team */}
      <section ref={(el)=>{revealRefs.current[1]=el;}} className="cdIn opacity-0 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 relative overflow-hidden bg-(--card) border border-(--brd) shadow-xl">
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10 bg-blue-600 pointer-events-none"/>
      <h2 className="font-black text-lg sm:text-xl mb-6 sm:mb-8 flex items-center gap-3 relative z-10 text-(--t1) uppercase tracking-tight">
      <Users className="text-blue-600" size={24}/> Team Alpha
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 relative z-10">
      <div className="p-4 sm:p-6 rounded-2xl bg-(--bg) border border-(--brd)">
      <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">Поточний турнір</p>
      <p className="font-bold text-sm text-(--t1)">Весняний хакатон</p>
      </div>
      <div className="p-4 sm:p-6 rounded-2xl bg-(--bg) border border-(--brd)">
      <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-(--t2)">Завдання</p>
      <p className="font-bold text-sm text-(--t1)">API Auth System</p>
      </div>
      <div className="p-4 sm:p-6 rounded-2xl bg-blue-600/10 border border-blue-600/20">
      <p className="text-[10px] font-black uppercase tracking-wider mb-2 text-blue-600">Статус</p>
      <p className="font-bold text-sm text-blue-600 italic">v2_final.zip</p>
      </div>
      </div>
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 sm:pt-8 border-t border-(--brd)">
      <p className="text-xs font-bold text-(--t2) uppercase tracking-widest italic text-center sm:text-left">Статус: Перевірка...</p>
      <button className="w-full sm:w-auto bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl px-6 sm:px-8 py-4 flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
      <Upload size={16}/> Нова версія
      </button>
      </div>
      </section>
      </div>
      </div>
      </main>
      </div>
  );
}

function NavItem({icon,label,active=false,onClick}:{icon:React.ReactNode;label:string;active?:boolean;onClick:()=>void}){
  return(
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all spr ${active?"bg-blue-600 text-white shadow-lg shadow-blue-600/20":"text-(--t2) hover:bg-(--bg) hover:text-blue-600"}`}>
    {icon}<span>{label}</span>
    </button>
  );
}

function TournamentRow({title,status,statusType,date,isSpecialAction}:{title:string;status:string;statusType:string;date:string;isSpecialAction?:boolean}){
  const colors=({warning:"bg-amber-500/10 text-amber-600 border-amber-500/30",info:"bg-blue-600/10 text-blue-600 border-blue-600/30"} as any)[statusType]??"bg-blue-600/10 text-blue-600 border-blue-600/30";
  return(
    <tr className="transition-colors hover:bg-(--bg)/30">
    <td className="px-4 sm:px-8 py-4 sm:py-5 font-bold text-(--t1)">{title}</td>
    <td className="px-4 sm:px-8 py-4 sm:py-5"><span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded border ${colors}`}>{status}</span></td>
    <td className="px-4 sm:px-8 py-4 sm:py-5 font-bold text-(--t2) text-xs">{date}</td>
    <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
    {isSpecialAction
      ?<button className="font-black text-[9px] uppercase tracking-tighter px-3 py-2 rounded-lg border border-blue-600 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">Реєстрація</button>
      :<button className="p-2 rounded-lg text-(--t2) hover:bg-blue-600/10 hover:text-blue-600 transition-colors"><ExternalLink size={16}/></button>
    }
    </td>
    </tr>
  );
}
